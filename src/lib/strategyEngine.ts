// Phase 2 — Strategy Engine.
//
// This module is the structured-config counterpart to dsl.ts: instead of
// parsing a text DSL, it evaluates a BuilderStrategyConfig (built by the
// Strategy page's visual condition builder) against precomputed indicator
// series. It deliberately mirrors dsl.ts's two-phase shape (precompute
// series once, then O(1)-per-node evaluation per bar) so the two engines
// stay easy to reason about side by side.
//
// This file has zero React dependency and produces only data — the actual
// trade simulation loop still lives in backtestEngine.ts, which calls into
// here for signal + exit-distance evaluation.

import { atr, bollingerBands, ema, macd, rsi, sma, vwap } from './indicators';
import { getHistoricalCandles } from './mtf';
import { TIMEFRAME_SECONDS } from './types';
import type {
  BuilderStrategyConfig,
  Candle,
  ConditionGroup,
  ConditionOperator,
  IndicatorRef,
  Operand,
  RuleCondition,
  TradeDirection,
  Dataset,
  Timeframe,
} from './types';

// ---------------------------------------------------------------------------
// Series precomputation
// ---------------------------------------------------------------------------

export type SeriesMap = Map<string, number[]>;

function indicatorKey(ref: IndicatorRef): string {
  const period = ref.kind.startsWith('MACD') ? 'std' : ref.kind.startsWith('BB') ? ref.period : ref.period;
  return ref.timeframe ? `${ref.kind}(${period})@${ref.timeframe}` : `${ref.kind}(${period})`;
}

function collectIndicatorRefs(group: ConditionGroup, refs: Map<string, IndicatorRef>) {
  for (const cond of group.conditions) {
    for (const operand of [cond.left, cond.right]) {
      if (operand.type === 'indicator' && operand.indicator) {
        refs.set(indicatorKey(operand.indicator), operand.indicator);
      }
    }
  }
}

export function precomputeBuilderSeries(candles: Candle[], config: BuilderStrategyConfig): SeriesMap {
  const refs = new Map<string, IndicatorRef>();
  collectIndicatorRefs(config.entryLong, refs);
  collectIndicatorRefs(config.entryShort, refs);
  if (config.exit.stopLossIndicator) refs.set(indicatorKey(config.exit.stopLossIndicator), config.exit.stopLossIndicator);
  if (config.exit.takeProfitIndicator) refs.set(indicatorKey(config.exit.takeProfitIndicator), config.exit.takeProfitIndicator);

  const map: SeriesMap = new Map();

  // MACD and Bollinger Bands each produce three related series computed
  // together — cache the tuple once per config rather than per-key.
  let macdResult: ReturnType<typeof macd> | null = null;
  const bbCache = new Map<number, ReturnType<typeof bollingerBands>>();

  for (const ref of refs.values()) {
    const key = indicatorKey(ref);
    if (map.has(key)) continue;
    switch (ref.kind) {
      case 'SMA': map.set(key, sma(candles, ref.period)); break;
      case 'EMA': map.set(key, ema(candles, ref.period)); break;
      case 'RSI': map.set(key, rsi(candles, ref.period)); break;
      case 'ATR': map.set(key, atr(candles, ref.period)); break;
      case 'VWAP': map.set(key, vwap(candles, ref.period)); break;
      case 'MACD_LINE':
      case 'MACD_SIGNAL':
      case 'MACD_HIST': {
        if (!macdResult) macdResult = macd(candles);
        map.set(indicatorKey({ kind: 'MACD_LINE', period: 0 }), macdResult.line);
        map.set(indicatorKey({ kind: 'MACD_SIGNAL', period: 0 }), macdResult.signal);
        map.set(indicatorKey({ kind: 'MACD_HIST', period: 0 }), macdResult.histogram);
        break;
      }
      case 'BB_UPPER':
      case 'BB_MIDDLE':
      case 'BB_LOWER': {
        let bb = bbCache.get(ref.period);
        if (!bb) {
          bb = bollingerBands(candles, ref.period);
          bbCache.set(ref.period, bb);
        }
        map.set(indicatorKey({ kind: 'BB_UPPER', period: ref.period }), bb.upper);
        map.set(indicatorKey({ kind: 'BB_MIDDLE', period: ref.period }), bb.middle);
        map.set(indicatorKey({ kind: 'BB_LOWER', period: ref.period }), bb.lower);
        break;
      }
    }
  }

  return map;
}

