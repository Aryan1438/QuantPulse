import { useMemo } from 'react';
import { useApp } from '../state/store';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { generateInsights } from '../lib/insights';
import { REGIME_LABELS } from '../lib/regime';
import type { Page } from '../App';
import type { Regime } from '../lib/types';

const TONE_BADGE: Record<string, 'bullish' | 'bearish' | 'consolidation' | 'muted'> = {
  positive: 'bullish',
  negative: 'bearish',
  warning: 'consolidation',
  neutral: 'muted',
};

export function AIInsights({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { backtestResult, selectedDataset } = useApp();

  const insights = useMemo(() => (backtestResult ? generateInsights(backtestResult) : []), [backtestResult]);

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-xl font-bold text-text">AI Insights</h1>
        <p className="mt-0.5 text-xs text-muted">Rule-based analysis of your strategy performance</p>
      </div>

      <Card className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text">⚡ Live Market Snapshot</h3>
          {selectedDataset && <span className="text-xs text-muted">{selectedDataset.symbol}</span>}
        </div>
        <p className="text-xs text-muted">
          {selectedDataset
            ? `${selectedDataset.candles.length} candles loaded. Regime classification runs automatically on load.`
            : 'Select a symbol on the Data page to see dataset details.'}
        </p>
      </Card>

      {!backtestResult ? (
        <Card className="flex h-[420px] flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-elevated text-3xl text-muted">◈</div>
          <h3 className="text-base font-semibold text-text">No Data for Analysis</h3>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Run a backtest to generate AI-driven insights. The engine needs trade history to detect patterns and regime performance.
          </p>
          <Button variant="primary" className="mt-5" onClick={() => onNavigate('backtest')}>Go to Backtest</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {insights.map((ins) => (
              <Card key={ins.id}>
                <div className="mb-1 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-text">{ins.title}</h4>
                  <Badge tone={TONE_BADGE[ins.tone]}>{ins.tone}</Badge>
                </div>
                <p className="text-sm leading-relaxed text-text-dim">{ins.detail}</p>
              </Card>
            ))}
          </div>

          <div>
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-text">Regime Performance</h3>
              <div className="space-y-3">
                {(Object.entries(backtestResult.regimeBreakdown) as [Regime, typeof backtestResult.regimeBreakdown[Regime]][])
                  .filter(([, v]) => v.trades > 0)
                  .sort((a, b) => b[1].pnl - a[1].pnl)
                  .map(([regime, stats]) => (
                    <div key={regime} className="rounded-lg border border-border bg-elevated p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-medium text-text">{REGIME_LABELS[regime]}</span>
                        <span className={`mono text-sm font-semibold ${stats.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                          {stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted">
                        <span>{stats.trades} trades</span>
                        <span>{stats.winRate.toFixed(0)}% win rate</span>
                      </div>
                    </div>
                  ))}
                {backtestResult.trades.length === 0 && (
                  <p className="text-sm text-muted">No trades to break down by regime.</p>
                )}
              </div>
            </Card>

            <Card accent className="mt-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-accent">📄</span>
                <h3 className="text-sm font-semibold text-text">Generate Report</h3>
              </div>
              <p className="mb-4 text-xs leading-relaxed text-text-dim">
                Compile everything above into a full strategy report — equity curve, drawdown, monthly
                returns heatmap, P&amp;L distribution, win/loss split, cumulative P&amp;L, and session
                analysis — with auto-written explanations for each chart. Built directly from this
                backtest run, ready to print or save as a PDF.
              </p>
              <Button variant="primary" className="w-full" onClick={() => onNavigate('report')}>
                Generate Report →
              </Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
