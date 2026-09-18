import { describe, expect, it } from 'vitest';
import { generateSampleCandles } from '../sampleData';
import { bollingerBands, macd } from '../indicators';

describe('macd', () => {
  const candles = generateSampleCandles(200, 100);
  const result = macd(candles);

  it('produces line/signal/histogram arrays aligned to candles', () => {
    expect(result.line.length).toBe(candles.length);
    expect(result.signal.length).toBe(candles.length);
    expect(result.histogram.length).toBe(candles.length);
  });

  it('is NaN during warmup and finite well after it', () => {
    expect(Number.isFinite(result.line[0])).toBe(false);
    expect(Number.isFinite(result.signal[40])).toBe(true);
    expect(Number.isFinite(result.histogram[40])).toBe(true);
  });

  it('histogram equals line minus signal wherever both are finite', () => {
    for (let i = 40; i < candles.length; i++) {
      expect(result.histogram[i]).toBeCloseTo(result.line[i] - result.signal[i], 9);
    }
  });
});

describe('bollingerBands', () => {
  const candles = generateSampleCandles(100, 100);
  const result = bollingerBands(candles, 20, 2);

  it('keeps upper >= middle >= lower once populated', () => {
    for (let i = 19; i < candles.length; i++) {
      expect(result.upper[i]).toBeGreaterThanOrEqual(result.middle[i]);
      expect(result.middle[i]).toBeGreaterThanOrEqual(result.lower[i]);
    }
  });

  it('is NaN before the lookback window fills', () => {
    expect(Number.isFinite(result.upper[5])).toBe(false);
  });
});
