// Framework-free data engine: offline-first cache, write queue, session. DataContext wraps it for React.
import { ApiError, type Api } from '../api/types';
import type {
  Bootstrap,
  Factory,
  FactoryDraft,
  FileRef,
  Item,
  Pricelist,
  PricelistDraft,
  Role,
  SearchHit,
  Session,
  Settings,
  SyncStatus,
  User,
} from '../types';
import type { KV, SyncStore } from './storage';

export const SESSION_KEY = 'pv_session_v1';
export const FILE_CACHE_CAP = 100 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const OFFLINE_UPLOAD = 'You are offline. Connect to upload files.';
export const OFFLINE_GENERIC = 'You are offline. Connect to the internet to do this.';
export const OFFLINE_FILE_LIST = 'You are offline. Connect to save a pricelist that has files.';
export const NOT_CACHED_ITEMS = 'These prices are not saved on this phone yet. Connect to the internet to open them.';
export const NOT_CACHED_FILE = 'This file is not saved on this phone yet. Connect to the internet to open it.';

export type PendingWrite =
  | { qid: string; kind: 'factory'; tmpId?: string; id?: string; draft: FactoryDraft; createdAt: string }
  | { qid: string; kind: 'pricelist'; tmpId: string; draft: PricelistDraft; createdAt: string };

export interface EngineState {
  session: Session | null;
  ready: boolean;
  factories: Factory[];
  pricelists: Pricelist[];
  settings: Settings;
  syncStatus: SyncStatus;
  lastSync: string | null;
  pendingWrites: number;
}

export interface EngineDeps {
  api: Api;
  kv: KV;
  sync: SyncStore;
  now?: () => Date;
  isOnline?: () => boolean;
  compress?: (f: File) => Promise<File>;
  makeUrl?: (b: Blob) => string;
  revokeUrl?: (u: string) => void;
  fileCap?: number;
}

export const isTmp = (id: string) => id.startsWith('tmp_');
const rid = () => Math.random().toString(36).slice(2, 10);

/** Pure: which cached files to drop (oldest first) so the total stays within cap. Never drops keepId. */
export function planEviction(index: Record<string, { size: number; at: number }>, keepId: string, cap: number): string[] {
  let total = Object.values(index).reduce((s, e) => s + e.size, 0);
  const out: string[] = [];
  const order = Object.entries(index)
    .filter(([id]) => id !== keepId)
    .sort((a, b) => a[1].at - b[1].at);
  for (const [id, e] of order) {
    if (total <= cap) break;
    out.push(id);
    total -= e.size;
  }
  return out;
}

const isApiErr = (e: unknown, code?: string): e is ApiError => e instanceof ApiError && (!code || e.code === code);

function fileToBase64(f: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.readAsDataURL(f);
  });
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function guessMime(f: File): string {
  if (f.type) return f.type;
  const n = f.name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png')) return 'image/png';
  return '';
}

export class DataEngine {
  private deps: Required<Pick<EngineDeps, 'api' | 'kv' | 'sync'>> & EngineDeps;
  private state: EngineState;
  private listeners = new Set<() => void>();
  private queue: PendingWrite[] = [];
  private navOnline: boolean;
  private refreshing: Promise<void> | null = null;
  private flushing: Promise<void> | null = null;
  private bg = new Set<Promise<unknown>>();
  private urls = new Map<string, string>();
  private touchClock = 0;
  private idMap = new Map<string, string>(); // tmp id -> real id after a queued write synced
  private resolve = (id: string) => this.idMap.get(id) ?? id;

  constructor(deps: EngineDeps) {
    this.deps = deps;
    this.navOnline = deps.isOnline ? deps.isOnline() : typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    this.state = {
      session: this.readSession(),
      ready: false,
      factories: [],
      pricelists: [],
      settings: { hideRatesFromStaff: true, staleWeeks: 3 },
      syncStatus: this.navOnline ? 'idle' : 'offline',
      lastSync: null,
      pendingWrites: 0,
    };
  }

