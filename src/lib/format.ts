// Display formatters. Pure functions, no locale/ICU dependency, so output is identical everywhere.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

/** 38.5 -> "₹38.50", 123456 -> "₹1,23,456.00" (Indian grouping). */
export function formatRupee(n: number): string {
  if (!Number.isFinite(n)) return '';
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(2).split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `${neg ? '-' : ''}₹${grouped}.${dec}`;
}

/** Rate that may be hidden or missing (null): "₹38.50" or "-". */
export function formatRate(n: number | null | undefined): string {
  return n == null ? '-' : formatRupee(n);
}

/** Parse "YYYY-MM-DD" as a local calendar date, or any other ISO string as an instant. */
function parse(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-10-01" -> "01 Oct 2026". Empty string for invalid input. */
export function formatDate(value: string): string {
  const d = parse(value);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Just now", "5 min ago", "3 hours ago", "Yesterday", "4 days ago", "2 weeks ago", "3 months ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return '';
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

/** True when the date (YYYY-MM-DD or ISO) is more than `weeks` weeks old. */
export function isStale(value: string, weeks: number, now: Date = new Date()): boolean {
  const d = parse(value);
  if (!d) return false;
  return now.getTime() - d.getTime() > weeks * 7 * DAY_MS;
}
