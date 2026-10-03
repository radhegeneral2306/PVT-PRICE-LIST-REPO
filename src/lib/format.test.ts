import { describe, expect, it } from 'vitest';
import { formatDate, formatRate, formatRupee, isStale, timeAgo } from './format';

describe('formatRupee', () => {
  it('formats with two decimals', () => {
    expect(formatRupee(38.5)).toBe('₹38.50');
    expect(formatRupee(0)).toBe('₹0.00');
  });
  it('uses Indian grouping', () => {
    expect(formatRupee(999)).toBe('₹999.00');
    expect(formatRupee(1000)).toBe('₹1,000.00');
    expect(formatRupee(123456)).toBe('₹1,23,456.00');
    expect(formatRupee(12345678.9)).toBe('₹1,23,45,678.90');
  });
  it('handles negatives and non-finite', () => {
    expect(formatRupee(-1500)).toBe('-₹1,500.00');
    expect(formatRupee(NaN)).toBe('');
  });
});

describe('formatRate', () => {
  it('shows a dash for hidden rates', () => {
    expect(formatRate(null)).toBe('-');
    expect(formatRate(12)).toBe('₹12.00');
  });
});

describe('formatDate', () => {
  it('formats a calendar date', () => {
    expect(formatDate('2026-10-01')).toBe('01 Oct 2026');
    expect(formatDate('2026-01-31')).toBe('31 Jan 2026');
  });
  it('returns empty for junk', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('nope')).toBe('');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  it('buckets', () => {
    expect(timeAgo('2026-10-03T11:59:40Z', now)).toBe('Just now');
    expect(timeAgo('2026-10-03T11:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-10-03T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-10-02T11:00:00Z', now)).toBe('Yesterday');
    expect(timeAgo('2026-09-30T12:00:00Z', now)).toBe('3 days ago');
    expect(timeAgo('2026-09-26T12:00:00Z', now)).toBe('1 week ago');
    expect(timeAgo('2026-09-12T12:00:00Z', now)).toBe('3 weeks ago');
    expect(timeAgo('2026-07-01T12:00:00Z', now)).toBe('3 months ago');
  });
});

describe('isStale', () => {
  const now = new Date(2026, 9, 3, 12);
  it('compares against weeks', () => {
    expect(isStale('2026-10-01', 3, now)).toBe(false);
    expect(isStale('2026-09-13', 3, now)).toBe(false);
    expect(isStale('2026-09-12', 3, now)).toBe(true);
  });
  it('flags older dates', () => {
    expect(isStale('2026-09-01', 3, now)).toBe(true);
  });
  it('is false for invalid input', () => {
    expect(isStale('', 3, now)).toBe(false);
  });
});
