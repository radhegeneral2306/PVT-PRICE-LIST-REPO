import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import type { Category, SearchHit, Unit } from '../../types';
import { Badge, Button, Chip, ErrorState, Icon, ListGroup, ListRow, PageContainer, SectionTitle, SearchField, SkeletonRows, TopBar, formatRupee, isStale, timeAgo } from '../../ui';
import './search.css';
import {
  addRecent, buildIndex, compareStats, diffVsLowest, formatDiff, isLowest, loadRecent, matchesHeader, parseQuery, saveRecent, searchIndex, sortHits,
  type CompareStats, type RecentSearch, type ScoredHit, type SortDir, type SortKey,
} from './searchEngine';

const EXAMPLES = ['600x1200 glossy', 'wall hung WC', '800x800 matt'];
const CATEGORIES: Category[] = ['Tiles', 'Sanitaryware', 'Other'];
const UNITS: { value: Unit; label: string }[] = [
  { value: 'sqft', label: 'Per sqft' },
  { value: 'box', label: 'Per box' },
  { value: 'pc', label: 'Per pc' },
];
const CAP = 200;
const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: 'factory', label: 'Factory' },
  { key: 'item', label: 'Item' },
  { key: 'size', label: 'Size' },
  { key: 'finish', label: 'Finish' },
  { key: 'rate', label: 'Rate', right: true },
  { key: 'unit', label: 'Unit' },
  { key: 'updated', label: 'Updated' },
];

