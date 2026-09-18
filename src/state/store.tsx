import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type {
  ActivityEvent,
  BacktestResult,
  BuilderStrategyConfig,
  Dataset,
  DefaultStrategyConfig,
  Regime,
  RunHistoryEntry,
  Strategy,
} from '../lib/types';
import { classifyRegimes } from '../lib/regime';
import { generateXauUsdCandles } from '../lib/sampleData';
import { MAX_RUN_HISTORY } from '../lib/comparison';

const DEFAULT_STRATEGY_CONFIG: DefaultStrategyConfig = {
  regimes: ['bullish', 'bearish'],
  riskPerTradePct: 1,
  stopLossAtrMultiple: 1.5,
  takeProfitRR: 2.0,
};

const DEFAULT_CUSTOM_CODE = `IF close > EMA(20) THEN
ENTER long
STOP_LOSS = ATR(14) * 1.5
TAKE_PROFIT = ATR(14) * 3`;

// A ready-to-run example so the Builder tab isn't empty on first visit:
// EMA(20) crosses above EMA(50) to go long, opposite cross to go short.
export function makeDefaultBuilderConfig(): BuilderStrategyConfig {
  return {
    direction: 'long',
    timeframeLabel: 'As loaded',
    initialCapital: 100_000,
    entryLong: {
      combinator: 'AND',
      conditions: [
        {
          id: 'cond-long-1',
          left: { type: 'indicator', indicator: { kind: 'EMA', period: 20 } },
          operator: 'crosses_above',
          right: { type: 'indicator', indicator: { kind: 'EMA', period: 50 } },
        },
      ],
    },
    entryShort: {
      combinator: 'AND',
      conditions: [
        {
          id: 'cond-short-1',
          left: { type: 'indicator', indicator: { kind: 'EMA', period: 20 } },
          operator: 'crosses_below',
          right: { type: 'indicator', indicator: { kind: 'EMA', period: 50 } },
        },
      ],
    },
    exit: {
      stopLossMode: 'atr_multiple',
      stopLossAtrMultiple: 1.5,
      stopLossPct: 1,
      stopLossIndicator: null,
      takeProfitMode: 'risk_reward',
      takeProfitRR: 2,
      takeProfitPct: 2,
      takeProfitIndicator: null,
      oppositeSignalExit: false,
    },
    risk: {
      positionSizingMode: 'risk_pct',
      riskPerTradePct: 1,
      fixedPositionSize: 1,
      commissionPct: 0.04,
      slippagePct: 0.02,
    },
  };
}

function makeDefaultStrategy(): Strategy {
  return {
    id: 'strategy-default-breakout',
    name: 'Default Breakout Strategy',
    mode: 'default',
    default: DEFAULT_STRATEGY_CONFIG,
    custom: { code: DEFAULT_CUSTOM_CODE, riskPerTradePct: 1 },
    builder: makeDefaultBuilderConfig(),
    createdAt: Date.now(),
  };
}

export interface AppState {
  datasets: Dataset[];
  selectedDatasetId: string | null;
  strategies: Strategy[];
  selectedStrategyId: string | null;
  draftStrategy: Strategy;
  backtestResult: BacktestResult | null;
  isRunningBacktest: boolean;
  activity: ActivityEvent[];
  runHistory: RunHistoryEntry[];
}

export type Action =
  | { type: 'ADD_DATASET'; dataset: Dataset }
  | { type: 'SELECT_DATASET'; id: string | null }
  | { type: 'SAVE_STRATEGY'; strategy: Strategy }
  | { type: 'SELECT_STRATEGY'; id: string | null }
  | { type: 'UPDATE_DRAFT'; strategy: Strategy }
  | { type: 'RESET_DRAFT' }
  | { type: 'RUN_BACKTEST_START' }
  | { type: 'RUN_BACKTEST_DONE'; result: BacktestResult }
  | { type: 'RUN_BACKTEST_ERROR' }
  | { type: 'LOG_ACTIVITY'; event: ActivityEvent }
  | { type: 'REMOVE_RUN_FROM_HISTORY'; id: string }
  | { type: 'CLEAR_RUN_HISTORY' };

const initialStrategy = makeDefaultStrategy();

