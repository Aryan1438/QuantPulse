import type { ReactNode } from 'react';

type Tone = 'accent' | 'bullish' | 'bearish' | 'consolidation' | 'volatility' | 'muted' | 'info';

const toneClasses: Record<Tone, string> = {
  accent: 'bg-accent/10 text-accent border-accent/25',
  bullish: 'bg-bullish/10 text-bullish border-bullish/25',
  bearish: 'bg-bearish/10 text-bearish border-bearish/25',
  consolidation: 'bg-consolidation/10 text-consolidation border-consolidation/25',
  volatility: 'bg-volatility/10 text-volatility border-volatility/25',
  muted: 'bg-elevated text-muted border-border',
  info: 'bg-info/10 text-info border-info/25',
};

export function Badge({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function StatusDot({ tone = 'muted' }: { tone?: Tone }) {
  const dotColor: Record<Tone, string> = {
    accent: 'bg-accent',
    bullish: 'bg-bullish',
    bearish: 'bg-bearish',
    consolidation: 'bg-consolidation',
    volatility: 'bg-volatility',
    muted: 'bg-muted',
    info: 'bg-info',
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor[tone]}`} />;
}
