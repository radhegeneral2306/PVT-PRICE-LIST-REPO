/*
 * parseList: turns pasted pricelist text (WhatsApp, typed, Excel, CSV) into item rows.
 * Pure TypeScript, no dependencies, no React.
 *
 * How it works, in short
 *  1. Each line is cleaned (emoji, WhatsApp markup, bullets, numbering, GST phrases).
 *  2. Pure noise (terms, phone numbers, dates, greetings) goes to `skipped`.
 *  3. A header row (item / size / finish / rate ...) switches on column mapping for
 *     tab, pipe, comma, semicolon or wide-space separated pastes.
 *  4. Other lines are read as free text: size, box pcs, thickness, rate, unit, finish and
 *     item code are cut out, and the words left over become the name.
 *  5. A line with no rate that looks like a section title is skipped with reason
 *     'heading'. Its category, its size (e.g. "GVT 600x600 mm") and any unit it names
 *     are remembered and applied to the rows that follow and lack them.
 *
 * Confidence rules
 *  'check' when: rate missing, rate implausible (< 1, > 100000, or > 5000 per sqft),
 *  size missing on something that looks like a tile, size unit had to be guessed,
 *  or no name could be read. 'Unit assumed ...' and 'Size taken from heading' are shown
 *  in `issues` as information only and do NOT make a row 'check'.
 *
 * Known limitations (honest list)
 *  - One item per line. Wrapped lines or several items on one line are not split.
 *  - Unit-less sizes are guessed: both sides >= 150 means mm, a side < 10 means ft,
 *    up to 24 means inch, anything else means cm. Guessed sizes are marked 'check'.
 *    Sizes in metres (1.2x0.6) and sizes written 2'x2' are not understood.
 *    The bare word "in" is not treated as inches; write "inch".
 *  - Without a header row, the last loose number on a line is taken as the rate. A lone
 *    number that is really a quantity or a year can be misread as a rate.
 *  - Item codes need letters followed by 2 to 6 digits (WH-204, TB330). Pure numeric
 *    codes are only recognised in a "Code" column under a header row.
 *  - Finish is the first recognised finish word; a second one on the same line is dropped.
 *    "Wooden" is only used as the finish when no other finish is present (it stays in the name).
 *  - A rate-less line with no size, code or finish and 6 words or fewer is treated as a
 *    heading, so a bare item name with no data becomes a heading, not a row.
 *    A rate-less line of more than 6 words with nothing else recognised is skipped as text.
 *  - Bare 'set' and 'box' are only read as a unit right after the rate ("640 set"); with
 *    "per" or "/" they always work ("640/set").
 *  - European decimals ("38,5") are not supported. Commas are thousands separators only
 *    when followed by exactly 3 digits (or Indian grouping 1,45,000).
 *  - A header row whose columns have unrecognised names is not detected as a header.
 *  - Hindi is only supported through common Latin-script words (rate, bhav, kimat, ka).
 *  - The code is stored in `code` and removed from the name. If nothing else is left the
 *    name equals the code.
 */
import type { Category, Item, Unit } from '../types';

export interface ParsedRow {
  raw: string;
  line: number;
  item: Omit<Item, 'id' | 'pricelistId'>;
  confidence: 'ok' | 'check';
  issues: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  skipped: { line: number; raw: string; reason: string }[];
  summary: { total: number; ok: number; check: number };
}

/* ------------------------------------------------------------------ */
/* Regexes (compiled once)                                             */
/* ------------------------------------------------------------------ */

