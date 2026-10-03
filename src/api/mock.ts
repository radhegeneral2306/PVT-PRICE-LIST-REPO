// In-memory implementation of every action in docs/api-contract.md. State persists to localStorage.
import type { Bootstrap, Factory, FactoryDraft, FileRef, Item, Pricelist, PricelistDraft, Role, Session, Settings, User } from '../types';
import { ApiError, type Api, type UploadPayload } from './types';
import { buildSeed, getSeedBlobs, type MockState, type MockUser } from './mockSeed';

export const MOCK_STORAGE_KEY = 'pv_mock_state_v1';

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface MockOptions {
  /** [min, max] artificial delay in ms, or false for none (tests). Default [300, 600]. */
  delay?: [number, number] | false;
  /** Where to persist. Default: window.localStorage when available. null disables persistence. */
  storage?: KV | null;
  now?: () => Date;
}

export interface MockApi extends Api {
  /** Test helpers. */
  _reset(): void;
  _expireSessions(): void;
  _state(): MockState;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const rid = () => Math.random().toString(36).slice(2, 12).padEnd(10, '0');

function defaultStorage(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function createMockApi(opts: MockOptions = {}): MockApi {
  const delay = opts.delay === undefined ? ([300, 600] as [number, number]) : opts.delay;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const now = opts.now ?? (() => new Date());

  function load(): MockState {
    try {
      const raw = storage?.getItem(MOCK_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as MockState;
        if (s && Array.isArray(s.factories) && s.items && s.users) return { ...s, uploads: s.uploads ?? {}, sessions: s.sessions ?? {} };
      }
    } catch {
      /* fall through to seed */
    }
    return buildSeed();
  }

  let state = load();

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
    } catch {
      try {
        storage.setItem(MOCK_STORAGE_KEY, JSON.stringify({ ...state, uploads: {} }));
      } catch {
        /* quota or blocked: keep working in memory */
      }
    }
  }

  async function wait() {
    if (delay === false) return;
    const ms = delay[0] + Math.random() * (delay[1] - delay[0]);
    await new Promise((r) => setTimeout(r, ms));
  }

  function auth(token: string): MockUser {
    const uid = state.sessions[token];
    const u = uid ? state.users.find((x) => x.id === uid) : undefined;
    if (!u) throw new ApiError('SESSION_EXPIRED', 'Your session ended. Please sign in again.');
    return u;
  }
  function owner(token: string): MockUser {
    const u = auth(token);
    if (u.role !== 'owner') throw new ApiError('BAD_REQUEST', 'Only the owner can do this.');
    return u;
  }
  const masked = (u: MockUser): boolean => state.settings.hideRatesFromStaff && u.role === 'staff';
  const view = (items: Item[], u: MockUser): Item[] => items.map((i) => ({ ...i, rate: masked(u) ? null : i.rate }));
  const pub = (u: MockUser): User => ({ id: u.id, name: u.name, role: u.role });

  async function run<T>(fn: () => T): Promise<T> {
    await wait();
    const out = fn();
    return (out === undefined ? out : clone(out)) as T;
  }

