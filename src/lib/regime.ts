// Classifies each candle into a market regime using trend slope (EMA20 vs
// EMA50) and normalized volatility (ATR% of price). This is a deliberately
// transparent, rule-based classifier — not a statistical/ML regime model —
// so results are explainable in the UI and reproducible across runs.

import type { Candle, Regime, RegimeLabel } from './types';
import { atr, ema } from './indicators';

const HIGH_VOL_ATR_PCT_THRESHOLD = 0.025; // 2.5% of price in a single ATR reading
const TREND_SLOPE_THRESHOLD = 0.0015; // ~0.15% separation between fast/slow EMA

export function classifyRegimes(candles: Candle[]): RegimeLabel[] {
  if (candles.length === 0) return [];

  const fast = ema(candles, 20);
  const slow = ema(candles, 50);
  const atrSeries = atr(candles, 14);

  const labels: RegimeLabel[] = [];

  for (let i = 0; i < candles.length; i++) {
    const price = candles[i].close;
    const atrPct = Number.isFinite(atrSeries[i]) ? atrSeries[i] / price : 0;

    let regime: Regime;

    if (atrPct >= HIGH_VOL_ATR_PCT_THRESHOLD) {
      regime = 'high_volatility';
    } else if (Number.isFinite(fast[i]) && Number.isFinite(slow[i])) {
      const separation = (fast[i] - slow[i]) / price;
      if (separation > TREND_SLOPE_THRESHOLD) regime = 'bullish';
      else if (separation < -TREND_SLOPE_THRESHOLD) regime = 'bearish';
      else regime = 'consolidation';
    } else {
      regime = 'consolidation';
    }

    labels.push({ time: candles[i].time, regime });
  }

  return labels;
}

export function regimeBreakdownPct(labels: RegimeLabel[]): Record<Regime, number> {
  const counts: Record<Regime, number> = {
    bullish: 0,
    bearish: 0,
    consolidation: 0,
    high_volatility: 0,
  };
  if (labels.length === 0) return counts;
  for (const l of labels) counts[l.regime]++;
  const total = labels.length;
  return {
    bullish: (counts.bullish / total) * 100,
    bearish: (counts.bearish / total) * 100,
    consolidation: (counts.consolidation / total) * 100,
    high_volatility: (counts.high_volatility / total) * 100,
  };
}

export const REGIME_LABELS: Record<Regime, string> = {
  bullish: 'Bullish',
  bearish: 'Bearish',
  consolidation: 'Consolidation',
  high_volatility: 'High Volatility',
};

export const REGIME_COLOR_VAR: Record<Regime, string> = {
  bullish: 'var(--color-bullish)',
  bearish: 'var(--color-bearish)',
  consolidation: 'var(--color-consolidation)',
  high_volatility: 'var(--color-volatility)',
};

// Raw hex equivalents of the CSS variables above, for canvas-based chart
// libraries (lightweight-charts, etc.) that can't resolve CSS custom
// properties at draw time.
export const REGIME_COLOR_HEX: Record<Regime, string> = {
  bullish: '#34d399',
  bearish: '#fb7185',
  consolidation: '#fbbf24',
  high_volatility: '#a78bfa',
};
