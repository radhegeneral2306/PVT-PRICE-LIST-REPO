import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import { Button, Chip, Chips, Field, Icon, Input, TextArea, formatDate } from '../../ui';
import type { PricelistDraft, SourceType } from '../../types';
import { useAdd } from './AddContext';
import { Frame } from './Frame';
import { CATEGORIES, checkCount, type AddState } from './state';
import { flashToast } from './toast';

const SOURCE: Record<string, { icon: string; label: string; type: SourceType }> = {
  paste: { icon: 'clipboard-text', label: 'Pasted text', type: 'items' },
  pdf: { icon: 'file-pdf', label: 'PDF file', type: 'pdf' },
  photo: { icon: 'camera', label: 'Photos', type: 'image' },
};

function useOnline(): boolean {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

export function ConfirmStep() {
  const { savePricelist, pricelists } = useData();
  const { state, dispatch, factory, defaultTitle, discard } = useAdd();
  const navigate = useNavigate();
  const online = useOnline();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const method = state.method;
  if (!method) return <Navigate to="/add/method" replace />;
  const src = SOURCE[method];
  const isItems = method === 'paste';
  const items = state.rows.map((r) => r.item).filter((i) => i.name.trim());
  const doneFiles = state.files.filter((f) => f.status === 'done' && f.ref);
  const title = state.titleTouched ? state.title : defaultTitle;
  const toCheck = isItems ? checkCount(state.rows.filter((r) => r.item.name.trim())) : 0;
  const hasContent = isItems ? items.length > 0 : doneFiles.length > 0 && doneFiles.length === state.files.length;
  const needsNet = !isItems && !online;
  const valid = !!factory && title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(state.date) && hasContent && !needsNet;

  const previous = factory
    ? pricelists.find((p) => p.status === 'current' && p.factoryId === factory.id && p.category === state.category)
    : undefined;
  const prevLabel = previous ? formatDate(previous.effectiveDate).slice(3) : '';

  const save = async () => {
    if (!valid || !factory) return;
    setSaving(true); setError('');
    const draft: PricelistDraft = {
      factoryId: factory.id,
      title: title.trim(),
      category: state.category,
      effectiveDate: state.date,
      source: src.type,
      files: isItems ? [] : doneFiles.map((f) => f.ref!),
      note: state.note.trim(),
      items: isItems ? items.map((i) => ({ ...i, name: i.name.trim() })) : [],
    };
    try {
      const saved = await savePricelist(draft);
      discard();
      flashToast('Pricelist saved');
      navigate(`/pricelist/${saved.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not save the pricelist. Your list is kept, please try again.');
      setSaving(false);
    }
  };

  const back = isItems ? '/add/paste' : '/add/upload';
  const patch = (p: Partial<AddState>) => dispatch({ type: 'patch', patch: p });

  return (
    <Frame
      step={3}
      label="Confirm"
      backTo={back}
      actions={
        <>
          <Button disabled={saving} onClick={() => navigate(-1)}>Back</Button>
          <Button variant="primary" style={{ flex: 2 }} icon="check" loading={saving} disabled={!valid} onClick={() => void save()}>Save pricelist</Button>
        </>
      }
    >
      <div className="page">
        <div className="list add-sumc">
          <div className="row"><span className="k">Factory</span><span className="v">{factory?.name ?? '...'}</span></div>
          <div className="row"><span className="k">Source</span><span className="v"><Icon name={src.icon} />{src.label}</span></div>
          <div className="row">
            <span className="k">{isItems ? 'Items' : 'Files'}</span>
            <span className="v mono">{isItems ? items.length : doneFiles.length}</span>
            {toCheck ? <span className="badge warn" style={{ marginLeft: 'auto' }}>{toCheck} to check</span> : null}
          </div>
        </div>

        <Input label="Pricelist title" value={title} onChange={(e) => patch({ title: e.target.value, titleTouched: true })} autoComplete="off" />

        <div className="field">
          <label htmlFor="add-date">Effective date</label>
          <div className="add-date input">
            <span className="tx">{formatDate(state.date) || 'Choose a date'}</span>
            <Icon name="calendar-blank" />
            <input
              id="add-date"
              type="date"
              value={state.date}
              onChange={(e) => e.target.value && patch({ date: e.target.value })}
              onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* not supported */ } }}
            />
          </div>
        </div>

        <Field label="Category">
          <Chips label="Category">
            {CATEGORIES.map((c) => <Chip key={c} selected={state.category === c} onClick={() => patch({ category: c, categoryTouched: true })}>{c}</Chip>)}
          </Chips>
        </Field>

        <TextArea label="Note (optional)" value={state.note} onChange={(e) => patch({ note: e.target.value })} placeholder="For example: Rates ex-factory, GST extra" />

        {previous ? (
          <div className="add-info"><Icon name="clock-counter-clockwise" /><span>Previous list ({prevLabel}) will move to History. You can still open it anytime.</span></div>
        ) : null}
        {needsNet ? (
          <div className="add-info warn"><Icon name="wifi-slash" /><span>You are offline. Saving a PDF or photos needs internet. Connect and try again.</span></div>
        ) : null}
        {!isItems && state.files.length > doneFiles.length ? (
          <div className="add-info warn"><Icon name="warning" /><span>Some files have not finished uploading. Go back to fix them.</span></div>
        ) : null}
        {error ? <div className="error-text" role="alert" style={{ marginTop: 12 }}>{error}</div> : null}
      </div>
    </Frame>
  );
}
