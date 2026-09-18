// Phase 3 — Run History / Comparison.
//
// Pure functions only: no React, no chart library. Takes the existing
// BacktestResult objects already produced by backtestEngine.ts (no new
// simulation logic here) and reshapes them for side-by-side comparison.

import type { BacktestResult, RunHistoryEntry } from './types';

/** The engine doesn't store starting equity directly on BacktestResult,
 * but it's recoverable exactly: netProfit = finalEquity - startingEquity. */
export function startingEquityOf(result: BacktestResult): number {
  const finalEquity = result.equityCurve.length ? result.equityCurve[result.equityCurve.length - 1].equity : 0;
  return finalEquity - result.netProfit;
}

export interface NormalizedPoint {
  time: number;
  returnPct: number;
}

/** Equity curve rescaled to % return from that run's own starting capital,
 * so runs with different initial capital (default $100k vs a builder
 * strategy's custom initialCapital) can be overlaid on one chart fairly. */
export function normalizeEquityCurve(result: BacktestResult): NormalizedPoint[] {
  const startingEquity = startingEquityOf(result);
  if (!Number.isFinite(startingEquity) || startingEquity <= 0) {
    return result.equityCurve.map((p) => ({ time: p.time, returnPct: 0 }));
  }
  return result.equityCurve.map((p) => ({
    time: p.time,
    returnPct: ((p.equity - startingEquity) / startingEquity) * 100,
  }));
}

export interface ComparisonRow {
  id: string;
  label: string;
  totalReturnPct: number;
  netProfit: number;
  winRatePct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpeApprox: number;
  totalTrades: number;
}

export function toComparisonRow(entry: RunHistoryEntry): ComparisonRow {
  const r = entry.result;
  return {
    id: entry.id,
    label: entry.strategyName,
    totalReturnPct: r.totalReturnPct,
    netProfit: r.netProfit,
    winRatePct: r.winRatePct,
    profitFactor: r.profitFactor,
    maxDrawdownPct: r.maxDrawdownPct,
    sharpeApprox: r.sharpeApprox,
    totalTrades: r.totalTrades,
  };
}

/** Ranks comparison rows by total return, best first — used to highlight
 * the top performer in the comparison table. */
export function rankByReturn(rows: ComparisonRow[]): ComparisonRow[] {
  return [...rows].sort((a, b) => b.totalReturnPct - a.totalReturnPct);
}

export const MAX_RUN_HISTORY = 20;
export const MAX_COMPARISON_SELECTION = 6;

/** Merges several runs' normalized equity curves onto a single 0–100 "%
 * through the backtest" x-axis so runs with different dataset lengths or
 * date ranges can be plotted as overlaid lines in one chart. Each output
 * row has one numeric field per run, keyed by that run's history id. */
export function buildComparisonChartData(
  entries: RunHistoryEntry[],
): Array<{ progressPct: number } & Record<string, number>> {
  const curves = entries.map((e) => ({ id: e.id, points: normalizeEquityCurve(e.result) }));
  const rows: Array<{ progressPct: number } & Record<string, number>> = [];

  for (let pct = 0; pct <= 100; pct += 2) {
    const row: { progressPct: number } & Record<string, number> = { progressPct: pct };
    for (const curve of curves) {
      if (curve.points.length === 0) continue;
      const idx = Math.round((pct / 100) * (curve.points.length - 1));
      row[curve.id] = curve.points[idx].returnPct;
    }
    rows.push(row);
  }

  return rows;
}
