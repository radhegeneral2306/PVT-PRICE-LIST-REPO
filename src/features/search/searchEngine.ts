import type { Category, SearchHit, Unit } from '../../types';

// Pure search + compare helpers. No React, no I/O.

const SYNONYMS: Record<string, string> = { gloss: 'glossy', matte: 'matt' };
const UNIT_WORDS: Record<string, Unit> = { sqft: 'sqft', sqm: 'sqm', box: 'box', pc: 'pc', pcs: 'pc' };
const SIZE_RE = /^\d+(x\d+)+$/;

/** Lowercase, unify size separators (x, X, *), drop "mm" and punctuation, map synonyms. */
export function normalizeText(input: string): string {
  return tokenize(input).join(' ');
}

export function tokenize(input: string): string[] {
  const s = input
    .toLowerCase()
    .replace(/(\d)\s*[x*×]\s*(?=\d)/g, '$1x')
    .replace(/(\d)\s*mm\b/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!s) return [];
  const out: string[] = [];
  for (const w of s.split(' ')) {
    if (!w || w === 'mm') continue;
    out.push(SYNONYMS[w] ?? w);
  }
  return out;
}

export interface ParsedQuery {
  /** Words to AND-match. */
  tokens: string[];
  /** Units typed in the query itself ("sqft", "box"). */
  units: Unit[];
}

export function parseQuery(q: string): ParsedQuery {
  const tokens: string[] = [];
  const units: Unit[] = [];
  for (const t of tokenize(q)) {
    if (t === 'per') continue;
    const u = UNIT_WORDS[t];
    if (u) { if (!units.includes(u)) units.push(u); } else tokens.push(t);
  }
  return { tokens, units };
}

function reverseSize(size: string): string {
  return size.split('x').reverse().join('x');
}

export interface IndexedHit {
  hit: SearchHit;
  words: string[];
  size: string;
  sizeRev: string;
}

export function buildIndex(hits: SearchHit[]): IndexedHit[] {
  return hits.map((hit) => {
    const sizeWords = tokenize(hit.item.size);
    const size = sizeWords.find((w) => SIZE_RE.test(w)) ?? sizeWords.join('');
    const sizeRev = SIZE_RE.test(size) ? reverseSize(size) : size;
    const words = [
      ...tokenize(hit.item.name),
      ...tokenize(hit.item.code),
      ...sizeWords,
      ...tokenize(hit.item.finish),
      ...tokenize(hit.factory.name),
    ];
    if (SIZE_RE.test(size)) words.push(sizeRev, ...size.split('x'));
    return { hit, words, size, sizeRev };
  });
}

export interface Filters {
  categories?: Category[];
  units?: Unit[];
  factoryId?: string;
}

export interface ScoredHit {
  hit: SearchHit;
  score: number;
}

/** AND-match every token (prefix allowed), then rank: exact size, then whole-word matches. */
export function searchIndex(index: IndexedHit[], query: string, filters: Filters = {}): ScoredHit[] {
  const { tokens, units: typedUnits } = parseQuery(query);
  if (tokens.length === 0 && typedUnits.length === 0) return [];
  const units = [...(filters.units ?? []), ...typedUnits];
  const cats = filters.categories ?? [];
  const out: ScoredHit[] = [];
  for (const ix of index) {
    const { item, pricelist, factory } = ix.hit;
    if (cats.length && !cats.includes(pricelist.category)) continue;
    if (units.length && !units.includes(item.unit)) continue;
    if (filters.factoryId && factory.id !== filters.factoryId) continue;
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      let best = 0;
      for (const w of ix.words) {
        if (w === t) { best = 2; break; }
        if (best === 0 && w.startsWith(t)) best = 1;
      }
      if (!best) { ok = false; break; }
      score += best * 10;
      if (SIZE_RE.test(t) && (t === ix.size || t === ix.sizeRev)) score += 100;
    }
    if (ok) out.push({ hit: ix.hit, score });
  }
  return out;
}

export function search(hits: SearchHit[], query: string, filters: Filters = {}): ScoredHit[] {
  return searchIndex(buildIndex(hits), query, filters);
}

// ---------- comparison ----------

export type SortKey = 'factory' | 'item' | 'size' | 'finish' | 'rate' | 'unit' | 'updated';
export type SortDir = 'asc' | 'desc';

const cmpStr = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

