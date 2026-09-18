// A small, explicit DSL for custom strategy logic, matching the format
// shown in the Strategy page editor:
//
//   IF close > EMA(20) THEN
//   ENTER long
//   STOP_LOSS = ATR(14) * 1.5
//   TAKE_PROFIT = ATR(14) * 3
//
// Supported indicators: SMA, EMA, RSI, VWAP, ATR (each takes a period).
// Supported fields: close, open, high, low, volume.
// Supported operators: > < >= <= == and + - * / with parentheses.
//
// This is intentionally a narrow, safe expression language — no loops,
// no assignment beyond STOP_LOSS/TAKE_PROFIT, no arbitrary code
// execution. It's parsed into an AST and evaluated against precomputed
// indicator series, never `eval`'d.

import type { Candle, TradeSide } from './types';
import { atr, ema, rsi, sma, vwap } from './indicators';

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------
type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'field'; name: 'close' | 'open' | 'high' | 'low' | 'volume' }
  | { kind: 'indicator'; fn: 'SMA' | 'EMA' | 'RSI' | 'VWAP' | 'ATR'; period: number }
  | { kind: 'binop'; op: '+' | '-' | '*' | '/'; left: Expr; right: Expr }
  | { kind: 'compare'; op: '>' | '<' | '>=' | '<=' | '=='; left: Expr; right: Expr };

export interface ParsedStrategy {
  condition: Expr;
  side: TradeSide;
  stopLoss: Expr | null;
  takeProfit: Expr | null;
  raw: string;
}

export class DslError extends Error {}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------
type Token = { type: string; value: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s*(>=|<=|==|[><+\-*/(),=]|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?)\s*/y;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m || m.index !== i) {
      i++; // skip whitespace/newlines that didn't match
      continue;
    }
    const raw = m[1];
    i = re.lastIndex;
    if (/^\d/.test(raw)) tokens.push({ type: 'num', value: raw });
    else if (/^[A-Za-z_]/.test(raw)) tokens.push({ type: 'ident', value: raw });
    else tokens.push({ type: 'op', value: raw });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Expression parser (recursive descent): compare > additive > term > atom
// ---------------------------------------------------------------------------
class ExprParser {
  private pos = 0;
  private tokens: Token[];
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private next(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new DslError('Unexpected end of expression.');
    this.pos++;
    return t;
  }
  private expectOp(op: string) {
    const t = this.next();
    if (t.value !== op) throw new DslError(`Expected "${op}" but found "${t.value}".`);
  }

  parseCompare(): Expr {
    const left = this.parseAdditive();
    const t = this.peek();
    if (t && ['>', '<', '>=', '<=', '=='].includes(t.value)) {
      this.next();
      const right = this.parseAdditive();
      return { kind: 'compare', op: t.value as any, left, right };
    }
    return left;
  }

  parseAdditive(): Expr {
    let left = this.parseTerm();
    while (this.peek() && ['+', '-'].includes(this.peek()!.value)) {
      const op = this.next().value as '+' | '-';
      const right = this.parseTerm();
      left = { kind: 'binop', op, left, right };
    }
    return left;
  }

  parseTerm(): Expr {
    let left = this.parseAtom();
    while (this.peek() && ['*', '/'].includes(this.peek()!.value)) {
      const op = this.next().value as '*' | '/';
      const right = this.parseAtom();
      left = { kind: 'binop', op, left, right };
    }
    return left;
  }

  parseAtom(): Expr {
    const t = this.next();
    if (t.type === 'num') return { kind: 'num', value: parseFloat(t.value) };

    if (t.value === '(') {
      const e = this.parseCompare();
      this.expectOp(')');
      return e;
    }

    if (t.type === 'ident') {
      const upper = t.value.toUpperCase();
      if (['SMA', 'EMA', 'RSI', 'VWAP', 'ATR'].includes(upper)) {
        this.expectOp('(');
        const periodTok = this.next();
        if (periodTok.type !== 'num') throw new DslError(`${upper}(...) expects a numeric period.`);
        this.expectOp(')');
        return { kind: 'indicator', fn: upper as any, period: parseFloat(periodTok.value) };
      }
      const lower = t.value.toLowerCase();
      if (['close', 'open', 'high', 'low', 'volume'].includes(lower)) {
        return { kind: 'field', name: lower as any };
      }
      throw new DslError(`Unknown identifier "${t.value}". Supported: SMA, EMA, RSI, VWAP, ATR, close, open, high, low, volume.`);
    }

    throw new DslError(`Unexpected token "${t.value}".`);
  }
}

function parseExpr(src: string): Expr {
  const tokens = tokenize(src);
  const parser = new ExprParser(tokens);
  return parser.parseCompare();
}

