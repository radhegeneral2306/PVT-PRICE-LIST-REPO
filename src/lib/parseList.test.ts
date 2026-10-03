import { describe, expect, it } from 'vitest';
import { parseList } from './parseList';
import * as F from './parseList.fixtures';

const first = (t: string, o?: Parameters<typeof parseList>[1]) => parseList(t, o).rows[0]!;
const item = (t: string, o?: Parameters<typeof parseList>[1]) => first(t, o).item;

describe('mockup example', () => {
  const r = parseList(F.MOCKUP_8);
  it('reads 8 rows, 7 ok, 1 to check', () => {
    expect(r.summary).toEqual({ total: 8, ok: 7, check: 1 });
    expect(r.skipped).toHaveLength(0);
  });
  it('matches the mockup preview table', () => {
    const t = r.rows.map((x) => [x.item.name, x.item.size, x.item.finish, x.item.rate, x.item.unit]);
    expect(t).toEqual([
      ['Calacatta Gold', '600x1200', 'Glossy', 38.5, 'sqft'],
      ['Calacatta Gold', '800x1600', 'Glossy', 68, 'sqft'],
      ['Statuario Ice', '600x1200', 'Matt', 36, 'sqft'],
      ['Carrara Grey', '600x600', 'Glossy', 27.5, 'sqft'],
      ['Onyx Honey', '800x800', 'Glossy', 44, 'sqft'],
      ['Slate Black', '600x1200', 'Rustic', null, 'sqft'],
      ['Terrazzo Sand', '600x600', 'Matt', 25, 'sqft'],
      ['Wood Walnut Plank', '200x1200', 'Matt', 29.5, 'sqft']
    ]);
  });
  it('flags only the rate-less row', () => {
    const bad = r.rows.filter((x) => x.confidence === 'check');
    expect(bad).toHaveLength(1);
    expect(bad[0]!.item.name).toBe('Slate Black');
    expect(bad[0]!.issues).toContain('Rate missing');
    expect(bad[0]!.line).toBe(6);
  });
  it('notes the assumed unit without downgrading confidence', () => {
    const row = r.rows[3]!;
    expect(row.issues).toContain('Unit assumed sqft');
    expect(row.confidence).toBe('ok');
  });
  it('keeps raw text and line numbers', () => {
    expect(r.rows[0]!.raw).toBe('Calacatta Gold 600x1200 glossy 38.5/sqft');
    expect(r.rows[7]!.line).toBe(8);
  });
});

describe('WhatsApp style', () => {
  const r = parseList(F.WHATSAPP);
  it('strips emoji and markup from names', () => {
    expect(r.rows.map((x) => x.item.name)).toEqual(['Sky Onyx', 'Nero Marquina', 'Botticino Beige']);
  });
  it('reads rates with /- rupee sign and per sqft', () => {
    expect(r.rows.map((x) => x.item.rate)).toEqual([28, 30, 26.5]);
  });
  it('applies the heading size to rows lacking one', () => {
    expect(r.rows.every((x) => x.item.size === '600x600')).toBe(true);
    expect(r.rows[0]!.issues).toContain('Size taken from heading');
  });
  it('skips chatter, dates, terms, phone and greeting', () => {
    const reasons = r.skipped.map((s) => s.reason);
    expect(reasons).toContain('heading');
    expect(reasons).toContain('terms or note');
    expect(reasons).toContain('contact details');
    expect(r.skipped.length).toBe(7);
    expect(r.summary).toEqual({ total: 3, ok: 3, check: 0 });
  });
  it('strips keycap number emoji and star markup', () => {
    expect(item('1️⃣ *Sky Onyx* 600x600 glossy 28').name).toBe('Sky Onyx');
    expect(item('~Old Item~ 600x600 matt 10').name).toBe('Old Item');
    expect(item('```Sky Onyx 600x600 matt 22```').rate).toBe(22);
  });
});

