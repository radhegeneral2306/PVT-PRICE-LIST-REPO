import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import { Avatar, Button, Icon, ListGroup, ListRow, SearchField, SkeletonRows } from '../../ui';
import { useAdd } from './AddContext';
import { Frame } from './Frame';
import { NewFactorySheet } from './NewFactorySheet';

export function FactoryStep() {
  const { factories, ready } = useData();
  const { state, selectFactory } = useAdd();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const sorted = [...factories].sort((a, b) => a.name.localeCompare(b.name));
    return needle ? sorted.filter((f) => `${f.name} ${f.city}`.toLowerCase().includes(needle)) : sorted;
  }, [factories, q]);

  return (
    <Frame
      step={1}
      label="Choose factory"
      heading="Which factory is this for?"
      backTo={null}
      actions={
        <Button variant="primary" disabled={!state.factoryId} onClick={() => navigate('/add/method')}>
          Continue<Icon name="arrow-right" weight="bold" />
        </Button>
      }
    >
      <div className="page stack">
        <SearchField value={q} onChange={setQ} placeholder="Search factories" />
        <ListGroup>
          {!ready && factories.length === 0 ? <SkeletonRows count={4} /> : null}
          {list.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={state.factoryId === f.id}
              className={`row add-factory${state.factoryId === f.id ? ' sel' : ''}`}
              onClick={() => selectFactory(f)}
            >
              <Avatar name={f.name} />
              <div className="grow">
                <div className="t">{f.name}</div>
                <div className="s">{[f.city, f.category].filter(Boolean).join(' · ')}</div>
              </div>
              <span className="add-radio" aria-hidden="true" />
            </button>
          ))}
          {ready && q.trim() && list.length === 0 ? (
            <div className="add-nomatch muted">No factory matches &ldquo;{q.trim()}&rdquo;.</div>
          ) : null}
          <ListRow
            leading={<div className="avatar add-plus"><Icon name="plus" weight="bold" /></div>}
            title={<span style={{ color: 'var(--accent)' }}>New factory</span>}
            subtitle="Add a factory that is not listed"
            onClick={() => setCreating(true)}
          />
        </ListGroup>
      </div>
      <NewFactorySheet
        open={creating}
        onClose={() => setCreating(false)}
        initialName={q.trim()}
        onCreated={(f) => { selectFactory(f); setCreating(false); setQ(''); }}
      />
    </Frame>
  );
}
