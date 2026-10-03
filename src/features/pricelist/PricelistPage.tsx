import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import type { Item, Pricelist } from '../../types';
import {
  Badge, Button, Chip, Chips, EmptyState, ErrorState, Icon, IconButton, ListGroup, ListRow, PageContainer, SearchField,
  Sheet, SkeletonRows, TopBar, formatDate, formatRupee, useToast,
} from '../../ui';
import { SourceBadge } from './parts';
import './pricelist.css';

const PAGE = 60;
type Band = { label: string; min: number; max: number };

function niceStep(v: number): number {
  return v >= 1000 ? 100 : v >= 200 ? 25 : v >= 50 ? 10 : v >= 10 ? 5 : 1;
}

/** Up to three rate bands derived from the data (Under X, X to Y, Y and above). */
function rateBands(items: Item[]): Band[] {
  const rates = items.map((i) => i.rate).filter((r): r is number => r != null).sort((a, b) => a - b);
  if (rates.length < 4) return [];
  const step = niceStep(rates[Math.floor(rates.length / 2)]);
  const snap = (v: number) => Math.round(v / step) * step;
  const t1 = snap(rates[Math.floor(rates.length / 3)]);
  const t2 = snap(rates[Math.floor((rates.length * 2) / 3)]);
  if (!(t1 > 0) || t2 <= t1) return [];
  const f = (n: number) => formatRupee(n).replace(/\.00$/, '');
  return [
    { label: `Under ${f(t1)}`, min: -Infinity, max: t1 },
    { label: `${f(t1)} to ${f(t2)}`, min: t1, max: t2 },
    { label: `${f(t2)} and above`, min: t2, max: Infinity },
  ];
}

function unitWord(u: Item['unit']): string {
  return u;
}

export function PricelistPage() {
  const { id = '' } = useParams();
  const { ready, pricelists, factories, syncStatus, refresh } = useData();
  const pl = pricelists.find((p) => p.id === id);
  const factory = pl ? factories.find((f) => f.id === pl.factoryId) : undefined;

  if (!ready) {
    return (
      <div className="pl-page">
        <TopBar back title="Pricelist" />
        <PageContainer narrow>
          <div className="page">{syncStatus === 'error' ? <ErrorState onRetry={() => void refresh()} /> : <SkeletonRows count={6} avatar={false} />}</div>
        </PageContainer>
      </div>
    );
  }
  if (!pl) {
    return (
      <div className="pl-page">
        <TopBar backTo="/factories" title="Pricelist" />
        <PageContainer narrow><div className="page"><EmptyState icon="file-dashed" title="Pricelist not found" text="It may have been removed." action={<Link to="/factories" className="btn">Go to factories</Link>} /></div></PageContainer>
      </div>
    );
  }
  if (pl.source !== 'items') return <FileInfo pl={pl} factoryName={factory ? `${factory.name}${factory.city ? ', ' + factory.city : ''}` : ''} />;
  return <ItemsView pl={pl} factoryName={factory?.name ?? ''} factoryCity={factory?.city ?? ''} factoryId={pl.factoryId} />;
}

function useBack(factoryId: string) {
  const loc = useLocation();
  // First entry in history (deep link): there is nothing to go back to, so link to the factory.
  return loc.key === 'default' ? { backTo: `/factories/${factoryId}` } : { back: true as const };
}

function StatusLine({ pl }: { pl: Pricelist }) {
  return (
    <div className="pl-meta">
      <div className="l">
        {pl.status === 'current' ? <Badge tone="ok" icon="check-circle">Current</Badge> : <Badge icon="archive">Archived</Badge>}
        <Icon name="calendar-blank" />
        <span>Effective {formatDate(pl.effectiveDate)}</span>
      </div>
      {pl.note ? <div className="l"><Icon name="info" />{pl.note}</div> : null}
    </div>
  );
}

/** Shown for pdf and image lists. The router sends the user straight on to the file viewer. */
function FileInfo({ pl, factoryName }: { pl: Pricelist; factoryName: string }) {
  const navigate = useNavigate();
  const back = useBack(pl.factoryId);
  useEffect(() => { navigate(`/file/${pl.id}`, { replace: true }); }, [navigate, pl.id]);
  return (
    <div className="pl-page">
      <TopBar {...back} title={pl.title} subtitle={factoryName} />
      <PageContainer narrow>
        <StatusLine pl={pl} />
        <div className="page stack-sm">
          <div><SourceBadge source={pl.source} /></div>
          <Link to={`/file/${pl.id}`} replace className="btn btn-primary btn-block"><Icon name="arrow-square-out" weight="bold" />Open file</Link>
        </div>
      </PageContainer>
    </div>
  );
}

