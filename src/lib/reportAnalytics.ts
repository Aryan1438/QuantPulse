// Pure analytics functions that turn a completed backtest's Trade[] into
// the shapes each report chart needs. No React, no chart-library
// dependency — kept separate from components/charts/* so these are easy
// to unit test and reuse (e.g. in the PDF/print report and in any future
// export format) without duplicating aggregation logic.

import type { Trade } from './types';

// ---------------------------------------------------------------------------
// Session classification — UTC-hour buckets, same convention used across
// institutional trading-session breakdowns.
// ---------------------------------------------------------------------------
export type Session = 'Asian' | 'London' | 'London-NY Overlap' | 'New York' | 'Off-Hours';

export function classifySession(unixSeconds: number): Session {
  const hour = new Date(unixSeconds * 1000).getUTCHours();
  if (hour >= 0 && hour < 7) return 'Asian';
  if (hour >= 7 && hour < 13) return 'London';
  if (hour >= 13 && hour < 16) return 'London-NY Overlap';
  if (hour >= 16 && hour < 21) return 'New York';
  return 'Off-Hours';
}

export interface SessionStats {
  session: Session;
  trades: number;
  winRate: number;
  pnl: number;
  avgPnl: number;
}

const SESSION_ORDER: Session[] = ['Asian', 'London', 'London-NY Overlap', 'New York', 'Off-Hours'];

export function sessionPerformance(trades: Trade[]): SessionStats[] {
  const buckets = new Map<Session, Trade[]>();
  for (const s of SESSION_ORDER) buckets.set(s, []);
  for (const t of trades) buckets.get(classifySession(t.entryTime))!.push(t);

  return SESSION_ORDER.map((session) => {
    const list = buckets.get(session)!;
    const wins = list.filter((t) => t.result === 'win').length;
    const pnl = list.reduce((s, t) => s + t.pnl, 0);
    return {
      session,
      trades: list.length,
      winRate: list.length ? (wins / list.length) * 100 : 0,
      pnl,
      avgPnl: list.length ? pnl / list.length : 0,
    };
  }).filter((s) => s.trades > 0);
}

// ---------------------------------------------------------------------------
// Monthly returns heatmap — Year x Month matrix of net PnL, keyed off
// each trade's exit time.
// ---------------------------------------------------------------------------
export interface MonthlyHeatmapCell {
  year: number;
  monthIndex: number; // 0-11
  monthLabel: string;
  pnl: number;
  trades: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthlyReturnsMatrix(trades: Trade[]): { years: number[]; cells: MonthlyHeatmapCell[] } {
  if (trades.length === 0) return { years: [], cells: [] };

  const map = new Map<string, MonthlyHeatmapCell>();
  const years = new Set<number>();

  for (const t of trades) {
    const d = new Date(t.exitTime * 1000);
    const year = d.getUTCFullYear();
    const monthIndex = d.getUTCMonth();
    years.add(year);
    const key = `${year}-${monthIndex}`;
    const existing = map.get(key);
    if (existing) {
      existing.pnl += t.pnl;
      existing.trades += 1;
    } else {
      map.set(key, { year, monthIndex, monthLabel: MONTH_LABELS[monthIndex], pnl: t.pnl, trades: 1 });
    }
  }

  return { years: Array.from(years).sort(), cells: Array.from(map.values()) };
}

// ---------------------------------------------------------------------------
// PnL distribution histogram
// ---------------------------------------------------------------------------
export interface HistogramBin {
  label: string;
  rangeStart: number;
  rangeEnd: number;
  count: number;
  isProfitable: boolean;
}

export function pnlHistogram(trades: Trade[], binCount = 16): HistogramBin[] {
  if (trades.length === 0) return [];

  const values = trades.map((t) => t.pnl);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: min.toFixed(0), rangeStart: min, rangeEnd: max, count: trades.length, isProfitable: min >= 0 }];
  }

  const width = (max - min) / binCount;
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => {
    const rangeStart = min + i * width;
    const rangeEnd = rangeStart + width;
    return {
      label: `${rangeStart >= 0 ? '+' : ''}${rangeStart.toFixed(0)}`,
      rangeStart,
      rangeEnd,
      count: 0,
      isProfitable: rangeStart + width / 2 >= 0,
    };
  });

  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  }

  return bins;
}

// ---------------------------------------------------------------------------
// Cumulative PnL by trade sequence (distinct from the time-based equity
// curve — this axis is trade count, which highlights streakiness).
// ---------------------------------------------------------------------------
export interface CumulativePnlPoint {
  tradeIndex: number;
  cumulativePnl: number;
  pnl: number;
}

export function cumulativePnlByTrade(trades: Trade[]): CumulativePnlPoint[] {
  let running = 0;
  return trades.map((t, i) => {
    running += t.pnl;
    return { tradeIndex: i + 1, cumulativePnl: running, pnl: t.pnl };
  });
}

// ---------------------------------------------------------------------------
// Win / loss / breakeven counts
// ---------------------------------------------------------------------------
export interface WinLossCounts {
  win: number;
  loss: number;
  breakeven: number;
}

export function winLossCounts(trades: Trade[]): WinLossCounts {
  return {
    win: trades.filter((t) => t.result === 'win').length,
    loss: trades.filter((t) => t.result === 'loss').length,
    breakeven: trades.filter((t) => t.result === 'breakeven').length,
  };
}
