import type { Candle, Dataset, Timeframe } from './types';
import { TIMEFRAME_SECONDS } from './types';

export interface TimeframeContext {
  timeframe: Timeframe;
  timestamp: number;
  candle: Candle | null;
  candles: Candle[];
}

export interface DataValidationIssue {
  severity: 'error' | 'warning';
  timeframe: Timeframe;
  message: string;
}

export interface DatasetQualitySummary {
  symbol: string;
  timeframe: Timeframe;
  rows: number;
  start: string;
  end: string;
  duplicates: number;
  invalidOhlc: number;
  missingCandles: number;
  timezone: 'UTC';
  status: 'READY' | 'INVALID';
  issues: string[];
}

function seriesFor(dataset: Dataset, timeframe: Timeframe): Candle[] {
  return dataset.timeframes?.[timeframe] ?? (dataset.builderTimeframe === timeframe ? dataset.candles : []);
}

function sameUtcDate(left: number, right: number): boolean {
  return new Date(left * 1000).toISOString().slice(0, 10) === new Date(right * 1000).toISOString().slice(0, 10);
}

export function normalizeCandles(candles: Candle[]): Candle[] {
  return candles
    .map((candle) => ({ ...candle, time: Math.floor(candle.time) }))
    .sort((a, b) => a.time - b.time);
}

export function getHistoricalCandles(dataset: Dataset, timeframe: Timeframe, timestamp: number, lookback?: number): Candle[] {
  const candles = normalizeCandles(seriesFor(dataset, timeframe));
  const available = candles.filter((candle) => candle.time + TIMEFRAME_SECONDS[timeframe] <= timestamp);
  return lookback === undefined ? available : available.slice(-lookback);
}

export function getTimeframeContext(dataset: Dataset, timeframe: Timeframe, timestamp: number): TimeframeContext {
  const candles = getHistoricalCandles(dataset, timeframe, timestamp);
  return { timeframe, timestamp, candle: candles.length ? candles[candles.length - 1] : null, candles };
}

export function validateTimeframeData(dataset: Dataset, selected: Timeframe[]): DataValidationIssue[] {
  const issues: DataValidationIssue[] = [];
  for (const timeframe of selected) {
    const candles = normalizeCandles(dataset.timeframes?.[timeframe] ?? (timeframe === dataset.builderTimeframe ? dataset.candles : []));
    let previous = -Infinity;
    const seen = new Set<number>();
    for (const candle of candles) {
      if (!Number.isFinite(candle.time) || candle.time < 0) {
        issues.push({ severity: 'error', timeframe, message: `Invalid timestamp in ${timeframe} data.` });
        continue;
      }
      if (seen.has(candle.time)) issues.push({ severity: 'error', timeframe, message: `Duplicate timestamp ${candle.time}.` });
      if (candle.time < previous) issues.push({ severity: 'error', timeframe, message: 'Candles are not sorted chronologically.' });
      if (candle.high <= 0 || candle.low <= 0 || candle.open <= 0 || candle.close <= 0) {
        issues.push({ severity: 'error', timeframe, message: `Invalid OHLC values at ${candle.time}.` });
      }
      if (candle.high < candle.low || candle.high < candle.open || candle.high < candle.close || candle.low > candle.open || candle.low > candle.close) {
        issues.push({ severity: 'error', timeframe, message: `Invalid OHLC values at ${candle.time}.` });
      }
      seen.add(candle.time);
      previous = candle.time;
    }
    if (candles.length > 1) {
      const duration = TIMEFRAME_SECONDS[timeframe];
      for (let i = 1; i < candles.length; i++) {
        const gap = candles[i].time - candles[i - 1].time;
        if (gap < duration) {
          issues.push({ severity: 'error', timeframe, message: `Overlapping candles near ${candles[i].time}.` });
          break;
        }
        if (gap > duration && sameUtcDate(candles[i - 1].time, candles[i].time)) {
          const missing = Math.max(0, Math.floor((gap - 1) / duration));
          issues.push({ severity: 'warning', timeframe, message: `Missing ${missing} candle(s) between ${candles[i - 1].time} and ${candles[i].time}.` });
        }
      }
    }
  }
  return issues;
}

