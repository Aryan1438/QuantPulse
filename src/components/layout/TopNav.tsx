import { Badge, StatusDot } from '../ui/Badge';
import type { Page } from '../../App';

const NAV_ITEMS: { key: Page; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'dashboard', label: 'Dashboard', icon: '▦' },
  { key: 'data', label: 'Data', icon: '⟠' },
  { key: 'backtest', label: 'Backtest', icon: '▶' },
  { key: 'compare', label: 'Compare', icon: '⇄' },
  { key: 'strategy', label: 'Strategy', icon: '⚙' },
  { key: 'insights', label: 'AI Insights', icon: '◈' },
];

export function TopNav({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-dim text-sm font-extrabold text-bg">
              Q
            </div>
            <span className="text-[15px] font-bold text-text">QuantPulse</span>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  page === item.key
                    ? 'bg-accent/10 text-accent border border-accent/30'
                    : 'text-text-dim hover:text-text hover:bg-elevated border border-transparent'
                }`}
              >
                <span className="text-xs">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <Badge tone="bullish">
          <StatusDot tone="bullish" />
          System Ready
        </Badge>
      </div>
    </header>
  );
}
