import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import type { Page } from '../App';

const FEATURES: { title: string; detail: string; icon: string; page: Page }[] = [
  { title: 'Data', detail: 'Upload OHLCV CSVs or load a sample dataset to explore.', icon: '⟠', page: 'data' },
  { title: 'Strategy', detail: 'Configure a regime-filtered breakout strategy, or write custom entry/exit logic in a small DSL.', icon: '⚙', page: 'strategy' },
  { title: 'Backtest', detail: 'Simulate the strategy bar-by-bar across your dataset with realistic stop-loss/take-profit fills.', icon: '▶', page: 'backtest' },
  { title: 'AI Insights', detail: 'Get a rule-based read on profitability, risk, and which market regimes the strategy handles best.', icon: '◈', page: 'insights' },
];

export function Home({ onNavigate }: { onNavigate: (p: Page) => void }) {
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-16">
      <div className="text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-bullish" /> Client-side backtesting engine
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
          Build, backtest, and understand<br />rule-based trading strategies.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] text-text-dim">
          Upload historical OHLCV data, define entry/exit logic with regime filters or a custom DSL,
          and get an institutional-style breakdown of how the strategy actually performed.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="primary" size="md" onClick={() => onNavigate('data')}>Upload Data →</Button>
          <Button variant="outline" size="md" onClick={() => onNavigate('dashboard')}>View Dashboard</Button>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <Card key={f.title} className="cursor-pointer hover:border-accent/40 transition-colors" onClick={() => onNavigate(f.page)}>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-elevated text-accent">{f.icon}</div>
            <h3 className="mb-1 text-[15px] font-semibold text-text">{f.title}</h3>
            <p className="text-sm leading-relaxed text-text-dim">{f.detail}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
