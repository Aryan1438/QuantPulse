import { Button } from '../ui/Button';
import { PERIODLESS_INDICATORS } from '../../lib/types';
import type {
  Combinator,
  ConditionGroup,
  ConditionOperator,
  IndicatorKind,
  Operand,
  OperandType,
  PriceField,
  RuleCondition,
} from '../../lib/types';

const INDICATOR_KINDS: IndicatorKind[] = [
  'SMA', 'EMA', 'RSI', 'ATR', 'VWAP',
  'MACD_LINE', 'MACD_SIGNAL', 'MACD_HIST',
  'BB_UPPER', 'BB_MIDDLE', 'BB_LOWER',
];

const PRICE_FIELDS: PriceField[] = ['close', 'open', 'high', 'low', 'volume'];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '==', label: '==' },
  { value: 'crosses_above', label: 'crosses above' },
  { value: 'crosses_below', label: 'crosses below' },
];

function defaultOperand(type: OperandType): Operand {
  if (type === 'indicator') return { type, indicator: { kind: 'EMA', period: 20 } };
  if (type === 'price') return { type, field: 'close' };
  return { type, value: 0 };
}

export function newCondition(): RuleCondition {
  return {
    id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    left: { type: 'price', field: 'close' },
    operator: '>',
    right: { type: 'indicator', indicator: { kind: 'EMA', period: 20 } },
  };
}

function OperandEditor({ operand, onChange }: { operand: Operand; onChange: (o: Operand) => void }) {
  const inputClass = 'rounded-lg border border-border bg-elevated px-2 py-1.5 text-xs text-text focus:border-accent/40 focus:outline-none';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={operand.type}
        onChange={(e) => onChange(defaultOperand(e.target.value as OperandType))}
        className={inputClass}
      >
        <option value="indicator">Indicator</option>
        <option value="price">Price field</option>
        <option value="constant">Constant</option>
      </select>

      {operand.type === 'indicator' && operand.indicator && (
        <>
          <select
            value={operand.indicator.kind}
            onChange={(e) => onChange({ ...operand, indicator: { ...operand.indicator!, kind: e.target.value as IndicatorKind } })}
            className={inputClass}
          >
            {INDICATOR_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          {!PERIODLESS_INDICATORS.includes(operand.indicator.kind) && (
            <input
              type="number"
              min={1}
              value={operand.indicator.period}
              onChange={(e) => onChange({ ...operand, indicator: { ...operand.indicator!, period: parseInt(e.target.value, 10) || 0 } })}
              className={`${inputClass} w-16`}
              title="Period"
            />
          )}
        </>
      )}

      {operand.type === 'price' && (
        <select
          value={operand.field}
          onChange={(e) => onChange({ ...operand, field: e.target.value as PriceField })}
          className={inputClass}
        >
          {PRICE_FIELDS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      )}

      {operand.type === 'constant' && (
        <input
          type="number"
          value={operand.value ?? 0}
          onChange={(e) => onChange({ ...operand, value: parseFloat(e.target.value) || 0 })}
          className={`${inputClass} w-24`}
        />
      )}
    </div>
  );
}

export function ConditionGroupEditor({
  group,
  onChange,
  emptyLabel = 'No conditions yet — add one to define this signal.',
}: {
  group: ConditionGroup;
  onChange: (g: ConditionGroup) => void;
  emptyLabel?: string;
}) {
  const setCombinator = (combinator: Combinator) => onChange({ ...group, combinator });

  const updateCondition = (id: string, patch: Partial<RuleCondition>) => {
    onChange({ ...group, conditions: group.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const removeCondition = (id: string) => {
    onChange({ ...group, conditions: group.conditions.filter((c) => c.id !== id) });
  };

  const addCondition = () => {
    onChange({ ...group, conditions: [...group.conditions, newCondition()] });
  };

  return (
    <div>
      {group.conditions.length > 1 && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="text-muted">Combine with</span>
          <div className="flex rounded-lg border border-border bg-elevated p-0.5">
            {(['AND', 'OR'] as Combinator[]).map((c) => (
              <button
                key={c}
                onClick={() => setCombinator(c)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  group.combinator === c ? 'bg-elevated-2 text-text' : 'text-text-dim'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {group.conditions.map((cond, idx) => (
          <div key={cond.id} className="rounded-lg border border-border-soft bg-elevated/50 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted">
                {idx > 0 ? group.combinator : 'IF'} #{idx + 1}
              </span>
              <button onClick={() => removeCondition(cond.id)} className="text-[11px] text-bearish hover:underline">
                Remove
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <OperandEditor operand={cond.left} onChange={(left) => updateCondition(cond.id, { left })} />
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(cond.id, { operator: e.target.value as ConditionOperator })}
                className="rounded-lg border border-border bg-elevated px-2 py-1.5 text-xs font-medium text-accent focus:border-accent/40 focus:outline-none"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              <OperandEditor operand={cond.right} onChange={(right) => updateCondition(cond.id, { right })} />
            </div>
          </div>
        ))}
        {group.conditions.length === 0 && <p className="text-xs text-muted">{emptyLabel}</p>}
      </div>

      <Button variant="outline" size="sm" className="mt-2.5" onClick={addCondition}>+ Add condition</Button>
    </div>
  );
}
