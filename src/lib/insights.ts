// Deterministic rules engine that turns a BacktestResult into the kind of
// narrative the "AI Insights" page shows. No external LLM call — this
// keeps the app fully self-contained — but the function signature
// (BacktestResult -> Insight[]) is narrow enough to swap in a real model
// call later without touching callers.

import { REGIME_LABELS } from './regime';
import type { BacktestResult, Regime } from './types';

export interface Insight {
  id: string;
  tone: 'positive' | 'negative' | 'neutral' | 'warning';
  title: string;
  detail: string;
}

export function generateInsights(result: BacktestResult): Insight[] {
  const insights: Insight[] = [];

  if (result.totalTrades === 0) {
    insights.push({
      id: 'no-trades',
      tone: 'warning',
      title: 'No trades were triggered',
      detail:
        'The strategy conditions never fired over this dataset. Widen the regime filter, lower the entry threshold, or try a longer/different dataset.',
    });
    return insights;
  }

  // Profitability
  if (result.netProfit > 0 && result.profitFactor >= 1.5) {
    insights.push({
      id: 'profitability',
      tone: 'positive',
      title: 'Strategy is solidly profitable',
      detail: `Net profit of $${result.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })} across ${result.totalTrades} trades, with a profit factor of ${result.profitFactor.toFixed(2)}.`,
    });
  } else if (result.netProfit > 0) {
    insights.push({
      id: 'profitability',
      tone: 'neutral',
      title: 'Marginally profitable',
      detail: `Net profit is positive but the profit factor (${result.profitFactor.toFixed(2)}) is thin — small changes in slippage or fees could flip this negative.`,
    });
  } else {
    insights.push({
      id: 'profitability',
      tone: 'negative',
      title: 'Strategy is net negative on this dataset',
      detail: `Net result: -$${Math.abs(result.netProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })} across ${result.totalTrades} trades. Consider revisiting entry criteria or risk parameters.`,
    });
  }

  // Risk
  const ddSeverity = result.maxDrawdownPct <= -25 ? 'severe' : result.maxDrawdownPct <= -10 ? 'moderate' : 'contained';
  insights.push({
    id: 'drawdown',
    tone: ddSeverity === 'severe' ? 'negative' : ddSeverity === 'moderate' ? 'warning' : 'positive',
    title: `Max drawdown was ${ddSeverity}`,
    detail: `Equity drew down ${Math.abs(result.maxDrawdownPct).toFixed(1)}% from its peak. ${
      ddSeverity === 'severe'
        ? 'This exceeds typical institutional risk tolerance — position sizing or stop placement may need tightening.'
        : ddSeverity === 'moderate'
          ? 'This is within a reasonable range but worth monitoring across more market cycles.'
          : 'Risk was well-contained across the tested period.'
    }`,
  });

  // Sharpe
  insights.push({
    id: 'sharpe',
    tone: result.sharpeApprox >= 1 ? 'positive' : result.sharpeApprox >= 0 ? 'neutral' : 'negative',
    title: `Risk-adjusted return: Sharpe ≈ ${result.sharpeApprox.toFixed(2)}`,
    detail:
      result.sharpeApprox >= 1
        ? 'Returns are compensating well for the volatility taken on.'
        : 'Returns are not yet clearly compensating for volatility — a larger sample or refined entries may help.',
  });

  // Win rate / consistency
  insights.push({
    id: 'consistency',
    tone: result.winRatePct >= 45 ? 'positive' : 'neutral',
    title: `Win rate: ${result.winRatePct.toFixed(1)}%`,
    detail: `${result.totalTrades} total trades were evaluated. ${
      result.winRatePct < 40
        ? 'A lower win rate can still be profitable if winners are meaningfully larger than losers — check the reward:risk setting.'
        : 'This is a competitive win rate for a rules-based breakout/trend strategy.'
    }`,
  });

  // Regime breakdown — call out the best and worst performing regimes.
  const regimeEntries = (Object.entries(result.regimeBreakdown) as [Regime, BacktestResult['regimeBreakdown'][Regime]][])
    .filter(([, v]) => v.trades > 0)
    .sort((a, b) => b[1].pnl - a[1].pnl);

  if (regimeEntries.length > 0) {
    const [bestRegime, bestStats] = regimeEntries[0];
    const [worstRegime, worstStats] = regimeEntries[regimeEntries.length - 1];
    insights.push({
      id: 'regime-best',
      tone: 'positive',
      title: `Strongest in ${REGIME_LABELS[bestRegime]} conditions`,
      detail: `${bestStats.trades} trades, ${bestStats.winRate.toFixed(0)}% win rate, $${bestStats.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} net.`,
    });
    if (worstRegime !== bestRegime && regimeEntries.length > 1) {
      insights.push({
        id: 'regime-worst',
        tone: worstStats.pnl < 0 ? 'warning' : 'neutral',
        title: `Weakest in ${REGIME_LABELS[worstRegime]} conditions`,
        detail: `${worstStats.trades} trades, ${worstStats.winRate.toFixed(0)}% win rate, $${worstStats.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} net. ${
          worstStats.pnl < 0 ? 'Consider excluding this regime from the filter.' : ''
        }`,
      });
    }
  }

  return insights;
}