describe('tab separated paste', () => {
  const r = parseList(F.TSV_HEADER);
  it('detects the header and skips it', () => {
    expect(r.skipped).toEqual([{ line: 1, raw: F.TSV_HEADER.split('\n')[0], reason: 'header row' }]);
    expect(r.rows).toHaveLength(4);
  });
  it('maps columns', () => {
    expect(r.rows[0]!.item).toMatchObject({ name: 'Calacatta Gold', size: '600x1200', finish: 'Glossy', rate: 38.5, unit: 'sqft' });
  });
  it('converts cm sizes and keeps inch sizes as typed', () => {
    expect(r.rows[0]!.item.size).toBe('600x1200');
    expect(r.rows[2]!.item.size).toBe('24x48 inch');
  });
  it('reads thousands separators and box unit', () => {
    expect(r.rows[2]!.item).toMatchObject({ rate: 1450, unit: 'box', finish: 'Glossy' });
  });
  it('keeps a row with an empty rate cell as check', () => {
    expect(r.rows[3]!.item.rate).toBeNull();
    expect(r.rows[3]!.confidence).toBe('check');
    expect(r.rows[3]!.issues).toContain('Rate missing');
  });
  it('handles tabs without a header and drops the serial cell', () => {
    const x = item('1\tSky Onyx\t600x600\tglossy\t28');
    expect(x).toMatchObject({ name: 'Sky Onyx', size: '600x600', finish: 'Glossy', rate: 28 });
  });
});

describe('CSV and pipes', () => {
  it('maps a CSV with quoted commas and a unit hint from the header', () => {
    const r = parseList(F.CSV_HEADER);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]!.item).toMatchObject({ name: 'Calacatta Gold Premium', size: '600x1200', finish: 'Glossy', rate: 38.5, unit: 'sqft' });
    expect(r.rows[0]!.issues).not.toContain('Unit assumed sqft');
    expect(r.rows[1]!.item).toMatchObject({ size: '2x2 ft', rate: 41 });
  });
  it('reads CSV without a header', () => {
    const r = parseList(F.CSV_NO_HEADER);
    expect(r.rows.map((x) => [x.item.name, x.item.size, x.item.finish, x.item.rate])).toEqual([
      ['Calacatta Gold', '600x1200', 'Glossy', 38.5],
      ['Nero Marquina', '600x600', 'Matt', 41]
    ]);
  });
  it('reads pipe tables with a header', () => {
    const r = parseList(F.PIPE_HEADER);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1]!.item).toMatchObject({ name: 'Nero Marquina', rate: 1450, unit: 'box' });
  });
  it('treats 1,450 as one number in comma text', () => {
    expect(item('Sky Onyx,600x600,glossy,1,450').rate).toBe(1450);
  });
  it('supports semicolon CSV', () => {
    const r = parseList('Item;Size;Rate\nSky Onyx;600x600;28');
    expect(r.rows[0]!.item).toMatchObject({ name: 'Sky Onyx', size: '600x600', rate: 28 });
  });
  it('maps header words such as Design, Price, Thickness and Pcs/Box', () => {
    const r = parseList('Design\tCode\tSize\tThickness\tPcs/Box\tPrice\nSky Onyx\tSK-01\t600x600\t9\t4\t28');
    expect(r.rows[0]!.item).toMatchObject({ name: 'Sky Onyx', code: 'SK-01', thickness: '9 mm', boxPcs: '4 pcs', rate: 28 });
  });
});

describe('sanitaryware', () => {
  const r = parseList(F.SANITARY);
  it('treats the first line as a heading', () => {
    expect(r.skipped[0]).toMatchObject({ line: 1, reason: 'heading' });
  });
  it('extracts codes and rates', () => {
    expect(r.rows[0]!.item).toMatchObject({ name: 'Wall Hung WC', code: 'WH-204', rate: 6850, unit: 'pc', size: '' });
    expect(r.rows[1]!.item).toMatchObject({ name: 'Table Top Basin', code: 'TB330', rate: 1450 });
    expect(r.rows[2]!.item).toMatchObject({ rate: 3200, unit: 'pc' });
  });
  it('removes + GST and Rs./- noise', () => {
    expect(r.rows[3]!.item).toMatchObject({ code: 'PD-110', rate: 2750 });
    expect(r.rows[3]!.item.name).toBe('Pedestal Basin');
    expect(r.rows[5]!.item).toMatchObject({ name: 'Shower Set', rate: 640 });
  });
  it('does not ask for a size on sanitaryware', () => {
    expect(r.rows.every((x) => !x.issues.includes('Size not found'))).toBe(true);
    expect(r.summary.check).toBe(0);
  });
  it('uses the code as name when nothing else is left', () => {
    const x = item('TB330 Rs 1450/-');
    expect(x.code).toBe('TB330');
    expect(x.name).toBe('TB330');
  });
  it('uppercases codes typed in lower case', () => {
    expect(item('wh-204 wall hung wc 6850/-').code).toBe('WH-204');
  });
  it('title cases acronyms like WC and EWC', () => {
    expect(item('ewc s-trap white 3200 pc').name).toBe('EWC S-Trap White');
  });
  it('keeps measurements in the name instead of reading them as rate', () => {
    const x = item('Wash Basin 450 mm Rs 2300/-');
    expect(x.rate).toBe(2300);
    expect(x.name).toBe('Wash Basin 450 mm');
  });
});

