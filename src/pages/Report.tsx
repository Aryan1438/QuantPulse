import { useMemo } from 'react';
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
import { generateInsights } from '../lib/insights';
import {
  cumulativePnlCaption,
  drawdownCaption,
  equityCurveCaption,
  monthlyHeatmapCaption,
  pnlDistributionCaption,
  sessionAnalysisCaption,
  winLossCaption,
} from '../lib/reportNarrative';
import type { Page } from '../App';

function ReportSection({
  rank,
  medal,
  title,
  subtitle,
  caption,
  children,
}: {
  rank: number;
  medal: string;
  title: string;
  subtitle: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="report-section break-inside-avoid">
      <div className="mb-1 flex items-center gap-2">
        <span className="mono text-xs text-muted">#{rank}</span>
        <span className="text-base">{medal}</span>
        <h3 className="text-[15px] font-semibold text-text">{title}</h3>
      </div>
      <p className="mb-4 text-xs text-muted">{subtitle}</p>
      {children}
      <p className="mt-4 border-l-2 border-accent/40 pl-3 text-[13px] leading-relaxed text-text-dim">{caption}</p>
    </Card>
  );
}

export function Report({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { backtestResult, selectedDataset, selectedStrategy } = useApp();

  const insights = useMemo(() => (backtestResult ? generateInsights(backtestResult) : []), [backtestResult]);

  if (!backtestResult || !selectedDataset || !selectedStrategy) {
    return (
      <div className="mx-auto max-w-[1000px] px-6 py-16 text-center">
        <h1 className="text-xl font-bold text-text">No Backtest Data</h1>
        <p className="mt-2 text-sm text-muted">Run a backtest first, then generate a report from its results.</p>
        <Button variant="primary" className="mt-6" onClick={() => onNavigate('backtest')}>Go to Backtest</Button>
      </div>
    );
  }

  const trades = backtestResult.trades;
  const generatedAt = new Date(backtestResult.runAt);
  const handlePrint = () => {
    const previousTitle = document.title;
    document.title = `XAUUSD ${selectedStrategy.name} Backtest Report`;
    window.print();
    document.title = previousTitle;
  };

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-8">
      {/* Screen-only toolbar */}
      <div className="no-print mb-6 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-text">Strategy Performance Report</h1>
          <p className="mt-0.5 text-xs text-muted">Auto-generated documentation from the latest backtest run</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onNavigate('insights')}>← Back to Insights</Button>
          <Button variant="primary" onClick={handlePrint}>🖨 Generate PDF</Button>
        </div>
      </div>

      {/* Report cover */}
      <div className="report-cover mb-8 rounded-xl border border-border bg-surface p-8">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-dim text-sm font-extrabold text-bg">Q</div>
          <span className="text-sm font-bold text-text">QuantPulse</span>
        </div>
        <h1 className="mt-6 text-3xl font-extrabold text-text">Strategy Performance Report</h1>
        <p className="mt-2 text-sm text-text-dim">Institutional-style backtest documentation, generated directly from simulation output.</p>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border-soft pt-6 sm:grid-cols-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Strategy</div>
            <div className="mt-1 text-sm font-semibold text-text">{selectedStrategy.name}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Instrument</div>
            <div className="mt-1 text-sm font-semibold text-text">{selectedDataset.symbol}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Period</div>
            <div className="mt-1 text-sm font-semibold text-text">
              {new Date(selectedDataset.candles[0].time * 1000).toLocaleDateString()} – {new Date(selectedDataset.candles[selectedDataset.candles.length - 1].time * 1000).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted">Generated</div>
            <div className="mt-1 text-sm font-semibold text-text">{generatedAt.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* KPI summary */}
      <Card className="report-section mb-4 break-inside-avoid">
        <h3 className="mb-4 text-sm font-semibold text-text">Executive Summary</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {[
            ['Total Return', `${backtestResult.totalReturnPct >= 0 ? '+' : ''}${backtestResult.totalReturnPct.toFixed(2)}%`],
            ['Net Profit', `$${backtestResult.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`],
            ['Win Rate', `${backtestResult.winRatePct.toFixed(1)}%`],
            ['Profit Factor', Number.isFinite(backtestResult.profitFactor) ? backtestResult.profitFactor.toFixed(2) : '∞'],
            ['Max Drawdown', `${backtestResult.maxDrawdownPct.toFixed(2)}%`],
            ['Total Trades', `${backtestResult.totalTrades}`],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
              <div className="mono mt-1 text-lg font-semibold text-text">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 space-y-2 border-t border-border-soft pt-4">
          {insights.slice(0, 3).map((ins) => (
            <div key={ins.id} className="flex items-start gap-2 text-[13px]">
              <Badge tone={ins.tone === 'positive' ? 'bullish' : ins.tone === 'negative' ? 'bearish' : ins.tone === 'warning' ? 'consolidation' : 'muted'}>
                {ins.tone}
              </Badge>
              <span className="text-text-dim">{ins.detail}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 7 ranked report sections */}
      <div className="space-y-4">
        <ReportSection rank={1} medal="🥇" title="Equity Curve" subtitle="Portfolio value over time — the single most important chart in any strategy report." caption={equityCurveCaption(backtestResult)}>
          <EquityCurveChart data={backtestResult.equityCurve} height={280} />
        </ReportSection>

        <ReportSection rank={2} medal="🥈" title="Drawdown Curve" subtitle="Largest declines from equity peaks — demonstrates the strategy's realized risk." caption={drawdownCaption(backtestResult)}>
          <DrawdownChart data={backtestResult.equityCurve} height={220} />
        </ReportSection>

        <ReportSection rank={3} medal="🥉" title="Monthly Returns Heatmap" subtitle="Identify profitable and losing months at a glance." caption={monthlyHeatmapCaption(trades)}>
          <MonthlyHeatmap trades={trades} />
        </ReportSection>

        <ReportSection rank={4} medal="⭐" title="Profit &amp; Loss Distribution" subtitle="Whether profits come from many small trades or a few large winners." caption={pnlDistributionCaption(trades)}>
          <PnlHistogram trades={trades} height={240} />
        </ReportSection>

        <ReportSection rank={5} medal="⭐" title="Win vs Loss" subtitle="Quick visualization of the win rate and loss rate." caption={winLossCaption(trades)}>
          <WinLossPieChart trades={trades} height={240} />
        </ReportSection>

        <ReportSection rank={6} medal="⭐" title="Cumulative P&amp;L by Trade" subtitle="How profits accumulate trade by trade, highlighting consistency and streakiness." caption={cumulativePnlCaption(trades)}>
          <CumulativePnlChart trades={trades} height={240} />
        </ReportSection>

        <ReportSection rank={7} medal="⭐" title="Session / Time Analysis" subtitle="Profitability compared across trading sessions (Asian, London, New York, overlap)." caption={sessionAnalysisCaption(trades)}>
          <SessionAnalysisChart trades={trades} height={240} />
        </ReportSection>
      </div>

      <div className="report-section mt-6 border-t border-border-soft pt-4 text-center text-xs text-muted">
        QuantPulse Terminal — Report generated {generatedAt.toLocaleString()} · For internal documentation use
      </div>
    </div>
  );
}
