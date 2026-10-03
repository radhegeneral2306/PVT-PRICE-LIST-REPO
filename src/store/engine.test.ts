import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi, type MockApi } from '../api/mock';
import { ApiError, type Api } from '../api/types';
import type { PricelistDraft } from '../types';
import { DataEngine, OFFLINE_UPLOAD, planEviction, type PendingWrite } from './engine';
import { createMemoryKV, createMemorySyncStore, type KV, type SyncStore } from './storage';
import { fitWithin } from '../lib/imageCompress';

interface Rig {
  mock: MockApi;
  api: Api;
  net: { down: boolean; calls: string[] };
  kv: KV;
  sync: SyncStore;
  make: () => DataEngine;
}

function rig(): Rig {
  const mock = createMockApi({ delay: false, storage: null });
  const net = { down: false, calls: [] as string[] };
  const api = new Proxy(mock as Api, {
    get(target, prop: string) {
      const v = (target as unknown as Record<string, unknown>)[prop];
      if (typeof v !== 'function' || prop.startsWith('_')) return v;
      return (...args: unknown[]) => {
        net.calls.push(prop);
        if (net.down) return Promise.reject(new ApiError('NETWORK', 'Cannot reach the server.'));
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  const kv = createMemoryKV();
  const sync = createMemorySyncStore();
  const make = () => new DataEngine({ api, kv, sync, isOnline: () => true });
  return { mock, api, net, kv, sync, make };
}

const factoryDraft = (name: string) => ({ name, city: 'Morbi', category: 'Tiles' as const, contactName: '', phone: '', notes: '' });
const plDraft = (factoryId: string, title: string, category: 'Tiles' | 'Sanitaryware' | 'Other' = 'Tiles'): PricelistDraft => ({
  factoryId,
  title,
  category,
  effectiveDate: '2026-10-03',
  source: 'items',
  files: [],
  note: '',
  items: [{ name: 'A', code: '', size: '600x600', finish: 'Matt', thickness: '', boxPcs: '', unit: 'sqft', rate: 20, note: '' }],
});

async function loggedIn(r: Rig) {
  const e = r.make();
  await e.init();
  await e.login('Owner', '1234');
  await e.whenIdle();
  return e;
}

describe('startup and cache', () => {
  it('loads data after login and shows it from cache on the next start without network', async () => {
    const r = rig();
    const e = await loggedIn(r);
    expect(e.getState().ready).toBe(true);
    expect(e.getState().factories).toHaveLength(5);
    expect(e.getState().syncStatus).toBe('idle');
    r.net.down = true;
    const e2 = r.make();
    expect(e2.getState().session?.user.name).toBe('Owner'); // session restored synchronously
    await e2.init();
    expect(e2.getState().ready).toBe(true);
    expect(e2.getState().factories).toHaveLength(5);
    await e2.whenIdle();
    expect(e2.getState().syncStatus).toBe('offline');
    expect(e2.getState().ready).toBe(true);
  });

  it('falls back to cached items when the network throws, and errors clearly when nothing is cached', async () => {
    const r = rig();
    const e = await loggedIn(r);
    const first = await e.getItems('pl1');
    expect(first.length).toBeGreaterThan(20);
    r.net.down = true;
    const again = await e.getItems('pl1');
    expect(again).toEqual(first);
    await e.whenIdle();
    await expect(e.getItems('pl3')).rejects.toThrow(/not saved on this phone|reach/i);
    // all-items search also degrades to what is on the phone
    r.net.down = false;
    const hits = await e.getAllCurrentItems();
    expect(hits.length).toBeGreaterThan(40);
    r.net.down = true;
    const offlineHits = await e.getAllCurrentItems();
    expect(offlineHits.length).toBe(hits.length);
    expect(offlineHits[0].factory.id).toBeTruthy();
    expect(offlineHits.every((h) => h.pricelist.status === 'current')).toBe(true);
  });

  it('clears the session but keeps cached data when the token expires', async () => {
    const r = rig();
    const e = await loggedIn(r);
    r.mock._expireSessions();
    await e.refresh();
    expect(e.getState().session).toBeNull();
    expect(r.sync.get('pv_session_v1')).toBeNull();
    expect(e.getState().factories).toHaveLength(5);
    expect(await r.kv.get('bootstrap')).toBeTruthy();
  });

  it('drops cached prices when a different person signs in', async () => {
    const r = rig();
    const e = await loggedIn(r);
    await e.getItems('pl1');
    expect(await r.kv.get('items:pl1')).toBeTruthy();
    e.logout();
    await e.login('Rakesh', '5678');
    const items = await e.getItems('pl1');
    expect(items.every((i) => i.rate === null)).toBe(true);
  });
});

describe('offline write queue', () => {
  let r: Rig;
  beforeEach(() => {
    r = rig();
  });

  it('queues in order with optimistic tmp ids and flushes on reconnect, remapping ids', async () => {
    const e = await loggedIn(r);
    r.net.down = true;
    const f = await e.saveFactory(factoryDraft('Offline Tiles'));
    expect(f.id.startsWith('tmp_')).toBe(true);
    const pl = await e.savePricelist(plDraft(f.id, 'First list'));
    expect(pl.id.startsWith('tmp_')).toBe(true);
    const edit = await e.saveFactory({ ...factoryDraft('Offline Tiles 2') }, f.id); // merges into the queued create
    expect(edit.name).toBe('Offline Tiles 2');
    expect(e.getState().pendingWrites).toBe(2);
    expect(e.getState().factories.some((x) => x.id === f.id)).toBe(true);
    expect(e.getState().pricelists.find((p) => p.id === pl.id)?.status).toBe('current');
    const q = (await r.kv.get<PendingWrite[]>('queue'))!;
    expect(q.map((w) => w.kind)).toEqual(['factory', 'pricelist']);
    expect(await e.getItems(pl.id)).toHaveLength(1); // optimistic items are readable offline

    r.net.down = false;
    r.net.calls.length = 0;
    e.setOnline(true);
    await e.whenIdle();
    const writes = r.net.calls.filter((c) => c === 'saveFactory' || c === 'savePricelist');
    expect(writes).toEqual(['saveFactory', 'savePricelist']);
    const st = e.getState();
    expect(st.pendingWrites).toBe(0);
    expect(st.syncStatus).toBe('idle');
    expect(st.factories.some((x) => x.id.startsWith('tmp_'))).toBe(false);
    expect(st.pricelists.some((x) => x.id.startsWith('tmp_'))).toBe(false);
    const realF = st.factories.find((x) => x.name === 'Offline Tiles 2')!;
    const realPl = st.pricelists.find((x) => x.title === 'First list')!;
    expect(realPl.factoryId).toBe(realF.id);
    expect(realPl.status).toBe('current');
    // the temporary ids still resolve for screens that held them
    expect(await e.getItems(pl.id)).toHaveLength(1);
    expect(await r.kv.get('queue')).toEqual([]);
  });

  it('keeps writes queued while the network stays down and applies the archive rule locally', async () => {
    const e = await loggedIn(r);
    r.net.down = true;
    await e.savePricelist(plDraft('f1', 'Offline Oct list'));
    const pls = e.getState().pricelists;
    expect(pls.find((p) => p.id === 'pl1')?.status).toBe('archived');
    expect(pls.filter((p) => p.factoryId === 'f1' && p.category === 'Tiles' && p.status === 'current')).toHaveLength(1);
    await e.refresh();
    expect(e.getState().syncStatus).toBe('offline');
    expect(e.getState().pendingWrites).toBe(1);
    // optimistic list survives a failed refresh
    expect(e.getState().pricelists.some((p) => p.title === 'Offline Oct list')).toBe(true);
  });

  it('flushes earlier queued writes before a new online write so order is kept', async () => {
    const e = await loggedIn(r);
    r.net.down = true;
    await e.saveFactory(factoryDraft('Queued first'));
    r.net.down = false;
    r.net.calls.length = 0;
    await e.saveFactory(factoryDraft('Written second'));
    const sent = r.mock._state().factories.map((f) => f.name);
    expect(sent.indexOf('Queued first')).toBeLessThan(sent.indexOf('Written second'));
    expect(e.getState().pendingWrites).toBe(0);
  });

  it('refuses uploads and file pricelists while offline with friendly messages', async () => {
    const e = await loggedIn(r);
    r.net.down = true;
    e.setOnline(false);
    await expect(e.uploadFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).rejects.toThrow(OFFLINE_UPLOAD);
    await expect(
      e.savePricelist({ ...plDraft('f1', 'pdf list'), source: 'pdf', files: [{ fileId: 'x', name: 'a.pdf', mime: 'application/pdf' }], items: [] }),
    ).rejects.toThrow(/offline/i);
    expect(e.getState().pendingWrites).toBe(0);
  });

  it('drops a queued write the server rejects so the rest still go through', async () => {
    const e = await loggedIn(r);
    r.net.down = true;
    await e.saveFactory(factoryDraft('')); // empty name: the server will refuse it
    await e.saveFactory(factoryDraft('Good one'));
    r.net.down = false;
    e.setOnline(true);
    await e.whenIdle();
    expect(e.getState().pendingWrites).toBe(0);
    expect(e.getState().factories.some((f) => f.name === 'Good one' && !f.id.startsWith('tmp_'))).toBe(true);
    expect(e.getState().factories.some((f) => f.name === '')).toBe(false);
  });
});

describe('pure helpers', () => {
  it('planEviction drops the least recently used files first and never the new one', () => {
    const index = { a: { size: 60, at: 1 }, b: { size: 30, at: 2 }, c: { size: 40, at: 3 }, d: { size: 20, at: 0 } };
    expect(planEviction(index, 'c', 100)).toEqual(['d', 'a']);
    expect(planEviction(index, 'a', 200)).toEqual([]);
    expect(planEviction({ a: { size: 500, at: 1 } }, 'a', 100)).toEqual([]);
  });

  it('fitWithin keeps aspect ratio, caps at 2000 and never upscales', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 });
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
});