describe('rates', () => {
  const rate = (t: string) => item(t).rate;
  it.each([
    ['Sky Onyx 600x600 glossy 38.5', 38.5],
    ['Sky Onyx 600x600 glossy 38.50/sqft', 38.5],
    ['Sky Onyx 600x600 glossy 1,450', 1450],
    ['Sky Onyx 600x600 glossy 6850/-', 6850],
    ['Sky Onyx 600x600 glossy Rs 640 per pc', 640],
    ['Sky Onyx 600x600 glossy Rs. 640', 640],
    ['Sky Onyx 600x600 glossy Rs640', 640],
    ['Sky Onyx 600x600 glossy INR 640', 640],
    ['Sky Onyx 600x600 glossy ₹640', 640],
    ['Sky Onyx 600x600 glossy 640 rs', 640],
    ['Sky Onyx 600x600 glossy @ 640', 640],
    ['Sky Onyx 600x600 glossy rate: 640', 640],
    ['Sky Onyx 600x600 glossy MRP 1,45,000', 145000]
  ])('%s -> %s', (t, v) => {
    expect(rate(t)).toBe(v);
  });
  it('flags a rate below 1', () => {
    const r = first('Sky Onyx 600x600 glossy 0.5/sqft');
    expect(r.confidence).toBe('check');
    expect(r.issues).toContain('Rate looks too low');
  });
  it('flags a rate above 100000', () => {
    const r = first('Sky Onyx 600x600 glossy 250000');
    expect(r.confidence).toBe('check');
    expect(r.issues).toContain('Rate looks too high');
  });
  it('flags an implausible per sqft rate', () => {
    const r = first('Sky Onyx 600x600 glossy 6850/sqft');
    expect(r.confidence).toBe('check');
  });
  it.each(['???', 'TBD', 'call', 'n/a'])('treats %s as missing rate', (m) => {
    const r = first(`Sky Onyx 600x600 glossy ${m}`);
    expect(r.item.rate).toBeNull();
    expect(r.confidence).toBe('check');
    expect(r.item.name).toBe('Sky Onyx');
  });
});

describe('sizes', () => {
  const size = (t: string) => item(`Sky Onyx ${t} glossy 28`).size;
  it.each([
    ['600x1200', '600x1200'],
    ['600 x 1200', '600x1200'],
    ['600*1200', '600x1200'],
    ['600X1200 mm', '600x1200'],
    ['60x120 cm', '600x1200'],
    ['60 x 120 CM', '600x1200'],
    ['59.5x119.5 cm', '595x1195'],
    ['2x2 ft', '2x2 ft'],
    ['2 x 4 feet', '2x4 ft'],
    ['24x48 inch', '24x48 inch'],
    ['12x18 inches', '12x18 inch']
  ])('%s -> %s', (t, v) => {
    expect(size(t)).toBe(v);
  });
  it('guesses unit-less sizes and marks them check', () => {
    const r = first('Sky Onyx 60x120 glossy 28');
    expect(r.item.size).toBe('600x1200');
    expect(r.confidence).toBe('check');
    expect(r.issues).toContain('Size unit assumed cm');
  });
  it('treats big unit-less sizes as mm without complaint', () => {
    expect(first('Sky Onyx 800x1600 glossy 28').confidence).toBe('ok');
  });
  it('reads a thickness given as the third dimension', () => {
    const x = item('Sky Onyx 600x600x9mm glossy 28');
    expect(x.size).toBe('600x600');
    expect(x.thickness).toBe('9 mm');
  });
  it('reports size not found for tile-like rows', () => {
    const r = first('Sky Onyx glossy 28/sqft');
    expect(r.issues).toContain('Size not found');
    expect(r.confidence).toBe('check');
  });
});

