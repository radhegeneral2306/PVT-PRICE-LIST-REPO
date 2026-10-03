import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The browser fires this once, early. Capture at module load so the Settings screen can use it later.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const other = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && !other;
}

export type InstallMode = 'none' | 'prompt' | 'ios';

export function useInstall(): { mode: InstallMode; install: () => Promise<void> } {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const mode: InstallMode = isStandalone() ? 'none' : deferred ? 'prompt' : isIosSafari() ? 'ios' : 'none';
  const install = async () => {
    const d = deferred;
    if (!d) return;
    await d.prompt();
    await d.userChoice;
    deferred = null;
    notify();
  };
  return { mode, install };
}
