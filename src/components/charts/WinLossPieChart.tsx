import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Trade } from '../../lib/types';
import { winLossCounts } from '../../lib/reportAnalytics';

const COLORS: Record<string, string> = {
  Wins: '#34d399',
  Losses: '#fb7185',
  Breakeven: '#fbbf24',
};

export function WinLossPieChart({ trades, height = 260 }: { trades: Trade[]; height?: number }) {
  const counts = winLossCounts(trades);
  const data = [
    { name: 'Wins', value: counts.win },
    { name: 'Losses', value: counts.loss },
    { name: 'Breakeven', value: counts.breakeven },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>No trade data to chart.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={COLORS[d.name]} stroke="#0b0f16" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: '#10151d', border: '1px solid #1d2532', borderRadius: 8, fontSize: 12 }} />
        <Legend
          verticalAlign="bottom"
          height={28}
          formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
