import { REGIME_COLOR_HEX, REGIME_LABELS, regimeBreakdownPct } from '../../lib/regime';
import type { RegimeLabel } from '../../lib/types';

export function RegimeTimeline({ regimes }: { regimes: RegimeLabel[] }) {
  const pct = regimeBreakdownPct(regimes);

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {regimes.map((r, i) => (
          <div
            key={i}
            style={{ backgroundColor: REGIME_COLOR_HEX[r.regime], width: `${100 / regimes.length}%` }}
            title={REGIME_LABELS[r.regime]}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-5 text-xs">
        {(Object.keys(REGIME_LABELS) as (keyof typeof REGIME_LABELS)[]).map((key) => (
          <div key={key} className="flex items-center gap-1.5 text-text-dim">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: REGIME_COLOR_HEX[key] }} />
            {REGIME_LABELS[key]} <span className="mono text-muted">{pct[key].toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
