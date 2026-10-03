// Seed data for the mock API. Equivalent of mockups/data.js, expanded. Sample only, not real rates.
import type { Factory, FileRef, Item, Pricelist, Settings, Unit } from '../types';
import { samplePdfBase64, samplePngBase64 } from './mockFiles';

export interface MockUser {
  id: string;
  name: string;
  role: 'owner' | 'staff';
  pin: string;
}

export interface MockState {
  factories: Factory[];
  pricelists: Pricelist[];
  items: Record<string, Item[]>;
  users: MockUser[];
  settings: Settings;
  sessions: Record<string, string>; // token -> user id
  uploads: Record<string, { mime: string; base64: string }>;
}

type Row = [name: string, code: string, size: string, finish: string, thickness: string, boxPcs: string, unit: Unit, rate: number];

function mkItems(plId: string, rows: Row[]): Item[] {
  return rows.map((r, i) => ({
    id: `${plId}_i${i + 1}`,
    pricelistId: plId,
    name: r[0],
    code: r[1],
    size: r[2],
    finish: r[3],
    thickness: r[4],
    boxPcs: r[5],
    unit: r[6],
    rate: r[7],
    note: '',
  }));
}

const T = (name: string, size: string, finish: string, rate: number, thickness = '9 mm', box = '2 pcs', code = ''): Row => [
  name, code, size, finish, thickness, box, 'sqft', rate,
];
const S = (name: string, code: string, finish: string, rate: number): Row => [name, code, '', finish, '', '', 'pc', rate];

const pl1Rows: Row[] = [
  T('Calacatta Gold', '600x1200', 'Glossy', 38.5, '9 mm', '2 pcs', 'SC-6101'),
  T('Calacatta Gold', '800x1600', 'Glossy', 68, '10 mm', '1 pc', 'SC-8101'),
  T('Statuario Ice', '600x1200', 'Matt', 36, '9 mm', '2 pcs', 'SC-6102'),
  T('Carrara Grey', '600x600', 'Glossy', 27.5, '8.5 mm', '4 pcs', 'SC-6601'),
  T('Onyx Honey', '800x800', 'Glossy', 44, '9.5 mm', '3 pcs', 'SC-8801'),
  T('Slate Black', '600x1200', 'Rustic', 33, '9 mm', '2 pcs', 'SC-6103'),
  T('Terrazzo Sand', '600x600', 'Matt', 25, '8.5 mm', '4 pcs', 'SC-6602'),
  T('Wood Walnut Plank', '200x1200', 'Matt', 29.5, '9 mm', '6 pcs', 'SC-2101'),
  T('Armani Grey', '600x1200', 'Glossy', 43, '9 mm', '2 pcs', 'SC-6104'),
  T('Botticino Beige', '600x1200', 'Glossy', 39.5, '9 mm', '2 pcs', 'SC-6105'),
  T('Nero Marquina', '600x1200', 'Glossy', 42, '9 mm', '2 pcs', 'SC-6106'),
  T('Pietra Grey', '600x1200', 'Matt', 34, '9 mm', '2 pcs', 'SC-6107'),
  T('Cement Dark', '800x800', 'Matt', 41, '9.5 mm', '3 pcs', 'SC-8802'),
  T('Cement Light', '800x800', 'Matt', 41, '9.5 mm', '3 pcs', 'SC-8803'),
  T('Emperador Brown', '800x1600', 'Glossy', 71, '10 mm', '1 pc', 'SC-8102'),
  T('Verde Alpi', '600x600', 'Glossy', 28, '8.5 mm', '4 pcs', 'SC-6603'),
  T('Crema Marfil', '600x600', 'Glossy', 26.5, '8.5 mm', '4 pcs', 'SC-6604'),
  T('Travertine Cream', '600x1200', 'Rustic', 35.5, '9 mm', '2 pcs', 'SC-6108'),
  T('Basalt Stone', '600x600', 'Rustic', 24, '8.5 mm', '4 pcs', 'SC-6605'),
  T('Oak Natural Plank', '200x1200', 'Matt', 30, '9 mm', '6 pcs', 'SC-2102'),
  T('Teak Honey Plank', '200x1200', 'Matt', 31, '9 mm', '6 pcs', 'SC-2103'),
  T('Pearl White', '600x600', 'Glossy', 23.5, '8.5 mm', '4 pcs', 'SC-6606'),
  T('Marfil Dark', '800x800', 'Glossy', 43, '9.5 mm', '3 pcs', 'SC-8804'),
  T('Granito Spark', '600x600', 'Matt', 26, '8.5 mm', '4 pcs', 'SC-6607'),
];

