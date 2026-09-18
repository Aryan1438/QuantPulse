// Technical indicators computed as full-length arrays aligned to the
// candle array (index i of the output corresponds to candles[i]).
// Values that can't yet be computed (insufficient lookback) are NaN.

import type { Candle } from './types';

export function sma(candles: Candle[], period: number, field: keyof Candle = 'close'): number[] {
  const out = new Array(candles.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i][field] as number;
    if (i >= period) sum -= candles[i - period][field] as number;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(candles: Candle[], period: number, field: keyof Candle = 'close'): number[] {
  const out = new Array(candles.length).fill(NaN);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < candles.length; i++) {
    const value = candles[i][field] as number;
    if (prev === null) {
      if (i === period - 1) {
        // seed with SMA of the first `period` values
        let sum = 0;
        for (let j = 0; j <= i; j++) sum += candles[j][field] as number;
        prev = sum / period;
        out[i] = prev;
      }
      continue;
    }
    prev = value * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function rsi(candles: Candle[], period = 14): number[] {
  const out = new Array(candles.length).fill(NaN);
  if (candles.length < period + 1) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function atr(candles: Candle[], period = 14): number[] {
  const out = new Array(candles.length).fill(NaN);
  const trueRanges: number[] = new Array(candles.length).fill(NaN);

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trueRanges[i] = candles[i].high - candles[i].low;
      continue;
    }
    const prevClose = candles[i - 1].close;
    trueRanges[i] = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose),
    );
  }

  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += trueRanges[i];
    if (i >= period) sum -= trueRanges[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Rolling VWAP over a lookback window (session-agnostic — resets never,
 * but weighted by a trailing window so it behaves usefully on any dataset). */
export function vwap(candles: Candle[], window = 20): number[] {
  const out = new Array(candles.length).fill(NaN);
  let pvSum = 0;
  let vSum = 0;
  for (let i = 0; i < candles.length; i++) {
    const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
    pvSum += typicalPrice * candles[i].volume;
    vSum += candles[i].volume;
    if (i >= window) {
      const old = candles[i - window];
      const oldTypical = (old.high + old.low + old.close) / 3;
      pvSum -= oldTypical * old.volume;
      vSum -= old.volume;
    }
    if (i >= window - 1 && vSum > 0) out[i] = pvSum / vSum;
  }
  return out;
}

/** MACD: fast EMA - slow EMA, a signal EMA of that line, and the histogram
 * (line - signal). Standard defaults are 12/26/9. */
export interface MacdResult {
  line: number[];
  signal: number[];
  histogram: number[];
}

export function macd(candles: Candle[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MacdResult {
  const fast = ema(candles, fastPeriod);
  const slow = ema(candles, slowPeriod);
  const line = candles.map((_, i) => (Number.isFinite(fast[i]) && Number.isFinite(slow[i]) ? fast[i] - slow[i] : NaN));

  // EMA of the MACD line itself, seeded once the line has `signalPeriod`
  // consecutive finite values (mirrors ema()'s SMA-seed approach).
  const signal = new Array(candles.length).fill(NaN);
  const k = 2 / (signalPeriod + 1);
  let prev: number | null = null;
  let seedStart = -1;
  for (let i = 0; i < line.length; i++) {
    if (!Number.isFinite(line[i])) continue;
    if (seedStart === -1) seedStart = i;
    if (prev === null) {
      if (i - seedStart === signalPeriod - 1) {
        let sum = 0;
        for (let j = seedStart; j <= i; j++) sum += line[j];
        prev = sum / signalPeriod;
        signal[i] = prev;
      }
      continue;
    }
    prev = line[i] * k + prev * (1 - k);
    signal[i] = prev;
  }

  const histogram = candles.map((_, i) => (Number.isFinite(line[i]) && Number.isFinite(signal[i]) ? line[i] - signal[i] : NaN));
  return { line, signal, histogram };
}

/** Bollinger Bands: SMA middle band +/- (stdDevMultiple * rolling std dev). */
export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function bollingerBands(candles: Candle[], period = 20, stdDevMultiple = 2): BollingerResult {
  const middle = sma(candles, period);
  const upper = new Array(candles.length).fill(NaN);
  const lower = new Array(candles.length).fill(NaN);

  for (let i = period - 1; i < candles.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = candles[j].close - middle[i];
      sumSq += diff * diff;
    }
    const stdDev = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + stdDev * stdDevMultiple;
    lower[i] = middle[i] - stdDev * stdDevMultiple;
  }

  return { upper, middle, lower };
}

export interface IndicatorSet {
  sma20: number[];
  sma50: number[];
  ema20: number[];
  ema50: number[];
  rsi14: number[];
  atr14: number[];
  vwap20: number[];
}

export function computeIndicatorSet(candles: Candle[]): IndicatorSet {
  return {
    sma20: sma(candles, 20),
    sma50: sma(candles, 50),
    ema20: ema(candles, 20),
    ema50: ema(candles, 50),
    rsi14: rsi(candles, 14),
    atr14: atr(candles, 14),
    vwap20: vwap(candles, 20),
  };
}
