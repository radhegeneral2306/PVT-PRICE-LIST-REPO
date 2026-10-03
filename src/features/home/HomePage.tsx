import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import type { Category, Factory, Item, Pricelist } from '../../types';
import {
  Avatar, Badge, Chip, Chips, EmptyState, ErrorState, Icon, ListGroup, ListRow, PageContainer,
  SectionTitle, SkeletonRows, formatDate, formatRate, isStale, timeAgo,
} from '../../ui';
import { SourceBadge, lastUpdated } from '../pricelist/parts';
import { useMedia } from './useMedia';
import './home.css';

type CatFilter = 'All' | Category;
const CATS: CatFilter[] = ['All', 'Tiles', 'Sanitaryware', 'Other'];

function greeting(name: string): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

/** Search box that hands over to the Search screen on focus or Enter. */
function SearchLauncher({ placeholder, big, kbd }: { placeholder: string; big?: boolean; kbd?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const go = (value: string) => navigate(value.trim() ? `/search?q=${encodeURIComponent(value.trim())}` : '/search');
  return (
    <div className={`search${big ? ' big' : ''}`} role="search">
      <Icon name="magnifying-glass" />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={q}
        placeholder={placeholder}
        aria-label={placeholder}
        onFocus={() => go(q)}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') go(q); }}
      />
      {kbd ? <span className="home-kbd" aria-hidden="true">/</span> : null}
    </div>
  );
}

export function HomePage() {
  const { ready, factories, pricelists, settings, session, syncStatus, refresh } = useData();
  const desktop = useMedia('(min-width: 1024px)');
  const [cat, setCat] = useState<CatFilter>('All');

  const factoryById = useMemo(() => new Map(factories.map((f) => [f.id, f])), [factories]);
  const current = useMemo(() => pricelists.filter((p) => p.status === 'current'), [pricelists]);

  if (!ready) {
    return (
      <PageContainer wide>
        <div className="page">
          {!desktop ? <div className="home-greet"><div className="hi">&nbsp;</div></div> : null}
          <ListGroup><SkeletonRows count={5} /></ListGroup>
        </div>
      </PageContainer>
    );
  }
  if (factories.length === 0) {
    return (
      <PageContainer>
        <div className="page">
          {syncStatus === 'error' ? (
            <ErrorState message="Could not load your data." onRetry={() => void refresh()} />
          ) : (
            <EmptyState
              icon="factory"
              title="No factories yet"
              text="Add a factory first, then add its pricelist."
              action={<Link to="/factories?add=1" className="btn btn-primary"><Icon name="plus" weight="bold" />Add your first factory</Link>}
            />
          )}
        </div>
      </PageContainer>
    );
  }

  if (desktop) return <DesktopHome factories={factories} pricelists={pricelists} />;

  const recent = current
    .filter((p) => cat === 'All' || p.category === cat)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <PageContainer>
      <div className="page stack-sm">
        <div className="home-greet">
          <div className="hi">{greeting(session?.user.name ?? '')}</div>
          <h1>Radhe General</h1>
        </div>
        <SearchLauncher big placeholder="Search item, size or factory" />
        <Link to="/add" className="btn btn-primary btn-block home-cta" style={{ marginTop: 4 }}>
          <Icon name="plus" weight="bold" />Add pricelist
        </Link>
        <div style={{ marginTop: 6 }}>
          <Chips label="Category">
            {CATS.map((c) => <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
          </Chips>
        </div>
        <SectionTitle action={<Link to="/factories">See all</Link>}>Recently updated</SectionTitle>
        {recent.length === 0 ? (
          <EmptyState icon="tray" title={`No ${cat} pricelists yet`} text="Pick another category or add a pricelist." />
        ) : (
          <ListGroup className="home-list">
            {recent.map((p) => {
              const f = factoryById.get(p.factoryId);
              const stale = isStale(p.effectiveDate, settings.staleWeeks);
              return (
                <ListRow
                  key={p.id}
                  to={`/pricelist/${p.id}`}
                  avatar={f?.name ?? '?'}
                  eyebrow={`${f?.name ?? 'Unknown factory'} · ${timeAgo(p.createdAt)}`}
                  title={p.title}
                  subtitle={<div className="row-meta"><span className="mono">{formatDate(p.effectiveDate)}</span><SourceBadge source={p.source} /></div>}
                  chevron={!stale}
                  trailing={stale ? <Badge tone="warn" icon="warning">Stale</Badge> : undefined}
                />
              );
            })}
          </ListGroup>
        )}
      </div>
    </PageContainer>
  );
}

function DesktopHome({ factories, pricelists }: { factories: Factory[]; pricelists: Pricelist[] }) {
  const { settings } = useData();
  const rows = useMemo(
    () => factories
      .map((f) => ({ f, at: lastUpdated(f, pricelists), n: pricelists.filter((p) => p.factoryId === f.id).length }))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 5),
    [factories, pricelists],
  );
  const [sel, setSel] = useState<string | null>(null);
  const selId = sel && rows.some((r) => r.f.id === sel) ? sel : rows[0]?.f.id ?? null;

  return (
    <PageContainer wide>
      <div className="page">
        <div style={{ paddingTop: 16 }}><SearchLauncher placeholder="Search size, finish or item across all factories" kbd /></div>
        <div className="home-desk">
          <section>
            <h2 className="st">Recently updated</h2>
            <ListGroup>
              {rows.map(({ f, at, n }) => {
                const cur = pricelists.filter((p) => p.factoryId === f.id && p.status === 'current').sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
                const stale = cur ? isStale(cur.effectiveDate, settings.staleWeeks) : false;
                return (
                  <ListRow
                    key={f.id}
                    selected={f.id === selId}
                    onClick={() => setSel(f.id)}
                    avatar={f.name}
                    title={f.name}
                    subtitle={`${f.city} · ${f.category}`}
                    chevron={false}
                    trailing={
                      <div className="dh-right">
                        <div className="a">{timeAgo(at)}</div>
                        {stale ? <Badge tone="warn">Old list</Badge> : <div className="s" style={{ fontSize: 13, color: 'var(--text-2)' }}>{n} lists</div>}
                      </div>
                    }
                  />
                );
              })}
            </ListGroup>
          </section>
          <section style={{ minWidth: 0 }}>
            <h2 className="st">Current pricelist preview</h2>
            {selId ? <Preview factory={factories.find((f) => f.id === selId)!} pricelists={pricelists} /> : null}
          </section>
        </div>
      </div>
    </PageContainer>
  );
}

function Preview({ factory, pricelists }: { factory: Factory; pricelists: Pricelist[] }) {
  const { getItems, session, settings } = useData();
  const cur = pricelists
    .filter((p) => p.factoryId === factory.id && p.status === 'current')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);
  const curId = cur?.id;
  const isItems = cur?.source === 'items';

  useEffect(() => {
    if (!curId || !isItems) { setItems(null); return; }
    let live = true;
    setItems(null); setErr(false);
    getItems(curId).then((r) => { if (live) setItems(r); }, () => { if (live) setErr(true); });
    return () => { live = false; };
  }, [curId, isItems, getItems, tick]);

  if (!cur) {
    return <div className="panel"><EmptyState icon="file-dashed" title="No current pricelist" text={`${factory.name} has no current pricelist yet.`} action={<Link to={`/add?factory=${factory.id}`} className="btn btn-primary">Add pricelist</Link>} /></div>;
  }
  const hideRates = session?.user.role === 'staff' && settings.hideRatesFromStaff;
  const shown = items?.slice(0, 8) ?? [];
  return (
    <>
      <div className="panel">
        <div className="panel-h">
          <Avatar name={factory.name} />
          <div className="grow">
            <h3>{factory.name}</h3>
            <div className="s">{cur.title} {'·'} effective {formatDate(cur.effectiveDate)}{cur.source === 'items' ? ` · ${cur.itemCount} items` : ''}</div>
          </div>
          <Badge tone="ok">Current</Badge>
          <Link to={`/pricelist/${cur.id}`} className="btn btn-sm">Open full list<Icon name="arrow-right" weight="bold" /></Link>
        </div>
        {!isItems ? (
          <EmptyState icon={cur.source === 'pdf' ? 'file-pdf' : 'image'} title={cur.source === 'pdf' ? 'PDF pricelist' : 'Image pricelist'} text="Open the full list to view the file." />
        ) : err ? (
          <ErrorState message="Could not load items." onRetry={() => setTick((t) => t + 1)} />
        ) : !items ? (
          <SkeletonRows count={6} avatar={false} />
        ) : (
          <div className="ptable-wrap">
            <table className="ptable">
              <thead><tr><th>Item</th><th>Size</th><th>Finish</th><th className="r">Rate</th><th>Unit</th></tr></thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>{i.name}</td>
                    <td className="mono">{i.size}</td>
                    <td>{i.finish}</td>
                    <td className="r mono" style={{ fontWeight: 600 }}>{i.rate == null && hideRates ? <span className="faint">Hidden</span> : formatRate(i.rate)}</td>
                    <td style={{ color: 'var(--text-2)' }}>per {i.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {isItems && items ? (
        <div style={{ fontSize: 13, color: 'var(--text-2)', margin: '10px 2px' }}>
          Showing {shown.length} of {items.length} items.{cur.note ? ` ${cur.note}.` : ''}
        </div>
      ) : null}
    </>
  );
}

