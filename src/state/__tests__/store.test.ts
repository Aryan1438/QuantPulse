import { describe, expect, it } from 'vitest';
import { reducer, initialState, makeDefaultBuilderConfig } from '../store';
import { classifyRegimes } from '../../lib/regime';
import { generateSampleCandles } from '../../lib/sampleData';
import { runBacktest } from '../../lib/backtestEngine';
import type { Dataset, Strategy } from '../../lib/types';

function makeDataset(): Dataset {
  const candles = generateSampleCandles(300, 42000);
  return {
    id: 'ds-1',
    name: 'Sample BTC/USDT',
    symbol: 'BTC/USDT',
    assetType: 'Crypto',
    candles,
    regimes: classifyRegimes(candles),
    createdAt: Date.now(),
  };
}

function makeStrategy(): Strategy {
  return {
    id: 'strat-1',
    name: 'Test Builder Strategy',
    mode: 'builder',
    default: { regimes: ['bullish', 'bearish'], riskPerTradePct: 1, stopLossAtrMultiple: 1.5, takeProfitRR: 2 },
    custom: { code: 'IF close > EMA(20) THEN\nENTER long\nSTOP_LOSS = ATR(14) * 1.5\nTAKE_PROFIT = ATR(14) * 3', riskPerTradePct: 1 },
    builder: makeDefaultBuilderConfig(),
    createdAt: Date.now(),
  };
}

describe('reducer — run history', () => {
  it('RUN_BACKTEST_DONE adds an entry to runHistory with resolved strategy/dataset names', () => {
    const dataset = makeDataset();
    const strategy = makeStrategy();
    strategy.builder.direction = 'both';
    const result = runBacktest(dataset, strategy);

    let state = { ...initialState, datasets: [dataset], strategies: [strategy] };
    state = reducer(state, { type: 'RUN_BACKTEST_DONE', result });

    expect(state.runHistory.length).toBe(1);
    expect(state.runHistory[0].strategyName).toBe('Test Builder Strategy');
    expect(state.runHistory[0].strategyMode).toBe('builder');
    expect(state.runHistory[0].datasetSymbol).toBe('BTC/USDT');
    expect(state.backtestResult).toBe(result);
  });

  it('accumulates multiple runs, newest first', () => {
    const dataset = makeDataset();
    const strategy = makeStrategy();
    strategy.builder.direction = 'both';
    const result1 = runBacktest(dataset, strategy);
    const result2 = runBacktest(dataset, strategy);

    let state = { ...initialState, datasets: [dataset], strategies: [strategy] };
    state = reducer(state, { type: 'RUN_BACKTEST_DONE', result: result1 });
    state = reducer(state, { type: 'RUN_BACKTEST_DONE', result: result2 });

    expect(state.runHistory.length).toBe(2);
    expect(state.runHistory[0].result).toBe(result2);
    expect(state.runHistory[1].result).toBe(result1);
  });

  it('caps history at MAX_RUN_HISTORY (20)', () => {
    const dataset = makeDataset();
    const strategy = makeStrategy();
    strategy.builder.direction = 'both';
    const result = runBacktest(dataset, strategy);

    let state = { ...initialState, datasets: [dataset], strategies: [strategy] };
    for (let i = 0; i < 25; i++) {
      state = reducer(state, { type: 'RUN_BACKTEST_DONE', result: { ...result, runAt: Date.now() + i } });
    }
    expect(state.runHistory.length).toBe(20);
  });

  it('REMOVE_RUN_FROM_HISTORY removes only the targeted entry', () => {
    const dataset = makeDataset();
    const strategy = makeStrategy();
    strategy.builder.direction = 'both';
    const result = runBacktest(dataset, strategy);

    let state = { ...initialState, datasets: [dataset], strategies: [strategy] };
    state = reducer(state, { type: 'RUN_BACKTEST_DONE', result });
    const id = state.runHistory[0].id;
    state = reducer(state, { type: 'REMOVE_RUN_FROM_HISTORY', id });

    expect(state.runHistory.length).toBe(0);
  });

  it('CLEAR_RUN_HISTORY empties the list', () => {
    const dataset = makeDataset();
    const strategy = makeStrategy();
    strategy.builder.direction = 'both';
    const result = runBacktest(dataset, strategy);

    let state = { ...initialState, datasets: [dataset], strategies: [strategy] };
    state = reducer(state, { type: 'RUN_BACKTEST_DONE', result });
    state = reducer(state, { type: 'CLEAR_RUN_HISTORY' });

    expect(state.runHistory).toEqual([]);
  });

  it('falls back gracefully when strategy/dataset can no longer be found', () => {
    const dataset = makeDataset();
    const strategy = makeStrategy();
    strategy.builder.direction = 'both';
    const result = runBacktest(dataset, strategy);

    // Note: datasets/strategies arrays are empty, simulating a stale reference.
    let state = { ...initialState };
    state = reducer(state, { type: 'RUN_BACKTEST_DONE', result });

    expect(state.runHistory.length).toBe(1);
    expect(state.runHistory[0].datasetName).toBe('Unknown dataset');
  });
});
