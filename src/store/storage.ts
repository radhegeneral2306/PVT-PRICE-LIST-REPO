// Tiny async key-value interface so the store can be tested without IndexedDB.
import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval';

export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function createMemoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    async get<T>(k: string) {
      return m.get(k) as T | undefined;
    },
    async set(k, v) {
      m.set(k, v);
    },
    async del(k) {
      m.delete(k);
    },
    async keys() {
      return [...m.keys()];
    },
  };
}

export function createIdbKV(dbName = 'pricelist-vault', storeName = 'kv'): KV {
  let store: UseStore | null = null;
  const s = () => (store ??= createStore(dbName, storeName));
  return {
    get: <T,>(k: string) => get<T>(k, s()),
    set: (k, v) => set(k, v, s()),
    del: (k) => del(k, s()),
    keys: async () => (await keys(s())).map(String),
  };
}

/** Wraps a KV so that a broken IndexedDB (private mode, blocked) never crashes the app. */
export function safeKV(inner: KV): KV {
  return {
    get: async <T,>(k: string) => {
      try {
        return await inner.get<T>(k);
      } catch {
        return undefined;
      }
    },
    set: async (k, v) => {
      try {
        await inner.set(k, v);
      } catch {
        /* ignore */
      }
    },
    del: async (k) => {
      try {
        await inner.del(k);
      } catch {
        /* ignore */
      }
    },
    keys: async () => {
      try {
        return await inner.keys();
      } catch {
        return [];
      }
    },
  };
}

/** Small synchronous store for the login session (kept in localStorage). */
export interface SyncStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createMemorySyncStore(): SyncStore {
  const m = new Map<string, string>();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => void m.set(k, v),
    remove: (k) => void m.delete(k),
  };
}

export function createLocalSyncStore(): SyncStore {
  return {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    },
    remove: (k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };
}
