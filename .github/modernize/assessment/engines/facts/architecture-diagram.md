# Architecture Diagram

QuantPulse Terminal is a client-side React application for loading OHLCV market data, defining trading strategies, running deterministic backtests, and visualizing performance. Vite builds the TypeScript application for browser execution; there is no backend, database, or remote AI service in the current design.

## Application Architecture

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
~~~mermaid
flowchart TD
    subgraph ClientLayer["Client Layer"]
        Browser["Web Browser"]
    end
    subgraph PresentationLayer["Presentation Layer - React"]
        Router["App state router"]
        Pages["Application pages"]
        Charts["Charts and UI components"]
    end
    subgraph StateLayer["State Layer"]
        Context["React Context and reducer"]
        Domain["Shared domain types"]
    end
    subgraph LogicLayer["Trading Logic - TypeScript"]
        Parser["OHLCV CSV parser"]
        Indicators["Technical indicators"]
        Regimes["Market regime classifier"]
        Strategies["Strategy and DSL engines"]
        Backtest["Bar by bar backtest engine"]
        Analytics["Report analytics and narratives"]
    end
    subgraph StorageLayer["Browser Data Sources"]
        SampleData[("Bundled sample CSV data")]
        Uploads[("User uploaded CSV data")]
        Runtime[("In memory application state")]
    end

    Browser -->|"loads and interacts"| Router
    Router -->|"renders"| Pages
    Pages -->|"uses"| Charts
    Pages -->|"reads and updates"| Context
    Context -->|"stores"| Runtime
    Context -->|"uses"| Domain
    Pages -->|"uploads"| Parser
    SampleData -->|"loads"| Parser
    Uploads -->|"loads"| Parser
    Parser -->|"validated candles"| Context
    Context -->|"dataset metadata"| Regimes
    Regimes -->|"classified candles"| Context
    Context -->|"dataset and strategy"| Backtest
    Strategies -->|"signals and exits"| Backtest
    Indicators -->|"precomputed series"| Strategies
    Backtest -->|"completed result"| Context
    Context -->|"result data"| Analytics
    Analytics -->|"chart and report data"| Charts
~~~

### Technology Stack Summary

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Build and runtime | Vite | 8.x | Development server and production bundling |
| UI | React | 19.x | Component rendering and page composition |
| Language | TypeScript | 6.x | Type-safe UI and trading domain logic |
| Styling | Tailwind CSS with Vite plugin | 4.x | Utility styling and responsive layout |
| State | React Context and `useReducer` | React 19 | Shared datasets, strategies, results, and run history |
| Charting | Recharts | 3.x | Equity, drawdown, distribution, and report charts |
| Charting | lightweight-charts | 5.x | Candlestick market-data visualization |
| Testing | Vitest | 4.x | Unit tests for engines, indicators, comparisons, and state |
| Linting | Oxlint | 1.x | JavaScript and TypeScript lint checks |

### Data Storage & External Services

The application has no server-side persistence or external service integration. Built-in CSV files are served as static public assets, while users can upload OHLCV CSV or spreadsheet-style HTML table content in the browser. Parsed datasets, strategies, backtest results, activity, and run history live in React state for the current session. The “AI Insights” feature is a deterministic TypeScript rules engine rather than an LLM or network API call.

### Key Architectural Decisions

- Trading logic is kept in React-independent TypeScript modules, making indicators, parsing, strategy evaluation, backtesting, and report aggregation directly unit-testable.
- A shared React Context and reducer coordinates page-to-page workflow without a backend or routing library; `App.tsx` provides the state-based page router.
- The default, custom DSL, and visual builder strategy modes converge on the same bar-by-bar backtest result model, which allows all charts and reports to reuse one output shape.

## Component Relationships