/** Largest lookback period referenced anywhere in the config, used by the
 * backtest engine to size its warmup window so indicators aren't NaN. */
export function requiredWarmupBars(config: BuilderStrategyConfig): number {
  const refs = new Map<string, IndicatorRef>();
  collectIndicatorRefs(config.entryLong, refs);
  collectIndicatorRefs(config.entryShort, refs);
  if (config.exit.stopLossIndicator) refs.set(indicatorKey(config.exit.stopLossIndicator), config.exit.stopLossIndicator);
  if (config.exit.takeProfitIndicator) refs.set(indicatorKey(config.exit.takeProfitIndicator), config.exit.takeProfitIndicator);

  let max = 20; // sane floor even with no indicators referenced
  for (const ref of refs.values()) {
    if (ref.kind === 'MACD_LINE' || ref.kind === 'MACD_SIGNAL' || ref.kind === 'MACD_HIST') max = Math.max(max, 26 + 9);
    else max = Math.max(max, ref.period);
  }
  return max + 5;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function readOperand(operand: Operand, candles: Candle[], i: number, series: SeriesMap): number {
  switch (operand.type) {
    case 'constant':
      return operand.value ?? NaN;
    case 'price':
      return operand.field ? (candles[i][operand.field] as number) : NaN;
    case 'indicator': {
      if (!operand.indicator) return NaN;
      const arr = series.get(indicatorKey(operand.indicator));
      return arr ? arr[i] : NaN;
    }
    default:
      return NaN;
  }
}

function compare(op: ConditionOperator, l: number, r: number): boolean {
  switch (op) {
    case '>': return l > r;
    case '<': return l < r;
    case '>=': return l >= r;
    case '<=': return l <= r;
    case '==': return Math.abs(l - r) < 1e-9;
    default: return false;
  }
}

function evalCondition(cond: RuleCondition, candles: Candle[], i: number, series: SeriesMap): boolean {
  if (cond.operator === 'crosses_above' || cond.operator === 'crosses_below') {
    if (i < 1) return false;
    const lNow = readOperand(cond.left, candles, i, series);
    const rNow = readOperand(cond.right, candles, i, series);
    const lPrev = readOperand(cond.left, candles, i - 1, series);
    const rPrev = readOperand(cond.right, candles, i - 1, series);
    if (![lNow, rNow, lPrev, rPrev].every(Number.isFinite)) return false;
    return cond.operator === 'crosses_above'
      ? lPrev <= rPrev && lNow > rNow
      : lPrev >= rPrev && lNow < rNow;
  }
  const l = readOperand(cond.left, candles, i, series);
  const r = readOperand(cond.right, candles, i, series);
  if (!Number.isFinite(l) || !Number.isFinite(r)) return false;
  return compare(cond.operator, l, r);
}

export function evalGroup(group: ConditionGroup, candles: Candle[], i: number, series: SeriesMap): boolean {
  if (group.conditions.length === 0) return false;
  return group.combinator === 'AND'
    ? group.conditions.every((c) => evalCondition(c, candles, i, series))
    : group.conditions.some((c) => evalCondition(c, candles, i, series));
}

/** Returns the entry signal (if any) for this bar, respecting the
 * configured trade direction. When direction is 'both' and both groups
 * fire on the same bar, long takes priority (documented limitation). */
export function computeEntrySignal(
  config: BuilderStrategyConfig,
  candles: Candle[],
  i: number,
  series: SeriesMap,
): 'long' | 'short' | null {
  const dir: TradeDirection = config.direction;
  const longOk = (dir === 'long' || dir === 'both') && evalGroup(config.entryLong, candles, i, series);
  if (longOk) return 'long';
  const shortOk = (dir === 'short' || dir === 'both') && evalGroup(config.entryShort, candles, i, series);
  if (shortOk) return 'short';
  return null;
}

function collectTimeframes(group: ConditionGroup, set: Set<Timeframe>) {
  for (const condition of group.conditions) {
    for (const operand of [condition.left, condition.right]) {
      if (operand.timeframe) set.add(operand.timeframe);
      if (operand.indicator?.timeframe) set.add(operand.indicator.timeframe);
    }
  }
}

export function hasMtfConditions(config: BuilderStrategyConfig): boolean {
  const timeframes = new Set<Timeframe>();
  collectTimeframes(config.entryLong, timeframes);
  collectTimeframes(config.entryShort, timeframes);
  return timeframes.size > 0;
}

function projectSeries(source: Candle[], values: number[], executionCandles: Candle[], timeframe: Timeframe, executionTimeframe?: Timeframe): number[] {
  const out = new Array(executionCandles.length).fill(NaN);
  let sourceIndex = -1;
  for (let i = 0; i < executionCandles.length; i++) {
    const available = getHistoricalCandles(
      { id: '', name: '', symbol: '', assetType: '', candles: source, builderTimeframe: timeframe, regimes: [], createdAt: 0 },
      timeframe,
      executionCandles[i].time + TIMEFRAME_SECONDS[executionTimeframe ?? 'M1'],
    );
    sourceIndex = available.length - 1;
    if (sourceIndex >= 0) out[i] = values[sourceIndex];
  }
  return out;
}

function projectedCandleValues(source: Candle[], executionCandles: Candle[], timeframe: Timeframe, executionTimeframe?: Timeframe): Map<string, number[]> {
  const fields = new Map<string, number[]>();
  for (const field of ['open', 'high', 'low', 'close', 'volume'] as const) {
    fields.set(field, projectSeries(source, source.map((candle) => candle[field]), executionCandles, timeframe, executionTimeframe));
  }
  return fields;
}

/** Precomputes timeframe-isolated indicators and projects only completed
 * values onto the lowest selected execution timeline. */
export function precomputeMtfBuilderSeries(dataset: Dataset, executionCandles: Candle[], config: BuilderStrategyConfig): SeriesMap {
  const refs = new Map<string, IndicatorRef>();
  collectIndicatorRefs(config.entryLong, refs);
  collectIndicatorRefs(config.entryShort, refs);
  const timeframes = new Set<Timeframe>();
  collectTimeframes(config.entryLong, timeframes);
  collectTimeframes(config.entryShort, timeframes);
  for (const ref of refs.values()) if (ref.timeframe) timeframes.add(ref.timeframe);
  timeframes.add(config.executionTimeframe ?? dataset.builderTimeframe ?? 'H1');

  const map: SeriesMap = new Map();
  for (const timeframe of timeframes) {
    const source = dataset.timeframes?.[timeframe];
    if (!source) continue;
    const timeframeRefs = [...refs.values()].filter((ref) => (ref.timeframe ?? config.executionTimeframe) === timeframe);
    let macdResult: ReturnType<typeof macd> | null = null;
    const bbCache = new Map<number, ReturnType<typeof bollingerBands>>();
    for (const ref of timeframeRefs) {
      const key = indicatorKey(ref);
      switch (ref.kind) {
        case 'SMA': map.set(key, projectSeries(source, sma(source, ref.period), executionCandles, timeframe, config.executionTimeframe)); break;
        case 'EMA': map.set(key, projectSeries(source, ema(source, ref.period), executionCandles, timeframe, config.executionTimeframe)); break;
        case 'RSI': map.set(key, projectSeries(source, rsi(source, ref.period), executionCandles, timeframe, config.executionTimeframe)); break;
        case 'ATR': map.set(key, projectSeries(source, atr(source, ref.period), executionCandles, timeframe, config.executionTimeframe)); break;
        case 'VWAP': map.set(key, projectSeries(source, vwap(source, ref.period), executionCandles, timeframe, config.executionTimeframe)); break;
        case 'MACD_LINE':
        case 'MACD_SIGNAL':
        case 'MACD_HIST':
          macdResult ??= macd(source);
          map.set(key, projectSeries(source, macdResult[ref.kind === 'MACD_LINE' ? 'line' : ref.kind === 'MACD_SIGNAL' ? 'signal' : 'histogram'], executionCandles, timeframe, config.executionTimeframe));
          break;
        case 'BB_UPPER':
        case 'BB_MIDDLE':
        case 'BB_LOWER':
          if (!bbCache.has(ref.period)) bbCache.set(ref.period, bollingerBands(source, ref.period));
          map.set(key, projectSeries(source, bbCache.get(ref.period)![ref.kind === 'BB_UPPER' ? 'upper' : ref.kind === 'BB_MIDDLE' ? 'middle' : 'lower'], executionCandles, timeframe, config.executionTimeframe));
          break;
      }
    }
    const prices = projectedCandleValues(source, executionCandles, timeframe, config.executionTimeframe);
    for (const [field, values] of prices) map.set(`PRICE(${field})@${timeframe}`, values);
  }
  return map;
}

export function computeMtfEntrySignal(config: BuilderStrategyConfig, i: number, series: SeriesMap): 'long' | 'short' | null {
  const evalMtfGroup = (group: ConditionGroup): boolean => {
    if (!group.conditions.length) return false;
    const read = (operand: Operand): number => {
      if (operand.type === 'constant') return operand.value ?? NaN;
      if (operand.type === 'price') return series.get(`PRICE(${operand.field})@${operand.timeframe ?? config.executionTimeframe}`)?.[i] ?? NaN;
      return series.get(indicatorKey(operand.indicator!))?.[i] ?? NaN;
    };
    const evaluateCondition = (condition: RuleCondition): boolean => {
      const left = read(condition.left);
      const right = read(condition.right);
      if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
      if (condition.operator === 'crosses_above' || condition.operator === 'crosses_below') {
        if (i < 1) return false;
        const previousLeft = readAt(condition.left, i - 1, series, config.executionTimeframe);
        const previousRight = readAt(condition.right, i - 1, series, config.executionTimeframe);
        return condition.operator === 'crosses_above' ? previousLeft <= previousRight && left > right : previousLeft >= previousRight && left < right;
      }
      return compare(condition.operator, left, right);
    };
    return group.combinator === 'AND'
      ? group.conditions.every(evaluateCondition)
      : group.conditions.some(evaluateCondition);
  };
  if ((config.direction === 'long' || config.direction === 'both') && evalMtfGroup(config.entryLong)) return 'long';
  if ((config.direction === 'short' || config.direction === 'both') && evalMtfGroup(config.entryShort)) return 'short';
  return null;
}

function readAt(operand: Operand, index: number, series: SeriesMap, executionTimeframe?: Timeframe): number {
  if (operand.type === 'constant') return operand.value ?? NaN;
  if (operand.type === 'price') return series.get(`PRICE(${operand.field})@${operand.timeframe ?? executionTimeframe}`)?.[index] ?? NaN;
  return series.get(indicatorKey(operand.indicator!))?.[index] ?? NaN;
}

export function readIndicatorValue(ref: IndicatorRef, _candles: Candle[], i: number, series: SeriesMap): number | null {
  const arr = series.get(indicatorKey(ref));
  const v = arr ? arr[i] : NaN;
  return Number.isFinite(v) ? v : null;
}

// ---------------------------------------------------------------------------
// Validation — surfaced in the Strategy Builder UI before a backtest runs.
// ---------------------------------------------------------------------------

function validateOperand(operand: Operand, path: string, errors: string[]) {
  if (operand.type === 'constant' && (operand.value === undefined || Number.isNaN(operand.value))) {
    errors.push(`${path}: constant value is missing.`);
  }
  if (operand.type === 'price' && !operand.field) {
    errors.push(`${path}: price field is missing.`);
  }
  if (operand.type === 'indicator') {
    if (!operand.indicator) {
      errors.push(`${path}: indicator is missing.`);
    } else if (!operand.indicator.kind.startsWith('MACD') && !operand.indicator.kind.startsWith('BB') && (!operand.indicator.period || operand.indicator.period < 1)) {
      errors.push(`${path}: indicator period must be a positive number.`);
    } else if (operand.indicator.kind.startsWith('BB') && (!operand.indicator.period || operand.indicator.period < 1)) {
      errors.push(`${path}: Bollinger Band period must be a positive number.`);
    }
  }
}

function validateGroup(group: ConditionGroup, label: string, errors: string[]) {
  if (group.conditions.length === 0) {
    errors.push(`${label}: add at least one condition.`);
    return;
  }
  group.conditions.forEach((cond, idx) => {
    validateOperand(cond.left, `${label} condition #${idx + 1} (left side)`, errors);
    validateOperand(cond.right, `${label} condition #${idx + 1} (right side)`, errors);
    if (cond.left.type === 'constant' && cond.right.type === 'constant') {
      errors.push(`${label} condition #${idx + 1}: both sides are constants — this never changes.`);
    }
  });
}

export function validateBuilderStrategy(config: BuilderStrategyConfig): { valid: true } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (config.direction === 'long' || config.direction === 'both') {
    validateGroup(config.entryLong, 'Long entry', errors);
  }
  if (config.direction === 'short' || config.direction === 'both') {
    validateGroup(config.entryShort, 'Short entry', errors);
  }

  if (config.exit.stopLossMode === 'atr_multiple' && config.exit.stopLossAtrMultiple <= 0) {
    errors.push('Stop loss: ATR multiple must be greater than 0.');
  }
  if (config.exit.stopLossMode === 'fixed_pct' && config.exit.stopLossPct <= 0) {
    errors.push('Stop loss: fixed percent must be greater than 0.');
  }
  if (config.exit.stopLossMode === 'indicator' && !config.exit.stopLossIndicator) {
    errors.push('Stop loss: select an indicator to base the stop distance on.');
  }

  if (config.exit.takeProfitMode === 'risk_reward' && config.exit.takeProfitRR <= 0) {
    errors.push('Take profit: reward:risk ratio must be greater than 0.');
  }
  if (config.exit.takeProfitMode === 'fixed_pct' && config.exit.takeProfitPct <= 0) {
    errors.push('Take profit: fixed percent must be greater than 0.');
  }
  if (config.exit.takeProfitMode === 'indicator' && !config.exit.takeProfitIndicator) {
    errors.push('Take profit: select an indicator to base the target distance on.');
  }

  if (config.risk.positionSizingMode === 'risk_pct' && (config.risk.riskPerTradePct <= 0 || config.risk.riskPerTradePct > 100)) {
    errors.push('Risk per trade must be between 0 and 100%.');
  }
  if (config.risk.positionSizingMode === 'fixed_size' && config.risk.fixedPositionSize <= 0) {
    errors.push('Fixed position size must be greater than 0.');
  }
  if (config.risk.commissionPct < 0) errors.push('Commission cannot be negative.');
  if (config.risk.slippagePct < 0) errors.push('Slippage cannot be negative.');
  if (config.initialCapital <= 0) errors.push('Initial capital must be greater than 0.');

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
