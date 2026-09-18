import { useApp } from '../state/store';
import { Card } from '../components/ui/Card';
import { Badge, StatusDot } from '../components/ui/Badge';
import { EquityCurveChart } from '../components/charts/EquityCurveChart';
import type { Page } from '../App';

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'bullish' | 'bearish' | 'muted' }) {
  return (
    <Card className={tone === 'bullish' ? 'border-l-2 border-l-bullish' : tone === 'bearish' ? 'border-l-2 border-l-bearish' : ''}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mono mt-2 text-2xl font-semibold text-text">{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </Card>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { selectedDataset, selectedStrategy, backtestResult, activity, datasets, strategies } = useApp();

  const hasResult = !!backtestResult;
  const totalReturn = hasResult ? backtestResult!.totalReturnPct : 0;
  const maxDd = hasResult ? backtestResult!.maxDrawdownPct : 0;
  const winRate = hasResult ? backtestResult!.winRatePct : 0;
  const totalTrades = hasResult ? backtestResult!.totalTrades : 0;

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 flex items-start justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-text">Dashboard</h1>
          <p className="mt-0.5 text-xs text-muted">Overview of your backtesting performance and system status</p>
        </div>
        <Badge tone={selectedDataset ? 'bullish' : 'muted'}>
          <StatusDot tone={selectedDataset ? 'bullish' : 'muted'} />
          {selectedDataset ? selectedDataset.symbol : 'No dataset selected'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Return" value={`${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`} sub="All time performance" tone={totalReturn > 0 ? 'bullish' : totalReturn < 0 ? 'bearish' : 'muted'} />
        <KpiCard label="Max Drawdown" value={`${maxDd.toFixed(2)}%`} sub="Worst peak-to-trough" tone={maxDd < -15 ? 'bearish' : 'muted'} />
        <KpiCard label="Win Rate" value={`${winRate.toFixed(1)}%`} sub="Profitable trades" tone="muted" />
        <KpiCard label="Total Trades" value={`${totalTrades}`} sub="Backtested positions" tone="muted" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Equity Curve</h3>
            {selectedStrategy && <span className="text-xs text-muted">{selectedStrategy.name}</span>}
          </div>
          <EquityCurveChart data={backtestResult?.equityCurve ?? []} height={340} />
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-text">Recent Activity</h3>
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {activity.map((ev) => (
              <div key={ev.id} className="border-b border-border-soft pb-3 last:border-0">
                <div className="text-[13px] font-medium text-text">{ev.title}</div>
                <div className="mt-0.5 text-xs text-muted">{ev.detail}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="mb-3 text-sm font-semibold text-text">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button onClick={() => onNavigate('data')} className="flex items-center justify-between rounded-lg border border-border bg-elevated p-4 text-left hover:border-accent/40 transition-colors">
            <div>
              <div className="text-sm font-medium text-text">Upload Data</div>
              <div className="text-xs text-muted">Import OHLCV CSV files</div>
            </div>
            <span className="text-accent">→</span>
          </button>
          <button onClick={() => onNavigate('backtest')} className="flex items-center justify-between rounded-lg border border-border bg-elevated p-4 text-left hover:border-accent/40 transition-colors">
            <div>
              <div className="text-sm font-medium text-text">Run Backtest</div>
              <div className="text-xs text-muted">Test strategy on history</div>
            </div>
            <span className="text-accent">→</span>
          </button>
          <button onClick={() => onNavigate('insights')} className="flex items-center justify-between rounded-lg border border-border bg-elevated p-4 text-left hover:border-accent/40 transition-colors">
            <div>
              <div className="text-sm font-medium text-text">AI Insights</div>
              <div className="text-xs text-muted">Performance analysis</div>
            </div>
            <span className="text-accent">→</span>
          </button>
        </div>
      </Card>

      <Card className="mt-4">
        <h3 className="mb-3 text-sm font-semibold text-text">System Status</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs text-text-dim">
          <div className="flex items-center gap-2"><StatusDot tone={datasets.length ? 'bullish' : 'consolidation'} /> Data Engine ({datasets.length ? 'Ready' : 'Idle'})</div>
          <div className="flex items-center gap-2"><StatusDot tone={selectedStrategy ? 'bullish' : 'consolidation'} /> Backtest Engine ({selectedStrategy ? 'Ready' : 'No Strategy'})</div>
          <div className="flex items-center gap-2"><StatusDot tone={hasResult ? 'bullish' : 'muted'} /> AI Analysis ({hasResult ? 'Ready' : 'Idle'})</div>
          <div className="flex items-center gap-2"><StatusDot tone="muted" /> Strategies Saved ({strategies.length})</div>
        </div>
      </Card>
    </div>
  );
}
