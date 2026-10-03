import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

export function Avatar({ name, size, className }: { name: string; size?: 'sm' | 'lg'; className?: string }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return <div className={`avatar${size ? ' ' + size : ''}${className ? ' ' + className : ''}`} aria-hidden="true">{initial}</div>;
}

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger';

export function Badge({ tone = 'neutral', icon, children }: { tone?: BadgeTone; icon?: string; children: ReactNode }) {
  return <span className={`badge${tone === 'neutral' ? '' : ' ' + tone}`}>{icon ? <Icon name={icon} weight="bold" /> : null}{children}</span>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="section-title"><h2 style={{ font: 'inherit', letterSpacing: 'inherit' }}>{children}</h2>{action}</div>;
}

/** Rounded grouped container for ListRows. */
export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`list${className ? ' ' + className : ''}`}>{children}</div>;
}

export interface ListRowProps {
  /** Custom leading element. Wins over `avatar`. */
  leading?: ReactNode;
  /** Shortcut: shows an Avatar with the first letter of this text. */
  avatar?: string;
  /** Small line above the title (e.g. factory name and time). */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right side content (Badge, text, Toggle). */
  trailing?: ReactNode;
  /** Show a chevron at the far right. Defaults to true when the row is tappable. */
  chevron?: boolean;
  /** Link target (renders an <a>). */
  to?: string;
  /** Click handler (renders a <button>). */
  onClick?: () => void;
  selected?: boolean;
  /** Tint the title (e.g. 'danger' for Sign out). */
  tone?: 'danger' | 'accent';
}

export function ListRow({ leading, avatar, eyebrow, title, subtitle, trailing, chevron, to, onClick, selected, tone }: ListRowProps) {
  const tappable = !!(to || onClick);
  const showChevron = chevron ?? tappable;
  const content = (
    <>
      {leading ?? (avatar !== undefined ? <Avatar name={avatar} /> : null)}
      <div className="grow">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <div className="t" style={tone ? { color: `var(--${tone})` } : undefined}>{title}</div>
        {subtitle ? <div className="s">{subtitle}</div> : null}
      </div>
      {trailing ? <div className="trail">{trailing}</div> : null}
      {showChevron ? <Icon name="caret-right" className="chev" /> : null}
    </>
  );
  const cls = `row${selected ? ' sel' : ''}`;
  if (to) return <Link to={to} className={cls}>{content}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{content}</button>;
  return <div className={cls}>{content}</div>;
}

export function Chips({ children, label }: { children: ReactNode; label?: string }) {
  return <div className="chips" role="group" aria-label={label}>{children}</div>;
}

export interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function Chip({ selected, onClick, children }: ChipProps) {
  return <button type="button" className={`chip${selected ? ' on' : ''}`} aria-pressed={!!selected} onClick={onClick}>{children}</button>;
}