describe('finish, thickness, box pcs, units', () => {
  it.each([
    ['gloss', 'Glossy'],
    ['GLOSSY', 'Glossy'],
    ['matt', 'Matt'],
    ['matte', 'Matt'],
    ['rustic', 'Rustic'],
    ['satin', 'Satin'],
    ['polished', 'Polished'],
    ['carving', 'Carving'],
    ['hi-gloss', 'High Gloss'],
    ['high gloss', 'High Gloss'],
    ['sugar', 'Sugar'],
    ['wooden', 'Wooden']
  ])('finish %s -> %s', (w, v) => {
    expect(item(`Sky Onyx 600x600 ${w} 28`).finish).toBe(v);
  });
  it('removes the word finish and finish from the name', () => {
    const x = item('Sky Onyx matt finish 600x600 28');
    expect(x).toMatchObject({ finish: 'Matt', name: 'Sky Onyx' });
  });
  it('prefers a surface finish over wooden and keeps wooden in the name', () => {
    expect(item('Wooden Oak 600x1200 matt 30')).toMatchObject({ finish: 'Matt', name: 'Wooden Oak' });
  });
  it.each([
    ['9mm', '9 mm'],
    ['9 mm', '9 mm'],
    ['thk 10mm', '10 mm'],
    ['8.5 mm', '8.5 mm']
  ])('thickness %s', (t, v) => {
    expect(item(`Sky Onyx 600x600 ${t} glossy 28`).thickness).toBe(v);
  });
  it.each([
    ['2 pcs/box', '2 pcs'],
    ['4 pc per box', '4 pcs'],
    ['box of 4', '4 pcs'],
    ['3pcs/box', '3 pcs']
  ])('box pcs %s', (t, v) => {
    const x = item(`Sky Onyx 600x1200 ${t} glossy 1450 per box`);
    expect(x.boxPcs).toBe(v);
    expect(x.unit).toBe('box');
    expect(x.rate).toBe(1450);
  });
  it('reads every unit word', () => {
    const r = parseList(F.MIXED_UNITS);
    expect(r.rows.map((x) => x.item.unit)).toEqual(['sqft', 'sqm', 'box', 'pc', 'set', 'pc', 'pc']);
    expect(r.rows.map((x) => x.item.rate)).toEqual([28, 300, 1450, 120, 1850, 90, 12]);
  });
  it.each([
    ['sq ft', 'sqft'],
    ['sq.ft', 'sqft'],
    ['sqm', 'sqm'],
    ['sq mtr', 'sqm'],
    ['piece', 'pc'],
    ['pcs', 'pc']
  ])('unit word %s', (u, v) => {
    expect(item(`Sky Onyx 600x600 glossy 28 per ${u}`).unit).toBe(v);
  });
  it('uses defaultUnit when none is written and says so', () => {
    const r = first('Sky Onyx 600x600 glossy 28', { defaultUnit: 'box' });
    expect(r.item.unit).toBe('box');
    expect(r.issues).toContain('Unit assumed box');
  });
  it('uses the chosen category for the default unit', () => {
    expect(first('Rose Basin 2300', { category: 'Sanitaryware' }).item.unit).toBe('pc');
    expect(first('Sky Onyx 600x600 glossy 28', { category: 'Tiles' }).item.unit).toBe('sqft');
  });
});

describe('headings', () => {
  const r = parseList(F.HEADING_SIZES);
  it('puts headings in skipped with reason heading', () => {
    expect(r.skipped.map((s) => [s.line, s.reason])).toEqual([[1, 'heading'], [4, 'heading'], [7, 'heading']]);
  });
  it('applies heading size to following rows, and switches at the next heading', () => {
    expect(r.rows.map((x) => x.item.size)).toEqual(['600x600', '600x600', '800x1600', '800x1600', '300x600']);
  });
  it('clears the size at a heading without one', () => {
    const x = parseList('GVT 600x600 mm\nSky Onyx glossy 28\nSANITARYWARE\nBasin 2000').rows;
    expect(x[0]!.item.size).toBe('600x600');
    expect(x[1]!.item.size).toBe('');
  });
  it('a size-less heading does not stop rows being rows', () => {
    expect(r.summary.total).toBe(5);
  });
  it('remembers a unit named in a heading', () => {
    const q = parseList('Rates per sqft\nSky Onyx 600x600 glossy 28');
    expect(q.skipped[0]!.reason).toBe('heading');
    expect(q.rows[0]!.item.unit).toBe('sqft');
    expect(q.rows[0]!.issues).not.toContain('Unit assumed sqft');
  });
  it('treats SANITARYWARE as a heading', () => {
    const q = parseList('SANITARYWARE');
    expect(q.rows).toHaveLength(0);
    expect(q.skipped[0]!.reason).toBe('heading');
  });
  it('keeps a rate-less line with size and finish as a row', () => {
    const q = parseList('Slate Black 600x1200 rustic');
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0]!.issues).toContain('Rate missing');
  });
});