  // ---- plumbing -----------------------------------------------------------
  getState = (): EngineState => this.state;
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(patch: Partial<EngineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  private now = () => (this.deps.now ? this.deps.now() : new Date());
  private track<T>(p: Promise<T>): Promise<T> {
    this.bg.add(p);
    const done = () => this.bg.delete(p);
    p.then(done, done);
    return p;
  }
  /** Resolves when background work (revalidation, refresh, flush) has finished. For tests. */
  async whenIdle(): Promise<void> {
    while (this.bg.size) await Promise.allSettled([...this.bg]);
  }

  private readSession(): Session | null {
    try {
      const raw = this.deps.sync.get(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Session;
      return s && s.token && s.user ? s : null;
    } catch {
      return null;
    }
  }
  private expire() {
    this.deps.sync.remove(SESSION_KEY);
    this.set({ session: null, syncStatus: 'idle' });
  }

  private async call<T>(fn: (token: string) => Promise<T>): Promise<T> {
    const s = this.state.session;
    if (!s) throw new Error('Please sign in.');
    try {
      return await fn(s.token);
    } catch (e) {
      if (isApiErr(e, 'SESSION_EXPIRED')) this.expire();
      else if (isApiErr(e, 'NETWORK')) this.set({ syncStatus: 'offline' });
      throw e;
    }
  }

  // ---- lifecycle ------------------------------------------------------------
  async init(): Promise<void> {
    const [b, q, ls] = await Promise.all([
      this.deps.kv.get<Bootstrap>('bootstrap'),
      this.deps.kv.get<PendingWrite[]>('queue'),
      this.deps.kv.get<string>('lastSync'),
    ]);
    this.queue = q ?? [];
    this.set({
      ...(b ? { factories: b.factories, pricelists: b.pricelists, settings: b.settings, ready: true } : {}),
      lastSync: ls ?? null,
      pendingWrites: this.queue.length,
    });
    if (this.state.session) void this.track(this.runRefresh(false));
  }

  dispose() {
    
    for (const u of this.urls.values()) (this.deps.revokeUrl ?? URL.revokeObjectURL)(u);
    this.urls.clear();
    this.listeners.clear();
  }

  setOnline(on: boolean) {
    this.navOnline = on;
    if (!on) {
      this.set({ syncStatus: 'offline' });
      return;
    }
    if (this.state.session) void this.track(this.runRefresh(true));
  }

  /** Called on a timer: try again when we are offline/errored or writes are waiting. */
  retryIfNeeded(): Promise<void> {
    const s = this.state;
    if (!s.session || !this.navOnline) return Promise.resolve();
    if (s.syncStatus === 'offline' || s.syncStatus === 'error' || this.queue.length) return this.track(this.runRefresh(true));
    return Promise.resolve();
  }

  // ---- session ----------------------------------------------------------------
  login = async (name: string, pin: string): Promise<void> => {
    let s: Session;
    try {
      s = await this.deps.api.login(name, pin);
    } catch (e) {
      if (isApiErr(e, 'NETWORK')) throw new Error('Cannot reach the server. Check your internet and try again.');
      throw new Error(e instanceof Error ? e.message : 'Could not sign in.');
    }
    const last = await this.deps.kv.get<string>('cacheUser');
    if (last && last !== s.user.id) await this.purgeItems();
    await this.deps.kv.set('cacheUser', s.user.id);
    this.deps.sync.set(SESSION_KEY, JSON.stringify(s));
    this.set({ session: s });
    await this.runRefresh(true);
  };

  logout = (): void => {
    this.deps.sync.remove(SESSION_KEY);
    this.set({ session: null, syncStatus: 'idle' });
  };

  // ---- refresh / flush ------------------------------------------------------
  refresh = (): Promise<void> => this.runRefresh(true);

  private runRefresh(force: boolean): Promise<void> {
    if (this.refreshing) return this.refreshing;
    const p = this.doRefresh(force).finally(() => {
      this.refreshing = null;
    });
    this.refreshing = p;
    return p;
  }

  private async doRefresh(force: boolean): Promise<void> {
    if (!this.state.session) return;
    if (!this.navOnline) {
      this.set({ syncStatus: 'offline' });
      return;
    }
    this.set({ syncStatus: 'syncing' });
    try {
      if (this.queue.length) await this.flush();
      const b = await this.call((t) => this.deps.api.bootstrap(t));
      await this.applyBootstrap(b);
      const lastSync = this.now().toISOString();
      await this.deps.kv.set('lastSync', lastSync);
      this.set({ ready: true, syncStatus: this.queue.length ? 'offline' : 'idle', lastSync });
    } catch (e) {
      if (isApiErr(e, 'SESSION_EXPIRED')) return; // expire() already reset the status
      this.set({ syncStatus: isApiErr(e, 'NETWORK') ? 'offline' : 'error' });
    }
  }

  private async applyBootstrap(b: Bootstrap) {
    const hideChanged = this.state.ready && b.settings.hideRatesFromStaff !== this.state.settings.hideRatesFromStaff;
    const merged = this.overlay(b);
    this.set({ factories: merged.factories, pricelists: merged.pricelists, settings: merged.settings });
    await this.deps.kv.set('bootstrap', merged);
    if (hideChanged) await this.purgeItems();
  }

  /** Put still-queued optimistic changes on top of what the server just said. */
  private overlay(b: Bootstrap): Bootstrap {
    if (!this.queue.length) return b;
    let factories = [...b.factories];
    let pricelists = [...b.pricelists];
    for (const w of this.queue) {
      if (w.kind === 'factory') {
        if (w.tmpId) {
          const f = this.state.factories.find((x) => x.id === w.tmpId);
          if (f) factories.push(f);
        } else if (w.id) {
          factories = factories.map((f) => (f.id === w.id ? { ...f, ...w.draft } : f));
        }
      } else {
        const p = this.state.pricelists.find((x) => x.id === w.tmpId);
        if (p) {
          pricelists = pricelists.map((x) =>
            x.status === 'current' && x.factoryId === p.factoryId && x.category === p.category ? { ...x, status: 'archived' as const } : x,
          );
          pricelists.push(p);
        }
      }
    }
    return { ...b, factories, pricelists };
  }

  private persistQueue() {
    this.set({ pendingWrites: this.queue.length });
    return this.deps.kv.set('queue', this.queue);
  }

  /** Send queued writes in order. Throws on network/server/session trouble, leaving the rest queued. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    const p = this.doFlush().finally(() => {
      this.flushing = null;
    });
    this.flushing = p;
    return p;
  }

  private async doFlush() {
    while (this.queue.length) {
      const w = this.queue[0];
      try {
        if (w.kind === 'factory') {
          const f = await this.call((t) => this.deps.api.saveFactory(t, w.draft, w.id));
          await this.onFactorySynced(w, f);
        } else {
          const p = await this.call((t) => this.deps.api.savePricelist(t, w.draft));
          await this.onPricelistSynced(w, p);
        }
        this.queue.shift();
        await this.persistQueue();
      } catch (e) {
        if (isApiErr(e, 'BAD_REQUEST')) {
          // The server will never accept this one. Drop it so it does not block the rest.
          this.queue.shift();
          await this.persistQueue();
          continue;
        }
        throw e;
      }
    }
  }

  private async onFactorySynced(w: Extract<PendingWrite, { kind: 'factory' }>, f: Factory) {
    const tmp = w.tmpId;
    if (tmp) this.idMap.set(tmp, f.id);
    let factories = this.state.factories;
    let pricelists = this.state.pricelists;
    if (tmp) {
      factories = factories.map((x) => (x.id === tmp ? f : x));
      pricelists = pricelists.map((p) => (p.factoryId === tmp ? { ...p, factoryId: f.id } : p));
      this.queue = this.queue.map((q) => {
        if (q === w) return q;
        if (q.kind === 'pricelist' && q.draft.factoryId === tmp) return { ...q, draft: { ...q.draft, factoryId: f.id } };
        if (q.kind === 'factory' && q.id === tmp) return { ...q, id: f.id };
        return q;
      });
      // `w` was replaced in place by map identity check, keep head pointing at it
    } else {
      factories = factories.map((x) => (x.id === f.id ? f : x));
    }
    this.set({ factories, pricelists });
    await this.cacheBootstrap();
  }

  private async onPricelistSynced(w: Extract<PendingWrite, { kind: 'pricelist' }>, p: Pricelist) {
    this.idMap.set(w.tmpId, p.id);
    const pricelists = this.state.pricelists.map((x) => (x.id === w.tmpId ? p : x));
    this.set({ pricelists });
    const items = await this.deps.kv.get<Item[]>(`items:${w.tmpId}`);
    if (items) await this.deps.kv.set(`items:${p.id}`, items.map((i) => ({ ...i, pricelistId: p.id })));
    await this.deps.kv.del(`items:${w.tmpId}`);
    await this.deps.kv.del('allItems');
    await this.cacheBootstrap();
  }

  private cacheBootstrap() {
    const s = this.state;
    return this.deps.kv.set('bootstrap', { factories: s.factories, pricelists: s.pricelists, settings: s.settings, serverTime: this.now().toISOString() } satisfies Bootstrap);
  }

  private async purgeItems() {
    const keys = await this.deps.kv.keys();
    await Promise.all(keys.filter((k) => (k.startsWith('items:') && !k.startsWith('items:tmp_')) || k === 'allItems').map((k) => this.deps.kv.del(k)));
  }

  // ---- reads ------------------------------------------------------------------
  getItems = async (requestedId: string): Promise<Item[]> => {
    const pricelistId = this.resolve(requestedId);
    const cached = await this.deps.kv.get<Item[]>(`items:${pricelistId}`);
    if (isTmp(pricelistId)) return cached ?? [];
    if (cached) {
      if (this.navOnline && this.state.session) this.track(this.revalidateItems(pricelistId));
      return cached;
    }
    if (!this.navOnline) throw new Error(NOT_CACHED_ITEMS);
    try {
      const items = await this.call((t) => this.deps.api.getItems(t, pricelistId));
      await this.deps.kv.set(`items:${pricelistId}`, items);
      return items;
    } catch (e) {
      throw this.friendly(e, NOT_CACHED_ITEMS);
    }
  };

  private async revalidateItems(pricelistId: string) {
    try {
      const items = await this.call((t) => this.deps.api.getItems(t, pricelistId));
      await this.deps.kv.set(`items:${pricelistId}`, items);
    } catch {
      /* cache stays */
    }
  }

