import { describe, expect, it } from 'vitest';
import type { Candle, ConditionGroup } from '../types';
import { computeEntrySignal, evalGroup, precomputeBuilderSeries, validateBuilderStrategy } from '../strategyEngine';
import { makeDefaultBuilderConfig } from '../../state/store';

function makeCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: 1_700_000_000 + i * 3600,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  }));
}

describe('evalGroup', () => {
  const candles = makeCandles([10, 20, 30]);

  it('AND requires every condition to hold', () => {
    const group: ConditionGroup = {
      combinator: 'AND',
      conditions: [
        { id: 'a', left: { type: 'price', field: 'close' }, operator: '>', right: { type: 'constant', value: 5 } },
        { id: 'b', left: { type: 'price', field: 'close' }, operator: '<', right: { type: 'constant', value: 100 } },
      ],
    };
    expect(evalGroup(group, candles, 1, new Map())).toBe(true);
  });

  it('AND fails if any condition fails', () => {
    const group: ConditionGroup = {
      combinator: 'AND',
      conditions: [
        { id: 'a', left: { type: 'price', field: 'close' }, operator: '>', right: { type: 'constant', value: 5 } },
        { id: 'b', left: { type: 'price', field: 'close' }, operator: '>', right: { type: 'constant', value: 1000 } },
      ],
    };
    expect(evalGroup(group, candles, 1, new Map())).toBe(false);
  });

  it('OR succeeds if any condition holds', () => {
    const group: ConditionGroup = {
      combinator: 'OR',
      conditions: [
        { id: 'a', left: { type: 'price', field: 'close' }, operator: '>', right: { type: 'constant', value: 1000 } },
        { id: 'b', left: { type: 'price', field: 'close' }, operator: '>', right: { type: 'constant', value: 5 } },
      ],
    };
    expect(evalGroup(group, candles, 1, new Map())).toBe(true);
  });

  it('an empty group never fires', () => {
    expect(evalGroup({ combinator: 'AND', conditions: [] }, candles, 0, new Map())).toBe(false);
  });
});

describe('crossover detection', () => {
  // A fast series that ramps from below to above a flat slow series,
  // so a crossover happens at a known bar.
  const candles = makeCandles([10, 10, 10, 10, 10]);
  const fast = [1, 2, 3, 4, 5];
  const slow = [3, 3, 3, 3, 3];
  const series = new Map<string, number[]>([
    ['EMA(1)', fast],
    ['EMA(2)', slow],
  ]);

  const group: ConditionGroup = {
    combinator: 'AND',
    conditions: [
      {
        id: 'cross',
        left: { type: 'indicator', indicator: { kind: 'EMA', period: 1 } },
        operator: 'crosses_above',
        right: { type: 'indicator', indicator: { kind: 'EMA', period: 2 } },
      },
    ],
  };

  it('does not fire before the cross', () => {
    expect(evalGroup(group, candles, 1, series)).toBe(false); // fast=2 vs slow=3
  });

  it('fires exactly on the bar the fast series overtakes the slow one', () => {
    expect(evalGroup(group, candles, 3, series)).toBe(true); // prev fast=3<=slow=3, now fast=4>slow=3
  });

  it('does not fire again once already above', () => {
    expect(evalGroup(group, candles, 4, series)).toBe(false); // prev fast=4 already > slow=3
  });
});

describe('computeEntrySignal + direction gating', () => {
  const config = makeDefaultBuilderConfig();
  const candles = makeCandles(Array.from({ length: 60 }, (_, i) => 100 + i));
  const series = precomputeBuilderSeries(candles, config);

  it('respects the configured direction (long-only ignores short conditions)', () => {
    config.direction = 'long';
    // Even at an index where signal could theoretically be short, direction gating means only 'long' or null is possible.
    for (let i = 0; i < candles.length; i++) {
      const signal = computeEntrySignal(config, candles, i, series);
      expect(signal === 'long' || signal === null).toBe(true);
    }
  });
});

describe('validateBuilderStrategy', () => {
  it('accepts the default builder config', () => {
    const result = validateBuilderStrategy(makeDefaultBuilderConfig());
    expect(result.valid).toBe(true);
  });

  it('rejects an empty long-entry group when direction includes long', () => {
    const cfg = makeDefaultBuilderConfig();
    cfg.direction = 'long';
    cfg.entryLong.conditions = [];
    const result = validateBuilderStrategy(cfg);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.some((e) => e.includes('Long entry'))).toBe(true);
  });

  it('rejects a non-positive risk-per-trade percentage', () => {
    const cfg = makeDefaultBuilderConfig();
    cfg.risk.riskPerTradePct = 0;
    const result = validateBuilderStrategy(cfg);
    expect(result.valid).toBe(false);
  });

  it('rejects an ATR stop-loss multiple of zero', () => {
    const cfg = makeDefaultBuilderConfig();
    cfg.exit.stopLossMode = 'atr_multiple';
    cfg.exit.stopLossAtrMultiple = 0;
    const result = validateBuilderStrategy(cfg);
    expect(result.valid).toBe(false);
  });

  it('rejects two constant operands in the same condition', () => {
    const cfg = makeDefaultBuilderConfig();
    cfg.entryLong.conditions = [
      { id: 'c1', left: { type: 'constant', value: 1 }, operator: '>', right: { type: 'constant', value: 0 } },
    ];
    const result = validateBuilderStrategy(cfg);
    expect(result.valid).toBe(false);
  });
});
