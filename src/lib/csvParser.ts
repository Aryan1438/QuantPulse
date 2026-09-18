import type { Candle } from './types';

export interface CsvParseResult {
  candles: Candle[];
  errors: string[];
  warnings: string[];
}

const REQUIRED = ['timestamp', 'open', 'high', 'low', 'close'];
const ALIASES: Record<string, string[]> = {
  timestamp: ['time', 'date', 'datetime'],
  open: ['o'],
  high: ['h'],
  low: ['l'],
  close: ['c'],
  volume: ['vol', 'v'],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

function resolveHeaderMap(headers: string[]): Map<string, number> {
  const normalized = headers.map(normalizeHeader);
  const map = new Map<string, number>();

  for (const canonical of [...REQUIRED, 'volume']) {
    let idx = normalized.indexOf(canonical);
    if (idx === -1) {
      for (const alias of ALIASES[canonical] ?? []) {
        idx = normalized.indexOf(alias);
        if (idx !== -1) break;
      }
    }
    if (idx !== -1) map.set(canonical, idx);
  }
  return map;
}

function parseTimestamp(raw: string): number | null {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    // Heuristic: treat 13-digit numbers as milliseconds, else seconds.
    return trimmed.length >= 13 ? Math.floor(n / 1000) : n;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

export function parseCsvOhlcv(text: string): CsvParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { candles: [], errors: ['The file has no data rows.'], warnings };
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const map = resolveHeaderMap(headers);

  const missing = REQUIRED.filter((c) => !map.has(c));
  if (missing.length > 0) {
    errors.push(`Missing required column(s): ${missing.join(', ')}. Required columns: timestamp, open, high, low, close.`);
    return { candles: [], errors, warnings };
  }
  if (!map.has('volume')) {
    warnings.push('No volume column found — defaulting volume to 0 for all rows.');
  }

  const candles: Candle[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const tsRaw = cells[map.get('timestamp')!];
    const time = tsRaw !== undefined ? parseTimestamp(tsRaw) : null;
    const open = parseFloat(cells[map.get('open')!]);
    const high = parseFloat(cells[map.get('high')!]);
    const low = parseFloat(cells[map.get('low')!]);
    const close = parseFloat(cells[map.get('close')!]);
    const volume = map.has('volume') ? parseFloat(cells[map.get('volume')!]) : 0;

    if (time === null || [open, high, low, close].some((v) => Number.isNaN(v))) {
      skipped++;
      continue;
    }

    candles.push({ time, open, high, low, close, volume: Number.isNaN(volume) ? 0 : volume });
  }

  if (skipped > 0) warnings.push(`${skipped} row(s) had invalid/unparseable data and were skipped.`);

  candles.sort((a, b) => a.time - b.time);

  if (candles.length === 0) {
    errors.push('No valid OHLCV rows could be parsed from this file.');
  }

  return { candles, errors, warnings };
}
