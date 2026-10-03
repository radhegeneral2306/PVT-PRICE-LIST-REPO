import type { Category, FileRef, Item, Unit } from '../../types';

export type Method = 'paste' | 'pdf' | 'photo';
export type DraftItem = Omit<Item, 'id' | 'pricelistId'>;

export interface DraftRow {
  key: string;
  raw: string;
  manual: boolean;
  edited: boolean;
  item: DraftItem;
  confidence: 'ok' | 'check';
  issues: string[];
}

export interface DraftFile {
  key: string;
  name: string;
  mime: string;
  size: number;
  status: 'uploading' | 'done' | 'error';
  pct: number;
  error?: string;
  ref?: FileRef;
}

export interface SkippedLine { line: number; raw: string; reason: string }

export interface AddState {
  factoryId: string | null;
  /** True when the factory came from ?factory= (step 1 is skipped). */
  factoryLocked: boolean;
  method: Method | null;
  text: string;
  rows: DraftRow[];
  skipped: SkippedLine[];
  files: DraftFile[];
  title: string;
  titleTouched: boolean;
  date: string;
  category: Category;
  categoryTouched: boolean;
  note: string;
}

export const UNITS: Unit[] = ['sqft', 'sqm', 'box', 'pc', 'set'];
export const CATEGORIES: Category[] = ['Tiles', 'Sanitaryware', 'Other'];

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function initialState(): AddState {
  return {
    factoryId: null, factoryLocked: false, method: null, text: '', rows: [], skipped: [], files: [],
    title: '', titleTouched: false, date: todayISO(), category: 'Tiles', categoryTouched: false, note: '',
  };
}

let counter = 0;
export function newKey(prefix = 'k'): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

export function emptyItem(): DraftItem {
  return { name: '', code: '', size: '', finish: '', thickness: '', boxPcs: '', unit: 'sqft', rate: null, note: '' };
}

/** What is still wrong with a row, in plain words. */
export function rowIssues(item: DraftItem): string[] {
  const out: string[] = [];
  if (!item.name.trim()) out.push('Name is missing');
  if (item.rate == null) out.push('Rate is missing');
  return out;
}

export type Action =
  | { type: 'reset'; state: AddState }
  | { type: 'patch'; patch: Partial<AddState> }
  | { type: 'setText'; text: string; rows: DraftRow[]; skipped: SkippedLine[] }
  | { type: 'upsertRow'; row: DraftRow }
  | { type: 'deleteRow'; key: string }
  | { type: 'addFile'; file: DraftFile }
  | { type: 'updateFile'; key: string; patch: Partial<DraftFile> }
  | { type: 'removeFile'; key: string }
  | { type: 'moveFile'; key: string; dir: -1 | 1 };

export function reducer(s: AddState, a: Action): AddState {
  switch (a.type) {
    case 'reset': return a.state;
    case 'patch': return { ...s, ...a.patch };
    case 'setText': return { ...s, text: a.text, rows: a.rows, skipped: a.skipped };
    case 'upsertRow': {
      const i = s.rows.findIndex((r) => r.key === a.row.key);
      return { ...s, rows: i < 0 ? [...s.rows, a.row] : s.rows.map((r, j) => (j === i ? a.row : r)) };
    }
    case 'deleteRow': return { ...s, rows: s.rows.filter((r) => r.key !== a.key) };
    case 'addFile': return { ...s, files: [...s.files, a.file] };
    case 'updateFile': return { ...s, files: s.files.map((f) => (f.key === a.key ? { ...f, ...a.patch } : f)) };
    case 'removeFile': return { ...s, files: s.files.filter((f) => f.key !== a.key) };
    case 'moveFile': {
      const i = s.files.findIndex((f) => f.key === a.key);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= s.files.length) return s;
      const files = s.files.slice();
      [files[i], files[j]] = [files[j], files[i]];
      return { ...s, files };
    }
  }
}

export function isDirty(s: AddState): boolean {
  return !!(s.text.trim() || s.rows.length || s.files.length || s.note.trim() || s.titleTouched);
}

export function checkCount(rows: DraftRow[]): number {
  return rows.filter((r) => r.confidence === 'check' || r.item.rate == null).length;
}

// ---- draft persistence (sessionStorage, always guarded) ------------------------------
const KEY = 'pv-add-draft-v1';

export function loadDraft(): AddState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AddState>;
    const base = initialState();
    const s: AddState = { ...base, ...p };
    // Uploads that were in flight at refresh are gone; keep only finished ones.
    s.files = (s.files ?? []).filter((f) => f.status === 'done' && f.ref);
    s.rows = Array.isArray(s.rows) ? s.rows : [];
    s.skipped = Array.isArray(s.skipped) ? s.skipped : [];
    return s;
  } catch {
    return null;
  }
}

export function saveDraft(s: AddState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* storage unavailable: the flow still works, it just will not survive a refresh */ }
}

export function clearDraft(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
