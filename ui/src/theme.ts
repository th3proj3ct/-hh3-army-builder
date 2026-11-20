/**
 * Light/dark choice: "auto" follows the device (prefers-color-scheme), "light"/"dark" force it.
 * Stored per browser; if storage is unavailable the choice just isn't remembered.
 */
export type Theme = 'auto' | 'light' | 'dark';
const KEY = 'hh3-theme';
export const THEMES: Theme[] = ['auto', 'light', 'dark'];

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(t: Theme) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    if (t === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* not remembered, still applied */
  }
}
