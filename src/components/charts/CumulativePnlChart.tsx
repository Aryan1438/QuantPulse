import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Trade } from '../../lib/types';
import { cumulativePnlByTrade } from '../../lib/reportAnalytics';

export function CumulativePnlChart({ trades, height = 260 }: { trades: Trade[]; height?: number }) {
  const data = cumulativePnlByTrade(trades);

  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>No trade data to chart.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="cumPnlFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#161c26" vertical={false} />
        <XAxis dataKey="tradeIndex" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#1d2532' }} label={{ value: 'Trade #', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 11 }} />
        <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={48} />
        <Tooltip
          contentStyle={{ background: '#10151d', border: '1px solid #1d2532', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(v) => `Trade #${v}`}
          formatter={(value) => [`$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Cumulative PnL']}
        />
        <Area type="monotone" dataKey="cumulativePnl" stroke="#38bdf8" strokeWidth={2} fill="url(#cumPnlFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
