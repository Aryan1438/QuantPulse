// The backtest engine. Pure function: (dataset, strategy) -> BacktestResult.
// No React, no I/O — safe to unit test and safe to later move behind a
// worker thread if datasets grow large.

import { atr } from './indicators';
import {
  evalCondition,
  evalOffset,
  parseStrategyDsl,
  precomputeSeries,
  type ParsedStrategy,
} from './dsl';
import {
  computeEntrySignal,
  evalGroup,
  precomputeBuilderSeries,
  readIndicatorValue,
  requiredWarmupBars,
  type SeriesMap as BuilderSeriesMap,
} from './strategyEngine';
import type {
  BacktestResult,
  BuilderStrategyConfig,
  Candle,
  Dataset,
  EquityPoint,
  Regime,
  Strategy,
  Trade,
  TradeSide,
} from './types';

const STARTING_EQUITY = 100_000;
const BREAKOUT_LOOKBACK = 20;
const WARMUP_BARS = 55; // ensures EMA50/ATR14/etc. are populated

interface OpenPosition {
  side: TradeSide;
  entryTime: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  distance: number;
  riskAmount: number;
  regime: Regime | null;
  units?: number; // set for builder-mode positions sized by fixed unit count
}

function rollingHigh(candles: Candle[], i: number, lookback: number): number {
  let max = -Infinity;
  for (let j = Math.max(0, i - lookback); j < i; j++) max = Math.max(max, candles[j].high);
  return max;
}
function rollingLow(candles: Candle[], i: number, lookback: number): number {
  let min = Infinity;
  for (let j = Math.max(0, i - lookback); j < i; j++) min = Math.min(min, candles[j].low);
  return min;
}

function emptyBreakdown(): BacktestResult['regimeBreakdown'] {
  return {
    bullish: { trades: 0, winRate: 0, pnl: 0 },
    bearish: { trades: 0, winRate: 0, pnl: 0 },
    consolidation: { trades: 0, winRate: 0, pnl: 0 },
    high_volatility: { trades: 0, winRate: 0, pnl: 0 },
  };
}

export class BacktestError extends Error {}

/** Computes the stop-loss and take-profit *distance* (absolute price units
 * away from entry) for a builder-mode entry, per the configured exit
 * modes. Returns null if the configured mode can't be resolved on this bar
 * (e.g. an indicator is still NaN during warmup). */
function builderExitDistances(
  cfg: BuilderStrategyConfig,
  entryPrice: number,
  atr14: number[],
  candles: Candle[],
  i: number,
  series: BuilderSeriesMap,
): { slDistance: number; tpDistance: number } | null {
  let slDistance: number;
  switch (cfg.exit.stopLossMode) {
    case 'atr_multiple': {
      const a = atr14[i];
      if (!Number.isFinite(a) || a <= 0) return null;
      slDistance = a * cfg.exit.stopLossAtrMultiple;
      break;
    }
    case 'fixed_pct':
      slDistance = entryPrice * (cfg.exit.stopLossPct / 100);
      break;
    case 'indicator': {
      if (!cfg.exit.stopLossIndicator) return null;
      const v = readIndicatorValue(cfg.exit.stopLossIndicator, candles, i, series);
      if (v === null) return null;
      slDistance = Math.abs(entryPrice - v);
      break;
    }
  }
  if (!Number.isFinite(slDistance) || slDistance <= 0) return null;

  let tpDistance: number;
  switch (cfg.exit.takeProfitMode) {
    case 'risk_reward':
      tpDistance = slDistance * cfg.exit.takeProfitRR;
      break;
    case 'fixed_pct':
      tpDistance = entryPrice * (cfg.exit.takeProfitPct / 100);
      break;
    case 'indicator': {
      if (!cfg.exit.takeProfitIndicator) return null;
      const v = readIndicatorValue(cfg.exit.takeProfitIndicator, candles, i, series);
      if (v === null) return null;
      tpDistance = Math.abs(v - entryPrice);
      break;
    }
  }
  if (!Number.isFinite(tpDistance) || tpDistance <= 0) return null;

  return { slDistance, tpDistance };
}

