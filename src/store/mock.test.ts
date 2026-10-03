import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi, type MockApi } from '../api/mock';
import { ApiError } from '../api/types';
import type { PricelistDraft } from '../types';

let mock: MockApi;
beforeEach(() => {
  mock = createMockApi({ delay: false, storage: null });
});

const draft = (factoryId: string, category: 'Tiles' | 'Sanitaryware' | 'Other', title = 'New'): PricelistDraft => ({
  factoryId,
  title,
  category,
  effectiveDate: '2026-10-03',
  source: 'items',
  files: [],
  note: '',
  items: [{ name: 'X', code: '', size: '600x600', finish: 'Matt', thickness: '', boxPcs: '', unit: 'sqft', rate: 10, note: '' }],
});

describe('mock role masking', () => {
  it('hides rates from staff when the setting is on, not from the owner', async () => {
    const staff = await mock.login('Rakesh', '5678');
    const owner = await mock.login('Owner', '1234');
    const s = await mock.getItems(staff.token, 'pl1');
    const o = await mock.getItems(owner.token, 'pl1');
    expect(s.length).toBeGreaterThanOrEqual(24);
    expect(s.every((i) => i.rate === null)).toBe(true);
    expect(o.every((i) => typeof i.rate === 'number')).toBe(true);
    const all = await mock.getAllCurrentItems(staff.token);
    expect(all.every((i) => i.rate === null)).toBe(true);
  });

  it('shows rates to staff once the owner turns hiding off', async () => {
    const staff = await mock.login('Rakesh', '5678');
    const owner = await mock.login('Owner', '1234');
    await mock.saveSettings(owner.token, { hideRatesFromStaff: false, staleWeeks: 3 });
    const s = await mock.getItems(staff.token, 'pl3');
    expect(s.every((i) => typeof i.rate === 'number')).toBe(true);
  });

  it('keeps owner-only actions away from staff', async () => {
    const staff = await mock.login('Rakesh', '5678');
    await expect(mock.listUsers(staff.token)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(mock.saveSettings(staff.token, { hideRatesFromStaff: false, staleWeeks: 3 })).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a wrong PIN and an expired token', async () => {
    await expect(mock.login('Owner', '0000')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const o = await mock.login('Owner', '1234');
    mock._expireSessions();
    await expect(mock.bootstrap(o.token)).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });
});

describe('mock savePricelist archiving rule', () => {
  it('archives the previous current list of the same factory and category only', async () => {
    const o = await mock.login('Owner', '1234');
    const before = await mock.bootstrap(o.token);
    expect(before.pricelists.find((p) => p.id === 'pl1')?.status).toBe('current');
    const pl = await mock.savePricelist(o.token, draft('f1', 'Tiles'));
    const after = await mock.bootstrap(o.token);
    expect(after.pricelists.find((p) => p.id === 'pl1')?.status).toBe('archived');
    expect(after.pricelists.find((p) => p.id === pl.id)?.status).toBe('current');
    expect(pl.itemCount).toBe(1);
    // other factory and other category untouched
    expect(after.pricelists.find((p) => p.id === 'pl2')?.status).toBe('current');
    expect(after.pricelists.find((p) => p.id === 'pl3')?.status).toBe('current');
    await mock.savePricelist(o.token, draft('f2', 'Other'));
    const again = await mock.bootstrap(o.token);
    expect(again.pricelists.find((p) => p.id === 'pl2')?.status).toBe('current');
    expect(again.pricelists.find((p) => p.id === 'pl6')?.status).toBe('archived');
    // never deleted
    expect(again.pricelists.length).toBe(after.pricelists.length + 1);
  });

  it('seeds compare-friendly 600x1200 glossy items across f1, f2 and f4', async () => {
    const o = await mock.login('Owner', '1234');
    const [boot, items] = await Promise.all([mock.bootstrap(o.token), mock.getAllCurrentItems(o.token)]);
    const factoryOf = (plId: string) => boot.pricelists.find((p) => p.id === plId)!.factoryId;
    const hit = new Set(items.filter((i) => i.size === '600x1200' && i.finish === 'Glossy').map((i) => factoryOf(i.pricelistId)));
    expect(hit).toEqual(new Set(['f1', 'f2', 'f4']));
  });

  it('serves sample files for the pdf and image pricelists', async () => {
    const o = await mock.login('Owner', '1234');
    const b = await mock.bootstrap(o.token);
    const pdf = b.pricelists.find((p) => p.id === 'pl2')!.files[0];
    const f = await mock.getFile(o.token, pdf.fileId);
    expect(f.mime).toBe('application/pdf');
    expect(atob(f.base64).startsWith('%PDF-')).toBe(true);
    const img = b.pricelists.find((p) => p.id === 'pl4')!.files[0];
    const g = await mock.getFile(o.token, img.fileId);
    expect(atob(g.base64).charCodeAt(1)).toBe(80); // 'P' of PNG
  });
});
