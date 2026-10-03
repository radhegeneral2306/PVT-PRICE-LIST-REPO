import { useEffect, useState } from 'react';
import { Button, Input, Select, Sheet } from '../../ui';
import type { Unit } from '../../types';
import { UNITS, emptyItem, newKey, rowIssues, type DraftRow } from './state';

/** Edit one row (or create a manual one when `row` is null and `open` is true). */
export function RowSheet({ open, row, onClose, onSave, onDelete }: {
  open: boolean;
  row: DraftRow | null;
  onClose: () => void;
  onSave: (row: DraftRow) => void;
  onDelete: (key: string) => void;
}) {
  const [item, setItem] = useState(emptyItem());
  const [rate, setRate] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    const it = row?.item ?? emptyItem();
    setItem(it);
    setRate(it.rate == null ? '' : String(it.rate));
    setErr('');
  }, [open, row]);

  const set = (k: keyof typeof item) => (e: { target: { value: string } }) => setItem((p) => ({ ...p, [k]: e.target.value }));

  const save = () => {
    const r = rate.trim().replace(/,/g, '');
    const n = r === '' ? null : Number(r);
    if (n !== null && (!Number.isFinite(n) || n < 0)) { setErr('Please enter the rate as a number, for example 38.5'); return; }
    if (!item.name.trim()) { setErr('Please enter the item name.'); return; }
    const clean = { ...item, name: item.name.trim(), size: item.size.trim(), finish: item.finish.trim(), thickness: item.thickness.trim(), boxPcs: item.boxPcs.trim(), rate: n };
    const issues = rowIssues(clean);
    onSave({
      key: row?.key ?? newKey('r'),
      raw: row?.raw ?? '',
      manual: row?.manual ?? true,
      edited: true,
      item: clean,
      confidence: issues.length ? 'check' : 'ok',
      issues,
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={row ? 'Edit row' : 'Add row'}
      footer={
        <>
          {row ? <Button variant="danger" icon="trash" onClick={() => onDelete(row.key)}>Delete</Button> : <Button onClick={onClose}>Cancel</Button>}
          <Button variant="primary" onClick={save}>{row ? 'Done' : 'Add row'}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        {row?.raw ? <p className="help" style={{ marginBottom: 12 }}>Read from: {row.raw}</p> : null}
        <Input label="Item name" value={item.name} onChange={set('name')} autoComplete="off" />
        <div className="add-grid2">
          <Input label="Size" value={item.size} onChange={set('size')} placeholder="600x1200" autoComplete="off" />
          <Input label="Finish" value={item.finish} onChange={set('finish')} placeholder="Glossy" autoComplete="off" />
          <Input label="Thickness" value={item.thickness} onChange={set('thickness')} placeholder="9 mm" autoComplete="off" />
          <Input label="Pieces per box" value={item.boxPcs} onChange={set('boxPcs')} placeholder="2 pcs" autoComplete="off" />
          <Select label="Unit" value={item.unit} onChange={(e) => setItem((p) => ({ ...p, unit: e.target.value as Unit }))}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
          <Input label="Rate (INR)" value={rate} onChange={(e) => { setRate(e.target.value); setErr(''); }} inputMode="decimal" placeholder="38.50" autoComplete="off" />
        </div>
        {err ? <div className="error-text" role="alert">{err}</div> : null}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
