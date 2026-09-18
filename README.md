# QuantPulse Terminal

A client-side strategy backtesting platform: upload OHLCV data, configure a
rule-based strategy (regime-filtered breakout, or a custom entry/exit DSL),
run a bar-by-bar backtest, and read an automated performance breakdown —
all in the browser, no backend required.

## Pages

- **Home** — landing page with feature overview.
- **Dashboard** — KPI cards (total return, max drawdown, win rate, trade
  count), equity curve, recent activity feed, quick actions, system status.
- **Data** — load the built-in sample BTC/USDT dataset or upload your own
  OHLCV CSV. Shows a candlestick chart and a market regime timeline.
- **Backtest** — select a dataset + strategy, run the simulation, and explore
  results across four tabs: **Overview** (equity curve, drawdown,
  cumulative P&L by trade), **Distribution** (win/loss pie, P&L histogram,
  monthly returns heatmap), **Timing** (session/time-of-day performance),
  and the full **Trade Log**.
- **Strategy** — configure a strategy in one of two modes:
  - **Default**: pick which market regimes to trade in, risk per trade,
    stop-loss (ATR multiple), and take-profit (reward:risk ratio). A live
    "Logic Preview" shows the generated rules.
  - **Custom**: write entry/exit logic directly in a small DSL, e.g.
    ```
    IF close > EMA(20) THEN
    ENTER long
    STOP_LOSS = ATR(14) * 1.5
    TAKE_PROFIT = ATR(14) * 3
    ```
    Supported indicators: `SMA`, `EMA`, `RSI`, `VWAP`, `ATR` (each takes a
    period), plus `close`/`open`/`high`/`low`/`volume`. The editor validates
    syntax live.
- **AI Insights** — a rule-based narrative (not an LLM call) that reads the
  backtest result and reports on profitability, drawdown severity,
  risk-adjusted return, consistency, and which market regime the strategy
  handled best/worst. Includes a **Generate Report** panel that opens the
  full printable Strategy Performance Report.
- **Report** (reached via "Generate Report" on AI Insights) — a
  documentation-ready report built directly from the latest backtest run:
  cover page, executive summary, and seven ranked sections — Equity Curve,
  Drawdown Curve, Monthly Returns Heatmap, P&L Distribution, Win vs Loss,
  Cumulative P&L by Trade, and Session/Time Analysis — each with an
  auto-written interpretive caption. Use the browser's Print → Save as PDF
  (button provided) to export it; a print stylesheet hides the nav/buttons
  and paginates cleanly.

## Architecture

```
src/
  lib/                     # Pure logic — no React, fully unit-testable
    types.ts               # Shared domain types
    indicators.ts          # SMA, EMA, RSI, ATR, VWAP
    regime.ts               # Rule-based market regime classifier
    dsl.ts                  # Custom strategy DSL — tokenizer/parser/evaluator
    backtestEngine.ts       # Bar-by-bar simulation (default + custom modes)
    insights.ts              # Rule-based "AI Insights" narrative generator
    reportAnalytics.ts        # Session, monthly heatmap, histogram, cumulative PnL aggregation
    reportNarrative.ts         # Auto-written captions for each report chart
    sampleData.ts             # Deterministic synthetic OHLCV generator
    csvParser.ts               # OHLCV CSV upload parsing + validation
  state/store.tsx            # App-wide state (React Context + reducer)
  components/
    layout/TopNav.tsx
    ui/                       # Card, Badge, Button primitives
    charts/                   # Candlestick (lightweight-charts), equity
                               # curve, drawdown, monthly heatmap, PnL
                               # histogram, win/loss pie, cumulative PnL,
                               # session analysis, regime timeline
  pages/                      # Home, Dashboard, Data, Backtest, Strategy,
                               # AIInsights, Report
  App.tsx                     # Simple state-based page router
```

`lib/` has zero dependency on React or the UI — the backtest engine, DSL
parser, and regime classifier are plain TypeScript functions you could
reuse in a CLI, a worker thread, or a server-side job without changes.

## Strategy DSL semantics

- `IF <condition> THEN` — the entry trigger, evaluated on every bar once
  there's no open position.
- `ENTER long` / `ENTER short` — direction taken when the condition is true.
- `STOP_LOSS = <expr>` / `TAKE_PROFIT = <expr>` — evaluated as a **price
  distance** from the entry (not an absolute price), matching how the
  Default mode's ATR-multiple stops work. E.g. `ATR(14) * 1.5` means the
  stop sits 1.5×ATR away from the entry price.
- Expressions support `+ - * /`, parentheses, comparisons `> < >= <= ==`,
  the five indicator functions, and the five OHLCV fields.

## Setup

```bash
npm install
npm run dev       # starts Vite dev server
npm run build      # type-checks + production build to dist/
npm run preview    # serve the production build locally
```

## Try it

1. Go to **Data** → **Load Sample Data** (a synthetic 500-candle BTC/USDT
   series with a mix of trending and choppy phases).
2. Go to **Strategy** → keep the default "Default Breakout Strategy" or
   switch to Custom and edit the DSL.
3. Go to **Backtest** → select the dataset + strategy → **Run Backtest**.
4. Go to **AI Insights** to see the generated performance narrative.

## Notes on the regime classifier

Regimes are classified per-candle using EMA20 vs EMA50 separation (trend
direction) and ATR as a percentage of price (volatility), not a
statistical/ML model. This keeps the classification fully transparent and
reproducible, and is documented in `lib/regime.ts` if you want to tune the
thresholds.
