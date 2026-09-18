import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Trade } from '../../lib/types';
import { pnlHistogram } from '../../lib/reportAnalytics';

export function PnlHistogram({ trades, height = 260 }: { trades: Trade[]; height?: number }) {
  const bins = pnlHistogram(trades);

  if (bins.length === 0) {
    return <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>No trade data to chart.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={bins} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#161c26" vertical={false} />
        <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={{ stroke: '#1d2532' }} interval={1} />
        <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#10151d', border: '1px solid #1d2532', borderRadius: 8, fontSize: 12 }}
          formatter={(value, _name, props) => [`${value} trade(s)`, `$${props.payload.rangeStart.toFixed(0)} to $${props.payload.rangeEnd.toFixed(0)}`]}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {bins.map((b, i) => (
            <Cell key={i} fill={b.isProfitable ? '#34d399' : '#fb7185'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
