// Core domain types shared across the engine, state, and UI layers.

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';

export const TIMEFRAMES: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  D1: 86400,
};

export type TimeframeCandles = Partial<Record<Timeframe, Candle[]>>;
export type ExecutionPolicy = 'conservative' | 'optimistic' | 'next_bar' | 'close_based';

export interface ExecutionSettings {
  policy: ExecutionPolicy;
  spreadPct: number;
  slippagePct: number;
  commissionPct: number;
  intrabarAssumption: string;
}

export type Regime = 'bullish' | 'bearish' | 'consolidation' | 'high_volatility';

export interface RegimeLabel {
  time: number;
  regime: Regime;
}

export interface Dataset {
  id: string;
  name: string;
  symbol: string;
  assetType: string;
  candles: Candle[];
  timeframe?: Timeframe;
  /** Optional additional series. `candles` remains the default series. */
  timeframes?: TimeframeCandles;
  builderTimeframe?: Timeframe;
  source?: string;
  startDate?: string;
  endDate?: string;
  timezone?: 'UTC';
  regimes: RegimeLabel[];
  createdAt: number;
}

export type StrategyMode = 'default' | 'custom' | 'builder';

export interface DefaultStrategyConfig {
  regimes: Regime[];
  riskPerTradePct: number;
  stopLossAtrMultiple: number;
  takeProfitRR: number;
}

export interface CustomStrategyConfig {
  code: string;
  riskPerTradePct: number;
}

// ---------------------------------------------------------------------------
// Strategy Engine (Phase 2) — structured, form-built entry/exit rules.
// This is a data description, not code: the UI builds it from dropdowns,
// strategyEngine.ts precomputes+evaluates it, and backtestEngine.ts feeds
// the resulting signals through the same trade-management loop used by
// the other two modes.
// ---------------------------------------------------------------------------

export type PriceField = 'close' | 'open' | 'high' | 'low' | 'volume';

export type IndicatorKind =
  | 'SMA' | 'EMA' | 'RSI' | 'ATR' | 'VWAP'
  | 'MACD_LINE' | 'MACD_SIGNAL' | 'MACD_HIST'
  | 'BB_UPPER' | 'BB_MIDDLE' | 'BB_LOWER';

/** Indicators that ignore `period` and use fixed standard parameters
 * (MACD is always 12/26/9; Bollinger Bands use `period` for its SMA/stddev
 * window but no separate period field is needed for the MACD family). */
export const PERIODLESS_INDICATORS: IndicatorKind[] = ['MACD_LINE', 'MACD_SIGNAL', 'MACD_HIST'];

export interface IndicatorRef {
  kind: IndicatorKind;
  period: number; // ignored for MACD_* kinds
  timeframe?: Timeframe;
}

export type OperandType = 'indicator' | 'price' | 'constant';

export interface Operand {
  type: OperandType;
  indicator?: IndicatorRef;
  field?: PriceField;
  value?: number;
  timeframe?: Timeframe;
}

export type ConditionOperator = '>' | '<' | '>=' | '<=' | '==' | 'crosses_above' | 'crosses_below';

export interface RuleCondition {
  id: string;
  left: Operand;
  operator: ConditionOperator;
  right: Operand;
}

export type Combinator = 'AND' | 'OR';

export interface ConditionGroup {
  combinator: Combinator;
  conditions: RuleCondition[];
}

export type TradeDirection = 'long' | 'short' | 'both';
export type PositionSizingMode = 'risk_pct' | 'fixed_size';
export type StopLossMode = 'atr_multiple' | 'fixed_pct' | 'indicator';
export type TakeProfitMode = 'risk_reward' | 'fixed_pct' | 'indicator';

export interface BuilderExitConfig {
  stopLossMode: StopLossMode;
  stopLossAtrMultiple: number;
  stopLossPct: number;
  stopLossIndicator: IndicatorRef | null;
  takeProfitMode: TakeProfitMode;
  takeProfitRR: number;
  takeProfitPct: number;
  takeProfitIndicator: IndicatorRef | null;
  oppositeSignalExit: boolean;
}

export interface BuilderRiskConfig {
  positionSizingMode: PositionSizingMode;
  riskPerTradePct: number;
  fixedPositionSize: number;
  commissionPct: number;
  slippagePct: number;
  spreadPct?: number;
}

export interface BuilderStrategyConfig {
  direction: TradeDirection;
  timeframeLabel: string; // informational — dataset already fixes the actual bar interval
  executionTimeframe?: Timeframe;
  initialCapital: number;
  entryLong: ConditionGroup;
  entryShort: ConditionGroup;
  exit: BuilderExitConfig;
  risk: BuilderRiskConfig;
}

export interface Strategy {
  id: string;
  name: string;
  mode: StrategyMode;
  default: DefaultStrategyConfig;
  custom: CustomStrategyConfig;
  builder: BuilderStrategyConfig;
  createdAt: number;
}

export type TradeSide = 'long' | 'short';

export interface Trade {
  id: number;
  entryTime: number;
  exitTime: number;
  side: TradeSide;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  pnl: number;
  pnlPct: number;
  rMultiple: number;
  result: 'win' | 'loss' | 'breakeven';
  regime: Regime | null;
  exitReason: 'stop_loss' | 'take_profit' | 'end_of_data' | 'opposite_signal' | 'indicator_exit';
  symbol?: string;
  signalTimestamp?: number;
  entryTimestamp?: number;
  exitTimestamp?: number;
  riskAmount?: number;
  rewardAmount?: number;
  riskReward?: number;
  entryTimeframe?: Timeframe;
  executionTimeframe?: Timeframe;
  strategyConditions?: string[];
  tradeDuration?: number;
  mfe?: number;
  mae?: number;
}

export interface EquityPoint {
  time: number;
  equity: number;
  drawdownPct: number;
}

export interface BacktestResult {
  trades: Trade[];
  equityCurve: EquityPoint[];
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  totalTrades: number;
  profitFactor: number;
  netProfit: number;
  sharpeApprox: number;
  regimeBreakdown: Record<Regime, { trades: number; winRate: number; pnl: number }>;
  strategyId: string;
  datasetId: string;
  runAt: number;
  timeframeConfiguration?: {
    executionTimeframe: Timeframe;
    contextTimeframe?: Timeframe;
    selected: Timeframe[];
  };
  executionSettings?: ExecutionSettings;
  dataInfo?: {
    symbol: string;
    timezone: 'UTC';
    candleCounts: Partial<Record<Timeframe, number>>;
    datasetNames?: Partial<Record<Timeframe, string>>;
  };
}

export interface ActivityEvent {
  id: string;
  title: string;
  detail: string;
  time: number;
}

export type SystemEngineStatus = 'idle' | 'ready' | 'running' | 'no_strategy' | 'error';

// ---------------------------------------------------------------------------
// Run History / Comparison (Phase 3) — every completed backtest is kept
// (capped) so strategies and parameter variants can be compared side by
// side, instead of each run silently overwriting the last.
// ---------------------------------------------------------------------------
export interface RunHistoryEntry {
  id: string;
  strategyName: string;
  strategyMode: StrategyMode;
  datasetName: string;
  datasetSymbol: string;
  result: BacktestResult;
}
