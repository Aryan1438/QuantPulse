import { describe, expect, it } from 'vitest';
import {
  buildComparisonChartData,
  MAX_COMPARISON_SELECTION,
  normalizeEquityCurve,
  rankByReturn,
  startingEquityOf,
  toComparisonRow,
} from '../comparison';
import type { BacktestResult, RunHistoryEntry } from '../types';

function makeResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  const equityCurve = overrides.equityCurve ?? [
    { time: 1000, equity: 100_000, drawdownPct: 0 },
    { time: 2000, equity: 105_000, drawdownPct: 0 },
    { time: 3000, equity: 110_000, drawdownPct: 0 },
  ];
  return {
    trades: [],
    equityCurve,
    totalReturnPct: 10,
    maxDrawdownPct: -2,
    winRatePct: 55,
    totalTrades: 4,
    profitFactor: 1.8,
    netProfit: 10_000,
    sharpeApprox: 1.2,
    regimeBreakdown: {
      bullish: { trades: 0, winRate: 0, pnl: 0 },
      bearish: { trades: 0, winRate: 0, pnl: 0 },
      consolidation: { trades: 0, winRate: 0, pnl: 0 },
      high_volatility: { trades: 0, winRate: 0, pnl: 0 },
    },
    strategyId: 'strat-1',
    datasetId: 'ds-1',
    runAt: Date.now(),
    ...overrides,
  };
}

function makeEntry(id: string, overrides: Partial<BacktestResult> = {}): RunHistoryEntry {
  return {
    id,
    strategyName: `Strategy ${id}`,
    strategyMode: 'builder',
    datasetName: 'Test Dataset',
    datasetSymbol: 'TEST/USD',
    result: makeResult(overrides),
  };
}

describe('startingEquityOf', () => {
  it('recovers starting equity from final equity minus net profit', () => {
    const result = makeResult({ netProfit: 10_000 }); // final equity 110,000
    expect(startingEquityOf(result)).toBeCloseTo(100_000, 6);
  });

  it('handles negative netProfit correctly', () => {
    const result = makeResult({
      netProfit: -5_000,
      equityCurve: [{ time: 1, equity: 95_000, drawdownPct: -5 }],
    });
    expect(startingEquityOf(result)).toBeCloseTo(100_000, 6);
  });
});

describe('normalizeEquityCurve', () => {
  it('rescales equity to % return from starting capital', () => {
    const result = makeResult();
    const normalized = normalizeEquityCurve(result);
    expect(normalized[0].returnPct).toBeCloseTo(0, 6);
    expect(normalized[1].returnPct).toBeCloseTo(5, 6);
    expect(normalized[2].returnPct).toBeCloseTo(10, 6);
  });

  it('preserves time values', () => {
    const result = makeResult();
    const normalized = normalizeEquityCurve(result);
    expect(normalized.map((p) => p.time)).toEqual([1000, 2000, 3000]);
  });

  it('returns zeros rather than throwing when starting equity is non-positive', () => {
    const result = makeResult({ netProfit: 100_000, equityCurve: [{ time: 1, equity: 100_000, drawdownPct: 0 }] });
    const normalized = normalizeEquityCurve(result);
    expect(normalized.every((p) => p.returnPct === 0)).toBe(true);
  });
});

describe('toComparisonRow / rankByReturn', () => {
  it('maps a RunHistoryEntry to a flat comparison row', () => {
    const entry = makeEntry('run-a', { totalReturnPct: 12.5 });
    const row = toComparisonRow(entry);
    expect(row.id).toBe('run-a');
    expect(row.label).toBe('Strategy run-a');
    expect(row.totalReturnPct).toBe(12.5);
  });

  it('ranks rows by total return, best first', () => {
    const rows = [
      toComparisonRow(makeEntry('low', { totalReturnPct: 2 })),
      toComparisonRow(makeEntry('high', { totalReturnPct: 20 })),
      toComparisonRow(makeEntry('mid', { totalReturnPct: 10 })),
    ];
    const ranked = rankByReturn(rows);
    expect(ranked.map((r) => r.id)).toEqual(['high', 'mid', 'low']);
  });

  it('does not mutate the input array', () => {
    const rows = [toComparisonRow(makeEntry('a', { totalReturnPct: 1 })), toComparisonRow(makeEntry('b', { totalReturnPct: 2 }))];
    const original = [...rows];
    rankByReturn(rows);
    expect(rows).toEqual(original);
  });
});

describe('buildComparisonChartData', () => {
  it('produces one row per 2% progress step with a field per run', () => {
    const entries = [makeEntry('a'), makeEntry('b')];
    const data = buildComparisonChartData(entries);
    expect(data.length).toBe(51); // 0,2,4,...,100
    expect(data[0]).toHaveProperty('a');
    expect(data[0]).toHaveProperty('b');
    expect(data[0].progressPct).toBe(0);
    expect(data[data.length - 1].progressPct).toBe(100);
  });

  it('the last row reflects each run own total return', () => {
    const entries = [makeEntry('a', { totalReturnPct: 10, netProfit: 10_000 })];
    const data = buildComparisonChartData(entries);
    expect(data[data.length - 1].a).toBeCloseTo(10, 6);
  });

  it('returns an empty-runs-safe shape with zero entries selected', () => {
    const data = buildComparisonChartData([]);
    expect(data.length).toBe(51);
    expect(Object.keys(data[0])).toEqual(['progressPct']);
  });
});

describe('MAX_COMPARISON_SELECTION', () => {
  it('is a small, sane cap', () => {
    expect(MAX_COMPARISON_SELECTION).toBeGreaterThanOrEqual(2);
    expect(MAX_COMPARISON_SELECTION).toBeLessThanOrEqual(10);
  });
});
