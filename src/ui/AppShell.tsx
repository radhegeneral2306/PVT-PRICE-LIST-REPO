import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import { useData } from '../store/DataContext';
import { timeAgo } from '../lib/format';
import { Icon } from './Icon';
import { Avatar } from './Lists';
import { OfflineBanner } from './States';
import { ToastProvider } from './Toast';
import { applyTheme } from './theme';

const NAV = [
  { to: '/', label: 'Home', icon: 'house', end: true },
  { to: '/factories', label: 'Factories', icon: 'factory', end: false },
  { to: '/search', label: 'Search', icon: 'magnifying-glass', end: false },
  { to: '/settings', label: 'Settings', icon: 'gear', end: false },
];

/** Remember scroll per history entry; restore on back/forward, reset to top on new navigation. */
function useScrollRestoration() {
  const loc = useLocation();
  const type = useNavigationType();
  const saved = useRef(new Map<string, number>());
  const key = loc.key;
  useEffect(() => {
    const onScroll = () => saved.current.set(key, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [key]);
  useLayoutEffect(() => {
    const y = type === 'POP' ? saved.current.get(key) ?? 0 : 0;
    window.scrollTo(0, y);
    if (y > 0) {
      // Content may still be loading; retry once after the next frames.
      const id = requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
      return () => cancelAnimationFrame(id);
    }
  }, [key, type]);
}

function syncText(status: string | undefined, lastSync: string | null | undefined): string {
  if (status === 'offline') return 'Offline';
  if (status === 'syncing') return 'Syncing';
  if (status === 'error') return 'Sync problem';
  return lastSync ? `Synced ${timeAgo(lastSync).toLowerCase()}` : 'Not synced yet';
}

export function AppShell() {
  const { session, syncStatus, lastSync } = useData();
  useEffect(() => { applyTheme(); }, []);
  useScrollRestoration();
  const name = session?.user.name ?? '';

  return (
    <ToastProvider>
      <OfflineBanner />
      <div className="shell">
        <aside className="rail" aria-label="Main">
          <div className="biz">
            <div className="logo">R</div>
            <div><div className="bn">Radhe General</div><div className="bs">Pricelist Vault</div></div>
          </div>
          <Link to="/add" className="btn btn-primary btn-block"><Icon name="plus" weight="bold" />Add pricelist</Link>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `navitem${isActive ? ' active' : ''}`}>
                {({ isActive }) => (<><Icon name={n.icon} weight={isActive ? 'fill' : 'regular'} />{n.label}</>)}
              </NavLink>
            ))}
          </nav>
          <div className="rfoot">
            <Avatar name={name || '?'} />
            <div style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>{name}</div>
              <div className="faint" style={{ fontSize: 12, color: 'var(--text-2)' }}>{syncText(syncStatus, lastSync)}</div>
            </div>
          </div>
        </aside>
        <main className="shell-main">
          <Outlet />
        </main>
        <nav className="tabbar" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
              {({ isActive }) => (<><Icon name={n.icon} weight={isActive ? 'fill' : 'regular'} />{n.label}</>)}
            </NavLink>
          ))}
        </nav>
      </div>
    </ToastProvider>
  );
}
