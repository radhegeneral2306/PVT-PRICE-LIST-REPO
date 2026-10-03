/** A toast that survives the route change after saving (the add flow has no ToastProvider above it). */
export function flashToast(message: string): void {
  try {
    const host = document.createElement('div');
    host.className = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    host.style.bottom = 'calc(var(--tabbar-h) + var(--safe-b) + 12px)';
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    host.appendChild(t);
    document.body.appendChild(host);
    window.setTimeout(() => host.remove(), 3000);
  } catch { /* cosmetic only */ }
}
