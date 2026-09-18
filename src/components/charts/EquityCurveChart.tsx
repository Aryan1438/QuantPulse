import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EquityPoint } from '../../lib/types';

function formatDate(t: number) {
  return new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function EquityCurveChart({ data, height = 320 }: { data: EquityPoint[]; height?: number }) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted" style={{ height }}>
        Run a backtest to see the equity curve.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3a5" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#22d3a5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#161c26" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={formatDate}
          stroke="#64748b"
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: '#1d2532' }}
        />
        <YAxis
          stroke="#64748b"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          width={54}
        />
        <Tooltip
          contentStyle={{ background: '#10151d', border: '1px solid #1d2532', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(t) => formatDate(t as number)}
          formatter={(value) => [`$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Equity']}
        />
        <Area type="monotone" dataKey="equity" stroke="#22d3a5" strokeWidth={2} fill="url(#equityFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
