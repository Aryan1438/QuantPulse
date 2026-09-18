import { useState } from 'react';
import { AppProvider } from './state/store';
import { TopNav } from './components/layout/TopNav';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Data } from './pages/Data';
import { Backtest } from './pages/Backtest';
import { Strategy } from './pages/Strategy';
import { AIInsights } from './pages/AIInsights';
import { Report } from './pages/Report';
import { Compare } from './pages/Compare';

export type Page = 'home' | 'dashboard' | 'data' | 'backtest' | 'strategy' | 'insights' | 'report' | 'compare';

function Router({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  switch (page) {
    case 'home':
      return <Home onNavigate={onNavigate} />;
    case 'dashboard':
      return <Dashboard onNavigate={onNavigate} />;
    case 'data':
      return <Data />;
    case 'backtest':
      return <Backtest onNavigate={onNavigate} />;
    case 'strategy':
      return <Strategy />;
    case 'insights':
      return <AIInsights onNavigate={onNavigate} />;
    case 'report':
      return <Report onNavigate={onNavigate} />;
    case 'compare':
      return <Compare onNavigate={onNavigate} />;
    default:
      return <Home onNavigate={onNavigate} />;
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('home');

  return (
    <AppProvider>
      <div className="min-h-screen bg-bg">
        {/* Nav hides on the printable report so PDF output is clean */}
        <div className="no-print">
          <TopNav page={page} onNavigate={setPage} />
        </div>
        <main>
          <Router page={page} onNavigate={setPage} />
        </main>
      </div>
    </AppProvider>
  );
}