  return {
    _reset() {
      state = buildSeed();
      persist();
    },
    _expireSessions() {
      state.sessions = {};
      persist();
    },
    _state: () => state,

    login: (name, pin) =>
      run((): Session => {
        const u = state.users.find((x) => x.name.trim().toLowerCase() === String(name).trim().toLowerCase());
        if (!u || u.pin !== String(pin)) throw new ApiError('BAD_REQUEST', 'Wrong name or PIN. Please try again.');
        const token = `mock_${u.id}_${rid()}`;
        state.sessions[token] = u.id;
        persist();
        return { token, user: pub(u) };
      }),

    bootstrap: (token) =>
      run((): Bootstrap => {
        auth(token);
        return { factories: state.factories, pricelists: state.pricelists, settings: state.settings, serverTime: now().toISOString() };
      }),

    getItems: (token, pricelistId) =>
      run(() => {
        const u = auth(token);
        const list = state.items[pricelistId];
        if (!list) {
          if (state.pricelists.some((p) => p.id === pricelistId)) return [];
          throw new ApiError('BAD_REQUEST', 'That pricelist was not found.');
        }
        return view(list, u);
      }),

    getAllCurrentItems: (token) =>
      run(() => {
        const u = auth(token);
        const out: Item[] = [];
        for (const p of state.pricelists) if (p.status === 'current') out.push(...(state.items[p.id] ?? []));
        return view(out, u);
      }),

    saveFactory: (token, draft: FactoryDraft, id?: string) =>
      run((): Factory => {
        auth(token);
        if (!draft.name || !draft.name.trim()) throw new ApiError('BAD_REQUEST', 'Please enter the factory name.');
        if (id) {
          const f = state.factories.find((x) => x.id === id);
          if (!f) throw new ApiError('BAD_REQUEST', 'That factory was not found.');
          Object.assign(f, draft);
          persist();
          return f;
        }
        const f: Factory = { ...draft, id: rid(), createdAt: now().toISOString() };
        state.factories.push(f);
        persist();
        return f;
      }),

    savePricelist: (token, draft: PricelistDraft) =>
      run((): Pricelist => {
        const u = auth(token);
        if (!state.factories.some((f) => f.id === draft.factoryId)) throw new ApiError('BAD_REQUEST', 'That factory was not found.');
        // Archive the previous current list of the same factory + category. Never delete.
        for (const p of state.pricelists) {
          if (p.status === 'current' && p.factoryId === draft.factoryId && p.category === draft.category) p.status = 'archived';
        }
        const id = rid();
        const items: Item[] = draft.source === 'items' ? draft.items.map((it) => ({ ...it, id: rid(), pricelistId: id })) : [];
        const pl: Pricelist = {
          id,
          factoryId: draft.factoryId,
          title: draft.title,
          category: draft.category,
          effectiveDate: draft.effectiveDate,
          source: draft.source,
          files: draft.source === 'items' ? [] : draft.files,
          itemCount: items.length,
          note: draft.note,
          status: 'current',
          createdAt: now().toISOString(),
          createdBy: u.name,
        };
        state.pricelists.push(pl);
        state.items[id] = items;
        persist();
        return pl;
      }),

    uploadFile: (token, p: UploadPayload) =>
      run((): FileRef => {
        auth(token);
        if (!p.base64) throw new ApiError('BAD_REQUEST', 'The file is empty.');
        const fileId = `file_${rid()}`;
        state.uploads[fileId] = { mime: p.mime, base64: p.base64 };
        persist();
        return { fileId, name: p.name, mime: p.mime };
      }),

    getFile: (token, fileId) =>
      run(() => {
        auth(token);
        const f = state.uploads[fileId] ?? getSeedBlobs()[fileId];
        if (!f) throw new ApiError('BAD_REQUEST', 'That file was not found.');
        return f;
      }),

    saveSettings: (token, s: Settings) =>
      run(() => {
        owner(token);
        state.settings = { hideRatesFromStaff: !!s.hideRatesFromStaff, staleWeeks: Math.max(1, Math.round(Number(s.staleWeeks) || 3)) };
        persist();
        return state.settings;
      }),

    listUsers: (token) =>
      run(() => {
        owner(token);
        return state.users.map(pub);
      }),

    saveUser: (token, u: { id?: string; name: string; role: Role; pin?: string }) =>
      run((): User => {
        owner(token);
        const name = (u.name ?? '').trim();
        if (!name) throw new ApiError('BAD_REQUEST', 'Please enter a name.');
        if (u.pin !== undefined && u.pin !== '' && !/^\d{4,8}$/.test(u.pin)) throw new ApiError('BAD_REQUEST', 'PIN must be 4 to 8 digits.');
        if (state.users.some((x) => x.id !== u.id && x.name.toLowerCase() === name.toLowerCase())) {
          throw new ApiError('BAD_REQUEST', 'Someone with this name already exists.');
        }
        if (u.id) {
          const ex = state.users.find((x) => x.id === u.id);
          if (!ex) throw new ApiError('BAD_REQUEST', 'That user was not found.');
          if (ex.role === 'owner' && u.role !== 'owner' && state.users.filter((x) => x.role === 'owner').length <= 1) {
            throw new ApiError('BAD_REQUEST', 'There must be at least one owner.');
          }
          ex.name = name;
          ex.role = u.role;
          if (u.pin) ex.pin = u.pin;
          persist();
          return pub(ex);
        }
        if (!u.pin) throw new ApiError('BAD_REQUEST', 'Please set a PIN of 4 to 8 digits.');
        const nu: MockUser = { id: `u_${rid()}`, name, role: u.role, pin: u.pin };
        state.users.push(nu);
        persist();
        return pub(nu);
      }),

    deleteUser: (token, id) =>
      run(() => {
        const me = owner(token);
        if (me.id === id) throw new ApiError('BAD_REQUEST', 'You cannot remove yourself.');
        const ex = state.users.find((x) => x.id === id);
        if (!ex) throw new ApiError('BAD_REQUEST', 'That user was not found.');
        state.users = state.users.filter((x) => x.id !== id);
        for (const [t, uid] of Object.entries(state.sessions)) if (uid === id) delete state.sessions[t];
        persist();
        return undefined as void;
      }),
  };
}
