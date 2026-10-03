import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface ToastApi {
  /** Transient message, auto-dismisses after ~3s. Never use for anything the user must not miss. */
  show(message: string): void;
  success(message: string): void;
  error(message: string): void;
}

interface ToastItem { id: number; message: string; tone: 'default' | 'success' | 'error' }

const Ctx = createContext<ToastApi>({ show() {}, success() {}, error() {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const timers = useRef(new Set<number>());

  const push = useCallback((message: string, tone: ToastItem['tone']) => {
    const id = next.current++;
    setItems((l) => [...l.slice(-2), { id, message, tone }]);
    const t = window.setTimeout(() => { timers.current.delete(t); setItems((l) => l.filter((x) => x.id !== id)); }, tone === 'error' ? 5000 : 3000);
    timers.current.add(t);
  }, []);
  useEffect(() => { const ts = timers.current; return () => ts.forEach(clearTimeout); }, []);

  const api = useMemo<ToastApi>(() => ({
    show: (m) => push(m, 'default'),
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
  }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast${t.tone === 'error' ? ' error' : ''}`}>
            {t.tone === 'success' ? <Icon name="check-circle" weight="fill" /> : t.tone === 'error' ? <Icon name="warning-circle" weight="fill" /> : null}
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(Ctx);
}
