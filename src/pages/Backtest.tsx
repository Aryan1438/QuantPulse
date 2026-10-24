import { useState } from 'react';
import { useApp } from '../state/store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EquityCurveChart } from '../components/charts/EquityCurveChart';
import { DrawdownChart } from '../components/charts/DrawdownChart';
import { MonthlyHeatmap } from '../components/charts/MonthlyHeatmap';
import { PnlHistogram } from '../components/charts/PnlHistogram';
import { WinLossPieChart } from '../components/charts/WinLossPieChart';
import { CumulativePnlChart } from '../components/charts/CumulativePnlChart';
import { SessionAnalysisChart } from '../components/charts/SessionAnalysisChart';
import { runBacktest, BacktestError } from '../lib/backtestEngine';
import { validateDatasetQuality } from '../lib/mtf';
import type { Page } from '../App';

function StatCell({ label, value, tone }: { label: string; value: string; tone?: 'bullish' | 'bearish' }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mono mt-1 text-lg font-semibold ${tone === 'bullish' ? 'text-bullish' : tone === 'bearish' ? 'text-bearish' : 'text-text'}`}>
        {value}
      </div>
    </div>
  );
}

export function Backtest({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const {
    datasets, selectedDataset, selectedContextDataset, selectDataset, selectContextDataset,
    strategies, selectedStrategy, selectStrategy,
    backtestResult, isRunningBacktest,
    runBacktestStart, runBacktestDone, runBacktestError,
  } = useApp();

  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'distribution' | 'timing' | 'trades'>('overview');
  const missingConfig = !selectedDataset || !selectedContextDataset || !selectedStrategy;
  const selectedQuality = selectedDataset ? validateDatasetQuality(selectedDataset, selectedDataset.timeframe ?? 'D1') : null;
  const contextQuality = selectedContextDataset ? validateDatasetQuality(selectedContextDataset, selectedContextDataset.timeframe ?? 'H1') : null;

  const handleRun = () => {
    if (!selectedDataset || !selectedContextDataset || !selectedStrategy) return;
    if (selectedQuality?.status === 'INVALID' || contextQuality?.status === 'INVALID') {
      const issues = [...(selectedQuality?.issues ?? []), ...(contextQuality?.issues ?? [])];
      setError(`DATA QUALITY INVALID: ${issues.join('; ') || 'Dataset contains invalid data.'}`);
      return;
    }
    setError(null);
    runBacktestStart();
    setTimeout(() => {
      try {
        const result = runBacktest(selectedDataset, selectedStrategy, selectedContextDataset);
        runBacktestDone(result);
      } catch (e) {
        runBacktestError();
        setError(e instanceof BacktestError || e instanceof Error ? e.message : 'Backtest failed.');
      }
    }, 350);
  };

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-text">Backtest</h1>
          <p className="mt-0.5 text-xs text-muted">Run and analyze historical strategy performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { runBacktestError(); setError(null); }}>↺ Reset</Button>
          <Button variant="primary" disabled={missingConfig || isRunningBacktest} onClick={handleRun}>
            {isRunningBacktest ? 'Running…' : '▶ Run Backtest'}
          </Button>
        </div>
      </div>

      {missingConfig && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-consolidation/30 bg-consolidation/10 p-4">
          <div>
            <div className="text-sm font-semibold text-consolidation">⚠ Missing Configuration</div>
            <div className="text-xs text-text-dim">Please select execution data, context data, and a strategy.</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onNavigate('data')}>Go to Data</Button>
            <Button variant="outline" size="sm" onClick={() => onNavigate('strategy')}>Go to Strategy</Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-bearish/30 bg-bearish/10 p-4 text-sm text-bearish">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {!backtestResult ? (
            <Card className="flex h-[420px] items-center justify-center text-sm text-muted">
              {selectedDataset && selectedContextDataset ? 'Configure a strategy, then run the multi-timeframe backtest to view charts.' : 'Select execution and context datasets to view charts.'}
            </Card>
          ) : (
            <>
              <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
                {([
                  ['overview', 'Overview'],
                  ['distribution', 'Distribution'],
                  ['timing', 'Timing'],
                  ['trades', `Trade Log (${backtestResult.trades.length})`],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                      tab === key ? 'bg-elevated-2 text-text' : 'text-text-dim hover:text-text'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'overview' && (
                <>
                  <Card>
                    <h3 className="mb-1 text-sm font-semibold text-text">Equity Curve</h3>
                    <EquityCurveChart data={backtestResult.equityCurve} height={300} />
                  </Card>
                  <Card>
                    <h3 className="mb-1 text-sm font-semibold text-text">Drawdown</h3>
                    <DrawdownChart data={backtestResult.equityCurve} height={200} />
                  </Card>
                  <Card>
                    <h3 className="mb-1 text-sm font-semibold text-text">Cumulative P&amp;L by Trade</h3>
                    <CumulativePnlChart trades={backtestResult.trades} height={220} />
                  </Card>
                </>
              )}

              {tab === 'distribution' && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Card>
                      <h3 className="mb-1 text-sm font-semibold text-text">Win vs Loss</h3>
                      <WinLossPieChart trades={backtestResult.trades} height={260} />
                    </Card>
                    <Card>
                      <h3 className="mb-1 text-sm font-semibold text-text">P&amp;L Distribution</h3>
                      <PnlHistogram trades={backtestResult.trades} height={260} />
                    </Card>
                  </div>
                  <Card>
                    <h3 className="mb-3 text-sm font-semibold text-text">Monthly Returns Heatmap</h3>
                    <MonthlyHeatmap trades={backtestResult.trades} />
                  </Card>
                </>
              )}

              {tab === 'timing' && (
                <Card>
                  <h3 className="mb-1 text-sm font-semibold text-text">Session / Time Analysis</h3>
                  <p className="mb-3 text-xs text-muted">PnL grouped by trading session (Asian, London, New York, overlap), based on entry time.</p>
                  <SessionAnalysisChart trades={backtestResult.trades} height={300} />
                </Card>
              )}

              {tab === 'trades' && (
                <Card>
                  <h3 className="mb-3 text-sm font-semibold text-text">Trade Log</h3>
                  <div className="max-h-[560px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-surface text-muted">
                        <tr className="border-b border-border">
                          <th className="py-2 pr-3 font-medium">#</th>
                          <th className="py-2 pr-3 font-medium">Side</th>
                          <th className="py-2 pr-3 font-medium">Signal / Entry</th>
                          <th className="py-2 pr-3 font-medium">Exit</th>
                          <th className="py-2 pr-3 font-medium">R</th>
                          <th className="py-2 pr-3 font-medium">PnL</th>
                          <th className="py-2 pr-3 font-medium">Timeframes</th>
                          <th className="py-2 pr-3 font-medium">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backtestResult.trades.map((t) => (
                          <tr key={t.id} className="border-b border-border-soft">
                            <td className="mono py-2 pr-3 text-text-dim">{t.id}</td>
                            <td className="py-2 pr-3">
                              <Badge tone={t.side === 'long' ? 'bullish' : 'bearish'}>{t.side}</Badge>
                            </td>
                            <td className="py-2 pr-3 text-text-dim"><div className="mono">{t.entryPrice.toFixed(2)}</div><div className="text-[10px] text-muted">{new Date((t.signalTimestamp ?? t.entryTime) * 1000).toISOString()} UTC</div></td>
                            <td className="py-2 pr-3 text-text-dim"><div className="mono">{t.exitPrice.toFixed(2)}</div><div className="text-[10px] text-muted">{new Date(t.exitTime * 1000).toISOString()} UTC</div></td>
                            <td className="mono py-2 pr-3 text-text-dim">{t.rMultiple.toFixed(2)}R</td>
                            <td className={`mono py-2 pr-3 font-medium ${t.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(0)}
                            </td>
                            <td className="py-2 pr-3 text-text-dim">{t.entryTimeframe ?? '—'} / {t.executionTimeframe ?? '—'}</td>
                            <td className="py-2 pr-3">
                              <Badge tone={t.result === 'win' ? 'bullish' : t.result === 'loss' ? 'bearish' : 'muted'}>{t.result}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {backtestResult.trades.length === 0 && (
                      <div className="py-8 text-center text-sm text-muted">
                        No trades were triggered by this strategy over the selected dataset.
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">⌁ Configuration</h3>

            <div className="mb-4">
              <div className="mb-1 text-xs text-muted">Execution / Lower Timeframe</div>
              <select
                value={selectedDataset?.id ?? ''}
                onChange={(e) => selectDataset(e.target.value || null)}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
              >
                <option value="">None selected</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <div className="mb-1 text-xs text-muted">Context / Higher Timeframe</div>
              <select
                value={selectedContextDataset?.id ?? ''}
                onChange={(e) => selectContextDataset(e.target.value || null)}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
              >
                <option value="">None selected</option>
                {datasets.filter((d) => d.id !== selectedDataset?.id).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 text-xs text-muted">Selected Strategy</div>
              <select
                value={selectedStrategy?.id ?? ''}
                onChange={(e) => selectStrategy(e.target.value || null)}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
              >
                <option value="">None selected</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {selectedDataset && selectedContextDataset && selectedQuality && contextQuality && (
              <div className="mt-4 rounded-lg border border-border bg-elevated p-3 text-xs text-text-dim">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-muted">ONE MULTI-TIMEFRAME BACKTEST</div>
                <div>Symbol: {selectedDataset.symbol}</div>
                <div>Context: {selectedContextDataset.timeframe ?? '—'} · {contextQuality.rows} rows</div>
                <div>Execution: {selectedDataset.timeframe ?? '—'} · {selectedQuality.rows} rows</div>
                <div>Evaluation resolution: {selectedDataset.timeframe ?? '—'}</div>
                <div>Timezone: UTC</div>
                <div className="mt-2 font-semibold text-text">Status: {selectedQuality.status} / {contextQuality.status}</div>
              </div>
            )}
          </Card>

          {backtestResult && (
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-text">Results Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCell label="Total Return" value={`${backtestResult.totalReturnPct >= 0 ? '+' : ''}${backtestResult.totalReturnPct.toFixed(2)}%`} tone={backtestResult.totalReturnPct >= 0 ? 'bullish' : 'bearish'} />
                <StatCell label="Net Profit" value={`$${backtestResult.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} tone={backtestResult.netProfit >= 0 ? 'bullish' : 'bearish'} />
                <StatCell label="Win Rate" value={`${backtestResult.winRatePct.toFixed(1)}%`} />
                <StatCell label="Profit Factor" value={Number.isFinite(backtestResult.profitFactor) ? backtestResult.profitFactor.toFixed(2) : '∞'} />
                <StatCell label="Max Drawdown" value={`${backtestResult.maxDrawdownPct.toFixed(2)}%`} tone="bearish" />
                <StatCell label="Sharpe (approx)" value={backtestResult.sharpeApprox.toFixed(2)} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