function sortValue(h: SearchHit, key: SortKey): string | number | null {
  switch (key) {
    case 'factory': return h.factory.name;
    case 'item': return h.item.name;
    case 'size': return h.item.size;
    case 'finish': return h.item.finish;
    case 'rate': return h.item.rate;
    case 'unit': return h.item.unit;
    case 'updated': return Date.parse(h.pricelist.createdAt) || 0;
  }
}

/** Stable sort. Null rates always go last for the rate key. Ties fall back to rate, then rank. */
export function sortHits(rows: ScoredHit[], key: SortKey = 'rate', dir: SortDir = 'asc'): ScoredHit[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const va = sortValue(a.r.hit, key);
      const vb = sortValue(b.r.hit, key);
      if (key === 'rate') {
        if (va == null && vb == null) return b.r.score - a.r.score || a.i - b.i;
        if (va == null) return 1;
        if (vb == null) return -1;
      }
      let c = 0;
      if (typeof va === 'number' && typeof vb === 'number') c = va - vb;
      else c = cmpStr(String(va ?? ''), String(vb ?? ''));
      if (c !== 0) return c * sign;
      const ra = a.r.hit.item.rate;
      const rb = b.r.hit.item.rate;
      if (ra != null && rb != null && ra !== rb) return ra - rb;
      if (ra == null && rb != null) return 1;
      if (ra != null && rb == null) return -1;
      return b.r.score - a.r.score || a.i - b.i;
    })
    .map((x) => x.r);
}

export interface CompareStats {
  /** Unit that rows are compared in (the most common unit among rows that have a rate). */
  unit: Unit | null;
  lowest: SearchHit | null;
  lowestRate: number | null;
  /** How much more the highest same-unit rate is than the lowest. */
  highestDiff: number | null;
  factoryCount: number;
}

export function compareStats(rows: ScoredHit[]): CompareStats {
  const factories = new Set(rows.map((r) => r.hit.factory.id));
  const counts = new Map<Unit, number>();
  for (const r of rows) if (r.hit.item.rate != null) counts.set(r.hit.item.unit, (counts.get(r.hit.item.unit) ?? 0) + 1);
  let unit: Unit | null = null;
  let top = 0;
  for (const [u, n] of counts) if (n > top) { top = n; unit = u; }
  if (!unit) return { unit: null, lowest: null, lowestRate: null, highestDiff: null, factoryCount: factories.size };
  let lowest: SearchHit | null = null;
  let high = -Infinity;
  for (const r of rows) {
    const { rate, unit: u } = r.hit.item;
    if (rate == null || u !== unit) continue;
    if (!lowest || rate < (lowest.item.rate as number)) lowest = r.hit;
    if (rate > high) high = rate;
  }
  const lowestRate = lowest ? (lowest.item.rate as number) : null;
  const diff = lowestRate != null && high > lowestRate ? round2(high - lowestRate) : null;
  return { unit, lowest, lowestRate, highestDiff: diff, factoryCount: factories.size };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function isLowest(h: SearchHit, stats: CompareStats): boolean {
  return stats.lowestRate != null && h.item.unit === stats.unit && h.item.rate === stats.lowestRate;
}

/** "+1.50" when the row has a rate in the same unit as the lowest, else null. */
export function diffVsLowest(h: SearchHit, stats: CompareStats): number | null {
  if (stats.lowestRate == null || h.item.rate == null || h.item.unit !== stats.unit) return null;
  return round2(h.item.rate - stats.lowestRate);
}

export function formatDiff(d: number): string {
  return (d >= 0 ? '+' : '-') + Math.abs(d).toFixed(2);
}

export function matchesHeader(count: number, factories: number): string {
  const m = `${count} ${count === 1 ? 'match' : 'matches'}`;
  return `${m} across ${factories} ${factories === 1 ? 'factory' : 'factories'}`;
}

// ---------- recent searches ----------

export interface RecentSearch { q: string; at: string }
const RECENT_KEY = 'pv.recentSearches';
const RECENT_MAX = 8;

export function addRecent(list: RecentSearch[], q: string, now = new Date()): RecentSearch[] {
  const t = q.trim().replace(/\s+/g, ' ');
  if (!t) return list;
  const rest = list.filter((r) => r.q.toLowerCase() !== t.toLowerCase());
  return [{ q: t, at: now.toISOString() }, ...rest].slice(0, RECENT_MAX);
}

export function loadRecent(): RecentSearch[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((r) => r && typeof r.q === 'string' && typeof r.at === 'string').slice(0, RECENT_MAX);
  } catch { return []; }
}

export function saveRecent(list: RecentSearch[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}
