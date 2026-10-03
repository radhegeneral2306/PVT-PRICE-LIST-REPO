import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import type { Pricelist } from '../../types';
import {
  Badge, Button, EmptyState, ErrorState, Icon, IconButton, ListGroup, ListRow, PageContainer, SectionTitle, Sheet,
  Skeleton, SkeletonRows, TopBar, formatDate,
} from '../../ui';
import { CategoryBadge, SourceBadge, phoneDigits, sizeLabel, sourceIcon } from '../pricelist/parts';
import { CompareSheet } from './CompareSheet';
import { FactoryFormSheet } from './FactoryForm';
import './factories.css';

const byNewest = (a: Pricelist, b: Pricelist) => b.effectiveDate.localeCompare(a.effectiveDate) || b.createdAt.localeCompare(a.createdAt);

export function FactoryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { ready, factories, pricelists, syncStatus, refresh } = useData();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [comparing, setComparing] = useState(false);

  const factory = factories.find((f) => f.id === id);
  const mine = useMemo(() => pricelists.filter((p) => p.factoryId === id), [pricelists, id]);
  const current = useMemo(() => mine.filter((p) => p.status === 'current').sort(byNewest), [mine]);
  const history = useMemo(() => mine.filter((p) => p.status === 'archived').sort(byNewest), [mine]);

  // Compare: a current items list plus the newest archived items list of the same category.
  const pair = useMemo(() => {
    for (const cur of current) {
      if (cur.source !== 'items') continue;
      const prev = history.find((h) => h.source === 'items' && h.category === cur.category);
      if (prev) return { cur, prev };
    }
    return null;
  }, [current, history]);

  const bar = (right?: ReactNode) => <TopBar backTo="/factories" title="Factory" right={right} />;

  if (!ready) {
    return (
      <>
        {bar()}
        <PageContainer>
          <div className="page stack">
            {syncStatus === 'error' ? <ErrorState message="Could not load this factory." onRetry={() => void refresh()} /> : (
              <>
                <div className="row-flex"><Skeleton width={52} height={52} radius={16} /><div className="grow stack-sm"><Skeleton width="60%" height={18} /><Skeleton width="40%" height={12} /></div></div>
                <Skeleton height={76} radius={16} />
                <SkeletonRows count={3} />
              </>
            )}
          </div>
        </PageContainer>
      </>
    );
  }
  if (!factory) {
    return (
      <>
        {bar()}
        <PageContainer><div className="page"><EmptyState icon="factory" title="Factory not found" text="It may have been removed." action={<Link to="/factories" className="btn">Back to factories</Link>} /></div></PageContainer>
      </>
    );
  }

  const digits = phoneDigits(factory.phone);
  const hasContact = !!(factory.contactName || digits);

  return (
    <>
      {bar(<IconButton icon="dots-three-vertical" label="More actions" onClick={() => setMenu(true)} />)}
      <PageContainer>
        <div className="page stack-sm">
          <div className="fd-head">
            <div className="avatar">{(factory.name.trim()[0] ?? '?').toUpperCase()}</div>
            <div className="grow">
              <h2>{factory.name}</h2>
              <div className="s">
                <CategoryBadge category={factory.category} />
                {factory.city ? <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="map-pin" />{factory.city}</span> : null}
                <span>{mine.length} {mine.length === 1 ? 'list' : 'lists'}</span>
              </div>
            </div>
          </div>

          {hasContact ? (
            <div className="fd-contact">
              <div className="grow">
                <div className="lbl">Contact person</div>
                {factory.contactName ? <div className="nm">{factory.contactName}</div> : null}
                {digits ? <div className="num mono">+91 {factory.phone.trim()}</div> : null}
              </div>
              {digits ? (
                <>
                  <a className="fd-act call" href={`tel:+91${digits}`} aria-label={`Call ${factory.contactName || factory.name}`}><Icon name="phone-call" weight="bold" /></a>
                  <a className="fd-act wa" href={`https://wa.me/91${digits}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${factory.contactName || factory.name}`}><Icon name="whatsapp-logo" weight="fill" /></a>
                </>
              ) : null}
            </div>
          ) : (
            <Button icon="user-plus" onClick={() => setEditing(true)}>Add contact details</Button>
          )}
          {factory.notes ? <div className="fd-notes">{factory.notes}</div> : null}

          <SectionTitle>Current pricelist</SectionTitle>
          {current.length === 0 ? (
            <div className="fd-none">No current pricelist yet.</div>
          ) : (
            <div>
              {current.map((p) => (
                <div className="fd-cur" key={p.id}>
                  {current.length > 1 ? <div className="top">{p.category}</div> : null}
                  <h3 style={current.length > 1 ? undefined : { marginTop: 0 }}>{p.title}</h3>
                  <div className="facts">
                    <SourceBadge source={p.source} plain />
                    <span><b className="mono">{sizeLabel(p).split(' ')[0]}</b> {sizeLabel(p).split(' ')[1]}</span>
                    <span>From <b className="mono">{formatDate(p.effectiveDate)}</b></span>
                  </div>
                  {p.note ? <div className="note"><Icon name="note" />{p.note}</div> : null}
                  <Link to={`/pricelist/${p.id}`} className="btn btn-primary btn-block"><Icon name="arrow-square-out" weight="bold" />Open</Link>
                </div>
              ))}
            </div>
          )}

          <SectionTitle action={history.length ? <span style={{ fontWeight: 500 }}>{history.length} older {history.length === 1 ? 'list' : 'lists'}</span> : undefined}>History</SectionTitle>
          {history.length === 0 ? (
            <div className="fd-none">Older lists will show here after you add a newer one.</div>
          ) : (
            <ListGroup className="fd-hist">
              {history.map((p) => (
                <ListRow
                  key={p.id}
                  to={`/pricelist/${p.id}`}
                  leading={<div className="fd-src"><Icon name={sourceIcon(p.source)} /></div>}
                  title={p.title}
                  subtitle={<div className="fd-meta"><span className="mono">{formatDate(p.effectiveDate)}</span><span>{sizeLabel(p)}</span></div>}
                  chevron={false}
                  trailing={<Badge>Archived</Badge>}
                />
              ))}
            </ListGroup>
          )}

          <Link to={`/add?factory=${factory.id}`} className="btn btn-primary btn-block" style={{ marginTop: 12 }}><Icon name="plus" weight="bold" />Add pricelist for this factory</Link>
          <Button block icon="arrows-left-right" disabled={!pair} onClick={() => setComparing(true)}>Compare with previous</Button>
          {!pair ? <div className="help" style={{ textAlign: 'center' }}>Compare needs a current and an older list typed as items.</div> : null}
        </div>
      </PageContainer>

      <Sheet open={menu} onClose={() => setMenu(false)} title={factory.name}>
        <ListGroup className="menu-list">
          <ListRow leading={<Icon name="pencil-simple" />} title="Edit factory details" chevron onClick={() => { setMenu(false); setEditing(true); }} />
          <ListRow leading={<Icon name="plus" />} title="Add pricelist" chevron onClick={() => navigate(`/add?factory=${factory.id}`)} />
        </ListGroup>
      </Sheet>
      <FactoryFormSheet open={editing} onClose={() => setEditing(false)} factory={factory} />
      {pair ? <CompareSheet open={comparing} onClose={() => setComparing(false)} current={pair.cur} previous={pair.prev} /> : null}
    </>
  );
}
