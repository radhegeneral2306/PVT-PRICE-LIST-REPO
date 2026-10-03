import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icon, TextArea } from '../../ui';
import { useAdd } from './AddContext';
import { Frame } from './Frame';
import { RowSheet } from './RowSheet';
import { type DraftRow } from './state';

function fmtRate(n: number | null): string {
  return n == null ? '' : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PasteStep() {
  const { state, dispatch, setText } = useAdd();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<DraftRow | null>(null);
  const [adding, setAdding] = useState(false);
  const rows = state.rows;
  const flagged = rows.filter((r) => r.confidence === 'check').length;
  const total = rows.length;

  return (
    <Frame
      step={2}
      label="Paste text"
      backTo="/add/method"
      actions={
        <>
          <Button onClick={() => navigate(-1)}>Back</Button>
          <Button variant="primary" style={{ flex: 2 }} disabled={total === 0} onClick={() => navigate('/add/confirm')}>
            Review and save<Icon name="arrow-right" weight="bold" />
          </Button>
        </>
      }
    >
      <div className="page">
        <div className="add-tah">
          <label htmlFor="add-text">Pasted text</label>
          {state.text ? <button type="button" onClick={() => setText('')}><Icon name="trash" />Clear</button> : null}
        </div>
        <TextArea
          id="add-text"
          className="add-ta"
          value={state.text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Paste the list here, one item per line, for example:\nCalacatta Gold 600x1200 glossy 38.5/sqft'}
          spellCheck={false}
          autoCapitalize="off"
          rows={8}
        />

        <div className="add-sum">
          <Icon name="check-circle" weight="fill" className="ok" />
          <b>{total === 0 ? 'No rows yet' : `${total - flagged} of ${total} rows read`}</b>
          {flagged ? <span className="badge warn"><Icon name="warning" weight="bold" />{flagged} to check</span> : null}
        </div>

        {total === 0 ? (
          <p className="help" style={{ marginBottom: 12 }}>Rows appear here as you paste. You can also add them one by one.</p>
        ) : (
          <div className="add-pv">
            <div className="hd"><span>Item</span><span>Size</span><span>Finish</span><span style={{ textAlign: 'right' }}>Rate</span><span>Unit</span></div>
            {rows.map((r) => {
              const warn = r.confidence === 'check';
              return (
                <button key={r.key} type="button" className={`pr${warn ? ' flag' : ''}`} onClick={() => setEditing(r)} aria-label={`Edit ${r.item.name || 'row'}`}>
                  <div className="c n">{r.item.name || <span className="faint">No name</span>}</div>
                  <div className="c">{r.item.size}</div>
                  <div className="c fin">{r.item.finish}</div>
                  {r.item.rate == null ? <div className="c r chk">Check rate</div> : <div className="c r">{fmtRate(r.item.rate)}</div>}
                  <div className="u">{r.item.unit}</div>
                  {warn ? <div className="warnline"><Icon name="warning" weight="bold" />{r.issues[0] ?? 'Please check this row'}</div> : null}
                </button>
              );
            })}
          </div>
        )}

        <div className="add-addrow">
          <Button icon="plus" onClick={() => setAdding(true)}>Add row</Button>
        </div>

        {state.skipped.length ? (
          <details className="add-skipped">
            <summary>{state.skipped.length} {state.skipped.length === 1 ? 'line' : 'lines'} skipped</summary>
            <ul>
              {state.skipped.map((s) => <li key={s.line}><span className="mono">{s.raw}</span><span className="faint"> ({s.reason})</span></li>)}
            </ul>
          </details>
        ) : null}
      </div>

      <RowSheet
        open={!!editing || adding}
        row={editing}
        onClose={() => { setEditing(null); setAdding(false); }}
        onSave={(row) => { dispatch({ type: 'upsertRow', row }); setEditing(null); setAdding(false); }}
        onDelete={(key) => { dispatch({ type: 'deleteRow', key }); setEditing(null); }}
      />
    </Frame>
  );
}