const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)`;
const CUR = String.raw`(?:rs\.?|inr|₹|rupees?|rupaye|rupay)`;

const SQFT = String.raw`sq\.?\s*(?:ft|feet|foot)|sqft|sft|square\s+(?:feet|foot)`;
const SQM = String.raw`sq\.?\s*m(?:tr|tre|eter|etre)?s?|sqm|sqmt|square\s+met(?:er|re)s?`;
const BOX = String.raw`boxes|box|ctn|carton`;
const PC = String.raw`pcs|pc|pce|pieces|piece|nos|no|each|ea|unit|units`;
const SET = String.raw`sets|set`;
const UNITS_ALL = `${SQFT}|${SQM}|${BOX}|${PC}|${SET}`;
const UNITS_BARE = `${SQFT}|${SQM}|pcs|pc|pce|pieces|piece|nos|each`;

const EMOJI_RE = /\d️?⃣|[\p{Extended_Pictographic}​-‏⁠️⃣ ]/gu;
const BULLET_RE =
  /^\s*(?:[-*•▪●○◦‣⁃\u2013\u2014>➤➡→·#]+\s+|\(?\d{1,3}\s*[.)]\s+(?=[\p{L}_*~])|\d{1,3}\s*[-:]\s+(?=[\p{L}_*~])|#\d{1,3}\s+)/u;

const GST_RE =
  /(?:\+\s*|plus\s+|incl(?:uding|usive)?\.?\s+(?:of\s+)?|excl(?:uding|usive)?\.?\s+(?:of\s+)?|extra\s+)?(?:\d{1,2}(?:\.\d+)?\s*%\s*)?\b(?:i|c|s)?gst\b(?:\s+(?:extra|extr|applicable|as\s+applicable|inclusive|incl\.?|additional))?|\+\s*\d{1,2}(?:\.\d+)?\s*%(?:\s+extra)?/gi;

const SIZE_RE = new RegExp(
  String.raw`(?<![\d.])(\d+(?:\.\d+)?)\s*(mm|cm|ft|feet|foot|inch(?:es)?)?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(mm|cm|ft|feet|foot|inch(?:es)?)?(?:(?![A-Za-z])|(?=\s*[x\u00d7*]\s*\d))(?:\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(mm|cm)?(?![A-Za-z]))?`,
  'i'
);
const THK_RE = /(?:thk\.?\s*|thickness\s*[:=]?\s*)?(?<![\d.])(\d+(?:\.\d+)?)\s*mm(?![A-Za-z])/gi;
const BOXPCS_1 =
  /(?<![\d.])(\d{1,3})\s*(?:pcs|pc|pieces?|nos|tiles?)\s*(?:\/|per\b|in\b|-)?\s*(?:box(?:es)?|ctn|carton)(?![A-Za-z])/i;
const BOXPCS_2 = /(?<![A-Za-z])(?:box|ctn|carton)\s*(?:of|=|:)\s*(\d{1,3})(?:\s*(?:pcs|pc|pieces?|nos|tiles?))?(?![A-Za-z\d])/i;
const BOXPCS_3 = /(?<![A-Za-z])(?:pcs|pc)\s*(?:\/|per\b)\s*(?:box|ctn)\s*[:=-]?\s*(\d{1,3})(?![\d.])/i;

const LB = String.raw`(?<![A-Za-z\d.,])`;
const RATE_LABEL = new RegExp(
  String.raw`(?<![A-Za-z])(?:rates?|price|mrp|bhav|bhaav|bhaw|kimat|dp|net|nett)(?![A-Za-z])\s*(?:is\b|[:=@-])?\s*${CUR}?\s*${NUM}`,
  'i'
);
const RATE_AT = new RegExp(String.raw`@\s*${CUR}?\s*${NUM}`, 'i');
const RATE_PREFIX = new RegExp(String.raw`(?<![A-Za-z])${CUR}\s*${NUM}`, 'i');
const RATE_UNITPER = new RegExp(String.raw`${LB}${NUM}\s*(?:\/-)?\s*(?:\/|per\b)\s*(${UNITS_ALL})(?![A-Za-z])`, 'i');
const RATE_SUFFIX = new RegExp(String.raw`${LB}${NUM}\s*(?:\/-|\/=|${CUR}(?![A-Za-z])|₹)`, 'i');
const RATE_FALLBACK = /(?<![A-Za-z\d.,\-])(\d[\d,]*(?:\.\d+)?)(?![A-Za-z\d])/g;

const UNIT_PREFIXED = new RegExp(String.raw`(?:(?<![A-Za-z])per\b|\/)\s*(${UNITS_ALL})(?![A-Za-z])`, 'i');
const UNIT_BARE = new RegExp(String.raw`(?<![A-Za-z\d])(${UNITS_BARE})(?![A-Za-z])`, 'i');
const UNIT_AFTER_RATE = /\s*(sets?|box(?:es)?)(?![A-Za-z])/i;
const RATE_MARK = '';

const MARKER_RE = /\?{2,}|(?<![A-Za-z])(?:tbd|tba|n\/a|poa|call|ask|na|nil)(?![A-Za-z\d])|\bon\s+request\b|-{2,}\s*$/gi;

const CODE_RE = /(?<![\w-])[A-Za-z]{1,5}[-_]?\d{2,6}[A-Za-z]{0,2}(?:-[A-Za-z0-9]{1,4})*(?![\w])/;
const DIM_RE = /(\d+(?:\.\d+)?)\s*(?:mm|cm|ml|ltrs?|litres?|inch(?:es)?|ft|kg|gm|watts?|%)(?![A-Za-z])/gi;

interface FinishDef {
  re: RegExp;
  name: string;
  low?: boolean;
}
const FINISHES: FinishDef[] = [
  { re: /(?<![A-Za-z])(?:hi|high|super)[-\s]?gloss(?:y)?(?![A-Za-z])/i, name: 'High Gloss' },
  { re: /(?<![A-Za-z])semi[-\s]?polish(?:ed)?(?![A-Za-z])/i, name: 'Semi Polished' },
  { re: /(?<![A-Za-z])anti[-\s]?skid(?![A-Za-z])/i, name: 'Anti-Skid' },
  { re: /(?<![A-Za-z])gloss(?:y)?(?![A-Za-z])/i, name: 'Glossy' },
  { re: /(?<![A-Za-z])matte?(?![A-Za-z])/i, name: 'Matt' },
  { re: /(?<![A-Za-z])mat(?=\s+finish)/i, name: 'Matt' },
  { re: /(?<![A-Za-z])rustic(?![A-Za-z])/i, name: 'Rustic' },
  { re: /(?<![A-Za-z])satin(?![A-Za-z])/i, name: 'Satin' },
  { re: /(?<![A-Za-z])polish(?:ed)?(?![A-Za-z])/i, name: 'Polished' },
  { re: /(?<![A-Za-z])carving(?![A-Za-z])/i, name: 'Carving' },
  { re: /(?<![A-Za-z])sugar(?![A-Za-z])/i, name: 'Sugar' },
  { re: /(?<![A-Za-z])honed?(?![A-Za-z])/i, name: 'Honed' },
  { re: /(?<![A-Za-z])lappato(?![A-Za-z])/i, name: 'Lappato' },
  { re: /(?<![A-Za-z])leather(?![A-Za-z])/i, name: 'Leather' },
  { re: /(?<![A-Za-z])textur(?:e|ed)(?![A-Za-z])/i, name: 'Textured' },
  { re: /(?<![A-Za-z])metallic(?![A-Za-z])/i, name: 'Metallic' },
  { re: /(?<![A-Za-z])glazed(?![A-Za-z])/i, name: 'Glazed' },
  { re: /(?<![A-Za-z])wooden(?![A-Za-z])/i, name: 'Wooden', low: true }
];

const NOISE_WORDS = new Set([
  'rate', 'rates', 'price', 'mrp', 'bhav', 'bhaav', 'bhaw', 'kimat', 'per', 'at', 'only', 'approx',
  'approximately', 'finish', 'finishes', 'surface', 'thk', 'thickness', 'size', 'rs', 'inr', 'rupees',
  'rupee', 'rupaye', 'rupay', 'ka', 'ki', 'ke', 'ko', 'hai', 'is', 'x', 'mm', 'cm', 'sq', 'ft', 'sqft',
  'dp', 'net', 'nett'
]);
const SMALL_WORDS = new Set(['and', 'of', 'with', 'for', 'in', 'the', 'to', 'a', 'on']);
const ACRONYMS = new Set([
  'GVT', 'PGVT', 'DGVT', 'WC', 'EWC', 'HD', 'PVC', 'UPVC', 'CPVC', 'CP', 'SS', 'LED', 'ABS', 'FP', 'HR',
  'SWR', 'ISI', 'HDF', 'MDF', 'XL', 'XXL', 'PP', 'PU', 'RAK', 'UV'
]);

const TILE_KW = /(?<![A-Za-z])(?:tiles?|gvt|pgvt|dgvt|vitrified|ceramic|porcelain|slabs?)(?![A-Za-z])/i;
const SANITARY_KW =
  /(?<![A-Za-z])(?:sanitary\s*ware|sanitaryware|sanitary|wc|ewc|toilets?|basins?|bath(?:room|ware)?|faucets?|cp\s+fittings?|taps?|urinals?|cisterns?|showers?|closets?|commodes?|accessories|fittings)(?![A-Za-z])/i;
const SANITARY_ROW =
  /(?<![A-Za-z])(?:wc|ewc|commodes?|toilets?|basins?|urinals?|cisterns?|flush(?:ing)?|faucets?|taps?|showers?|bib\s*cock|pedestal|sinks?|bidet|angle\s*cock|stop\s*cock|mixers?|geyser|jet\s*spray|soap\s*dish|towel\s*rail|closets?|seat\s*cover)(?![A-Za-z])/i;
const HEADING_KW =
  /(?<![A-Za-z])(?:collections?|series|range|tiles?|sanitary\s*ware|sanitaryware|sanitary|catalog(?:ue)?|section|category|gvt|pgvt|dgvt|vitrified|ceramic|porcelain|fittings|bath\s*ware|bathware|faucets|products?|slabs?)(?![A-Za-z])/i;

/* noise */
const NOISE_TERMS =
  /^(?:terms?|t\s*&\s*c|conditions?|note|notes|nb|n\.b\.?|gst|payment|advance|freight|transport(?:ation)?|delivery|dispatch|disclaimer|subject\s+to|e\.?\s*&\s*o\.?\s*e|errors?)(?![\w-])/i;
const NOISE_CONTACT =
  /^(?:contact|call|mob(?:ile)?|ph(?:one)?|tel|whats\s?app|wa|e-?mail|mail|address|add|office|visit|website|web|www|https?:|fax)(?![\w-])/i;
const NOISE_GREET =
  /^(?:dear|hi|hello|hey|namaste|namaskar|good\s+(?:morning|evening|afternoon|night)|gm|regards|thanks?|thank\s+you|best\s+regards|warm\s+regards|team|sir|madam|please|kindly|pls|ok|okay|noted)(?![\w-])/i;
const NOISE_PRICELIST =
  /(?:(?:price|rate)\s*list|pricelist|w\.?e\.?f\b|effective|valid(?:ity)?|updated\s+(?:on|rates?|price)|new\s+(?:rates?|prices?)|revised|rates?\s+(?:below|attached))/i;
const NOISE_MID = /(?<![A-Za-z])(?:gst|igst|cgst|sgst|taxes?|freight|transport|advance|payment|loading|unloading|packing)(?![A-Za-z])/i;
const MONTHS = String.raw`(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*`;
const DATE_RE = new RegExp(
  String.raw`^(?:(?:date|dt|dated|as\s+on|on)\s*[:\-]?\s*)?(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?[\s\-]+${MONTHS}[\s\-,]*\d{2,4}|${MONTHS}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|${MONTHS}[\s\-]+\d{4})\s*$`,
  'i'
);

/* header detection */
function headerKey(cell: string): { key: ColKey; unit?: Unit } | null {
  const c = cell.toLowerCase().trim();
  if (!c || /\d/.test(c.replace(/\(.*?\)/g, ''))) return null;
  const inner = /\(([^)]*)\)/.exec(c)?.[1] ?? '';
  const slash = /\/\s*([a-z. ]+)$/.exec(c.replace(/\(.*?\)/g, ''))?.[1] ?? '';
  const base = c.replace(/\(.*?\)/g, ' ').replace(/[^a-z/. ]/g, ' ').replace(/\s+/g, ' ').trim();
  const hint = unitFromWord(slash.trim()) ?? unitFromWord(inner.replace(/^rs\.?\s*\/\s*/, '').trim());
  const r = (key: ColKey): { key: ColKey; unit?: Unit } => (hint && key === 'rate' ? { key, unit: hint } : { key });
  if (/^(sr|s\.? ?no|sl|sno|srno|serial|no|#|sr no|sl no)\.?$/.test(base)) return { key: 'skip' };
  if (/(pcs|pieces|nos|pc)\s*(\/|per|in)?\s*(box|ctn|carton)|^box( pcs| qty| size)?$|packing|^pcs$/.test(base)) return r('boxPcs');
  if (/\b(thk|thickness)\b/.test(base)) return r('thickness');
  if (/\b(size|sizes|dimension|dimensions)\b/.test(base)) return r('size');
  if (/\b(finish|finishes|surface)\b/.test(base)) return r('finish');
  if (/\b(code|sku|article|art|model|design (no|number|code)|item (no|code))\b/.test(base)) return r('code');
  if (/\b(rate|rates|price|mrp|amount|dp|net|nett|basic)\b/.test(base)) return r('rate');
  if (/\b(unit|uom|per)\b/.test(base)) return r('unit');
  if (/\b(item|items|name|design|product|description|desc|particulars|collection|series)\b/.test(base)) return r('name');
  if (/\b(note|notes|remark|remarks|comment|comments)\b/.test(base)) return r('note');
  return null;
}

type ColKey = 'name' | 'code' | 'size' | 'finish' | 'thickness' | 'boxPcs' | 'unit' | 'rate' | 'note' | 'skip';
interface Col {
  key: ColKey | null;
  unit?: Unit;
}
interface HeaderMode {
  delim: string;
  cols: Col[];
}

function splitCells(s: string, delim: string): string[] {
  if (delim === ',' || delim === ';') {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') {
        if (q && s[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (ch === delim && !q) {
        out.push(cur);
        cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  }
  if (delim === '  ') return s.split(/\s{2,}/).map((c) => c.trim());
  return s.split(delim).map((c) => c.trim());
}

/** Returns a header description if the line is a header row, else null. */
function detectHeader(s: string): { mode: HeaderMode | null } | null {
  if (/\d/.test(s.replace(/\(.*?\)/g, ''))) return null;
  for (const delim of ['\t', '|', ',', ';', '  ']) {
    if (!s.includes(delim)) continue;
    const cells = splitCells(s, delim);
    if (cells.length < 2) continue;
    const cols: Col[] = cells.map((c) => {
      const k = headerKey(c);
      return { key: k ? k.key : null, unit: k?.unit };
    });
    const mapped = cols.filter((c) => c.key && c.key !== 'skip').length;
    const unmapped = cols.filter((c, i) => !c.key && cells[i]).length;
    if (mapped >= 2 && unmapped <= 1) return { mode: { delim, cols } };
  }
  const toks = s.split(/\s+/).filter(Boolean);
  if (toks.length >= 3 && toks.every((t) => headerKey(t))) return { mode: null };
  return null;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function unitFromWord(w: string): Unit | null {
  const t = w.toLowerCase().trim().replace(/^(?:per|\/)\s*/, '');
  if (!t) return null;
  if (new RegExp(`^(?:${SQFT})$`, 'i').test(t)) return 'sqft';
  if (new RegExp(`^(?:${SQM})$`, 'i').test(t)) return 'sqm';
  if (new RegExp(`^(?:${BOX})$`, 'i').test(t)) return 'box';
  if (new RegExp(`^(?:${SET})$`, 'i').test(t)) return 'set';
  if (new RegExp(`^(?:${PC})$`, 'i').test(t)) return 'pc';
  return null;
}

function toNumber(s: string): number | null {
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function isUpperLine(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, '');
  return letters.length > 1 && letters === letters.toUpperCase();
}

function cut(s: string, m: RegExpExecArray, mark = ' '): string {
  return s.slice(0, m.index) + mark + s.slice(m.index + m[0].length);
}

/** Keeps thousands commas inside numbers, turns every other comma/pipe/tab/semicolon into a space. */
function normalizeSeparators(s: string): string {
  return s
    .replace(/(?<=\d),(?=\d{3}(?!\d)|\d{2},\d{3})/g, '')
    .replace(/[,|;\t]+/g, ' ')
    .replace(//g, ',');
}

function titleCase(name: string, allCaps: boolean): string {
  const out: string[] = [];
  name.split(/\s+/).forEach((tok, idx) => {
    if (!tok) return;
    if (/qqdim\d+qq/.test(tok)) {
      out.push(tok);
      return;
    }
    const up = tok.toUpperCase();
    if (/\d/.test(tok)) {
      out.push(up);
      return;
    }
    if (ACRONYMS.has(up)) {
      out.push(up);
      return;
    }
    if (!allCaps && tok === up && tok.length >= 2 && tok.length <= 4 && /^[A-Z]+$/.test(tok)) {
      out.push(tok);
      return;
    }
    const lower = tok.toLowerCase();
    if (idx > 0 && SMALL_WORDS.has(lower)) {
      out.push(lower);
      return;
    }
    out.push(lower.replace(/(^|[-/])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()));
  });
  return out.join(' ');
}

/* ------------------------------------------------------------------ */
/* Core: analyse one line (or one cell) of free text                    */
/* ------------------------------------------------------------------ */

interface Analysis {
  name: string;
  code: string;
  size: string;
  sizeAssumed: string; // '' or the unit that was guessed
  finish: string;
  thickness: string;
  boxPcs: string;
  unit: Unit | null;
  rate: number | null;
  marker: boolean;
  allCaps: boolean;
}

function parseSizeMatch(m: RegExpExecArray): { size: string; assumed: string; thk: string } {
  const [, a, u1, b, u2, c, u3] = m;
  let unit = (u2 || u1 || '').toLowerCase();
  let assumed = '';
  const n1 = Number(a);
  const n2 = Number(b);
  if (!unit) {
    const mx = Math.max(n1, n2);
    const mn = Math.min(n1, n2);
    if (mn >= 150) unit = 'mm';
    else if (mx < 10) {
      unit = 'ft';
      assumed = 'ft';
    } else if (mx <= 24) {
      unit = 'inch';
      assumed = 'inch';
    } else {
      unit = 'cm';
      assumed = 'cm';
    }
  }
  let size: string;
  if (unit === 'mm') size = `${fmtNum(n1)}x${fmtNum(n2)}`;
  else if (unit === 'cm') size = `${fmtNum(n1 * 10)}x${fmtNum(n2 * 10)}`;
  else if (unit === 'feet' || unit === 'foot' || unit === 'ft') size = `${a}x${b} ft`;
  else size = `${a}x${b} inch`;
  let thk = '';
  if (c) {
    const t = Number(c);
    if ((u3 || '').toLowerCase() === 'mm' || (!u3 && t <= 30)) thk = `${fmtNum(t)} mm`;
  }
  return { size, assumed, thk };
}

function analyze(input: string, allowRate: boolean): Analysis {
  const a: Analysis = {
    name: '', code: '', size: '', sizeAssumed: '', finish: '', thickness: '', boxPcs: '',
    unit: null, rate: null, marker: false, allCaps: isUpperLine(input)
  };
  let s = normalizeSeparators(input.replace(GST_RE, ' '));

  // size
  const sm = SIZE_RE.exec(s);
  if (sm) {
    const r = parseSizeMatch(sm);
    a.size = r.size;
    a.sizeAssumed = r.assumed;
    if (r.thk) a.thickness = r.thk;
    s = cut(s, sm);
  }

  // markup
  s = s
    .replace(/[*~`]+/g, ' ')
    .replace(/(?<![A-Za-z0-9])_+|_+(?![A-Za-z0-9])/g, ' ');

  // box pcs
  for (const re of [BOXPCS_1, BOXPCS_2, BOXPCS_3]) {
    const m = re.exec(s);
    if (m) {
      a.boxPcs = `${Number(m[1])} pcs`;
      s = cut(s, m);
      break;
    }
  }

  // thickness (only plausible tile thickness, 40 mm or less)
  if (!a.thickness) {
    s = s.replace(THK_RE, (full, n: string) => {
      if (a.thickness) return full;
      const v = Number(n);
      if (v > 40) return full;
      a.thickness = `${fmtNum(v)} mm`;
      return ' ';
    });
  }

  // rate by explicit pattern
  if (allowRate) {
    const pats: RegExp[] = [RATE_LABEL, RATE_AT, RATE_PREFIX, RATE_UNITPER, RATE_SUFFIX];
    for (const re of pats) {
      const m = re.exec(s);
      if (!m || m[1] === undefined) continue;
      const v = toNumber(m[1]);
      if (v === null) continue;
      a.rate = v;
      if (re === RATE_UNITPER && m[2]) a.unit = unitFromWord(m[2]);
      s = cut(s, m, ` ${RATE_MARK} `);
      break;
    }
  }

  // unit
  if (!a.unit) {
    const m = UNIT_PREFIXED.exec(s);
    if (m) {
      a.unit = unitFromWord(m[1] ?? '');
      s = cut(s, m);
    }
  }
  if (!a.unit) {
    const m = UNIT_AFTER_RATE.exec(s);
    if (m) {
      a.unit = unitFromWord(m[1] ?? '');
      s = s.slice(0, m.index) + ` ${RATE_MARK} ` + s.slice(m.index + m[0].length);
    }
  }
  if (!a.unit) {
    const m = UNIT_BARE.exec(s);
    if (m) {
      a.unit = unitFromWord(m[1] ?? '');
      s = cut(s, m);
    }
  }

  // missing-rate marker
  s = s.replace(MARKER_RE, () => {
    a.marker = true;
    return ' ';
  });

  // finish
  let best: { idx: number; def: FinishDef } | null = null;
  let low: FinishDef | null = null;
  for (const def of FINISHES) {
    const m = def.re.exec(s);
    if (!m) continue;
    if (def.low) {
      low = def;
      continue;
    }
    if (!best || m.index < best.idx) best = { idx: m.index, def };
  }
  if (best) {
    a.finish = best.def.name;
    for (const def of FINISHES) {
      if (!def.low) s = s.replace(new RegExp(def.re.source, 'gi'), ' ');
    }
  } else if (low) {
    a.finish = (low as FinishDef).name;
  }

  // item code
  const cm = CODE_RE.exec(s);
  if (cm) {
    a.code = cm[0].toUpperCase();
    s = cut(s, cm);
  }

  // protect other measurements (450 mm, 6 ltr, 5 ft) so they are not read as a rate
  const dims: string[] = [];
  s = s.replace(DIM_RE, (full) => {
    dims.push(full.replace(/\s+/g, ' ').trim().replace(/\s*%/, '%'));
    return ` qqdim${dims.length - 1}qq `;
  });

  // fallback rate: last loose number
  if (allowRate && a.rate === null) {
    let last: RegExpExecArray | null = null;
    const re = new RegExp(RATE_FALLBACK.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) last = m;
    if (last) {
      const v = toNumber(last[1] ?? '');
      if (v !== null) {
        a.rate = v;
        s = cut(s, last, ` ${RATE_MARK} `);
      }
    }
  }

  // name
  const words: string[] = [];
  for (const raw of s.replace(/[]/g, ' ').split(/\s+/)) {
    if (!raw) continue;
    let t = raw.replace(/^[^\p{L}\p{N}&]+|[^\p{L}\p{N}&]+$/gu, '');
    if (!t) continue;
    if (t.length > 1 && t.includes('&') && !/\p{L}&\p{L}/u.test(t)) t = t.replace(/&/g, '');
    if (!t || NOISE_WORDS.has(t.toLowerCase())) continue;
    words.push(t);
  }
  let name = titleCase(words.join(' '), a.allCaps);
  name = name.replace(/qqdim(\d+)qq/g, (_m, i: string) => dims[Number(i)] ?? '');
  a.name = name.trim();
  return a;
}

