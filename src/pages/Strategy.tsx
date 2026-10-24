import { useMemo, useState } from 'react';
import { useApp, ALL_REGIMES } from '../state/store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { REGIME_LABELS } from '../lib/regime';
import { validateDsl } from '../lib/dsl';
import { validateBuilderStrategy } from '../lib/strategyEngine';
import { ConditionGroupEditor } from '../components/strategy/ConditionGroupEditor';
import type {
  PositionSizingMode,
  Regime,
  StopLossMode,
  Strategy as StrategyT,
  StrategyMode,
  TakeProfitMode,
  TradeDirection,
  Timeframe,
} from '../lib/types';

const REGIME_TONE: Record<Regime, 'bullish' | 'bearish' | 'consolidation' | 'volatility'> = {
  bullish: 'bullish',
  bearish: 'bearish',
  consolidation: 'consolidation',
  high_volatility: 'volatility',
};

const SUPPORTED_INDICATORS = ['SMA', 'EMA', 'RSI', 'VWAP', 'ATR', 'close', 'open', 'high', 'low', 'volume'];

function buildLogicPreview(strategy: StrategyT): string {
  if (strategy.mode === 'custom') return strategy.custom.code;
  const cfg = strategy.default;
  const regimeList = cfg.regimes.map((r) => `    '${r}',`).join('\n');
  return `STRATEGY: ${strategy.name}

// Entry Conditions
IF Market_Regime IN [
${regimeList}
]
AND Price_Action == 'Breakout'

// Position Sizing
Risk_Amount = Equity * ${cfg.riskPerTradePct}%

// Exit Rules
Stop_Loss   = Entry ± (${cfg.stopLossAtrMultiple} * ATR)
Take_Profit = Entry ± (${cfg.stopLossAtrMultiple} * ATR * ${cfg.takeProfitRR})
Reward_Risk = 1:${cfg.takeProfitRR}`;
}