const pl3Rows: Row[] = [
  S('Wall Hung WC Rimless', 'WH-204', 'White', 6850),
  S('Two Piece WC S-Trap', 'TP-118', 'Ivory', 3250),
  S('Two Piece WC P-Trap', 'TP-119', 'White', 3350),
  S('Table Top Basin Round', 'TB-330', 'Matt Black', 2980),
  S('Table Top Basin Oval', 'TB-332', 'White', 2450),
  S('Pedestal Basin', 'PB-071', 'White', 1450),
  S('Wall Hung Basin', 'WB-052', 'White', 1180),
  S('One Piece WC', 'OP-401', 'White', 8900),
  S('Urinal Flat Back', 'UR-015', 'White', 1320),
  S('Cistern Concealed', 'CC-600', 'White', 4200),
  S('Orissa Pan 22 inch', 'OR-022', 'Ivory', 980),
  S('Counter Top Basin Square', 'TB-340', 'Matt Grey', 3150),
];

const pl5Rows: Row[] = [
  S('Health Faucet Set', 'HF-09', 'Chrome', 640),
  S('Pillar Cock', 'PC-11', 'Chrome', 520),
  S('Angle Cock', 'AC-14', 'Chrome', 360),
  S('Basin Mixer Single Lever', 'BM-210', 'Chrome', 1850),
  S('Basin Mixer Single Lever', 'BM-210B', 'Matt Black', 2450),
  S('Wall Mixer with Diverter', 'WM-330', 'Chrome', 3400),
  S('Overhead Shower 8 inch', 'OS-208', 'Chrome', 1650),
  S('Hand Shower Set', 'HS-120', 'Chrome', 780),
  S('Bib Cock Long Body', 'BC-18', 'Chrome', 440),
  S('Bottle Trap', 'BT-33', 'Chrome', 720),
  S('Floor Drain 6 inch', 'FD-06', 'Steel', 410),
  S('Towel Rail 24 inch', 'TR-24', 'Chrome', 1250),
];

const pl6Rows: Row[] = [
  T('Marble White Glossy', '600x1200', 'Glossy', 40, '9 mm', '2 pcs', 'KV-1201'),
  T('Ivory Statuario', '600x1200', 'Glossy', 41, '9 mm', '2 pcs', 'KV-1202'),
  T('Crema Select', '800x800', 'Glossy', 45, '9.5 mm', '3 pcs', 'KV-8801'),
  T('Sand Stone', '600x600', 'Matt', 24, '8.5 mm', '4 pcs', 'KV-6601'),
];

const pl7Rows: Row[] = [
  T('Statuario Premium', '600x1200', 'Glossy', 41.5, '9 mm', '2 pcs', 'AT-1201'),
  T('Onyx Pearl', '600x1200', 'Glossy', 44, '9 mm', '2 pcs', 'AT-1202'),
  T('Parking Grey Rustic', '300x300', 'Rustic', 19, '12 mm', '9 pcs', 'AT-3301'),
  T('Parking Brown Rustic', '300x300', 'Rustic', 19, '12 mm', '9 pcs', 'AT-3302'),
];

const ISO = (d: string) => `${d}T09:30:00.000Z`;

function seedFiles(): { pl2: FileRef[]; pl4: FileRef[]; blobs: Record<string, { mime: string; base64: string }> } {
  const blobs: Record<string, { mime: string; base64: string }> = {};
  blobs['seed_pdf_pl2'] = { mime: 'application/pdf', base64: samplePdfBase64('Kailash Vitrified - Full Body Vitrified Sep 2026', 3) };
  const tints: [number, number, number][] = [
    [200, 220, 205],
    [220, 210, 195],
    [200, 210, 225],
  ];
  const pl4: FileRef[] = tints.map((t, i) => {
    const fileId = `seed_img_pl4_${i + 1}`;
    blobs[fileId] = { mime: 'image/png', base64: samplePngBase64(120, 160, t) };
    return { fileId, name: `parking-tiles-page-${i + 1}.png`, mime: 'image/png' };
  });
  return {
    pl2: [{ fileId: 'seed_pdf_pl2', name: 'Kailash-Full-Body-Sep-2026.pdf', mime: 'application/pdf', pages: 3 }],
    pl4,
    blobs,
  };
}

let cachedBlobs: Record<string, { mime: string; base64: string }> | null = null;
/** Built-in sample files. Not persisted; regenerated on demand. */
export function getSeedBlobs(): Record<string, { mime: string; base64: string }> {
  if (!cachedBlobs) cachedBlobs = seedFiles().blobs;
  return cachedBlobs;
}