export function validateDatasetQuality(dataset: Dataset, timeframe: Timeframe = dataset.timeframe ?? dataset.builderTimeframe ?? 'H1'): DatasetQualitySummary {
  const candles = normalizeCandles(dataset.timeframes?.[timeframe] ?? (timeframe === dataset.builderTimeframe ? dataset.candles : dataset.candles));
  let duplicates = 0;
  let invalidOhlc = 0;
  let missingCandles = 0;
  const issues: string[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    if (!Number.isFinite(candle.time) || candle.time < 0) {
      issues.push(`Invalid timestamp at index ${i}.`);
      continue;
    }
    if (seen.has(candle.time)) {
      duplicates += 1;
      issues.push(`Duplicate timestamp ${candle.time}.`);
      continue;
    }
    seen.add(candle.time);
    if (
      candle.high <= 0 || candle.low <= 0 || candle.open <= 0 || candle.close <= 0
      || candle.high < candle.low
      || candle.high < candle.open
      || candle.high < candle.close
      || candle.low > candle.open
      || candle.low > candle.close
    ) {
      invalidOhlc += 1;
      issues.push(`Invalid OHLC values at ${candle.time}.`);
    }
  }

  for (let i = 1; i < candles.length; i++) {
    const duration = TIMEFRAME_SECONDS[timeframe];
    const gap = candles[i].time - candles[i - 1].time;
    if (gap > duration && sameUtcDate(candles[i - 1].time, candles[i].time)) {
      const missing = Math.max(0, Math.floor((gap - 1) / duration));
      missingCandles += missing;
      issues.push(`Missing ${missing} candle(s) between ${candles[i - 1].time} and ${candles[i].time}.`);
    }
  }

  const start = candles.length ? new Date(candles[0].time * 1000).toISOString().slice(0, 10) : 'n/a';
  const end = candles.length ? new Date(candles[candles.length - 1].time * 1000).toISOString().slice(0, 10) : 'n/a';
  const status: DatasetQualitySummary['status'] = duplicates > 0 || invalidOhlc > 0 || missingCandles > 0 ? 'INVALID' : 'READY';

  return {
    symbol: dataset.symbol,
    timeframe,
    rows: candles.length,
    start,
    end,
    duplicates,
    invalidOhlc,
    missingCandles,
    timezone: 'UTC',
    status,
    issues,
  };
}

export function executionTimeframe(dataset: Dataset, requested?: Timeframe): Timeframe {
  if (requested) return requested;
  if (dataset.builderTimeframe) return dataset.builderTimeframe;
  if (dataset.timeframe) return dataset.timeframe;
  return 'H1';
}

export function mergeTimeframeDatasets(executionDataset: Dataset, contextDataset: Dataset): Dataset {
  const executionTimeframeValue = executionDataset.timeframe ?? executionDataset.builderTimeframe;
  const contextTimeframeValue = contextDataset.timeframe ?? contextDataset.builderTimeframe;
  if (!executionTimeframeValue || !contextTimeframeValue) {
    throw new Error('Both datasets must declare a timeframe before they can be merged.');
  }
  if (executionDataset.symbol !== contextDataset.symbol) {
    throw new Error(`Dataset symbols must match: ${executionDataset.symbol} and ${contextDataset.symbol}.`);
  }
  if (TIMEFRAME_SECONDS[executionTimeframeValue] >= TIMEFRAME_SECONDS[contextTimeframeValue]) {
    throw new Error(`Execution timeframe ${executionTimeframeValue} must be lower than context timeframe ${contextTimeframeValue}.`);
  }

  const timeframes = {
    ...(contextDataset.timeframes ?? { [contextTimeframeValue]: contextDataset.candles }),
    ...(executionDataset.timeframes ?? { [executionTimeframeValue]: executionDataset.candles }),
  };

  return {
    ...executionDataset,
    id: `${executionDataset.id}::${contextDataset.id}`,
    name: `${contextDataset.name} + ${executionDataset.name}`,
    candles: executionDataset.candles,
    timeframe: executionTimeframeValue,
    builderTimeframe: executionTimeframeValue,
    timeframes,
    source: `${contextDataset.source ?? contextDataset.name} + ${executionDataset.source ?? executionDataset.name}`,
    startDate: executionDataset.startDate ?? contextDataset.startDate,
    endDate: executionDataset.endDate ?? contextDataset.endDate,
  };
}