export function runBacktest(dataset: Dataset, strategy: Strategy): BacktestResult {
  const candles = dataset.candles;

  const isBuilder = strategy.mode === 'builder';
  const builderCfg = strategy.builder;
  const startingEquity = isBuilder ? builderCfg.initialCapital : STARTING_EQUITY;
  const warmupBars = isBuilder ? Math.max(WARMUP_BARS, requiredWarmupBars(builderCfg)) : WARMUP_BARS;

  if (candles.length < warmupBars + 5) {
    throw new BacktestError(
      `Dataset is too short to backtest (${candles.length} candles). Need at least ${warmupBars + 5}.`,
    );
  }

  const regimeAt = new Map<number, Regime>();
  for (const r of dataset.regimes) regimeAt.set(r.time, r.regime);

  const atr14 = atr(candles, 14);

  let parsedCustom: ParsedStrategy | null = null;
  let customSeries: ReturnType<typeof precomputeSeries> | null = null;
  if (strategy.mode === 'custom') {
    parsedCustom = parseStrategyDsl(strategy.custom.code);
    customSeries = precomputeSeries(candles, parsedCustom);
  }

  let builderSeries: BuilderSeriesMap | null = null;
  if (isBuilder) {
    builderSeries = precomputeBuilderSeries(candles, builderCfg);
  }

  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];
  let equity = startingEquity;
  let peakEquity = startingEquity;
  let position: OpenPosition | null = null;
  let tradeId = 1;

  const riskPct = strategy.mode === 'default' ? strategy.default.riskPerTradePct : strategy.custom.riskPerTradePct;

  for (let i = warmupBars; i < candles.length; i++) {
    const candle = candles[i];
    const regime = regimeAt.get(candle.time) ?? null;

    // ---- Manage open position first ----
    if (position) {
      let exitPrice: number | null = null;
      let exitReason: Trade['exitReason'] = 'end_of_data';

      if (position.side === 'long') {
        const stopHit = candle.low <= position.stopLoss;
        const profitHit = candle.high >= position.takeProfit;
        if (stopHit && profitHit) {
          exitPrice = position.stopLoss; // conservative: assume stop hit first
          exitReason = 'stop_loss';
        } else if (stopHit) {
          exitPrice = position.stopLoss;
          exitReason = 'stop_loss';
        } else if (profitHit) {
          exitPrice = position.takeProfit;
          exitReason = 'take_profit';
        }
      } else {
        const stopHit = candle.high >= position.stopLoss;
        const profitHit = candle.low <= position.takeProfit;
        if (stopHit && profitHit) {
          exitPrice = position.stopLoss;
          exitReason = 'stop_loss';
        } else if (stopHit) {
          exitPrice = position.stopLoss;
          exitReason = 'stop_loss';
        } else if (profitHit) {
          exitPrice = position.takeProfit;
          exitReason = 'take_profit';
        }
      }

      // Builder-mode signal-based exits (indicator exit / opposite-signal
      // exit) only apply if no price-based stop/target was already hit
      // above — a hard SL/TP always takes priority over a soft signal exit.
      if (exitPrice === null && isBuilder && builderSeries) {
        if (builderCfg.exit.oppositeSignalExit) {
          const oppositeGroup = position.side === 'long' ? builderCfg.entryShort : builderCfg.entryLong;
          const oppositeEnabled = builderCfg.direction === 'both'
            || (builderCfg.direction === 'short' && position.side === 'long')
            || (builderCfg.direction === 'long' && position.side === 'short');
          if (oppositeEnabled && oppositeGroup.conditions.length > 0 && evalGroup(oppositeGroup, candles, i, builderSeries)) {
            exitPrice = candle.close;
            exitReason = 'opposite_signal';
          }
        }
      }

      const isLastBar = i === candles.length - 1;
      if (exitPrice === null && isLastBar) {
        exitPrice = candle.close;
        exitReason = 'end_of_data';
      }

      if (exitPrice !== null) {
        let priceMove = position.side === 'long' ? exitPrice - position.entryPrice : position.entryPrice - exitPrice;

        // Builder-mode slippage: exiting is always slightly worse than the
        // quoted price (applied here rather than mutating exitPrice so the
        // trade log still shows the actual triggering price/level).
        if (isBuilder && builderCfg.risk.slippagePct > 0) {
          priceMove -= position.entryPrice * (builderCfg.risk.slippagePct / 100);
        }

        const rMultiple = position.distance > 0 ? priceMove / position.distance : 0;
        let pnl = position.units !== undefined ? priceMove * position.units : position.riskAmount * rMultiple;

        if (isBuilder && builderCfg.risk.commissionPct > 0) {
          const units = position.units ?? (position.distance > 0 ? position.riskAmount / position.distance : 0);
          const notional = units * position.entryPrice;
          pnl -= notional * (builderCfg.risk.commissionPct / 100) * 2; // round trip
        }

        equity += pnl;

        trades.push({
          id: tradeId++,
          entryTime: position.entryTime,
          exitTime: candle.time,
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice,
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
          positionSize: position.units ?? position.riskAmount,
          pnl,
          pnlPct: (pnl / startingEquity) * 100,
          rMultiple,
          result: pnl > 0.01 ? 'win' : pnl < -0.01 ? 'loss' : 'breakeven',
          regime: position.regime,
          exitReason,
        });

        position = null;
      }
    }

    // ---- Look for new entries ----
    if (!position) {
      if (strategy.mode === 'default') {
        const cfg = strategy.default;
        if (regime && cfg.regimes.includes(regime)) {
          const distance = atr14[i] * cfg.stopLossAtrMultiple;
          if (Number.isFinite(distance) && distance > 0) {
            const hh = rollingHigh(candles, i, BREAKOUT_LOOKBACK);
            const ll = rollingLow(candles, i, BREAKOUT_LOOKBACK);

            if (candle.close > hh) {
              const entryPrice = candle.close;
              position = {
                side: 'long',
                entryTime: candle.time,
                entryPrice,
                stopLoss: entryPrice - distance,
                takeProfit: entryPrice + distance * cfg.takeProfitRR,
                distance,
                riskAmount: equity * (cfg.riskPerTradePct / 100),
                regime,
              };
            } else if (candle.close < ll) {
              const entryPrice = candle.close;
              position = {
                side: 'short',
                entryTime: candle.time,
                entryPrice,
                stopLoss: entryPrice + distance,
                takeProfit: entryPrice - distance * cfg.takeProfitRR,
                distance,
                riskAmount: equity * (cfg.riskPerTradePct / 100),
                regime,
              };
            }
          }
        }
      } else if (parsedCustom && customSeries) {
        if (evalCondition(parsedCustom, candles, i, customSeries)) {
          const entryPrice = candle.close;
          const slOffset = evalOffset(parsedCustom.stopLoss, candles, i, customSeries) ?? atr14[i] * 1.5;
          const tpOffset = evalOffset(parsedCustom.takeProfit, candles, i, customSeries) ?? atr14[i] * 3;
          const distance = Math.abs(slOffset);

          if (Number.isFinite(distance) && distance > 0) {
            const side = parsedCustom.side;
            position = {
              side,
              entryTime: candle.time,
              entryPrice,
              stopLoss: side === 'long' ? entryPrice - distance : entryPrice + distance,
              takeProfit: side === 'long' ? entryPrice + Math.abs(tpOffset) : entryPrice - Math.abs(tpOffset),
              distance,
              riskAmount: equity * (riskPct / 100),
              regime,
            };
          }
        }
      } else if (isBuilder && builderSeries) {
        const signal = computeEntrySignal(builderCfg, candles, i, builderSeries);
        if (signal) {
          const rawEntryPrice = candle.close;
          // Slippage makes entries slightly worse than the quoted price.
          const slip = builderCfg.risk.slippagePct / 100;
          const entryPrice = signal === 'long' ? rawEntryPrice * (1 + slip) : rawEntryPrice * (1 - slip);

          const distances = builderExitDistances(builderCfg, entryPrice, atr14, candles, i, builderSeries);
          if (distances) {
            const { slDistance, tpDistance } = distances;
            const units = builderCfg.risk.positionSizingMode === 'fixed_size'
              ? builderCfg.risk.fixedPositionSize
              : (equity * (builderCfg.risk.riskPerTradePct / 100)) / slDistance;

            position = {
              side: signal,
              entryTime: candle.time,
              entryPrice,
              stopLoss: signal === 'long' ? entryPrice - slDistance : entryPrice + slDistance,
              takeProfit: signal === 'long' ? entryPrice + tpDistance : entryPrice - tpDistance,
              distance: slDistance,
              riskAmount: equity * (builderCfg.risk.riskPerTradePct / 100),
              regime,
              units: builderCfg.risk.positionSizingMode === 'fixed_size' ? units : undefined,
            };
          }
        }
      }
    }

    peakEquity = Math.max(peakEquity, equity);
    const drawdownPct = peakEquity > 0 ? ((equity - peakEquity) / peakEquity) * 100 : 0;
    equityCurve.push({ time: candle.time, equity, drawdownPct });
  }

  // ---- Aggregate stats ----
  const wins = trades.filter((t) => t.result === 'win');
  const losses = trades.filter((t) => t.result === 'loss');
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = losses.reduce((s, t) => s + t.pnl, 0);
  const netProfit = equity - startingEquity;
  const totalReturnPct = (netProfit / startingEquity) * 100;
  const maxDrawdownPct = equityCurve.length ? Math.min(...equityCurve.map((p) => p.drawdownPct)) : 0;
  const winRatePct = trades.length ? (wins.length / trades.length) * 100 : 0;
  const profitFactor = grossLoss !== 0 ? grossProfit / Math.abs(grossLoss) : grossProfit > 0 ? Infinity : 0;

  const returns = trades.map((t) => t.pnlPct);
  const meanReturn = returns.length ? returns.reduce((s, r) => s + r, 0) / returns.length : 0;
  const variance = returns.length > 1
    ? returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (returns.length - 1)
    : 0;
  const stdReturn = Math.sqrt(variance);
  const sharpeApprox = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

  const regimeBreakdown = emptyBreakdown();
  for (const t of trades) {
    if (!t.regime) continue;
    const bucket = regimeBreakdown[t.regime];
    bucket.trades += 1;
    bucket.pnl += t.pnl;
  }
  (Object.keys(regimeBreakdown) as Regime[]).forEach((r) => {
    const bucket = regimeBreakdown[r];
    const regimeTrades = trades.filter((t) => t.regime === r);
    const regimeWins = regimeTrades.filter((t) => t.result === 'win').length;
    bucket.winRate = regimeTrades.length ? (regimeWins / regimeTrades.length) * 100 : 0;
  });

  return {
    trades,
    equityCurve,
    totalReturnPct,
    maxDrawdownPct,
    winRatePct,
    totalTrades: trades.length,
    profitFactor,
    netProfit,
    sharpeApprox,
    regimeBreakdown,
    strategyId: strategy.id,
    datasetId: dataset.id,
    runAt: Date.now(),
  };
}
