import { describe, expect, it } from 'vitest';
import { getHistoricalCandles, getTimeframeContext, mergeTimeframeDatasets, validateDatasetQuality, validateTimeframeData } from '../mtf';
import { computeMtfEntrySignal, precomputeMtfBuilderSeries } from '../strategyEngine';
import { makeDefaultBuilderConfig } from '../../state/store';
import { parseCsvOhlcv, parseOhlcvText } from '../csvParser';
import type { Candle, Dataset } from '../types';

function candle(time: number, close: number): Candle {
  return { time, open: close, high: close + 1, low: close - 1, close, volume: 100 };
}

function dataset(): Dataset {
  return {
    id: 'mtf-test',
    name: 'MTF test',
    symbol: 'XAUUSD',
    assetType: 'Commodity',
    candles: [],
    timeframes: {
      H1: [candle(0, 200), candle(3600, 100)],
      M5: Array.from({ length: 15 }, (_, index) => candle(index * 300, 50)),
    },
    builderTimeframe: 'M5',
    regimes: [],
    createdAt: 0,
  };
}

describe('MTF historical context', () => {
  it('does not expose an H1 candle until its full interval has closed', () => {
    const data = dataset();
    expect(getTimeframeContext(data, 'H1', 3599).candle).toBeNull();
    expect(getTimeframeContext(data, 'H1', 3600).candle?.close).toBe(200);
    expect(getHistoricalCandles(data, 'H1', 3599)).toHaveLength(0);
  });

  it('projects only completed higher-timeframe indicator values', () => {
    const data = dataset();
    const config = makeDefaultBuilderConfig();
    config.executionTimeframe = 'M5';
    config.entryLong.conditions = [{
      id: 'h1-filter',
      left: { type: 'indicator', indicator: { kind: 'SMA', period: 1, timeframe: 'H1' } },
      operator: '>',
      right: { type: 'constant', value: 150 },
    }];
    const execution = data.timeframes!.M5!;
    const series = precomputeMtfBuilderSeries(data, execution, config);

    expect(Number.isNaN(series.get('SMA(1)@H1')![9])).toBe(true);
    expect(computeMtfEntrySignal(config, 9, series)).toBeNull();
    expect(computeMtfEntrySignal(config, 12, series)).toBe('long');
  });

  it('merges one lower execution timeline with completed higher-timeframe context', () => {
    const execution: Dataset = {
      id: 'execution-h1', name: 'XAUUSD 1H', symbol: 'XAUUSD', assetType: 'Commodity',
      candles: [candle(0, 100), candle(3600, 101), candle(7200, 102)], timeframe: 'H1', builderTimeframe: 'H1',
      timeframes: { H1: [candle(0, 100), candle(3600, 101), candle(7200, 102)] }, regimes: [], createdAt: 0,
    };
    const context: Dataset = {
      id: 'context-h4', name: 'XAUUSD 4H', symbol: 'XAUUSD', assetType: 'Commodity',
      candles: [candle(0, 200), candle(14400, 201)], timeframe: 'H4', builderTimeframe: 'H4',
      timeframes: { H4: [candle(0, 200), candle(14400, 201)] }, regimes: [], createdAt: 0,
    };
    const merged = mergeTimeframeDatasets(execution, context);
    expect(merged.candles).toHaveLength(3);
    expect(merged.timeframes?.H1).toHaveLength(3);
    expect(merged.timeframes?.H4).toHaveLength(2);
    expect(getHistoricalCandles(merged, 'H4', 10_800)).toHaveLength(0);
    expect(getHistoricalCandles(merged, 'H4', 18_000)).toHaveLength(1);
  });
});

describe('MTF data validation', () => {
  it('reports duplicate timestamps and invalid OHLC values', () => {
    const data = dataset();
    data.timeframes = { H1: [candle(0, 100), { ...candle(0, 100), high: 90, low: 95 }] };
    const issues = validateTimeframeData(data, ['H1']);
    expect(issues.some((issue) => issue.message.includes('Duplicate timestamp'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('Invalid OHLC'))).toBe(true);
  });

  it('detects missing hourly candles and refuses invalid datasets', () => {
    const data: Dataset = {
      id: 'missing-hourly',
      name: 'Missing H1',
      symbol: 'XAUUSD',
      assetType: 'Commodity',
      candles: [
        { time: Date.UTC(2025, 4, 7, 0, 0, 0) / 1000, open: 100, high: 101, low: 99, close: 100, volume: 100 },
        { time: Date.UTC(2025, 4, 7, 2, 0, 0) / 1000, open: 101, high: 102, low: 100, close: 101, volume: 100 },
      ],
      timeframes: { H1: [
        { time: Date.UTC(2025, 4, 7, 0, 0, 0) / 1000, open: 100, high: 101, low: 99, close: 100, volume: 100 },
        { time: Date.UTC(2025, 4, 7, 2, 0, 0) / 1000, open: 101, high: 102, low: 100, close: 101, volume: 100 },
      ] },
      builderTimeframe: 'H1',
      regimes: [],
      createdAt: 0,
    };

    const summary = validateDatasetQuality(data, 'H1');
    expect(summary.missingCandles).toBeGreaterThan(0);
    expect(summary.status).toBe('INVALID');
  });

  it('parses CSV timestamps as UTC to keep hourly data consistent across timezones', () => {
    const result = parseCsvOhlcv('timestamp,open,high,low,close\n2025-05-07 01:00:00,100,101,99,100\n2025-05-07 02:00:00,101,102,100,101\n');
    expect(result.errors).toHaveLength(0);
    expect(result.candles[0].time).toBe(Date.UTC(2025, 4, 7, 1, 0, 0) / 1000);
    expect(result.candles[1].time).toBe(Date.UTC(2025, 4, 7, 2, 0, 0) / 1000);
  });

  it('parses the attached HTML-table XLS export format', () => {
    const result = parseOhlcvText('<!DOCTYPE html><table><tr><th>timestamp</th><th>open</th><th>high</th><th>low</th><th>close</th><th>volume</th></tr><tr><td>2004.06.11 00:00</td><td>384</td><td>384.8</td><td>383</td><td>384.2</td><td>10</td></tr></table>');
    expect(result.errors).toHaveLength(0);
    expect(result.candles).toHaveLength(1);
    expect(result.candles[0].close).toBe(384.2);
    expect(result.candles[0].time).toBe(Date.UTC(2004, 5, 11) / 1000);
  });
});
