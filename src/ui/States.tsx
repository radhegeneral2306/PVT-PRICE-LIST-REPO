import type { CSSProperties, ReactNode } from 'react';
import { useData } from '../store/DataContext';
import { Button } from './Buttons';
import { Icon } from './Icon';

export function Skeleton({ width, height = 14, radius, style }: { width?: number | string; height?: number | string; radius?: number | string; style?: CSSProperties }) {
  return <span className="skeleton" aria-hidden="true" style={{ width: width ?? '100%', height, borderRadius: radius, ...style }} />;
}

/** Placeholder list rows (avatar + two lines). Wrap in ListGroup. */
export function SkeletonRows({ count = 5, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className="skel-row" key={i}>
          {avatar ? <Skeleton width={40} height={40} radius={12} /> : null}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="55%" height={14} />
            <Skeleton width="35%" height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: string;
  title: string;
  text?: ReactNode;
  /** Usually a Button. */
  action?: ReactNode;
}

export function EmptyState({ icon = 'tray', title, text, action }: EmptyStateProps) {
  return (
    <div className="state">
      <div className="state-icon"><Icon name={icon} /></div>
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', title = 'Could not load', onRetry }: { message?: ReactNode; title?: string; onRetry?: () => void }) {
  return (
    <div className="state error" role="alert">
      <div className="state-icon"><Icon name="warning-circle" /></div>
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry ? <Button icon="arrow-clockwise" onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}

/** Top-of-app status strip. Renders nothing when online, synced and nothing queued. */
export function OfflineBanner() {
  const { syncStatus, pendingWrites } = useData();
  const pending = pendingWrites ?? 0;
  const waiting = `${pending} ${pending === 1 ? 'change' : 'changes'} waiting to sync`;
  let text: string | null = null;
  let icon = 'cloud-slash';
  let cls = 'banner';
  if (syncStatus === 'offline') text = pending > 0 ? `Offline, showing saved data. ${waiting}` : 'Offline, showing saved data';
  else if (syncStatus === 'syncing') { text = 'Syncing'; icon = 'arrows-clockwise'; cls += ' syncing'; }
  else if (pending > 0) { text = waiting; icon = 'clock'; }
  else if (syncStatus === 'error') { text = 'Could not sync. Showing saved data'; icon = 'warning'; }
  if (!text) return null;
  return <div className={cls} role="status"><Icon name={icon} weight="bold" />{text}</div>;
}