describe('Hindi-English mix', () => {
  const r = parseList(F.HINGLISH);
  it('reads the example from the brief', () => {
    expect(r.rows[0]!.item).toMatchObject({ name: 'Calacatta Gold', size: '600x1200', finish: 'Glossy', rate: 38.5, unit: 'sqft' });
    expect(r.rows[0]!.confidence).toBe('ok');
  });
  it('drops bhav, kimat, ka and rate from names', () => {
    expect(r.rows.map((x) => x.item.name)).toEqual(['Calacatta Gold', 'Sky Onyx', 'Nero Marquina', 'Statuario Ice']);
    expect(r.rows.map((x) => x.item.rate)).toEqual([38.5, 28, 30, 36]);
  });
});

describe('messy input', () => {
  const r = parseList(F.MESSY);
  it('reads bullets, odd spacing and mixed separators', () => {
    expect(r.rows.map((x) => [x.item.name, x.item.size, x.item.finish, x.item.rate])).toEqual([
      ['Calacatta Gold', '600x1200', 'Glossy', 38.5],
      ['Statuario Ice', '600x1200', 'Matt', 36],
      ['Onyx Honey', '800x800', 'Glossy', 44],
      ['Carrara Grey', '600x600', 'Satin', 27.5]
    ]);
  });
  it('title cases lower case and upper case names', () => {
    expect(item('CALACATTA GOLD 600X1200 GLOSSY 38.5').name).toBe('Calacatta Gold');
    expect(item('calacatta gold 600x1200 glossy 38.5').name).toBe('Calacatta Gold');
  });
  it('handles Windows line endings and blank lines', () => {
    const q = parseList('Sky Onyx 600x600 glossy 28\r\n\r\nNero 600x600 matt 30\r\n');
    expect(q.rows).toHaveLength(2);
    expect(q.rows[1]!.line).toBe(3);
  });
  it('skips a repeated header row in the middle', () => {
    const q = parseList('Item\tSize\tRate\nSky\t600x600\t28\nItem\tSize\tRate\nNero\t600x600\t30');
    expect(q.rows.map((x) => x.item.name)).toEqual(['Sky', 'Nero']);
  });
});

describe('garbage', () => {
  it('skips every garbage line and returns no rows', () => {
    const r = parseList(F.GARBAGE);
    expect(r.rows).toHaveLength(0);
    expect(r.skipped).toHaveLength(F.GARBAGE.split('\n').length);
  });
  it('gives reasons', () => {
    const reasons = parseList(F.GARBAGE).skipped.map((s) => s.reason);
    expect(reasons).toContain('phone number');
    expect(reasons).toContain('date');
    expect(reasons).toContain('terms or note');
    expect(reasons).toContain('divider');
  });
  it('handles empty and whitespace input', () => {
    expect(parseList('')).toEqual({ rows: [], skipped: [], summary: { total: 0, ok: 0, check: 0 } });
    expect(parseList('  \n\t\n').rows).toHaveLength(0);
  });
  it('does not throw on odd characters', () => {
    expect(() => parseList('\u0000\u0001 ### $$$ नमस्ते ((( ]]]\n\\\\ // ??')).not.toThrow();
  });
  it('does not read a phone number as a rate', () => {
    const r = parseList('Contact: Ramesh 98250 11234');
    expect(r.rows).toHaveLength(0);
  });
  it('keeps item rows in a noisy list while skipping the noise', () => {
    const r = parseList('Hi\nSky Onyx 600x600 glossy 28\nTerms: GST extra\nNero 600x600 matt 30');
    expect(r.rows).toHaveLength(2);
    expect(r.skipped).toHaveLength(2);
  });
  it('summary adds up', () => {
    const r = parseList(F.MOCKUP_8 + '\n' + F.GARBAGE);
    expect(r.summary.total).toBe(r.rows.length);
    expect(r.summary.ok + r.summary.check).toBe(r.summary.total);
  });
});

describe('performance', () => {
  it('parses 2000 lines well under 200 ms', () => {
    const text = F.bigPaste(2000);
    parseList(text); // warm up
    const t0 = performance.now();
    const r = parseList(text);
    const ms = performance.now() - t0;
    expect(r.rows.length).toBeGreaterThan(1500);
    expect(ms).toBeLessThan(200);
  });
});
