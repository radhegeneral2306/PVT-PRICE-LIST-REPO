import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Icon } from '../../ui';
import { useAdd } from './AddContext';
import { Frame } from './Frame';
import type { Method } from './state';

const OPTIONS: { value: Method; icon: string; title: string; text: string }[] = [
  { value: 'paste', icon: 'clipboard-text', title: 'Type or paste text', text: 'Paste rates copied from WhatsApp or type them in. We read the rows for you.' },
  { value: 'pdf', icon: 'file-pdf', title: 'Upload PDF', text: 'Keep the PDF as received. Staff can open and share it as is.' },
  { value: 'photo', icon: 'camera', title: 'Photo of list', text: 'Take a photo of a printed list or pick images from the gallery.' },
];

export function MethodStep() {
  const { state, dispatch, factory } = useAdd();
  const navigate = useNavigate();
  const method = state.method;
  useEffect(() => { if (!state.method) dispatch({ type: 'patch', patch: { method: 'paste' } }); }, [state.method, dispatch]);
  const next = () => navigate(method === 'paste' ? '/add/paste' : '/add/upload');

  return (
    <Frame
      step={2}
      label="Choose method"
      heading="How do you have this list?"
      backTo={state.factoryLocked ? null : '/add'}
      actions={
        <>
          <Button onClick={() => (state.factoryLocked ? navigate(-1) : navigate('/add'))}>Back</Button>
          <Button variant="primary" style={{ flex: 2 }} disabled={!method} onClick={next}>
            Continue<Icon name="arrow-right" weight="bold" />
          </Button>
        </>
      }
    >
      <div className="page">
        <div className="add-fac">
          <Avatar name={factory?.name ?? '?'} size="sm" />
          <span>Factory: <b>{factory?.name ?? '...'}</b></span>
        </div>
        <div role="radiogroup" aria-label="How do you have this list?">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={method === o.value}
              className={`add-opt${method === o.value ? ' sel' : ''}`}
              onClick={() => dispatch({ type: 'patch', patch: { method: o.value } })}
            >
              <span className="ic"><Icon name={o.icon} /></span>
              <span className="tx"><span className="t">{o.title}</span><span className="s">{o.text}</span></span>
              <span className="add-radio" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </Frame>
  );
}