export function Strategy() {
  const { strategies, draftStrategy, updateDraft, saveStrategy, selectStrategy, resetDraft, selectedStrategyId } = useApp();
  const [dslError, setDslError] = useState<string | null>(null);

  const setMode = (mode: StrategyMode) => updateDraft({ ...draftStrategy, mode });
  const setName = (name: string) => updateDraft({ ...draftStrategy, name });

  const toggleRegime = (regime: Regime) => {
    const has = draftStrategy.default.regimes.includes(regime);
    const regimes = has ? draftStrategy.default.regimes.filter((r) => r !== regime) : [...draftStrategy.default.regimes, regime];
    updateDraft({ ...draftStrategy, default: { ...draftStrategy.default, regimes } });
  };

  const setDefaultField = (field: keyof StrategyT['default'], value: number) => {
    updateDraft({ ...draftStrategy, default: { ...draftStrategy.default, [field]: value } });
  };

  const setCustomCode = (code: string) => {
    updateDraft({ ...draftStrategy, custom: { ...draftStrategy.custom, code } });
    const result = validateDsl(code);
    setDslError(result.valid ? null : result.error);
  };

  const setCustomRisk = (riskPerTradePct: number) => {
    updateDraft({ ...draftStrategy, custom: { ...draftStrategy.custom, riskPerTradePct } });
  };

  const builderValidation = useMemo(
    () => (draftStrategy.mode === 'builder' ? validateBuilderStrategy(draftStrategy.builder) : { valid: true as const }),
    [draftStrategy],
  );

  const handleSave = () => {
    if (draftStrategy.mode === 'custom') {
      const result = validateDsl(draftStrategy.custom.code);
      if (!result.valid) {
        setDslError(result.error);
        return;
      }
    }
    if (draftStrategy.mode === 'builder' && !builderValidation.valid) {
      return;
    }
    const id = selectedStrategyId ?? `strategy-${Date.now()}`;
    saveStrategy({ ...draftStrategy, id, createdAt: draftStrategy.createdAt || Date.now() });
  };

  const handleNew = () => resetDraft();

  const logicPreview = useMemo(() => buildLogicPreview(draftStrategy), [draftStrategy]);
  const isCustomValid = draftStrategy.mode !== 'custom' || dslError === null;
  const isBuilderValid = draftStrategy.mode !== 'builder' || builderValidation.valid;
  const canSave = isCustomValid && isBuilderValid;

  const setDirection = (direction: TradeDirection) =>
    updateDraft({ ...draftStrategy, builder: { ...draftStrategy.builder, direction } });
  const setInitialCapital = (initialCapital: number) =>
    updateDraft({ ...draftStrategy, builder: { ...draftStrategy.builder, initialCapital } });
  const setExecutionTimeframe = (executionTimeframe: Timeframe | undefined) =>
    updateDraft({ ...draftStrategy, builder: { ...draftStrategy.builder, executionTimeframe } });
  const setEntryLong = (entryLong: StrategyT['builder']['entryLong']) =>
    updateDraft({ ...draftStrategy, builder: { ...draftStrategy.builder, entryLong } });
  const setEntryShort = (entryShort: StrategyT['builder']['entryShort']) =>
    updateDraft({ ...draftStrategy, builder: { ...draftStrategy.builder, entryShort } });
  const setExitField = <K extends keyof StrategyT['builder']['exit']>(field: K, value: StrategyT['builder']['exit'][K]) =>
    updateDraft({ ...draftStrategy, builder: { ...draftStrategy.builder, exit: { ...draftStrategy.builder.exit, [field]: value } } });
  const setRiskField = <K extends keyof StrategyT['builder']['risk']>(field: K, value: StrategyT['builder']['risk'][K]) =>
    updateDraft({ ...draftStrategy, builder: { ...draftStrategy.builder, risk: { ...draftStrategy.builder.risk, [field]: value } } });

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-text">Strategy Configuration</h1>
          <p className="mt-0.5 text-xs text-muted">Define and save your rule-based trading strategy</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleNew}>+ New</Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>💾 Save Strategy</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr_1fr]">
        {/* Saved strategies */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-text">Saved Strategies</h3>
          <div className="space-y-2">
            {strategies.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStrategy(s.id)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                  selectedStrategyId === s.id ? 'border-accent/40 bg-accent/5 text-text' : 'border-border bg-elevated text-text-dim hover:border-border-soft'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </Card>

        {/* Configuration */}
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-text">Strategy Details</h3>
            <label className="mb-1 block text-xs text-muted">Strategy Name</label>
            <input
              value={draftStrategy.name}
              onChange={(e) => setName(e.target.value)}
              className="mb-4 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
            />
            <label className="mb-1 block text-xs text-muted">Strategy Type</label>
            <div className="flex rounded-lg border border-border bg-elevated p-1">
              {(['default', 'builder', 'custom'] as StrategyMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition-colors ${
                    draftStrategy.mode === m ? 'bg-elevated-2 text-text' : 'text-text-dim'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </Card>

          {draftStrategy.mode === 'default' ? (
            <>
              <Card>
                <h3 className="text-sm font-semibold text-text">Regime Filters</h3>
                <p className="mb-3 mt-0.5 text-xs text-muted">Select which market regimes to trade in</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_REGIMES.map((r) => {
                    const active = draftStrategy.default.regimes.includes(r);
                    return (
                      <button key={r} onClick={() => toggleRegime(r)} className={active ? '' : 'opacity-40'}>
                        <Badge tone={REGIME_TONE[r]}>{REGIME_LABELS[r]}</Badge>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted">Trading in {draftStrategy.default.regimes.length} regime(s)</p>
              </Card>

              <Card>
                <h3 className="mb-4 text-sm font-semibold text-text">Risk Parameters</h3>

                <label className="mb-1 block text-xs text-muted">Risk Per Trade (%)</label>
                <input
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={draftStrategy.default.riskPerTradePct}
                  onChange={(e) => setDefaultField('riskPerTradePct', parseFloat(e.target.value) || 0)}
                  className="mb-4 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                />

                <div className="mb-4 flex items-center justify-between">
                  <label className="text-xs text-muted">Stop Loss (ATR Multiple)</label>
                  <span className="mono text-xs text-text">{draftStrategy.default.stopLossAtrMultiple.toFixed(1)}x</span>
                </div>
                <input
                  type="range" min={0.5} max={4} step={0.1}
                  value={draftStrategy.default.stopLossAtrMultiple}
                  onChange={(e) => setDefaultField('stopLossAtrMultiple', parseFloat(e.target.value))}
                  className="mb-4 w-full accent-accent"
                />

                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs text-muted">Take Profit (R:R Ratio)</label>
                  <span className="mono text-xs text-text">{draftStrategy.default.takeProfitRR.toFixed(1)}:1</span>
                </div>
                <input
                  type="range" min={1} max={5} step={0.1}
                  value={draftStrategy.default.takeProfitRR}
                  onChange={(e) => setDefaultField('takeProfitRR', parseFloat(e.target.value))}
                  className="w-full accent-accent"
                />
              </Card>
            </>
          ) : draftStrategy.mode === 'builder' ? (
            <>
              <Card>
                <h3 className="mb-3 text-sm font-semibold text-text">Direction &amp; Capital</h3>
                <label className="mb-1 block text-xs text-muted">Trading Direction</label>
                <div className="mb-4 flex rounded-lg border border-border bg-elevated p-1">
                  {(['long', 'short', 'both'] as TradeDirection[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDirection(d)}
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
                        draftStrategy.builder.direction === d ? 'bg-elevated-2 text-text' : 'text-text-dim'
                      }`}
                    >
                      {d === 'both' ? 'Long + Short' : d}
                    </button>
                  ))}
                </div>
                <label className="mb-1 block text-xs text-muted">Initial Capital ($)</label>
                <input
                  type="number"
                  min={1}
                  step={1000}
                  value={draftStrategy.builder.initialCapital}
                  onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                />
                <label className="mb-1 mt-4 block text-xs text-muted">Execution Timeframe</label>
                <select
                  value={draftStrategy.builder.executionTimeframe ?? ''}
                  onChange={(e) => setExecutionTimeframe((e.target.value || undefined) as Timeframe | undefined)}
                  className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                >
                  <option value="">Dataset default</option>
                  {['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map((timeframe) => <option key={timeframe} value={timeframe}>{timeframe}</option>)}
                </select>
              </Card>

              <Card>
                <h3 className="mb-4 text-sm font-semibold text-text">Risk &amp; Position Sizing</h3>

                <label className="mb-1 block text-xs text-muted">Position Sizing</label>
                <div className="mb-4 flex rounded-lg border border-border bg-elevated p-1">
                  {(['risk_pct', 'fixed_size'] as PositionSizingMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setRiskField('positionSizingMode', mode)}
                      className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                        draftStrategy.builder.risk.positionSizingMode === mode ? 'bg-elevated-2 text-text' : 'text-text-dim'
                      }`}
                    >
                      {mode === 'risk_pct' ? 'Risk %' : 'Fixed Size'}
                    </button>
                  ))}
                </div>

                {draftStrategy.builder.risk.positionSizingMode === 'risk_pct' ? (
                  <>
                    <label className="mb-1 block text-xs text-muted">Risk Per Trade (%)</label>
                    <input
                      type="number" min={0.1} max={100} step={0.1}
                      value={draftStrategy.builder.risk.riskPerTradePct}
                      onChange={(e) => setRiskField('riskPerTradePct', parseFloat(e.target.value) || 0)}
                      className="mb-4 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                    />
                  </>
                ) : (
                  <>
                    <label className="mb-1 block text-xs text-muted">Fixed Position Size (units)</label>
                    <input
                      type="number" min={0.0001} step={0.1}
                      value={draftStrategy.builder.risk.fixedPositionSize}
                      onChange={(e) => setRiskField('fixedPositionSize', parseFloat(e.target.value) || 0)}
                      className="mb-4 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                    />
                  </>
                )}

                <label className="mb-1 block text-xs text-muted">Commission (% per side)</label>
                <input
                  type="number" min={0} step={0.01}
                  value={draftStrategy.builder.risk.commissionPct}
                  onChange={(e) => setRiskField('commissionPct', parseFloat(e.target.value) || 0)}
                  className="mb-4 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                />

                <label className="mb-1 block text-xs text-muted">Slippage (%)</label>
                <input
                  type="number" min={0} step={0.01}
                  value={draftStrategy.builder.risk.slippagePct}
                  onChange={(e) => setRiskField('slippagePct', parseFloat(e.target.value) || 0)}
                  className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                />
              </Card>
            </>
          ) : (
            <Card>
              <h3 className="mb-4 text-sm font-semibold text-text">Risk Parameters</h3>
              <label className="mb-1 block text-xs text-muted">Risk Per Trade (%)</label>
              <input
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                value={draftStrategy.custom.riskPerTradePct}
                onChange={(e) => setCustomRisk(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
              />
              <p className="mt-2 text-xs text-muted">SL/TP defined in strategy code</p>
            </Card>
          )}
        </div>

        {/* Logic Preview / Custom DSL editor / Strategy Builder */}
        <div className="space-y-4">
          {draftStrategy.mode === 'default' ? (
            <Card>
              <h3 className="text-sm font-semibold text-text">Logic Preview</h3>
              <p className="mb-3 mt-0.5 text-xs text-muted">Generated trading rules based on configuration</p>
              <pre className="mono whitespace-pre-wrap rounded-lg border border-border bg-elevated p-4 text-xs leading-relaxed text-text-dim">
                {logicPreview}
              </pre>
            </Card>
          ) : draftStrategy.mode === 'builder' ? (
            <>
              {(draftStrategy.builder.direction === 'long' || draftStrategy.builder.direction === 'both') && (
                <Card>
                  <h3 className="text-sm font-semibold text-text">Long Entry Conditions</h3>
                  <p className="mb-3 mt-0.5 text-xs text-muted">All/any of these must be true to open a long position</p>
                  <ConditionGroupEditor group={draftStrategy.builder.entryLong} onChange={setEntryLong} />
                </Card>
              )}

              {(draftStrategy.builder.direction === 'short' || draftStrategy.builder.direction === 'both') && (
                <Card>
                  <h3 className="text-sm font-semibold text-text">Short Entry Conditions</h3>
                  <p className="mb-3 mt-0.5 text-xs text-muted">All/any of these must be true to open a short position</p>
                  <ConditionGroupEditor group={draftStrategy.builder.entryShort} onChange={setEntryShort} />
                </Card>
              )}

              <Card>
                <h3 className="mb-4 text-sm font-semibold text-text">Exit Rules</h3>

                <label className="mb-1 block text-xs text-muted">Stop Loss</label>
                <select
                  value={draftStrategy.builder.exit.stopLossMode}
                  onChange={(e) => setExitField('stopLossMode', e.target.value as StopLossMode)}
                  className="mb-2 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                >
                  <option value="atr_multiple">ATR multiple</option>
                  <option value="fixed_pct">Fixed % from entry</option>
                  <option value="indicator">Indicator level</option>
                </select>
                {draftStrategy.builder.exit.stopLossMode === 'atr_multiple' && (
                  <input
                    type="number" min={0.1} step={0.1}
                    value={draftStrategy.builder.exit.stopLossAtrMultiple}
                    onChange={(e) => setExitField('stopLossAtrMultiple', parseFloat(e.target.value) || 0)}
                    className="mb-4 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                    placeholder="ATR multiple, e.g. 1.5"
                  />
                )}
                {draftStrategy.builder.exit.stopLossMode === 'fixed_pct' && (
                  <input
                    type="number" min={0.01} step={0.1}
                    value={draftStrategy.builder.exit.stopLossPct}
                    onChange={(e) => setExitField('stopLossPct', parseFloat(e.target.value) || 0)}
                    className="mb-4 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                    placeholder="Percent, e.g. 1.5"
                  />
                )}
                {draftStrategy.builder.exit.stopLossMode === 'indicator' && (
                  <p className="mb-4 text-xs text-muted">Uses the stop-loss indicator field (defaults to a 20-period EMA if unset) as the price level; distance = |entry − indicator|.</p>
                )}

                <label className="mb-1 block text-xs text-muted">Take Profit</label>
                <select
                  value={draftStrategy.builder.exit.takeProfitMode}
                  onChange={(e) => setExitField('takeProfitMode', e.target.value as TakeProfitMode)}
                  className="mb-2 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                >
                  <option value="risk_reward">Reward : Risk ratio</option>
                  <option value="fixed_pct">Fixed % from entry</option>
                  <option value="indicator">Indicator level</option>
                </select>
                {draftStrategy.builder.exit.takeProfitMode === 'risk_reward' && (
                  <input
                    type="number" min={0.1} step={0.1}
                    value={draftStrategy.builder.exit.takeProfitRR}
                    onChange={(e) => setExitField('takeProfitRR', parseFloat(e.target.value) || 0)}
                    className="mb-4 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                    placeholder="R:R, e.g. 2 for 1:2"
                  />
                )}
                {draftStrategy.builder.exit.takeProfitMode === 'fixed_pct' && (
                  <input
                    type="number" min={0.01} step={0.1}
                    value={draftStrategy.builder.exit.takeProfitPct}
                    onChange={(e) => setExitField('takeProfitPct', parseFloat(e.target.value) || 0)}
                    className="mb-4 w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text focus:border-accent/40 focus:outline-none"
                    placeholder="Percent, e.g. 3"
                  />
                )}
                {draftStrategy.builder.exit.takeProfitMode === 'indicator' && (
                  <p className="mb-4 text-xs text-muted">Uses the take-profit indicator field as the price level; distance = |indicator − entry|.</p>
                )}

                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={draftStrategy.builder.exit.oppositeSignalExit}
                    onChange={(e) => setExitField('oppositeSignalExit', e.target.checked)}
                    className="accent-accent"
                  />
                  Also exit on an opposite entry signal
                </label>
              </Card>
            </>
          ) : (
            <Card>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text">Custom Strategy Logic</h3>
                <Badge tone={dslError ? 'bearish' : 'bullish'}>{dslError ? '✕ Invalid' : '✓ Valid Strategy'}</Badge>
              </div>
              <p className="mb-3 text-xs text-muted">Define entry/exit rules using DSL</p>
              <textarea
                value={draftStrategy.custom.code}
                onChange={(e) => setCustomCode(e.target.value)}
                spellCheck={false}
                rows={12}
                className="mono w-full resize-none rounded-lg border border-border bg-elevated p-4 text-xs leading-relaxed text-text focus:border-accent/40 focus:outline-none"
              />
              {dslError && <p className="mt-2 text-xs text-bearish">{dslError}</p>}

              <div className="mt-4">
                <div className="mb-2 text-xs font-medium text-muted">Supported Indicators</div>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_INDICATORS.map((ind) => (
                    <span key={ind} className="mono rounded-md border border-border bg-elevated px-2 py-1 text-[11px] text-text-dim">
                      {ind}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Strategy Check</h3>
              <Badge tone={canSave ? 'bullish' : 'bearish'}>{canSave ? '✓ Ready' : '✕ Fix errors'}</Badge>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-muted">Mode</span><span className="mono text-text capitalize">{draftStrategy.mode}</span></div>
              {draftStrategy.mode !== 'builder' && (
                <div className="flex justify-between">
                  <span className="text-muted">Risk per trade</span>
                  <span className="mono text-text">{draftStrategy.mode === 'default' ? draftStrategy.default.riskPerTradePct : draftStrategy.custom.riskPerTradePct}%</span>
                </div>
              )}
              {draftStrategy.mode === 'default' && (
                <div className="flex justify-between"><span className="text-muted">Active regimes</span><span className="mono text-text">{draftStrategy.default.regimes.length}/4</span></div>
              )}
              {draftStrategy.mode === 'builder' && (
                <>
                  <div className="flex justify-between"><span className="text-muted">Direction</span><span className="mono text-text capitalize">{draftStrategy.builder.direction === 'both' ? 'long + short' : draftStrategy.builder.direction}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Sizing</span><span className="mono text-text">{draftStrategy.builder.risk.positionSizingMode === 'risk_pct' ? `${draftStrategy.builder.risk.riskPerTradePct}% risk` : `${draftStrategy.builder.risk.fixedPositionSize} units`}</span></div>
                </>
              )}
              <div className="flex justify-between"><span className="text-muted">Syntax</span><span className={`mono ${dslError ? 'text-bearish' : 'text-bullish'}`}>{dslError ? 'Error' : 'OK'}</span></div>
            </div>
            {draftStrategy.mode === 'builder' && !builderValidation.valid && (
              <ul className="mt-3 space-y-1 border-t border-border-soft pt-3 text-xs text-bearish">
                {builderValidation.errors.map((err) => (
                  <li key={err}>• {err}</li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
