import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionBar, ConfirmDialog, IconButton, PageContainer } from '../../ui';
import { useAdd } from './AddContext';

export interface FrameProps {
  /** 1, 2 or 3 */
  step: 1 | 2 | 3;
  label: string;
  /** Large heading under the step bar. */
  heading?: string;
  /** Where the back arrow goes (null: it leaves the flow and asks before throwing a dirty draft away). */
  backTo: string | null;
  children: ReactNode;
  actions: ReactNode;
}

/** Shared chrome of every step: top bar, 3-step progress, content column and the sticky action bar. */
export function Frame({ step, label, heading, backTo, children, actions }: FrameProps) {
  const navigate = useNavigate();
  const loc = useLocation();
  const { dirty, discard } = useAdd();
  const [confirm, setConfirm] = useState(false);

  const leave = () => {
    discard();
    if (loc.key === 'default') navigate('/', { replace: true });
    else navigate(-1);
  };
  const onBack = () => {
    if (backTo) {
      if (loc.key === 'default') navigate(backTo, { replace: true });
      else navigate(-1);
      return;
    }
    if (dirty) setConfirm(true);
    else leave();
  };

  return (
    <div className="add-flow">
      <header className="topbar add-topbar">
        <IconButton icon={backTo ? 'arrow-left' : 'x'} label={backTo ? 'Back' : 'Close'} onClick={onBack} />
        <h1>Add pricelist</h1>
        <span className="add-sp" aria-hidden="true" />
      </header>
      <PageContainer narrow>
        <div className="add-steps" aria-label={`Step ${step} of 3`}>
          <div className="lab"><span>Step {step} of 3</span><span>{label}</span></div>
          <div className="bar" aria-hidden="true">{[1, 2, 3].map((n) => <i key={n} className={n <= step ? 'on' : ''} />)}</div>
        </div>
        {heading ? <h2 className="add-h2">{heading}</h2> : null}
        <div className="add-body">{children}</div>
      </PageContainer>
      <ActionBar>{actions}</ActionBar>
      <ConfirmDialog
        open={confirm}
        title="Discard this list?"
        message="What you typed or uploaded so far will be thrown away."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); leave(); }}
      />
    </div>
  );
}
