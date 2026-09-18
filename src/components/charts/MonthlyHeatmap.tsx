import type { Trade } from '../../lib/types';
import { monthlyReturnsMatrix } from '../../lib/reportAnalytics';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function cellColor(pnl: number, maxAbs: number): string {
  if (maxAbs === 0) return '#141a24';
  const intensity = Math.min(1, Math.abs(pnl) / maxAbs);
  if (pnl > 0) {
    // interpolate toward bullish green
    const alpha = 0.12 + intensity * 0.55;
    return `rgba(52, 211, 153, ${alpha})`;
  }
  if (pnl < 0) {
    const alpha = 0.12 + intensity * 0.55;
    return `rgba(251, 113, 133, ${alpha})`;
  }
  return '#141a24';
}

export function MonthlyHeatmap({ trades }: { trades: Trade[] }) {
  const { years, cells } = monthlyReturnsMatrix(trades);

  if (years.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted">No trade data to chart.</div>;
  }

  const lookup = new Map(cells.map((c) => [`${c.year}-${c.monthIndex}`, c]));
  const maxAbs = Math.max(1, ...cells.map((c) => Math.abs(c.pnl)));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 4 }}>
        <thead>
          <tr>
            <th className="w-14 text-left text-xs text-muted">Year</th>
            {MONTHS.map((m) => (
              <th key={m} className="text-center text-xs font-medium text-muted">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="mono text-xs text-text-dim">{year}</td>
              {MONTHS.map((_, monthIndex) => {
                const cell = lookup.get(`${year}-${monthIndex}`);
                return (
                  <td key={monthIndex}>
                    <div
                      className="flex h-11 items-center justify-center rounded-md text-[11px] font-medium"
                      style={{ backgroundColor: cell ? cellColor(cell.pnl, maxAbs) : '#0f141c', color: cell ? '#e6eaf0' : '#3a4454' }}
                      title={cell ? `${cell.trades} trade(s) · $${cell.pnl.toFixed(0)}` : 'No trades'}
                    >
                      {cell ? `${cell.pnl >= 0 ? '+' : ''}${(cell.pnl / 1000).toFixed(1)}k` : '·'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
