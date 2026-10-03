// Shared types. THE contract between UI, store, API client and Apps Script.
// Do not change a field without updating docs/api-contract.md and apps-script/.

export type Category = 'Tiles' | 'Sanitaryware' | 'Other';
export type SourceType = 'items' | 'pdf' | 'image';
export type Unit = 'sqft' | 'sqm' | 'box' | 'pc' | 'set';
export type Role = 'owner' | 'staff';
export type PricelistStatus = 'current' | 'archived';

export interface Factory {
  id: string;
  name: string;
  city: string;
  category: Category;
  contactName: string;
  phone: string; // digits and spaces, e.g. "98250 11234"
  notes: string;
  createdAt: string; // ISO
}

export interface FileRef {
  fileId: string; // Google Drive file id
  name: string;
  mime: string; // application/pdf | image/jpeg | image/png
  pages?: number;
}

export interface Pricelist {
  id: string;
  factoryId: string;
  title: string;
  category: Category;
  effectiveDate: string; // YYYY-MM-DD
  source: SourceType;
  files: FileRef[]; // empty when source === 'items'
  itemCount: number; // 0 when source !== 'items'
  note: string;
  status: PricelistStatus;
  createdAt: string; // ISO
  createdBy: string; // user name
}

export interface Item {
  id: string;
  pricelistId: string;
  name: string;
  code: string;
  size: string; // "600x1200" (mm), may be empty for sanitaryware
  finish: string;
  thickness: string; // "9 mm" or ""
  boxPcs: string; // "2 pcs" or ""
  unit: Unit;
  rate: number | null; // INR. null = hidden for this user OR missing in source
  note: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Settings {
  hideRatesFromStaff: boolean;
  staleWeeks: number; // default 3
}

export interface Session {
  token: string;
  user: User;
}

/** Everything the app needs to render lists without fetching items. */
export interface Bootstrap {
  factories: Factory[];
  pricelists: Pricelist[];
  settings: Settings;
  serverTime: string;
}

/** Draft sent when saving a new pricelist. */
export interface PricelistDraft {
  factoryId: string;
  title: string;
  category: Category;
  effectiveDate: string;
  source: SourceType;
  files: FileRef[];
  note: string;
  items: Omit<Item, 'id' | 'pricelistId'>[]; // empty unless source === 'items'
}

export type FactoryDraft = Omit<Factory, 'id' | 'createdAt'>;

/** Result row for global search / compare. */
export interface SearchHit {
  item: Item;
  pricelist: Pricelist;
  factory: Factory;
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

/** What every screen gets from useData(). Implemented in src/store/DataContext.tsx. */
export interface DataApi {
  // session
  session: Session | null;
  login(name: string, pin: string): Promise<void>; // throws Error(message) on failure
  logout(): void;
  // data (null until first load; stays available offline from cache)
  ready: boolean; // false until cache or network gave the first Bootstrap
  factories: Factory[];
  pricelists: Pricelist[];
  settings: Settings;
  syncStatus: SyncStatus;
  lastSync: string | null; // ISO
  pendingWrites: number; // queued offline writes
  refresh(): Promise<void>;
  // reads
  getItems(pricelistId: string): Promise<Item[]>; // cached per pricelist
  getAllCurrentItems(): Promise<SearchHit[]>; // items of all status==='current' pricelists
  getFileUrl(file: FileRef): Promise<string>; // blob: URL, cached for offline
  // writes
  saveFactory(draft: FactoryDraft, id?: string): Promise<Factory>;
  savePricelist(draft: PricelistDraft): Promise<Pricelist>; // archives previous current of same factory + category
  uploadFile(file: File, onProgress?: (pct: number) => void): Promise<FileRef>; // compresses images first
  saveSettings(s: Settings): Promise<void>; // owner only
  listUsers(): Promise<User[]>; // owner only
  saveUser(u: { id?: string; name: string; role: Role; pin?: string }): Promise<void>; // owner only
  deleteUser(id: string): Promise<void>; // owner only
}
