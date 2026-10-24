import type { Candle } from './types';

// Deterministic pseudo-random generator so "Load Sample Data" produces the
// same dataset every time (nice for demos and repeatable screenshots).
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSampleCandles(count = 500, startPrice = 42000): Candle[] {
  const rand = mulberry32(1337);
  const candles: Candle[] = [];
  let price = startPrice;
  const startTime = Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000);
  const dayMs = 24 * 60 * 60;

  // A handful of regime "phases" so the sample data visibly trends,
  // chops, and spikes in volatility — useful for exercising the regime
  // classifier and the strategy engine in demos.
  const phases = [
    { len: 60, drift: -0.006, vol: 0.012 },
    { len: 80, drift: 0.001, vol: 0.006 },
    { len: 70, drift: 0.007, vol: 0.014 },
    { len: 90, drift: -0.002, vol: 0.008 },
    { len: 100, drift: 0.0015, vol: 0.005 },
    { len: 100, drift: -0.004, vol: 0.02 },
  ];

  let idx = 0;
  let phaseIdx = 0;
  let phaseRemaining = phases[0].len;

  for (let i = 0; i < count; i++) {
    if (phaseRemaining <= 0 && phaseIdx < phases.length - 1) {
      phaseIdx++;
      phaseRemaining = phases[phaseIdx].len;
    }
    phaseRemaining--;
    const phase = phases[phaseIdx];

    const shock = (rand() - 0.5) * 2 * phase.vol;
    const changePct = phase.drift + shock;
    const open = price;
    const close = Math.max(1, open * (1 + changePct));
    const high = Math.max(open, close) * (1 + rand() * phase.vol * 0.6);
    const low = Math.min(open, close) * (1 - rand() * phase.vol * 0.6);
    const volume = 500 + rand() * 1500 * (1 + phase.vol * 10);

    candles.push({
      time: startTime + idx * dayMs,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: Math.round(volume),
    });

    price = close;
    idx++;
  }

  return candles;
}

export function candlesToCsv(candles: Candle[]): string {
  const rows = candles.map((candle) => [
    new Date(candle.time * 1000).toISOString(),
    candle.open.toFixed(2),
    candle.high.toFixed(2),
    candle.low.toFixed(2),
    candle.close.toFixed(2),
    Math.round(candle.volume),
  ].join(','));

  return ['timestamp,open,high,low,close,volume', ...rows].join('\n');
}

export function candlesToExcelHtml(candles: Candle[]): string {
  const headers = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
  const rows = candles.map((candle) => [
    new Date(candle.time * 1000).toISOString(),
    candle.open.toFixed(2),
    candle.high.toFixed(2),
    candle.low.toFixed(2),
    candle.close.toFixed(2),
    Math.round(candle.volume).toString(),
  ]);
  const tableRow = (cells: string[], tag: 'th' | 'td') => `<tr>${cells.map((cell) => `<${tag}>${cell}</${tag}>`).join('')}</tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>XAUUSD Sample Data</title></head><body><table>${tableRow(headers, 'th')}${rows.map((row) => tableRow(row, 'td')).join('')}</table></body></html>`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
