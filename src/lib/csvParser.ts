import type { Candle } from './types';

export interface CsvParseResult {
  candles: Candle[];
  errors: string[];
  warnings: string[];
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function htmlTableToCsv(text: string): string {
  const rows = [...text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => {
    const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => decodeHtml(cell[1]).replace(/"/g, '""'));
    return cells.map((cell) => `"${cell}"`).join(',');
  });
  return rows.join('\n');
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
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return trimmed.length >= 13 ? Math.floor(n / 1000) : n;
  }

  const brokerDate = trimmed.match(/^(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (brokerDate) {
    const [, year, month, day, hour, minute, second = '00'] = brokerDate;
    return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) / 1000);
  }

  const naiveIso = trimmed.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/);
  if (naiveIso) {
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/);
    if (match) {
      const [, year, month, day, hour, minute, second = '00', fractional = '0'] = match;
      const ms = Number.parseInt(fractional || '0', 10) * (fractional.length === 1 ? 100 : fractional.length === 2 ? 10 : 1);
      return Math.floor(Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
        ms,
      ) / 1000);
    }
  }

  const parsed = Date.parse(trimmed.replace(' ', 'T'));
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

export function parseCsvOhlcv(text: string): CsvParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { candles: [], errors: ['The file has no data rows.'], warnings };
  }

  const headers = lines[0].split(',').map((header) => {
    const value = header.trim();
    return value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1).replace(/""/g, '"')
      : value;
  });
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
  const seen = new Set<number>();
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((cell) => {
      const value = cell.trim();
      return value.startsWith('"') && value.endsWith('"')
        ? value.slice(1, -1).replace(/""/g, '"')
        : value;
    });
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

    if (seen.has(time)) {
      warnings.push(`Duplicate timestamp '${tsRaw.trim()}' was skipped.`);
      continue;
    }

    const invalidOhlc = [open, high, low, close].some((v) => !Number.isFinite(v) || v <= 0)
      || high < Math.max(open, close)
      || high < low
      || low > Math.min(open, close)
      || low > high;
    if (invalidOhlc) {
      errors.push(`Invalid OHLC row at timestamp '${tsRaw.trim()}'.`);
      continue;
    }

    seen.add(time);
    candles.push({ time, open, high, low, close, volume: Number.isNaN(volume) ? 0 : volume });
  }

  if (skipped > 0) warnings.push(`${skipped} row(s) had invalid/unparseable data and were skipped.`);

  candles.sort((a, b) => a.time - b.time);

  if (candles.length === 0) {
    errors.push('No valid OHLCV rows could be parsed from this file.');
  }

  return { candles, errors, warnings };
}

export function parseOhlcvText(text: string): CsvParseResult {
  const trimmed = text.trimStart();
  if (/^(?:<!doctype\s+html|<html\b|<table\b)/i.test(trimmed)) {
    const csv = htmlTableToCsv(trimmed);
    if (!csv) return { candles: [], errors: ['The spreadsheet contains no table rows.'], warnings: [] };
    return parseCsvOhlcv(csv);
  }
  return parseCsvOhlcv(text);
}