  getAllCurrentItems = async (): Promise<SearchHit[]> => {
    const current = this.state.pricelists.filter((p) => p.status === 'current');
    const cached = await this.deps.kv.get<Item[]>('allItems');
    const withItems = (cachedItems: Item[]) => {
      const have = new Set(cachedItems.map((i) => i.pricelistId));
      return current.filter((p) => p.itemCount > 0 && !isTmp(p.id) && !have.has(p.id)).length === 0;
    };
    const tmpItems = async () => {
      const out: Item[] = [];
      for (const p of current) if (isTmp(p.id)) out.push(...((await this.deps.kv.get<Item[]>(`items:${p.id}`)) ?? []));
      return out;
    };
    if (cached && withItems(cached)) {
      if (this.navOnline && this.state.session) this.track(this.revalidateAll());
      return this.join([...cached, ...(await tmpItems())]);
    }
    if (this.navOnline && this.state.session) {
      try {
        const items = await this.call((t) => this.deps.api.getAllCurrentItems(t));
        await this.deps.kv.set('allItems', items);
        return this.join([...items, ...(await tmpItems())]);
      } catch (e) {
        if (isApiErr(e, 'SESSION_EXPIRED')) throw this.friendly(e, '');
        // fall through to whatever is on the phone
      }
    }
    // Offline fallback: stale all-items cache plus per-pricelist caches
    const pieces: Item[] = [...(cached ?? [])];
    const seen = new Set(pieces.map((i) => i.pricelistId));
    for (const p of current) {
      if (seen.has(p.id)) continue;
      pieces.push(...((await this.deps.kv.get<Item[]>(`items:${p.id}`)) ?? []));
    }
    if (!pieces.length && current.some((p) => p.itemCount > 0)) throw new Error(NOT_CACHED_ITEMS);
    return this.join(pieces);
  };

