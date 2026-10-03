import { describe, expect, it } from 'vitest';
import type { Category, Item, SearchHit, Unit } from '../../types';
import { addRecent, buildIndex, compareStats, diffVsLowest, formatDiff, isLowest, matchesHeader, normalizeText, parseQuery, search, searchIndex, sortHits } from './searchEngine';

let n = 0;
function hit(o: { name?: string; size?: string; finish?: string; code?: string; rate?: number | null; unit?: Unit; factory?: string; cat?: Category }): SearchHit {
  n++;
  const f = o.factory ?? 'Sunrise Ceramics';
  const item: Item = { id: 'i' + n, pricelistId: 'p' + f, name: o.name ?? 'Item', code: o.code ?? '', size: o.size ?? '', finish: o.finish ?? '', thickness: '', boxPcs: '', unit: o.unit ?? 'sqft', rate: o.rate === undefined ? 40 : o.rate, note: '' };
  return {
    item,
    pricelist: { id: 'p' + f, factoryId: f, title: 't', category: o.cat ?? 'Tiles', effectiveDate: '2026-10-01', source: 'items', files: [], itemCount: 1, note: '', status: 'current', createdAt: '2026-10-01T00:00:00Z', createdBy: 'o' },
    factory: { id: f, name: f, city: '', category: o.cat ?? 'Tiles', contactName: '', phone: '', notes: '', createdAt: '' },
  };
}

describe('normalise', () => {
  it('unifies size separators and mm', () => {
    expect(normalizeText('600 X 1200 mm')).toBe('600x1200');
    expect(normalizeText('600*1200mm')).toBe('600x1200');
    expect(normalizeText('600x600x9')).toBe('600x600x9');
  });
  it('maps synonyms and strips punctuation', () => {
    expect(normalizeText('Gloss, Matte!')).toBe('glossy matt');
  });
  it('pulls unit words out of the query', () => {
    expect(parseQuery('600x1200 per sqft')).toEqual({ tokens: ['600x1200'], units: ['sqft'] });
  });
});

describe('search', () => {
  const hits = [
    hit({ name: 'Calacatta Gold', size: '600x1200', finish: 'Glossy', rate: 38.5 }),
    hit({ name: 'Onyx', size: '1200x600', finish: 'Gloss', rate: 41, factory: 'Kailash' }),
    hit({ name: 'Wood Plank', size: '200x1200', finish: 'Matt', rate: 30, factory: 'Kailash' }),
    hit({ name: 'Wall Hung WC', code: 'WH-01', rate: 2500, unit: 'pc', cat: 'Sanitaryware', factory: 'Aarav' }),
  ];
  it('matches sizes in either orientation and synonyms', () => {
    const r = search(hits, '600 x 1200 glossy');
    expect(r.map((x) => x.hit.item.name).sort()).toEqual(['Calacatta Gold', 'Onyx']);
  });
  it('ANDs tokens and allows prefixes', () => {
    expect(search(hits, 'wall hu').length).toBe(1);
    expect(search(hits, 'wall onyx').length).toBe(0);
    expect(search(hits, 'kail').length).toBe(2);
  });
  it('matches codes, factory names and matte synonym', () => {
    expect(search(hits, 'wh-01').length).toBe(1);
    expect(search(hits, 'aarav').length).toBe(1);
    expect(search(hits, 'matte').length).toBe(1);
  });
  it('ranks exact size first', () => {
    const r = search([hit({ name: 'A', size: '600x1200' }), hit({ name: 'B', size: '600x1800' })], '600x1200');
    expect(r.map((x) => x.hit.item.name)).toEqual(['A']);
    const r2 = search([hit({ name: 'B', size: '600x1800' }), hit({ name: 'A', size: '600x1200' })], '600x1');
    expect(r2.length).toBe(2);
    const r3 = search([hit({ name: 'B', size: '600x1200x9' }), hit({ name: 'A', size: '600x1200' })], '600x1200');
    expect(r3.sort((a, b) => b.score - a.score)[0].hit.item.name).toBe('A');
  });
  it('applies chips and typed units', () => {
    expect(search(hits, 'wall', { units: ['sqft'] }).length).toBe(0);
    expect(search(hits, '', { categories: ['Sanitaryware'] }).length).toBe(0);
    expect(search(hits, 'wall pc').length).toBe(1);
    expect(search(hits, 'glossy', { categories: ['Sanitaryware'] }).length).toBe(0);
  });
  it('is fast for 5000 hits', () => {
    const many = Array.from({ length: 5000 }, (_, i) => hit({ name: 'Tile ' + i, size: i % 2 ? '600x1200' : '800x800', finish: 'Glossy', factory: 'F' + (i % 20) }));
    const idx = buildIndex(many);
    const t = performance.now();
    for (let i = 0; i < 20; i++) searchIndex(idx, '600x1200 glossy tile');
    expect((performance.now() - t) / 20).toBeLessThan(50);
  });
});

describe('compare', () => {
  const rows = [
    hit({ rate: 43, factory: 'B' }),
    hit({ rate: 38.5, factory: 'A' }),
    hit({ rate: null, factory: 'C' }),
    hit({ rate: 500, unit: 'box', factory: 'C' }),
  ].map((h) => ({ hit: h, score: 0 }));
  it('sorts by rate with nulls last', () => {
    const s = sortHits(rows, 'rate', 'asc').map((r) => r.hit.item.rate);
    expect(s).toEqual([38.5, 43, 500, null]);
    expect(sortHits(rows, 'rate', 'desc').map((r) => r.hit.item.rate)).toEqual([500, 43, 38.5, null]);
  });
  it('computes lowest, diffs and summary only within the same unit', () => {
    const st = compareStats(rows);
    expect(st.unit).toBe('sqft');
    expect(st.lowestRate).toBe(38.5);
    expect(st.highestDiff).toBe(4.5);
    expect(st.factoryCount).toBe(3);
    expect(isLowest(rows[1].hit, st)).toBe(true);
    expect(diffVsLowest(rows[0].hit, st)).toBe(4.5);
    expect(diffVsLowest(rows[3].hit, st)).toBeNull();
    expect(diffVsLowest(rows[2].hit, st)).toBeNull();
    expect(formatDiff(1.5)).toBe('+1.50');
  });
  it('handles all-null rates (staff)', () => {
    const st = compareStats([{ hit: hit({ rate: null }), score: 0 }]);
    expect(st.lowest).toBeNull();
  });
  it('formats header', () => {
    expect(matchesHeader(4, 3)).toBe('4 matches across 3 factories');
    expect(matchesHeader(1, 1)).toBe('1 match across 1 factory');
  });
});

describe('recent', () => {
  it('dedupes, caps at 8 and puts newest first', () => {
    let l = addRecent([], 'a');
    for (const q of ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']) l = addRecent(l, q);
    expect(l.length).toBe(8);
    expect(l[0].q).toBe('i');
    l = addRecent(l, 'D');
    expect(l[0].q).toBe('D');
    expect(l.filter((r) => r.q.toLowerCase() === 'd').length).toBe(1);
  });
});
