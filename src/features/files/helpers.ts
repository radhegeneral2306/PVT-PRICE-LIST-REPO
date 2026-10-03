import type { Factory, FileRef, Pricelist } from '../../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** True when the pricelist is stored as one or more files (PDF or photos) rather than typed items. */
export function isFileList(p: Pricelist): boolean {
  return p.source !== 'items' && p.files.length > 0;
}

/** "2026-09-24" -> "Sep 2026". Falls back to the raw text. */
export function monthYear(date: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(date);
  if (!m) return date;
  const name = MONTHS[Number(m[2]) - 1];
  return name ? `${name} ${m[1]}` : date;
}

export function extFromMime(mime: string, fallbackName = ''): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  const m = /\.([a-z0-9]{2,5})$/i.exec(fallbackName);
  return m ? m[1].toLowerCase() : 'bin';
}

export function isPdf(f: FileRef): boolean {
  return f.mime === 'application/pdf';
}

/** e.g. "Kailash Vitrified - Sep 2026.pdf". With several files: "... (2 of 3).jpg". */
export function downloadName(factory: Factory | undefined, p: Pricelist, file: FileRef, index = 0, total = 1): string {
  const base = `${factory?.name ?? p.title} - ${monthYear(p.effectiveDate)}`.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  const suffix = total > 1 ? ` (${index + 1} of ${total})` : '';
  return `${base}${suffix}.${extFromMime(file.mime, file.name)}`;
}

export function sourceLabel(p: Pricelist): string {
  if (p.source === 'pdf') return 'PDF';
  if (p.source === 'image') return p.files.length === 1 ? 'Photo' : 'Photos';
  return 'Typed items';
}
