import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useApp } from '../state/store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  buildComparisonChartData,
  MAX_COMPARISON_SELECTION,
  rankByReturn,
  toComparisonRow,
} from '../lib/comparison';
import type { Page } from '../App';

const LINE_COLORS = ['#22d3a5', '#38bdf8', '#fb7185', '#fbbf24', '#a78bfa', '#f472b6'];

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export function Compare({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { runHistory, removeRunFromHistory, clearRunHistory } = useApp();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => runHistory.slice(0, 3).map((r) => r.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARISON_SELECTION) return prev; // cap reached, ignore
      return [...prev, id];
    });
  };

  const selectedEntries = useMemo(
    () => runHistory.filter((r) => selectedIds.includes(r.id)),
    [runHistory, selectedIds],
  );

  const rows = useMemo(
    () => rankByReturn(selectedEntries.map(toComparisonRow)),
    [selectedEntries],
  );

  const chartData = useMemo(() => buildComparisonChartData(selectedEntries), [selectedEntries]);

  const colorFor = (id: string) => {
    const idx = selectedEntries.findIndex((e) => e.id === id);
    return LINE_COLORS[idx % LINE_COLORS.length];
  };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-text">Compare Runs</h1>
          <p className="mt-0.5 text-xs text-muted">
            Every completed backtest is kept here — select up to {MAX_COMPARISON_SELECTION} to compare strategies or parameter variants side by side.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onNavigate('backtest')}>▶ Run Another Backtest</Button>
          {runHistory.length > 0 && (
            <Button variant="outline" onClick={clearRunHistory}>🗑 Clear History</Button>
          )}
        </div>
      </div>

      {runHistory.length === 0 ? (
        <Card className="flex h-[420px] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-elevated text-3xl text-muted">⇄</div>
          <h3 className="text-base font-semibold text-text">No Runs Yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Run a backtest to start building history. Every run — Default, Custom, or Builder — is saved here so you can compare them later.
          </p>
          <Button variant="primary" className="mt-5" onClick={() => onNavigate('backtest')}>Go to Backtest</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          {/* Run history list with checkboxes */}
          <Card className="h-fit">
            <h3 className="mb-3 text-sm font-semibold text-text">Run History ({runHistory.length})</h3>
            <div className="space-y-2">
              {runHistory.map((entry) => {
                const checked = selectedIds.includes(entry.id);
                const disabled = !checked && selectedIds.length >= MAX_COMPARISON_SELECTION;
                return (
                  <div
                    key={entry.id}
                    className={`rounded-lg border p-3 text-xs transition-colors ${
                      checked ? 'border-accent/40 bg-accent/5' : 'border-border bg-elevated'
                    } ${disabled ? 'opacity-40' : ''}`}
                  >
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleSelected(entry.id)}
                        className="mt-0.5 accent-accent"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-text">{entry.strategyName}</span>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRunFromHistory(entry.id); }}
                            className="shrink-0 text-[11px] text-bearish hover:underline"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-muted">
                          <Badge tone="muted">{entry.strategyMode}</Badge>
                          <span>{entry.datasetSymbol}</span>
                        </div>
                        <div className={`mono mt-1 font-semibold ${entry.result.totalReturnPct >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                          {fmtPct(entry.result.totalReturnPct)}
                        </div>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Comparison content */}
          <div className="space-y-4">
            {selectedEntries.length === 0 ? (
              <Card className="flex h-[300px] items-center justify-center text-sm text-muted">
                Select one or more runs from the list to compare.
              </Card>
            ) : (
              <>
                <Card>
                  <h3 className="mb-1 text-sm font-semibold text-text">Overlaid Return Curves</h3>
                  <p className="mb-3 text-xs text-muted">
                    Each curve is normalized to % return from that run's own starting capital, plotted against % progress through the backtest — so runs with different capital or dataset length can be compared fairly.
                  </p>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#161c26" vertical={false} />
                      <XAxis
                        dataKey="progressPct"
                        tickFormatter={(v) => `${v}%`}
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
                        tickFormatter={(v) => `${v}%`}
                        width={48}
                      />
                      <Tooltip
                        contentStyle={{ background: '#10151d', border: '1px solid #1d2532', borderRadius: 8, fontSize: 12 }}
                        formatter={(value, name) => [
                          `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`,
                          selectedEntries.find((e) => e.id === name)?.strategyName ?? String(name),
                        ]}
                        labelFormatter={(v) => `${v}% through backtest`}
                      />
                      <Legend
                        formatter={(value) => selectedEntries.find((e) => e.id === value)?.strategyName ?? value}
                        wrapperStyle={{ fontSize: 12 }}
                      />
                      {selectedEntries.map((entry) => (
                        <Line
                          key={entry.id}
                          type="monotone"
                          dataKey={entry.id}
                          stroke={colorFor(entry.id)}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <h3 className="mb-3 text-sm font-semibold text-text">Metrics Comparison</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-muted">
                        <tr className="border-b border-border">
                          <th className="py-2 pr-3 font-medium">Strategy</th>
                          <th className="py-2 pr-3 font-medium">Total Return</th>
                          <th className="py-2 pr-3 font-medium">Net Profit</th>
                          <th className="py-2 pr-3 font-medium">Win Rate</th>
                          <th className="py-2 pr-3 font-medium">Profit Factor</th>
                          <th className="py-2 pr-3 font-medium">Max DD</th>
                          <th className="py-2 pr-3 font-medium">Sharpe</th>
                          <th className="py-2 pr-3 font-medium">Trades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, idx) => (
                          <tr key={row.id} className="border-b border-border-soft">
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorFor(row.id) }} />
                                <span className="font-medium text-text">{row.label}</span>
                                {idx === 0 && rows.length > 1 && <Badge tone="bullish">Best</Badge>}
                              </div>
                            </td>
                            <td className={`mono py-2 pr-3 font-medium ${row.totalReturnPct >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {fmtPct(row.totalReturnPct)}
                            </td>
                            <td className={`mono py-2 pr-3 ${row.netProfit >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {row.netProfit >= 0 ? '+' : ''}${row.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className="mono py-2 pr-3 text-text-dim">{row.winRatePct.toFixed(1)}%</td>
                            <td className="mono py-2 pr-3 text-text-dim">{Number.isFinite(row.profitFactor) ? row.profitFactor.toFixed(2) : '∞'}</td>
                            <td className="mono py-2 pr-3 text-bearish">{row.maxDrawdownPct.toFixed(2)}%</td>
                            <td className="mono py-2 pr-3 text-text-dim">{row.sharpeApprox.toFixed(2)}</td>
                            <td className="mono py-2 pr-3 text-text-dim">{row.totalTrades}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