export const initialState: AppState = {
  datasets: [],
  selectedDatasetId: null,
  strategies: [initialStrategy],
  selectedStrategyId: null,
  draftStrategy: initialStrategy,
  backtestResult: null,
  isRunningBacktest: false,
  activity: [
    { id: 'init', title: 'Platform initialized', detail: 'System · Ready', time: Date.now() },
  ],
  runHistory: [],
};

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_DATASET':
      return {
        ...state,
        datasets: [action.dataset, ...state.datasets.filter((d) => d.id !== action.dataset.id)],
        selectedDatasetId: action.dataset.id,
      };
    case 'SELECT_DATASET':
      return { ...state, selectedDatasetId: action.id, backtestResult: null };
    case 'SAVE_STRATEGY': {
      const exists = state.strategies.some((s) => s.id === action.strategy.id);
      const strategies = exists
        ? state.strategies.map((s) => (s.id === action.strategy.id ? action.strategy : s))
        : [action.strategy, ...state.strategies];
      return { ...state, strategies, selectedStrategyId: action.strategy.id, draftStrategy: action.strategy };
    }
    case 'SELECT_STRATEGY': {
      const found = state.strategies.find((s) => s.id === action.id) ?? null;
      return {
        ...state,
        selectedStrategyId: action.id,
        draftStrategy: found ?? state.draftStrategy,
        backtestResult: null,
      };
    }
    case 'UPDATE_DRAFT':
      return { ...state, draftStrategy: action.strategy };
    case 'RESET_DRAFT':
      return { ...state, draftStrategy: makeDefaultStrategy(), selectedStrategyId: null };
    case 'RUN_BACKTEST_START':
      return { ...state, isRunningBacktest: true };
    case 'RUN_BACKTEST_DONE': {
      const strategy = state.strategies.find((s) => s.id === action.result.strategyId) ?? state.draftStrategy;
      const dataset = state.datasets.find((d) => d.id === action.result.datasetId);
      const entry: RunHistoryEntry = {
        id: `run-${action.result.runAt}-${Math.random().toString(36).slice(2, 7)}`,
        strategyName: strategy?.name ?? 'Unknown strategy',
        strategyMode: strategy?.mode ?? 'default',
        datasetName: dataset?.name ?? 'Unknown dataset',
        datasetSymbol: dataset?.symbol ?? '',
        result: action.result,
      };
      return {
        ...state,
        isRunningBacktest: false,
        backtestResult: action.result,
        runHistory: [entry, ...state.runHistory].slice(0, MAX_RUN_HISTORY),
      };
    }
    case 'RUN_BACKTEST_ERROR':
      return { ...state, isRunningBacktest: false };
    case 'LOG_ACTIVITY':
      return { ...state, activity: [action.event, ...state.activity].slice(0, 20) };
    case 'REMOVE_RUN_FROM_HISTORY':
      return { ...state, runHistory: state.runHistory.filter((r) => r.id !== action.id) };
    case 'CLEAR_RUN_HISTORY':
      return { ...state, runHistory: [] };
    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  addDatasetFromCandles: (name: string, symbol: string, assetType: string, candles: Dataset['candles']) => void;
  selectDataset: (id: string | null) => void;
  saveStrategy: (strategy: Strategy) => void;
  selectStrategy: (id: string | null) => void;
  updateDraft: (strategy: Strategy) => void;
  resetDraft: () => void;
  runBacktestStart: () => void;
  runBacktestDone: (result: BacktestResult) => void;
  runBacktestError: () => void;
  logActivity: (title: string, detail: string) => void;
  selectedDataset: Dataset | null;
  selectedStrategy: Strategy | null;
  removeRunFromHistory: (id: string) => void;
  clearRunHistory: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const logActivity = useCallback((title: string, detail: string) => {
    dispatch({ type: 'LOG_ACTIVITY', event: { id: `${Date.now()}-${Math.random()}`, title, detail, time: Date.now() } });
  }, []);

  const addDatasetFromCandles = useCallback(
    (name: string, symbol: string, assetType: string, candles: Dataset['candles']) => {
      const dataset: Dataset = {
        id: `ds-${Date.now()}`,
        name,
        symbol,
        assetType,
        candles,
        regimes: classifyRegimes(candles),
        createdAt: Date.now(),
      };
      dispatch({ type: 'ADD_DATASET', dataset });
      logActivity('Dataset loaded', `${name} · ${candles.length} candles`);
    },
    [logActivity],
  );

  const selectDataset = useCallback((id: string | null) => dispatch({ type: 'SELECT_DATASET', id }), []);

  const saveStrategy = useCallback(
    (strategy: Strategy) => {
      dispatch({ type: 'SAVE_STRATEGY', strategy });
      logActivity('Strategy saved', strategy.name);
    },
    [logActivity],
  );

  const selectStrategy = useCallback((id: string | null) => dispatch({ type: 'SELECT_STRATEGY', id }), []);
  const updateDraft = useCallback((strategy: Strategy) => dispatch({ type: 'UPDATE_DRAFT', strategy }), []);
  const resetDraft = useCallback(() => dispatch({ type: 'RESET_DRAFT' }), []);
  const runBacktestStart = useCallback(() => dispatch({ type: 'RUN_BACKTEST_START' }), []);
  const runBacktestDone = useCallback(
    (result: BacktestResult) => {
      dispatch({ type: 'RUN_BACKTEST_DONE', result });
      logActivity(
        'Backtest completed',
        `${result.totalTrades} trades · ${result.totalReturnPct >= 0 ? '+' : ''}${result.totalReturnPct.toFixed(2)}% return`,
      );
    },
    [logActivity],
  );
  const runBacktestError = useCallback(() => dispatch({ type: 'RUN_BACKTEST_ERROR' }), []);
  const removeRunFromHistory = useCallback((id: string) => dispatch({ type: 'REMOVE_RUN_FROM_HISTORY', id }), []);
  const clearRunHistory = useCallback(() => dispatch({ type: 'CLEAR_RUN_HISTORY' }), []);

  const selectedDataset = useMemo(
    () => state.datasets.find((d) => d.id === state.selectedDatasetId) ?? null,
    [state.datasets, state.selectedDatasetId],
  );
  const selectedStrategy = useMemo(
    () => state.strategies.find((s) => s.id === state.selectedStrategyId) ?? null,
    [state.strategies, state.selectedStrategyId],
  );

  const value: AppContextValue = {
    ...state,
    addDatasetFromCandles,
    selectDataset,
    saveStrategy,
    selectStrategy,
    updateDraft,
    resetDraft,
    runBacktestStart,
    runBacktestDone,
    runBacktestError,
    logActivity,
    selectedDataset,
    selectedStrategy,
    removeRunFromHistory,
    clearRunHistory,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function generateSampleDataset(): Pick<Dataset, 'candles'> & { name: string; symbol: string; assetType: string } {
  return {
    name: 'Sample XAUUSD',
    symbol: 'XAUUSD',
    assetType: 'Commodity',
    candles: generateXauUsdCandles(),
  };
}

export const ALL_REGIMES: Regime[] = ['bullish', 'bearish', 'consolidation', 'high_volatility'];
