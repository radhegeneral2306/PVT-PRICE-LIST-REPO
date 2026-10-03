import { Badge, Icon } from '../../ui';
import type { Factory, Pricelist, SourceType } from '../../types';

const SRC: Record<SourceType, { icon: string; label: string }> = {
  items: { icon: 'list-bullets', label: 'Items' },
  pdf: { icon: 'file-pdf', label: 'PDF' },
  image: { icon: 'image', label: 'Image' },
};

export function SourceBadge({ source, plain }: { source: SourceType; plain?: boolean }) {
  const s = SRC[source];
  return (
    <span className="badge" style={plain ? { background: 'var(--surface)' } : undefined}>
      <Icon name={s.icon} weight="bold" />
      {s.label}
    </span>
  );
}

export function sourceIcon(source: SourceType): string {
  return SRC[source].icon;
}

export function CategoryBadge({ category }: { category: Factory['category'] }) {
  return <Badge tone={category === 'Tiles' ? 'ok' : 'neutral'}>{category}</Badge>;
}

/** "84 items", "10 pages", "3 photos". */
export function sizeLabel(p: Pricelist): string {
  if (p.source === 'items') return `${p.itemCount} ${p.itemCount === 1 ? 'item' : 'items'}`;
  if (p.source === 'pdf') {
    const n = p.files.reduce((a, f) => a + (f.pages ?? 1), 0);
    return `${n} ${n === 1 ? 'page' : 'pages'}`;
  }
  const n = p.files.length;
  return `${n} ${n === 1 ? 'photo' : 'photos'}`;
}

/** Latest activity of a factory: newest pricelist createdAt, else the factory's own createdAt. */
export function lastUpdated(factory: Factory, pricelists: Pricelist[]): string {
  let best = factory.createdAt;
  for (const p of pricelists) if (p.factoryId === factory.id && p.createdAt > best) best = p.createdAt;
  return best;
}

export function phoneDigits(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  return d;
}
