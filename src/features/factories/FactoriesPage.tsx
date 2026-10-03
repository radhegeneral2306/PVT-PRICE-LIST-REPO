import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import type { Category } from '../../types';
import {
  Button, Chip, Chips, EmptyState, ErrorState, Icon, IconButton, ListGroup, ListRow, PageContainer, SearchField,
  SkeletonRows, TopBar, timeAgo,
} from '../../ui';
import { CategoryBadge, lastUpdated } from '../pricelist/parts';
import { FactoryFormSheet } from './FactoryForm';
import './factories.css';

type CatFilter = 'All' | Category;
const CATS: CatFilter[] = ['All', 'Tiles', 'Sanitaryware', 'Other'];

export function FactoriesPage() {
  const { ready, factories, pricelists, syncStatus, refresh } = useData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CatFilter>('All');
  const [adding, setAdding] = useState(params.get('add') === '1');

  // /factories?add=1 opens the add sheet (used by the Home empty state).
  useEffect(() => {
    if (params.get('add') === '1') {
      setAdding(true);
      const next = new URLSearchParams(params);
      next.delete('add');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: factories.length, Tiles: 0, Sanitaryware: 0, Other: 0 };
    for (const f of factories) c[f.category] += 1;
    return c;
  }, [factories]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return factories
      .filter((f) => (cat === 'All' || f.category === cat) && (!needle || `${f.name} ${f.city}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({
        f,
        lists: pricelists.filter((p) => p.factoryId === f.id).length,
        at: lastUpdated(f, pricelists),
      }));
  }, [factories, pricelists, q, cat]);

  const addButton = <IconButton icon="plus" weight="bold" label="Add factory" className="add-btn" onClick={() => setAdding(true)} />;

  let body;
  if (!ready) {
    body = syncStatus === 'error'
      ? <ErrorState message="Could not load factories." onRetry={() => void refresh()} />
      : <ListGroup><SkeletonRows count={5} /></ListGroup>;
  } else if (factories.length === 0) {
    body = <EmptyState icon="factory" title="No factories yet" text="Add the factories you buy from." action={<Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add your first factory</Button>} />;
  } else {
    body = (
      <>
        <SearchField value={q} onChange={setQ} placeholder="Search factory or city" />
        <Chips label="Category">
          {CATS.filter((c) => c === 'All' || counts[c] > 0 || cat === c).map((c) => (
            <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>{c}<span className="n">{counts[c]}</span></Chip>
          ))}
        </Chips>
        <div className="count-line">
          {rows.length === 1 ? '1 factory' : `${rows.length} factories`}, sorted by name
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="magnifying-glass" title="No factories found" text="Try another name, city or category." action={<Button onClick={() => { setQ(''); setCat('All'); }}>Clear search</Button>} />
        ) : (
          <ListGroup className="fac-list">
            {rows.map(({ f, lists, at }) => (
              <ListRow
                key={f.id}
                avatar={f.name}
                onClick={() => navigate(`/factories/${f.id}`)}
                title={f.name}
                subtitle={
                  <>
                    <div className="fac-loc">{f.city ? <><Icon name="map-pin" />{f.city}</> : null}</div>
                    <div className="fac-meta"><CategoryBadge category={f.category} /><span>Updated {timeAgo(at).toLowerCase()}</span></div>
                  </>
                }
                chevron={false}
                trailing={<div className="fac-right"><span><span className="mono" style={{ fontWeight: 600, color: 'var(--text)' }}>{lists}</span> {lists === 1 ? 'list' : 'lists'}</span><Icon name="caret-right" className="chev" /></div>}
              />
            ))}
          </ListGroup>
        )}
      </>
    );
  }

  return (
    <>
      <TopBar title="Factories" right={addButton} />
      <PageContainer>
        <div className="page stack-sm">{body}</div>
      </PageContainer>
      <FactoryFormSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