/* ------------------------------------------------------------------ */
/* Line level classification                                           */
/* ------------------------------------------------------------------ */

function stripDecor(raw: string): string {
  let s = raw.replace(EMOJI_RE, ' ').replace(/\r/g, '');
  s = s.replace(/^[\s\t]+/, (m) => (m.includes('\t') ? m : ''));
  for (let i = 0; i < 2; i++) s = s.replace(BULLET_RE, '');
  return s.trim();
}

function noiseReason(s: string): string | null {
  const flat = s.replace(/\t/g, ' ');
  const bare = flat.replace(/[\s\-\u2013\u2014_*~=.•|#]+/g, '');
  if (!bare) return 'divider';
  const hasSize = SIZE_RE.test(flat);
  if (DATE_RE.test(flat.trim())) return 'date';
  if (/^[\s+()\-.\d]+$/.test(flat)) {
    const digits = flat.replace(/\D/g, '');
    if (digits.length >= 10) return 'phone number';
    if (DATE_RE.test(flat.trim())) return 'date';
    return 'no text';
  }
  if (!/\p{L}/u.test(flat)) return 'no text';
  if (DATE_RE.test(flat.trim())) return 'date';
  if (/https?:\/\/|www\.|[\w.]+@[\w.]+\.\w+/i.test(flat)) return 'link or email';
  if (hasSize) return null;
  if (NOISE_TERMS.test(flat)) return 'terms or note';
  if (NOISE_CONTACT.test(flat)) return 'contact details';
  if (NOISE_GREET.test(flat)) return 'greeting';
  if (NOISE_PRICELIST.test(flat) && !TILE_KW.test(flat) && !SANITARY_KW.test(flat)) return 'price list note';
  if (
    NOISE_MID.test(flat) &&
    !CODE_RE.test(flat) &&
    !RATE_PREFIX.test(flat) &&
    !RATE_SUFFIX.test(flat) &&
    !RATE_UNITPER.test(flat) &&
    !RATE_LABEL.test(flat)
  )
    return 'terms or note';
  if (/(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/.test(flat) && flat.replace(/[\d\s+()-]/g, '').length < 12 && !/\d[.]\d/.test(flat))
    return 'phone number';
  return null;
}

interface Ctx {
  size: string;
  category?: Category;
  unit?: Unit;
}

function isHeading(a: Analysis, text: string): boolean {
  if (a.rate !== null || a.marker) return false;
  const kw = HEADING_KW.test(text) || /:\s*$/.test(text);
  if (kw && !a.code) return true;
  if (a.finish || a.code || a.thickness || a.boxPcs) return false;
  const nameWords = a.name ? a.name.split(/\s+/).length : 0;
  if (a.size) return nameWords === 0 || (a.allCaps && nameWords <= 2);
  return nameWords <= 6;
}

function headingCategory(text: string): Category | undefined {
  if (SANITARY_KW.test(text)) return 'Sanitaryware';
  if (TILE_KW.test(text)) return 'Tiles';
  return undefined;
}

function buildRow(
  a: Analysis,
  ctx: Ctx,
  opts: { category?: Category; defaultUnit?: Unit },
  raw: string,
  line: number,
  extra: { note?: string; unitHint?: Unit | null } = {}
): ParsedRow {
  const issues: string[] = [];
  let check = false;

  let size = a.size;
  if (!size && ctx.size) {
    size = ctx.size;
    issues.push('Size taken from heading');
  }
  if (a.sizeAssumed) {
    issues.push(`Size unit assumed ${a.sizeAssumed}`);
    check = true;
  }

  const name = a.name || a.code;
  if (!name) {
    issues.push('Name missing');
    check = true;
  }

  const optCat = opts.category && opts.category !== 'Other' ? opts.category : undefined;
  const rowCat: Category | undefined = SANITARY_ROW.test(a.name) ? 'Sanitaryware' : optCat ?? ctx.category;

  let unit: Unit;
  if (a.unit) unit = a.unit;
  else if (extra.unitHint) unit = extra.unitHint;
  else if (ctx.unit) unit = ctx.unit;
  else {
    unit = opts.defaultUnit ?? (rowCat === 'Sanitaryware' ? 'pc' : rowCat === 'Tiles' || size ? 'sqft' : 'pc');
    issues.push(`Unit assumed ${unit}`);
  }

  let rate = a.rate;
  if (rate === null) {
    issues.unshift('Rate missing');
    check = true;
  } else if (rate < 1) {
    issues.unshift('Rate looks too low');
    check = true;
  } else if (rate > 100000) {
    issues.unshift('Rate looks too high');
    check = true;
  } else if (unit === 'sqft' && rate > 5000) {
    issues.unshift('Rate looks too high for sqft');
    check = true;
  }
  if (rate !== null) rate = Math.round(rate * 100) / 100;

  const tileLike = rowCat === 'Tiles' || (rowCat !== 'Sanitaryware' && (unit === 'sqft' || unit === 'sqm' || unit === 'box' || !!size));
  if (tileLike && !size) {
    issues.push('Size not found');
    check = true;
  }

  return {
    raw,
    line,
    item: {
      name,
      code: a.code,
      size,
      finish: a.finish,
      thickness: a.thickness,
      boxPcs: a.boxPcs,
      unit,
      rate,
      note: extra.note ?? ''
    },
    confidence: check ? 'check' : 'ok',
    issues
  };
}

function analyzeMapped(cells: string[], mode: HeaderMode): { a: Analysis; note: string; unitHint: Unit | null } {
  const hasRateCol = mode.cols.some((c) => c.key === 'rate');
  const nameParts: string[] = [];
  const get: Partial<Record<ColKey, string>> = {};
  let unitHint: Unit | null = null;
  cells.forEach((cell, i) => {
    const col = mode.cols[i];
    const text = stripDecor(cell);
    if (!col || !col.key || col.key === 'skip' || !text) return;
    if (col.key === 'name') nameParts.push(text);
    else get[col.key] = get[col.key] ? `${get[col.key]} ${text}` : text;
    if (col.key === 'rate' && col.unit) unitHint = col.unit;
  });
  if (!hasRateCol) {
    // no rate column: leave rate detection to the free text reader below
  }
  const a = analyze(nameParts.join(' '), !hasRateCol);
  if (get.code) a.code = get.code.toUpperCase();
  if (get.size) {
    const s = analyze(get.size, false);
    if (s.size) {
      a.size = s.size;
      a.sizeAssumed = s.sizeAssumed;
      if (s.thickness && !a.thickness) a.thickness = s.thickness;
    } else a.size = get.size.replace(/\s*[x×*]\s*/gi, 'x');
  }
  if (get.finish) {
    const f = analyze(get.finish, false);
    a.finish = f.finish || titleCase(get.finish, isUpperLine(get.finish));
  }
  if (get.thickness) {
    const t = analyze(get.thickness, false);
    a.thickness = t.thickness || (/^\d+(\.\d+)?$/.test(get.thickness) ? `${fmtNum(Number(get.thickness))} mm` : get.thickness);
  }
  if (get.boxPcs) {
    const b = /\d+/.exec(get.boxPcs);
    a.boxPcs = b ? `${Number(b[0])} pcs` : get.boxPcs;
  }
  if (get.unit) {
    const u = unitFromWord(get.unit.replace(/\./g, '. ').trim()) ?? unitFromWord(get.unit) ?? analyze(get.unit, false).unit;
    if (u) a.unit = u;
  }
  if (get.rate) {
    const r = analyze(get.rate, true);
    a.rate = r.rate;
    if (r.marker || /^[\s\-?]*$/.test(get.rate)) a.marker = true;
    if (r.unit && !a.unit) a.unit = r.unit;
  } else if (hasRateCol) {
    a.rate = null;
    a.marker = true;
  }
  if (!a.name && !a.code && get.code) a.name = get.code;
  return { a, note: get.note ?? '', unitHint };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function parseList(text: string, opts: { category?: Category; defaultUnit?: Unit } = {}): ParseResult {
  const rows: ParsedRow[] = [];
  const skipped: ParseResult['skipped'] = [];
  const lines = String(text ?? '').split(/\r\n|\r|\n/);
  let mode: HeaderMode | null = null;
  const ctx: Ctx = { size: '' };

  for (let i = 0; i < lines.length; i++) {
    const rawFull = lines[i] ?? '';
    const raw = rawFull.trim();
    if (!raw) continue;
    const line = i + 1;
    const s = stripDecor(rawFull);

    const hdr = detectHeader(s);
    if (hdr) {
      if (hdr.mode) mode = hdr.mode;
      skipped.push({ line, raw, reason: 'header row' });
      continue;
    }

    const noise = noiseReason(s);
    if (noise) {
      skipped.push({ line, raw, reason: noise });
      continue;
    }

    // header-mapped row
    if (mode) {
      const cells = splitCells(s, mode.delim);
      const nonEmpty = cells.filter(Boolean).length;
      if (cells.length >= 2 && nonEmpty >= 2 && cells.length <= mode.cols.length) {
        const { a, note, unitHint } = analyzeMapped(cells, mode);
        rows.push(buildRow(a, ctx, opts, raw, line, { note, unitHint }));
        continue;
      }
    }

    // free text row (tab or pipe pastes without header: drop a leading serial number cell)
    let body = s;
    if (/^\d{1,3}\t/.test(body) && (body.match(/\t/g)?.length ?? 0) >= 2) body = body.replace(/^\d{1,3}\t+/, '');
    const a = analyze(body, true);

    if (isHeading(a, body)) {
      if (!a.name && !a.size) {
        if (a.unit) ctx.unit = a.unit;
        skipped.push({ line, raw, reason: a.unit ? 'heading' : 'no text' });
        continue;
      }
      if (a.name && a.name.split(/\s+/).length > 6 && !HEADING_KW.test(body)) {
        skipped.push({ line, raw, reason: 'text' });
        continue;
      }
      ctx.size = a.size;
      ctx.category = headingCategory(body) ?? ctx.category;
      if (a.unit) ctx.unit = a.unit;
      skipped.push({ line, raw, reason: 'heading' });
      continue;
    }

    rows.push(buildRow(a, ctx, opts, raw, line));
  }

  const check = rows.filter((r) => r.confidence === 'check').length;
  return { rows, skipped, summary: { total: rows.length, ok: rows.length - check, check } };
}
