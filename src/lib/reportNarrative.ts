// Short, deterministic interpretive captions for each report section —
// same "rules engine, not an LLM" approach as lib/insights.ts, scoped to
// the specific chart it sits under.

import type { BacktestResult, Trade } from './types';
import { cumulativePnlByTrade, monthlyReturnsMatrix, pnlHistogram, sessionPerformance, winLossCounts } from './reportAnalytics';

export function equityCurveCaption(result: BacktestResult): string {
  const start = result.equityCurve[0]?.equity ?? 0;
  const end = result.equityCurve[result.equityCurve.length - 1]?.equity ?? 0;
  const growth = start > 0 ? ((end - start) / start) * 100 : 0;
  return `Equity moved from $${start.toLocaleString(undefined, { maximumFractionDigits: 0 })} to $${end.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%) over ${result.equityCurve.length} bars.`;
}

export function drawdownCaption(result: BacktestResult): string {
  const severity = result.maxDrawdownPct <= -25 ? 'severe' : result.maxDrawdownPct <= -10 ? 'moderate' : 'contained';
  return `Maximum peak-to-trough decline was ${Math.abs(result.maxDrawdownPct).toFixed(1)}%, which is ${severity} for this strategy style.`;
}

export function monthlyHeatmapCaption(trades: Trade[]): string {
  const { cells } = monthlyReturnsMatrix(trades);
  if (cells.length === 0) return 'No monthly data available.';
  const best = cells.reduce((a, b) => (b.pnl > a.pnl ? b : a));
  const worst = cells.reduce((a, b) => (b.pnl < a.pnl ? b : a));
  const profitableMonths = cells.filter((c) => c.pnl > 0).length;
  return `${profitableMonths} of ${cells.length} months were profitable. Best month: ${best.monthLabel} ${best.year} (+$${best.pnl.toFixed(0)}). Worst: ${worst.monthLabel} ${worst.year} ($${worst.pnl.toFixed(0)}).`;
}

export function pnlDistributionCaption(trades: Trade[]): string {
  if (trades.length === 0) return 'No trade data available.';
  const bins = pnlHistogram(trades);
  const wins = trades.filter((t) => t.pnl > 0);
  const largestWin = wins.length ? Math.max(...wins.map((t) => t.pnl)) : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const concentrationNote =
    largestWin > avgWin * 3
      ? 'Profits show meaningful concentration in a handful of large winners rather than being evenly spread.'
      : 'Profits are fairly evenly distributed across winning trades rather than concentrated in a few outliers.';
  const modalBin = bins.reduce((a, b) => (b.count > a.count ? b : a), bins[0]);
  return `Most trades cluster around a PnL of ${modalBin?.label ?? 'N/A'}. ${concentrationNote}`;
}

export function winLossCaption(trades: Trade[]): string {
  const counts = winLossCounts(trades);
  const total = trades.length || 1;
  return `${counts.win} wins (${((counts.win / total) * 100).toFixed(0)}%), ${counts.loss} losses (${((counts.loss / total) * 100).toFixed(0)}%), and ${counts.breakeven} breakeven trade(s) out of ${trades.length} total.`;
}

export function cumulativePnlCaption(trades: Trade[]): string {
  const series = cumulativePnlByTrade(trades);
  if (series.length === 0) return 'No trade data available.';
  let maxRun = 0;
  let curRun = 0;
  let sign = 0;
  for (const p of series) {
    const s = p.pnl > 0 ? 1 : p.pnl < 0 ? -1 : 0;
    if (s === sign && s !== 0) curRun += 1;
    else { curRun = 1; sign = s; }
    maxRun = Math.max(maxRun, curRun);
  }
  const finalPnl = series[series.length - 1].cumulativePnl;
  return `Cumulative PnL reached ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(0)} across ${series.length} trades. Longest same-direction streak: ${maxRun} trade(s), indicating ${maxRun >= 6 ? 'notable streakiness' : 'reasonably steady trade-to-trade consistency'}.`;
}

export function sessionAnalysisCaption(trades: Trade[]): string {
  const perf = sessionPerformance(trades);
  if (perf.length === 0) return 'No session data available.';
  const best = perf.reduce((a, b) => (b.pnl > a.pnl ? b : a));
  const worst = perf.reduce((a, b) => (b.pnl < a.pnl ? b : a));
  return `${best.session} was the most profitable session (${best.trades} trades, $${best.pnl.toFixed(0)}). ${
    worst.session !== best.session ? `${worst.session} was the weakest ($${worst.pnl.toFixed(0)}).` : ''
  }`;
}
