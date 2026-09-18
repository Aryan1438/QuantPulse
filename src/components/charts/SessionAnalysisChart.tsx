import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Trade } from '../../lib/types';
import { sessionPerformance } from '../../lib/reportAnalytics';

export function SessionAnalysisChart({ trades, height = 260 }: { trades: Trade[]; height?: number }) {
  const data = sessionPerformance(trades);

  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>No trade data to chart.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#161c26" vertical={false} />
        <XAxis dataKey="session" stroke="#64748b" fontSize={10} tickLine={false} axisLine={{ stroke: '#1d2532' }} />
        <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} width={54} />
        <Tooltip
          contentStyle={{ background: '#10151d', border: '1px solid #1d2532', borderRadius: 8, fontSize: 12 }}
          formatter={(value, _name, props) => [`$${Number(value).toFixed(0)} · ${props.payload.trades} trades · ${props.payload.winRate.toFixed(0)}% win`, 'PnL']}
        />
        <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.session} fill={d.pnl >= 0 ? '#34d399' : '#fb7185'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