  private async revalidateAll() {
    try {
      const items = await this.call((t) => this.deps.api.getAllCurrentItems(t));
      await this.deps.kv.set('allItems', items);
    } catch {
      /* ignore */
    }
  }

  private join(items: Item[]): SearchHit[] {
    const pl = new Map(this.state.pricelists.filter((p) => p.status === 'current').map((p) => [p.id, p]));
    const fa = new Map(this.state.factories.map((f) => [f.id, f]));
    const out: SearchHit[] = [];
    for (const item of items) {
      const pricelist = pl.get(item.pricelistId);
      const factory = pricelist && fa.get(pricelist.factoryId);
      if (pricelist && factory) out.push({ item, pricelist, factory });
    }
    return out;
  }

  // ---- files --------------------------------------------------------------------
  getFileUrl = async (file: FileRef): Promise<string> => {
    const existing = this.urls.get(file.fileId);
    if (existing) return existing;
    const make = this.deps.makeUrl ?? ((b: Blob) => URL.createObjectURL(b));
    const cached = await this.deps.kv.get<{ blob: Blob }>(`file:${file.fileId}`);
    let blob: Blob | undefined = cached?.blob;
    if (blob) {
      void this.touchFile(file.fileId, blob.size);
    } else {
      if (!this.navOnline) throw new Error(NOT_CACHED_FILE);
      try {
        const r = await this.call((t) => this.deps.api.getFile(t, file.fileId));
        blob = base64ToBlob(r.base64, r.mime || file.mime);
        await this.storeFile(file.fileId, blob);
      } catch (e) {
        throw this.friendly(e, NOT_CACHED_FILE);
      }
    }
    const url = make(blob);
    this.urls.set(file.fileId, url);
    return url;
  };

