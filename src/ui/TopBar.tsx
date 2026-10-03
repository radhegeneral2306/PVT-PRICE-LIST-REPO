import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconButton } from './Buttons';
import { Icon } from './Icon';

export interface TopBarProps {
  title: ReactNode;
  /** Small line under the title. */
  subtitle?: ReactNode;
  /** Show a back button that goes back one step in history. */
  back?: boolean;
  /** Show a back button that links to this path (use for deep links where history may be empty). */
  backTo?: string;
  /** Right side slot: IconButtons, Buttons. */
  right?: ReactNode;
  /** Stick to the top while scrolling. */
  sticky?: boolean;
}

export function TopBar({ title, subtitle, back, backTo, right, sticky }: TopBarProps) {
  const navigate = useNavigate();
  return (
    <header className={`topbar${sticky ? ' sticky' : ''}`}>
      {backTo ? (
        <Link to={backTo} className="iconbtn" aria-label="Back"><Icon name="arrow-left" /></Link>
      ) : back ? (
        <IconButton icon="arrow-left" label="Back" onClick={() => navigate(-1)} />
      ) : null}
      <h1>
        {title}
        {subtitle ? <div className="topbar-sub">{subtitle}</div> : null}
      </h1>
      {right}
    </header>
  );
}
