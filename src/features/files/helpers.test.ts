import { describe, expect, it } from 'vitest';
import { downloadName, monthYear } from './helpers';
import type { Pricelist } from '../../types';

const p = { title: 'Full Body', effectiveDate: '2026-09-24' } as Pricelist;

describe('file helpers', () => {
  it('formats month and year', () => expect(monthYear('2026-09-24')).toBe('Sep 2026'));
  it('names downloads', () => {
    const f = { fileId: 'a', name: 'x.pdf', mime: 'application/pdf' };
    expect(downloadName({ name: 'Kailash Vitrified' } as never, p, f)).toBe('Kailash Vitrified - Sep 2026.pdf');
    expect(downloadName(undefined, p, { ...f, mime: 'image/jpeg' }, 1, 3)).toBe('Full Body - Sep 2026 (2 of 3).jpg');
  });
});