// ---------------------------------------------------------------------------
// Statement-level parser for the strategy block
// ---------------------------------------------------------------------------
export function parseStrategyDsl(source: string): ParsedStrategy {
  const lines = source
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let condition: Expr | null = null;
  let side: TradeSide | null = null;
  let stopLoss: Expr | null = null;
  let takeProfit: Expr | null = null;

  for (const line of lines) {
    const ifMatch = line.match(/^IF\s+(.+?)\s+THEN$/i);
    if (ifMatch) {
      condition = parseExpr(ifMatch[1]);
      continue;
    }
    const enterMatch = line.match(/^ENTER\s+(long|short)$/i);
    if (enterMatch) {
      side = enterMatch[1].toLowerCase() as TradeSide;
      continue;
    }
    const slMatch = line.match(/^STOP_LOSS\s*=\s*(.+)$/i);
    if (slMatch) {
      stopLoss = parseExpr(slMatch[1]);
      continue;
    }
    const tpMatch = line.match(/^TAKE_PROFIT\s*=\s*(.+)$/i);
    if (tpMatch) {
      takeProfit = parseExpr(tpMatch[1]);
      continue;
    }
    throw new DslError(`Could not parse line: "${line}"`);
  }

  if (!condition) throw new DslError('Strategy must contain an "IF ... THEN" condition.');
  if (!side) throw new DslError('Strategy must contain an "ENTER long" or "ENTER short" statement.');

  return { condition, side, stopLoss, takeProfit, raw: source };
}

// ---------------------------------------------------------------------------
// Evaluation — precompute every indicator series the AST references,
// then walk the tree per-candle using simple lookups (O(1) per node).
// ---------------------------------------------------------------------------
type SeriesMap = Map<string, number[]>;

function seriesKey(fn: string, period: number) {
  return `${fn}(${period})`;
}

function collectIndicatorKeys(expr: Expr, keys: Set<string>) {
  if (expr.kind === 'indicator') keys.add(seriesKey(expr.fn, expr.period));
  if (expr.kind === 'binop' || expr.kind === 'compare') {
    collectIndicatorKeys(expr.left, keys);
    collectIndicatorKeys(expr.right, keys);
  }
}

export function precomputeSeries(candles: Candle[], strategy: ParsedStrategy): SeriesMap {
  const keys = new Set<string>();
  collectIndicatorKeys(strategy.condition, keys);
  if (strategy.stopLoss) collectIndicatorKeys(strategy.stopLoss, keys);
  if (strategy.takeProfit) collectIndicatorKeys(strategy.takeProfit, keys);

  const map: SeriesMap = new Map();
  for (const key of keys) {
    const m = key.match(/^([A-Z]+)\((\d+)\)$/);
    if (!m) continue;
    const [, fn, periodStr] = m;
    const period = parseInt(periodStr, 10);
    switch (fn) {
      case 'SMA': map.set(key, sma(candles, period)); break;
      case 'EMA': map.set(key, ema(candles, period)); break;
      case 'RSI': map.set(key, rsi(candles, period)); break;
      case 'ATR': map.set(key, atr(candles, period)); break;
      case 'VWAP': map.set(key, vwap(candles, period)); break;
    }
  }
  return map;
}

function evalExpr(expr: Expr, candles: Candle[], i: number, series: SeriesMap): number {
  switch (expr.kind) {
    case 'num':
      return expr.value;
    case 'field':
      return candles[i][expr.name];
    case 'indicator': {
      const arr = series.get(seriesKey(expr.fn, expr.period));
      return arr ? arr[i] : NaN;
    }
    case 'binop': {
      const l = evalExpr(expr.left, candles, i, series);
      const r = evalExpr(expr.right, candles, i, series);
      switch (expr.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return r === 0 ? NaN : l / r;
      }
      break;
    }
    case 'compare': {
      const l = evalExpr(expr.left, candles, i, series);
      const r = evalExpr(expr.right, candles, i, series);
      switch (expr.op) {
        case '>': return l > r ? 1 : 0;
        case '<': return l < r ? 1 : 0;
        case '>=': return l >= r ? 1 : 0;
        case '<=': return l <= r ? 1 : 0;
        case '==': return l === r ? 1 : 0;
      }
      break;
    }
  }
  return NaN;
}

export function evalCondition(strategy: ParsedStrategy, candles: Candle[], i: number, series: SeriesMap): boolean {
  return evalExpr(strategy.condition, candles, i, series) === 1;
}

export function evalOffset(expr: Expr | null, candles: Candle[], i: number, series: SeriesMap): number | null {
  if (!expr) return null;
  const v = evalExpr(expr, candles, i, series);
  return Number.isFinite(v) ? v : null;
}

export function validateDsl(source: string): { valid: true } | { valid: false; error: string } {
  try {
    parseStrategyDsl(source);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid strategy syntax.' };
  }
}