<!-- mermaid-checked: no \n, no em-dash/en-dash, no {} in labels, subgraphs are id["label"], arrows are -->|"label"|, all subgraphs closed by end, ids unique -->
~~~mermaid
flowchart LR
    subgraph cPresentation["Presentation"]
        cApp["App and page router"]
        cNav["Top navigation"]
        cPages["Home dashboard data backtest strategy insights report compare"]
        cCharts["Chart components"]
    end
    subgraph cState["Application State"]
        cProvider["AppProvider"]
        cReducer["State reducer"]
        cTypes["Domain types"]
    end
    subgraph cBusiness["Business Logic"]
        cCsv["CSV parser"]
        cIndicators["Indicators"]
        cRegime["Regime classifier"]
        cDsl["Strategy DSL"]
        cBuilder["Visual strategy engine"]
        cBacktest["Backtest engine"]
        cInsights["Insights generator"]
        cReport["Report analytics"]
    end
    subgraph cData["Data and Assets"]
        cStatic["Public sample datasets"]
        cUpload["Browser file input"]
    end

    cApp -->|"provides context"| cProvider
    cApp -->|"selects"| cPages
    cNav -->|"changes page"| cApp
    cPages -->|"renders"| cCharts
    cPages -->|"reads and dispatches"| cProvider
    cProvider -->|"reduces actions"| cReducer
    cProvider -->|"shares contracts"| cTypes
    cUpload -->|"raw text"| cCsv
    cStatic -->|"sample text"| cCsv
    cCsv -->|"datasets"| cProvider
    cProvider -->|"classifies candles"| cRegime
    cRegime -->|"regime labels"| cProvider
    cProvider -->|"strategy inputs"| cDsl
    cProvider -->|"strategy inputs"| cBuilder
    cDsl -->|"signals"| cBacktest
    cBuilder -->|"signals"| cBacktest
    cIndicators -->|"series"| cDsl
    cIndicators -->|"series"| cBuilder
    cProvider -->|"dataset and strategy"| cBacktest
    cBacktest -->|"backtest result"| cProvider
    cProvider -->|"result"| cInsights
    cProvider -->|"trades"| cReport
    cInsights -->|"narrative"| cPages
    cReport -->|"aggregations"| cCharts
    cBacktest -->|"equity and trades"| cCharts
~~~

### Component Inventory

| Component | Layer | Type | Responsibility |
|---|---|---|---|
| `App` | Presentation | Router and composition root | Holds the active page, mounts `AppProvider`, and renders navigation plus the selected page |
| `TopNav` | Presentation | Layout component | Provides navigation between the application pages |
| Page modules | Presentation | React pages | Implement Home, Dashboard, Data, Backtest, Strategy, AI Insights, Report, and Compare workflows |
| Chart components | Presentation | Visualization components | Render candlesticks, equity, drawdown, regime, P&L, timing, and report views |
| `AppProvider` | Application State | React Context provider | Exposes application state and domain actions to all pages |
| `reducer` | Application State | State reducer | Applies dataset, strategy, backtest, activity, and history actions immutably |
| `types.ts` | Application State | Domain model | Defines candles, datasets, strategies, trades, results, regimes, and timeframes |
| `csvParser.ts` | Business Logic | Parser and validator | Converts CSV or HTML-table text into validated OHLCV candles |
| `indicators.ts` | Business Logic | Calculation library | Computes SMA, EMA, RSI, ATR, VWAP, MACD, and Bollinger series |
| `regime.ts` | Business Logic | Classifier | Labels candles using trend separation and volatility rules |
| `dsl.ts` | Business Logic | Parser and evaluator | Tokenizes, parses, precomputes, and evaluates custom strategy expressions |
| `strategyEngine.ts` | Business Logic | Rule engine | Evaluates visual builder conditions and multi-timeframe indicator references |
| `backtestEngine.ts` | Business Logic | Simulation engine | Validates data, processes bars, manages positions, and returns trades and equity |
| `insights.ts` | Business Logic | Narrative rules engine | Produces profitability, risk, consistency, and regime observations |
| `reportAnalytics.ts` | Business Logic | Aggregation library | Produces session, monthly, histogram, cumulative P&L, and win-loss data |
| `public/data` | Data and Assets | Static assets | Supplies bundled sample OHLCV datasets to the browser |
| Browser file input | Data and Assets | Runtime source | Supplies user-provided OHLCV data without uploading it to a service |