export function buildSeed(): MockState {
  const files = seedFiles();
  cachedBlobs = files.blobs;
  const factories: Factory[] = [
    { id: 'f1', name: 'Sunrise Ceramics', city: 'Morbi', category: 'Tiles', contactName: 'Hitesh Bhai', phone: '98250 11234', notes: '', createdAt: ISO('2026-01-12') },
    { id: 'f2', name: 'Kailash Vitrified', city: 'Morbi', category: 'Tiles', contactName: 'Dinesh Patel', phone: '98240 55671', notes: '', createdAt: ISO('2026-01-20') },
    { id: 'f3', name: 'Shree Ganesh Sanitary', city: 'Thangadh', category: 'Sanitaryware', contactName: 'Jayesh Bhai', phone: '99090 22418', notes: 'Delivery to Surat on Tuesdays', createdAt: ISO('2026-02-03') },
    { id: 'f4', name: 'Aarav Tiles Pvt Ltd', city: 'Himmatnagar', category: 'Tiles', contactName: 'Manish Shah', phone: '97270 88102', notes: '', createdAt: ISO('2026-02-18') },
    { id: 'f5', name: 'Ocean Bath Fittings', city: 'Rajkot', category: 'Sanitaryware', contactName: 'Kunal Mehta', phone: '98795 30045', notes: '', createdAt: ISO('2026-03-02') },
  ];
  const base = { files: [] as FileRef[], status: 'current' as const, createdBy: 'Owner' };
  const items: Record<string, Item[]> = {
    pl1: mkItems('pl1', pl1Rows),
    pl3: mkItems('pl3', pl3Rows),
    pl5: mkItems('pl5', pl5Rows),
    pl6: mkItems('pl6', pl6Rows),
    pl7: mkItems('pl7', pl7Rows),
  };
  const pricelists: Pricelist[] = [
    { ...base, id: 'pl1', factoryId: 'f1', title: 'GVT Collection Oct 2026', category: 'Tiles', effectiveDate: '2026-10-01', source: 'items', itemCount: items.pl1.length, note: 'Rates ex-factory, GST extra', createdAt: ISO('2026-10-01') },
    { ...base, id: 'pl2', factoryId: 'f2', title: 'Full Body Vitrified Sep 2026', category: 'Tiles', effectiveDate: '2026-09-24', source: 'pdf', files: files.pl2, itemCount: 0, note: 'PDF received on WhatsApp', createdAt: ISO('2026-09-24'), createdBy: 'Rakesh' },
    { ...base, id: 'pl3', factoryId: 'f3', title: 'Sanitaryware Price List Q4', category: 'Sanitaryware', effectiveDate: '2026-09-29', source: 'items', itemCount: items.pl3.length, note: 'Includes freight to Surat', createdAt: ISO('2026-09-29') },
    { ...base, id: 'pl4', factoryId: 'f4', title: 'Parking Tiles Sep 2026', category: 'Tiles', effectiveDate: '2026-09-12', source: 'image', files: files.pl4, itemCount: 0, note: 'Photo of printed list', createdAt: ISO('2026-09-12') },
    { ...base, id: 'pl5', factoryId: 'f5', title: 'CP Fittings Oct 2026', category: 'Sanitaryware', effectiveDate: '2026-10-02', source: 'items', itemCount: items.pl5.length, note: '', createdAt: ISO('2026-10-02') },
    // Extra current lists (category Other, so the archive rule per factory + category is not broken)
    // so that "600x1200 glossy" compares across f1, f2 and f4 as in the mockup.
    { ...base, id: 'pl6', factoryId: 'f2', title: 'Glossy Range Sep 2026', category: 'Other', effectiveDate: '2026-09-26', source: 'items', itemCount: items.pl6.length, note: 'Typed from phone call', createdAt: ISO('2026-09-26'), createdBy: 'Rakesh' },
    { ...base, id: 'pl7', factoryId: 'f4', title: 'Glossy and Parking Sep 2026', category: 'Other', effectiveDate: '2026-09-12', source: 'items', itemCount: items.pl7.length, note: '', createdAt: ISO('2026-09-12') },
  ];
  // Archived history
  const arch = (id: string, from: string, factoryId: string, title: string, date: string, category: Pricelist['category'], factor: number, n: number) => {
    const src = items[from].slice(0, n).map((it, i) => ({ ...it, id: `${id}_i${i + 1}`, pricelistId: id, rate: it.rate == null ? null : Math.round(it.rate * factor * 100) / 100 }));
    items[id] = src;
    pricelists.push({ ...base, id, factoryId, title, category, effectiveDate: date, source: 'items', itemCount: src.length, note: '', status: 'archived', createdAt: ISO(date) });
  };
  arch('pl1a', 'pl1', 'f1', 'GVT Collection Sep 2026', '2026-09-01', 'Tiles', 0.97, 10);
  arch('pl1b', 'pl1', 'f1', 'GVT Collection Aug 2026', '2026-08-01', 'Tiles', 0.95, 8);
  arch('pl3a', 'pl3', 'f3', 'Sanitaryware Price List Q3', '2026-07-05', 'Sanitaryware', 0.96, 9);
  arch('pl5a', 'pl5', 'f5', 'CP Fittings Sep 2026', '2026-09-02', 'Sanitaryware', 0.98, 10);

  return {
    factories,
    pricelists,
    items,
    users: [
      { id: 'u_owner', name: 'Owner', role: 'owner', pin: '1234' },
      { id: 'u_rakesh', name: 'Rakesh', role: 'staff', pin: '5678' },
    ],
    settings: { hideRatesFromStaff: true, staleWeeks: 3 },
    sessions: {},
    uploads: {},
  };
}
