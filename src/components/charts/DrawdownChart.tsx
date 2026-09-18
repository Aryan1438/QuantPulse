import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EquityPoint } from '../../lib/types';

function formatDate(t: number) {
  return new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function DrawdownChart({ data, height = 220 }: { data: EquityPoint[]; height?: number }) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted" style={{ height }}>
        No drawdown data yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" stopOpacity={0} />
            <stop offset="100%" stopColor="#fb7185" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#161c26" vertical={false} />
        <XAxis dataKey="time" tickFormatter={formatDate} stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#1d2532' }} />
        <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} width={44} />
        <Tooltip
          contentStyle={{ background: '#10151d', border: '1px solid #1d2532', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(t) => formatDate(t as number)}
          formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Drawdown']}
        />
        <Area type="monotone" dataKey="drawdownPct" stroke="#fb7185" strokeWidth={1.5} fill="url(#ddFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