function ItemsView({ pl, factoryName, factoryCity, factoryId }: { pl: Pricelist; factoryName: string; factoryCity: string; factoryId: string }) {
  const { getItems, session, settings } = useData();
  const toast = useToast();
  const back = useBack(factoryId);
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  const [size, setSize] = useState('');
  const [finish, setFinish] = useState('');
  const [bandIdx, setBandIdx] = useState(-1);
  const [open, setOpen] = useState<null | 'size' | 'finish' | 'rate'>(null);
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let live = true;
    setItems(null); setErr(false);
    getItems(pl.id).then((r) => { if (live) setItems(r); }, () => { if (live) setErr(true); });
    return () => { live = false; };
  }, [pl.id, getItems, tick]);

  const hideRates = session?.user.role === 'staff' && settings.hideRatesFromStaff;

  const facets = useMemo(() => {
    const count = (pick: (i: Item) => string) => {
      const m = new Map<string, number>();
      for (const i of items ?? []) { const v = pick(i).trim(); if (v) m.set(v, (m.get(v) ?? 0) + 1); }
      return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    };
    return { sizes: count((i) => i.size), finishes: count((i) => i.finish), bands: rateBands(items ?? []) };
  }, [items]);

  const band = bandIdx >= 0 ? facets.bands[bandIdx] : undefined;
  const filtered = useMemo(() => {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (items ?? []).filter((i) => {
      if (size && i.size.trim() !== size) return false;
      if (finish && i.finish.trim() !== finish) return false;
      if (band && !(i.rate != null && i.rate >= band.min && i.rate < band.max)) return false;
      if (!tokens.length) return true;
      const hay = `${i.name} ${i.code} ${i.size} ${i.finish} ${i.thickness} ${i.note}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [items, q, size, finish, band]);

  useEffect(() => { setShown(PAGE); }, [q, size, finish, bandIdx]);

  // Auto-load more rows when the sentinel scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  const more = filtered.length > shown;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE);
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown]);

  const filtersOn = !!(size || finish || band);
  const clearFilters = () => { setSize(''); setFinish(''); setBandIdx(-1); };
  const units = useMemo(() => new Set((items ?? []).map((i) => i.unit)), [items]);
  const rateNote = hideRates ? 'Rates hidden' : units.size === 1 ? `Rate per ${unitWord([...units][0])}` : 'Rate per unit shown';
  const hasRates = (items ?? []).some((i) => i.rate != null);

  const share = useCallback(async () => {
    const lines = (items ?? []).slice(0, 200).map((i) => {
      const spec = [i.size && `${i.size} mm`, i.finish].filter(Boolean).join(' ');
      const rate = i.rate != null ? ` - ${formatRupee(i.rate)}/${i.unit}` : '';
      return `${i.name}${spec ? ' ' + spec : ''}${rate}`;
    });
    const text = [
      `${pl.title}`,
      `${factoryName}${factoryCity ? ', ' + factoryCity : ''}`,
      `Effective ${formatDate(pl.effectiveDate)}${pl.note ? '. ' + pl.note : ''}`,
      '',
      ...lines,
      (items?.length ?? 0) > 200 ? `... and ${(items?.length ?? 0) - 200} more items` : '',
    ].join('\n').trim();
    try {
      if (typeof navigator.share === 'function') { await navigator.share({ title: pl.title, text }); return; }
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toast.error('Could not share. Try again.');
    }
  }, [items, pl, factoryName, factoryCity, toast]);

  const sub = `${factoryName}${factoryCity ? ', ' + factoryCity : ''}`;
  const chev = <Icon name="caret-down" weight="bold" />;

  let list;
  if (err) list = <ErrorState message="Could not load the items." onRetry={() => setTick((t) => t + 1)} />;
  else if (!items) list = <SkeletonRows count={8} avatar={false} />;
  else if (items.length === 0) list = <EmptyState icon="list-bullets" title="No items in this list" text="This pricelist has no items saved." />;
  else if (filtered.length === 0) list = <EmptyState icon="magnifying-glass" title="No items match" text="Try a different word or clear the filters." action={<Button onClick={() => { setQ(''); clearFilters(); }}>Clear search and filters</Button>} />;
  else {
    list = (
      <>
        {filtered.slice(0, shown).map((i) => (
          <div className="pl-it" key={i.id}>
            <div className="grow">
              <div className="n">{i.name}</div>
              {i.size || i.finish ? <div className="z">{[i.size && `${i.size} mm`, i.finish].filter(Boolean).join(' · ')}</div> : null}
              {i.thickness || i.boxPcs ? <div className="y">{[i.thickness, i.boxPcs && `${i.boxPcs} per box`].filter(Boolean).join(' · ')}</div> : null}
              {i.note ? <div className="y">{i.note}</div> : null}
            </div>
            <div className="r">
              {i.rate != null ? (
                <><b>{formatRupee(i.rate)}</b><small>/{i.unit}</small></>
              ) : hideRates ? (
                <span className="hid">Rate hidden</span>
              ) : (
                <b className="faint">-</b>
              )}
            </div>
          </div>
        ))}
        {more ? (
          <div className="pl-more" ref={sentinel}>
            <Button onClick={() => setShown((n) => n + PAGE)}>Show more ({filtered.length - shown} left)</Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="pl-page">
      <TopBar {...back} title={pl.title} subtitle={sub} right={<IconButton icon="share-network" label="Share pricelist" onClick={() => void share()} disabled={!items} />} />
      <PageContainer narrow>
        <StatusLine pl={pl} />
        <div className="pl-tools">
          <SearchField value={q} onChange={setQ} placeholder="Search in this list" />
          <Chips label="Filters">
            <Chip selected={!filtersOn} onClick={clearFilters}>All</Chip>
            {facets.sizes.length > 0 ? <Chip selected={!!size} onClick={() => setOpen('size')}>{size || 'Size'}{chev}</Chip> : null}
            {facets.finishes.length > 0 ? <Chip selected={!!finish} onClick={() => setOpen('finish')}>{finish || 'Finish'}{chev}</Chip> : null}
            {facets.bands.length > 0 && hasRates ? <Chip selected={!!band} onClick={() => setOpen('rate')}>{band?.label ?? 'Rate'}{chev}</Chip> : null}
          </Chips>
        </div>
        <div className="pl-count">
          <span>{items ? (filtered.length === items.length ? `${items.length} items` : `${filtered.length} of ${items.length} items`) : ' '}</span>
          {items && items.length ? <span className="u">{rateNote}</span> : null}
        </div>
        <div className="pl-items">{list}</div>
      </PageContainer>

      <OptionSheet open={open === 'size'} title="Size" onClose={() => setOpen(null)} value={size} options={facets.sizes.map(([v, n]) => ({ value: v, label: `${v} mm`, count: n }))} onPick={(v) => { setSize(v); setOpen(null); }} />
      <OptionSheet open={open === 'finish'} title="Finish" onClose={() => setOpen(null)} value={finish} options={facets.finishes.map(([v, n]) => ({ value: v, label: v, count: n }))} onPick={(v) => { setFinish(v); setOpen(null); }} />
      <OptionSheet open={open === 'rate'} title="Rate" onClose={() => setOpen(null)} value={bandIdx >= 0 ? String(bandIdx) : ''} options={facets.bands.map((b, i) => ({ value: String(i), label: b.label }))} onPick={(v) => { setBandIdx(v === '' ? -1 : Number(v)); setOpen(null); }} />
    </div>
  );
}

function OptionSheet({ open, title, value, options, onPick, onClose }: { open: boolean; title: string; value: string; options: { value: string; label: string; count?: number }[]; onPick: (v: string) => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ListGroup className="opt-list">
        <ListRow title={`Any ${title.toLowerCase()}`} onClick={() => onPick('')} chevron={false} trailing={value === '' ? <Icon name="check" weight="bold" /> : undefined} />
        {options.map((o) => (
          <ListRow
            key={o.value}
            title={o.label}
            selected={o.value === value}
            onClick={() => onPick(o.value)}
            chevron={false}
            trailing={o.value === value ? <Icon name="check" weight="bold" /> : o.count != null ? <span className="cnt">{o.count}</span> : undefined}
          />
        ))}
      </ListGroup>
    </Sheet>
  );
}