  private nextTouch() {
    this.touchClock = Math.max(Date.now(), this.touchClock + 1);
    return this.touchClock;
  }

  private async touchFile(id: string, size: number) {
    const index = (await this.deps.kv.get<Record<string, { size: number; at: number }>>('fileIndex')) ?? {};
    index[id] = { size, at: this.nextTouch() };
    await this.deps.kv.set('fileIndex', index);
  }

  private async storeFile(id: string, blob: Blob) {
    const index = (await this.deps.kv.get<Record<string, { size: number; at: number }>>('fileIndex')) ?? {};
    await this.deps.kv.set(`file:${id}`, { blob, mime: blob.type });
    index[id] = { size: blob.size, at: this.nextTouch() };
    for (const old of planEviction(index, id, this.deps.fileCap ?? FILE_CACHE_CAP)) {
      await this.deps.kv.del(`file:${old}`);
      delete index[old];
    }
    await this.deps.kv.set('fileIndex', index);
  }

  uploadFile = async (file: File, onProgress?: (pct: number) => void): Promise<FileRef> => {
    if (!this.navOnline) throw new Error(OFFLINE_UPLOAD);
    onProgress?.(2);
    const f = file.type.startsWith('image/') && this.deps.compress ? await this.deps.compress(file) : file;
    const mime = guessMime(f);
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(mime)) {
      throw new Error('Please choose a PDF or a photo (JPG or PNG).');
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      throw new Error(`This file is too big (${(f.size / 1048576).toFixed(1)} MB). Please choose a file under 8 MB, or take a smaller photo.`);
    }
    onProgress?.(15);
    const base64 = await fileToBase64(f);
    onProgress?.(35);
    // fetch cannot report upload progress, so creep towards 90 while we wait for the server
    let pct = 35;
    const timer = setInterval(() => {
      pct = Math.min(90, pct + 5);
      onProgress?.(pct);
    }, 500);
    try {
      const ref = await this.call((t) => this.deps.api.uploadFile(t, { name: f.name, mime, base64 }));
      onProgress?.(100);
      void this.storeFile(ref.fileId, f).catch(() => undefined); // so the viewer opens it offline
      return ref;
    } catch (e) {
      if (isApiErr(e, 'NETWORK')) throw new Error(OFFLINE_UPLOAD);
      throw this.friendly(e, OFFLINE_UPLOAD);
    } finally {
      clearInterval(timer);
    }
  };

  // ---- writes -------------------------------------------------------------------
  saveFactory = async (draft: FactoryDraft, requestedId?: string): Promise<Factory> => {
    this.needSession();
    if (this.queue.length && this.navOnline) await this.flush().catch(() => undefined);
    const id = requestedId ? this.resolve(requestedId) : undefined;
    if (!this.queue.length && this.navOnline && !(id && isTmp(id))) {
      try {
        const f = await this.call((t) => this.deps.api.saveFactory(t, draft, id));
        const exists = this.state.factories.some((x) => x.id === f.id);
        this.set({ factories: exists ? this.state.factories.map((x) => (x.id === f.id ? f : x)) : [...this.state.factories, f] });
        await this.cacheBootstrap();
        return f;
      } catch (e) {
        if (!isApiErr(e, 'NETWORK')) throw this.friendly(e, OFFLINE_GENERIC);
      }
    }
    return this.queueFactory(draft, id);
  };

  private async queueFactory(draft: FactoryDraft, id?: string): Promise<Factory> {
    let result: Factory;
    if (id) {
      const cur = this.state.factories.find((f) => f.id === id);
      if (!cur) throw new Error('That factory was not found.');
      result = { ...cur, ...draft };
      const pending = this.queue.find((q) => q.kind === 'factory' && (q.tmpId === id || q.id === id));
      if (pending && pending.kind === 'factory') pending.draft = draft;
      else this.queue.push({ qid: rid(), kind: 'factory', id, draft, createdAt: this.now().toISOString() });
      this.set({ factories: this.state.factories.map((f) => (f.id === id ? result : f)) });
    } else {
      const tmpId = `tmp_${rid()}`;
      result = { ...draft, id: tmpId, createdAt: this.now().toISOString() };
      this.queue.push({ qid: rid(), kind: 'factory', tmpId, draft, createdAt: result.createdAt });
      this.set({ factories: [...this.state.factories, result] });
    }
    await this.persistQueue();
    await this.cacheBootstrap();
    return result;
  }

  savePricelist = async (rawDraft: PricelistDraft): Promise<Pricelist> => {
    const s = this.needSession();
    if (this.queue.length && this.navOnline) await this.flush().catch(() => undefined);
    const draft = { ...rawDraft, factoryId: this.resolve(rawDraft.factoryId) };
    const canQueue = draft.source === 'items' && draft.files.length === 0;
    if (!this.queue.length && this.navOnline && !isTmp(draft.factoryId)) {
      try {
        const p = await this.call((t) => this.deps.api.savePricelist(t, draft));
        const pricelists = this.state.pricelists.map((x) =>
          x.status === 'current' && x.factoryId === p.factoryId && x.category === p.category ? { ...x, status: 'archived' as const } : x,
        );
        this.set({ pricelists: [...pricelists, p] });
        await this.deps.kv.del('allItems');
        await this.cacheBootstrap();
        return p;
      } catch (e) {
        if (!isApiErr(e, 'NETWORK')) throw this.friendly(e, OFFLINE_FILE_LIST);
        if (!canQueue) throw new Error(OFFLINE_FILE_LIST);
      }
    }
    if (!canQueue) throw new Error(OFFLINE_FILE_LIST);
    const tmpId = `tmp_${rid()}`;
    const createdAt = this.now().toISOString();
    const pl: Pricelist = {
      id: tmpId,
      factoryId: draft.factoryId,
      title: draft.title,
      category: draft.category,
      effectiveDate: draft.effectiveDate,
      source: 'items',
      files: [],
      itemCount: draft.items.length,
      note: draft.note,
      status: 'current',
      createdAt,
      createdBy: s.user.name,
    };
    const items: Item[] = draft.items.map((it, i) => ({ ...it, id: `${tmpId}_i${i + 1}`, pricelistId: tmpId }));
    await this.deps.kv.set(`items:${tmpId}`, items);
    await this.deps.kv.del('allItems');
    const archived = this.state.pricelists.map((x) =>
      x.status === 'current' && x.factoryId === pl.factoryId && x.category === pl.category ? { ...x, status: 'archived' as const } : x,
    );
    this.queue.push({ qid: rid(), kind: 'pricelist', tmpId, draft, createdAt });
    this.set({ pricelists: [...archived, pl] });
    await this.persistQueue();
    await this.cacheBootstrap();
    return pl;
  };

  saveSettings = async (s: Settings): Promise<void> => {
    const saved = await this.netWrite((t) => this.deps.api.saveSettings(t, s));
    const hideChanged = saved.hideRatesFromStaff !== this.state.settings.hideRatesFromStaff;
    this.set({ settings: saved });
    await this.cacheBootstrap();
    if (hideChanged) await this.purgeItems();
  };

  listUsers = (): Promise<User[]> => this.netWrite((t) => this.deps.api.listUsers(t));

  saveUser = async (u: { id?: string; name: string; role: Role; pin?: string }): Promise<void> => {
    await this.netWrite((t) => this.deps.api.saveUser(t, u));
  };

  deleteUser = async (id: string): Promise<void> => {
    await this.netWrite((t) => this.deps.api.deleteUser(t, id));
  };

  private needSession(): Session {
    if (!this.state.session) throw new Error('Please sign in.');
    return this.state.session;
  }

  private async netWrite<T>(fn: (token: string) => Promise<T>): Promise<T> {
    this.needSession();
    if (!this.navOnline) throw new Error(OFFLINE_GENERIC);
    try {
      return await this.call(fn);
    } catch (e) {
      throw this.friendly(e, OFFLINE_GENERIC);
    }
  }

  private friendly(e: unknown, offlineMsg: string): Error {
    if (isApiErr(e, 'NETWORK')) return new Error(offlineMsg || 'Cannot reach the server.');
    if (e instanceof Error) return e;
    return new Error('Something went wrong. Please try again.');
  }
}
