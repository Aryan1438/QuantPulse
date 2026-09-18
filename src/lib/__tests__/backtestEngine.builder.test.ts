import { describe, expect, it } from 'vitest';
import { runBacktest } from '../backtestEngine';
import { generateSampleCandles } from '../sampleData';
import { classifyRegimes } from '../regime';
import { makeDefaultBuilderConfig } from '../../state/store';
import type { Dataset, Strategy } from '../types';

function makeDataset(count = 500): Dataset {
  const candles = generateSampleCandles(count, 42000);
  return {
    id: 'ds-test',
    name: 'Test Dataset',
    symbol: 'TEST/USD',
    assetType: 'Crypto',
    candles,
    regimes: classifyRegimes(candles),
    createdAt: Date.now(),
  };
}

function baseStrategy(): Strategy {
  return {
    id: 'strategy-test',
    name: 'Test Strategy',
    mode: 'default',
    default: { regimes: ['bullish', 'bearish'], riskPerTradePct: 1, stopLossAtrMultiple: 1.5, takeProfitRR: 2 },
    custom: { code: 'IF close > EMA(20) THEN\nENTER long\nSTOP_LOSS = ATR(14) * 1.5\nTAKE_PROFIT = ATR(14) * 3', riskPerTradePct: 1 },
    builder: makeDefaultBuilderConfig(),
    createdAt: Date.now(),
  };
}

describe('runBacktest — regression: existing modes still work', () => {
  it('default mode still produces a valid result', () => {
    const strategy = baseStrategy();
    strategy.mode = 'default';
    const result = runBacktest(makeDataset(), strategy);
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(Number.isFinite(result.totalReturnPct)).toBe(true);
  });

  it('custom DSL mode still produces a valid result', () => {
    const strategy = baseStrategy();
    strategy.mode = 'custom';
    const result = runBacktest(makeDataset(), strategy);
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(Number.isFinite(result.totalReturnPct)).toBe(true);
  });
});

describe('runBacktest — builder mode (Phase 2)', () => {
  it('runs an EMA crossover strategy end-to-end and produces trades', () => {
    const strategy = baseStrategy();
    strategy.mode = 'builder';
    strategy.builder.direction = 'both';
    const result = runBacktest(makeDataset(), strategy);

    expect(result.strategyId).toBe(strategy.id);
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(Number.isFinite(result.totalReturnPct)).toBe(true);
    expect(Number.isFinite(result.maxDrawdownPct)).toBe(true);
    // Every trade should carry a builder-appropriate exit reason.
    for (const t of result.trades) {
      expect(['stop_loss', 'take_profit', 'end_of_data', 'opposite_signal', 'indicator_exit']).toContain(t.exitReason);
    }
  });

  it('long-only direction never opens a short position', () => {
    const strategy = baseStrategy();
    strategy.mode = 'builder';
    strategy.builder.direction = 'long';
    const result = runBacktest(makeDataset(), strategy);
    expect(result.trades.every((t) => t.side === 'long')).toBe(true);
  });

  it('short-only direction never opens a long position', () => {
    const strategy = baseStrategy();
    strategy.mode = 'builder';
    strategy.builder.direction = 'short';
    const result = runBacktest(makeDataset(), strategy);
    expect(result.trades.every((t) => t.side === 'short')).toBe(true);
  });

  it('fixed position sizing uses a constant unit count per trade', () => {
    const strategy = baseStrategy();
    strategy.mode = 'builder';
    strategy.builder.direction = 'both';
    strategy.builder.risk.positionSizingMode = 'fixed_size';
    strategy.builder.risk.fixedPositionSize = 2;
    const result = runBacktest(makeDataset(), strategy);
    for (const t of result.trades) {
      expect(t.positionSize).toBeCloseTo(2, 9);
    }
  });

  it('risk_pct sizing: pnl always equals the risk amount times the R-multiple (no commission/slippage)', () => {
    const strategy = baseStrategy();
    strategy.mode = 'builder';
    strategy.builder.direction = 'both';
    strategy.builder.risk.positionSizingMode = 'risk_pct';
    strategy.builder.risk.riskPerTradePct = 1;
    strategy.builder.risk.commissionPct = 0;
    strategy.builder.risk.slippagePct = 0;
    const result = runBacktest(makeDataset(), strategy);
    expect(result.trades.length).toBeGreaterThan(0);
    for (const t of result.trades) {
      expect(t.pnl).toBeCloseTo(t.positionSize * t.rMultiple, 6);
    }
    // A stop-loss exit should always be worth almost exactly -1R.
    for (const t of result.trades.filter((t) => t.exitReason === 'stop_loss')) {
      expect(Math.abs(t.rMultiple)).toBeCloseTo(1, 1);
    }
  });

  it('throws BacktestError on a dataset too short for the configured indicators', () => {
    const strategy = baseStrategy();
    strategy.mode = 'builder';
    expect(() => runBacktest(makeDataset(10), strategy)).toThrow();
  });
});
