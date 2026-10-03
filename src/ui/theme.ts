export type Theme = 'light' | 'dark' | 'system';
export const THEME_KEY = 'pv-theme';

/** Saved choice, defaulting to 'system'. Never throws (storage can be blocked). */
export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Apply a theme to <html>. 'light'/'dark' set data-theme; 'system' removes it so the
 * prefers-color-scheme media query in app.css decides. With no argument, applies the saved choice.
 */
export function applyTheme(theme: Theme = getTheme()): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** Save and apply a theme choice (used by Settings). */
export function setTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable: still apply for this session */
  }
  applyTheme(theme);
}