function useDesktop(): boolean {
  const q = '(min-width: 1024px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

interface RowCtx {
  stats: CompareStats;
  staffHidden: boolean;
  staleWeeks: number;
  open: (h: SearchHit) => void;
}

function rateText(h: SearchHit, ctx: RowCtx): string {
  const r = h.item.rate;
  return r == null ? (ctx.staffHidden ? 'Rate hidden' : '-') : formatRupee(r);
}

function PhoneRow({ row, ctx }: { row: ScoredHit; ctx: RowCtx }) {
  const h = row.hit;
  const best = isLowest(h, ctx.stats);
  const stale = isStale(h.pricelist.effectiveDate, ctx.staleWeeks);
  const diff = diffVsLowest(h, ctx.stats);
  const meta = [h.item.size, h.item.finish].filter(Boolean).join(' · ');
  const rated = h.item.rate != null;
  return (
    <a
      className={`row sr-card${best ? ' best' : ''}`}
      href={`#/pricelist/${h.pricelist.id}`}
      onClick={(e) => { e.preventDefault(); ctx.open(h); }}
    >
      <div className="grow">
        <div className="f">
          {h.factory.name}
          {best ? <Badge tone="ok" icon="check">Lowest</Badge> : null}
          {stale ? <Badge tone="warn" icon="warning">Old list</Badge> : null}
        </div>
        <div className="n">{h.item.name}</div>
        {meta ? <div className="m">{meta}</div> : null}
        <div className={`u${stale ? ' old' : ''}`}>Updated {timeAgo(h.pricelist.createdAt).toLowerCase()}</div>
      </div>
      <div className="rt">
        {rated ? (
          <div className="p mono">{formatRupee(h.item.rate as number)}<small>/{h.item.unit}</small></div>
        ) : (
          <div className="p none">{rateText(h, ctx)}</div>
        )}
        <div className="d mono">{diff != null && !best ? formatDiff(diff) : ''}</div>
      </div>
    </a>
  );
}

function DesktopTable({ rows, ctx, sort, onSort }: { rows: ScoredHit[]; ctx: RowCtx; sort: { key: SortKey; dir: SortDir }; onSort: (k: SortKey) => void }) {
  return (
    <div className="sr-panel">
      <table className="sr-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => {
              const on = sort.key === c.key;
              return (
                <th key={c.key} className={`${c.right ? 'r' : ''}${on ? ' on' : ''}`} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => onSort(c.key)}>
                    {c.label}
                    <Icon name={on ? (sort.dir === 'asc' ? 'caret-up' : 'caret-down') : 'caret-up-down'} weight="bold" className={on ? '' : 'faint'} />
                  </button>
                </th>
              );
            })}
            <th className="r">Vs lowest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const h = r.hit;
            const best = isLowest(h, ctx.stats);
            const stale = isStale(h.pricelist.effectiveDate, ctx.staleWeeks);
            const diff = diffVsLowest(h, ctx.stats);
            return (
              <tr
                key={h.item.id}
                className={best ? 'best' : stale ? 'stale' : ''}
                tabIndex={0}
                onClick={() => ctx.open(h)}
                onKeyDown={(e) => { if (e.key === 'Enter') ctx.open(h); }}
              >
                <td style={{ fontWeight: 600 }}>{h.factory.name}</td>
                <td>{h.item.name}</td>
                <td className="mono">{h.item.size || '-'}</td>
                <td>{h.item.finish || '-'}</td>
                <td className="r mono rate" style={{ fontWeight: 600, fontSize: 15 }}>{rateText(h, ctx)}</td>
                <td style={{ color: 'var(--text-2)' }}>{h.item.unit === 'sqft' ? 'per sqft' : `per ${h.item.unit}`}</td>
                <td className={stale ? 'old' : ''}>
                  {timeAgo(h.pricelist.createdAt)}
                  {stale ? <> <span className="badge warn" style={{ marginLeft: 6 }}>Old list</span></> : null}
                </td>
                <td className="r mono">{best ? <span className="badge ok">Lowest</span> : diff != null ? formatDiff(diff) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SearchPage() {
  const data = useData();
  const { ready, pricelists, settings, session, getAllCurrentItems } = data;
  const navigate = useNavigate();
  const desktop = useDesktop();
  const [params, setParams] = useSearchParams();
  const urlQ = params.get('q') ?? '';

  const [text, setText] = useState(urlQ);
  const [query, setQuery] = useState(urlQ);
  const written = useRef(urlQ);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [factoryId, setFactoryId] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'rate', dir: 'asc' });
  const [shown, setShown] = useState(CAP);
  const [recent, setRecent] = useState<RecentSearch[]>(() => loadRecent());

  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Load all current items (cached by the store, so this also works offline).
  const role = session?.user.role;
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setError(null);
    getAllCurrentItems().then(
      (r) => { if (alive) setHits(r); },
      (e: unknown) => { if (alive) setError(e instanceof Error ? e.message : 'Could not load pricelists.'); },
    );
    return () => { alive = false; };
  }, [ready, pricelists, role, attempt, getAllCurrentItems]);

  // Debounce typing into the query and the URL (replace, not push).
  useEffect(() => {
    if (text === query) return;
    const id = window.setTimeout(() => setQuery(text), 150);
    return () => window.clearTimeout(id);
  }, [text, query]);
  useEffect(() => {
    if (query === written.current) return;
    written.current = query;
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (query) n.set('q', query); else n.delete('q');
      return n;
    }, { replace: true });
  }, [query, setParams]);
  // Follow external URL changes (e.g. a link from Home with ?q=).
  useEffect(() => {
    if (urlQ !== written.current) {
      written.current = urlQ;
      setText(urlQ);
      setQuery(urlQ);
    }
  }, [urlQ]);

  const index = useMemo(() => (hits ? buildIndex(hits) : []), [hits]);
  const parsed = useMemo(() => parseQuery(query), [query]);
  const searching = parsed.tokens.length > 0 || parsed.units.length > 0;
  const results = useMemo(
    () => (searching ? searchIndex(index, query, { categories, units, factoryId: factoryId || undefined }) : []),
    [index, query, searching, categories, units, factoryId],
  );
  const sorted = useMemo(() => sortHits(results, sort.key, sort.dir), [results, sort]);
  const stats = useMemo(() => compareStats(results), [results]);
  const factories = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of hits ?? []) m.set(h.factory.id, h.factory.name);
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [hits]);

  useEffect(() => { setShown(CAP); }, [query, categories, units, factoryId, sort]);

  const remember = useCallback((q: string) => {
    if (!q.trim()) return;
    setRecent((cur) => {
      const next = addRecent(cur, q);
      saveRecent(next);
      return next;
    });
  }, []);

  const fill = (q: string) => { setText(q); setQuery(q); };
  const open = useCallback((h: SearchHit) => { remember(query); navigate(`/pricelist/${h.pricelist.id}`); }, [remember, navigate, query]);
  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const staffHidden = role === 'staff';
  const ctx: RowCtx = { stats, staffHidden, staleWeeks: settings.staleWeeks, open };
  const visible = sorted.slice(0, shown);
  const sortLabel = sort.key === 'rate' ? (sort.dir === 'asc' ? 'Sorted by lowest rate' : 'Sorted by highest rate') : `Sorted by ${sort.key}`;
  const unitWord = stats.unit === 'sqft' ? 'sqft' : stats.unit;

  let body;
  if (error) {
    body = <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />;
  } else if (!ready || hits === null) {
    body = <div className="list" style={{ marginTop: 16 }}><SkeletonRows count={5} avatar={false} /></div>;
  } else if (!searching) {
    body = (
      <>
        <div className="sr-empty">
          <div className="ic"><Icon name="scales" /></div>
          <h2>Compare rates across factories</h2>
          <p>Type a size, finish or item and see every factory's rate side by side, lowest first.</p>
        </div>
        <div className="sr-ex">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => fill(e)}>
              <Icon name="magnifying-glass" />{e}<Icon name="arrow-up-left" />
            </button>
          ))}
        </div>
        {recent.length > 0 ? (
          <>
            <SectionTitle action={<button type="button" onClick={() => { setRecent([]); saveRecent([]); }}>Clear</button>}>Recent searches</SectionTitle>
            <ListGroup className="sr-rec">
              {recent.map((r) => (
                <ListRow key={r.q} leading={<Icon name="clock-counter-clockwise" />} title={r.q} chevron={false} onClick={() => fill(r.q)} trailing={<span className="when mono">{timeAgo(r.at)}</span>} />
              ))}
            </ListGroup>
          </>
        ) : null}
      </>
    );
  } else {
    body = (
      <>
        <div className="sr-filters" role="group" aria-label="Filters">
          {CATEGORIES.map((c) => <Chip key={c} selected={categories.includes(c)} onClick={() => setCategories(toggle(categories, c))}>{c}</Chip>)}
          {UNITS.map((u) => <Chip key={u.value} selected={units.includes(u.value)} onClick={() => setUnits(toggle(units, u.value))}>{u.label}</Chip>)}
          <select className="sr-fsel" aria-label="Factory" value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
            <option value="">Any factory</option>
            {factories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        {results.length === 0 ? (
          <div style={{ marginTop: 16 }}>
            <div className="state">
              <div className="state-icon"><Icon name="magnifying-glass" /></div>
              <h2>No matches</h2>
              <p>Nothing in the current pricelists matches "{query.trim()}".</p>
              <ul className="sr-tips">
                <li>Try a shorter search, like just the size.</li>
                <li>Write sizes as 600x1200 or 600 x 1200.</li>
                {categories.length + units.length > 0 || factoryId ? <li>Switch off some filters above.</li> : null}
              </ul>
              {categories.length + units.length > 0 || factoryId ? (
                <Button variant="secondary" onClick={() => { setCategories([]); setUnits([]); setFactoryId(''); }}>Clear filters</Button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="sr-res-h"><b>{matchesHeader(results.length, stats.factoryCount)}</b><span>{desktop ? 'Current pricelists only' : sortLabel}</span></div>
            {desktop ? (
              <DesktopTable rows={visible} ctx={ctx} sort={sort} onSort={onSort} />
            ) : (
              <div className="list">{visible.map((r) => <PhoneRow key={r.hit.item.id} row={r} ctx={ctx} />)}</div>
            )}
            {sorted.length > shown ? (
              <div className="sr-more"><Button variant="secondary" onClick={() => setShown((n) => n + CAP)}>Show more ({sorted.length - shown} left)</Button></div>
            ) : null}
            {stats.lowest && !staffHidden ? (
              <div className="sr-sum">
                <Icon name="info" weight="fill" />
                <span>
                  Lowest is <b className="mono" style={{ color: 'var(--text)' }}>{formatRupee(stats.lowestRate as number)}</b> at {stats.lowest.factory.name}.
                  {stats.highestDiff != null ? <> Highest is <b className="mono" style={{ color: 'var(--text)' }}>{formatRupee(stats.highestDiff)}</b> more per {unitWord}.</> : null}
                  {' '}Rates ex-factory, GST extra.
                </span>
              </div>
            ) : null}
          </>
        )}
      </>
    );
  }

  return (
    <>
      {desktop ? null : <TopBar title="Search" />}
      <PageContainer wide>
        <div className="page sr-wrap">
          <div className="sr-search">
            {!searching && !text ? <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-2)' }}>Search all pricelists</div> : null}
            <SearchField
              value={text}
              onChange={setText}
              placeholder="Size, finish or item name"
              label="Search all pricelists"
              autoFocus={!urlQ}
              onSubmit={() => { setQuery(text); remember(text); }}
            />
          </div>
          {body}
        </div>
      </PageContainer>
    </>
  );
}
