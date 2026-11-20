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

/** Colour palette for highlights, icons and Prime slots (styles.css › Colour palettes). */
export const ACCENTS = [
  { id: 'gold', name: 'Gold' },
  { id: 'crimson', name: 'Crimson' },
  { id: 'azure', name: 'Azure' },
  { id: 'emerald', name: 'Emerald' },
  { id: 'violet', name: 'Violet' },
  { id: 'steel', name: 'Steel' },
] as const;
export type Accent = (typeof ACCENTS)[number]['id'];
const ACCENT_KEY = 'hh3-accent';
export function loadAccent(): Accent {
  try {
    const a = localStorage.getItem(ACCENT_KEY);
    return ACCENTS.some((x) => x.id === a) ? (a as Accent) : 'gold';
  } catch {
    return 'gold';
  }
}
export function applyAccent(a: Accent) {
  if (a === 'gold') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = a;
  try {
    if (a === 'gold') localStorage.removeItem(ACCENT_KEY);
    else localStorage.setItem(ACCENT_KEY, a);
  } catch {
    /* not remembered, still applied */
  }
}

/** Which side the unit/detail panel sits on (wide screens; phones use a bottom sheet). Default left. */
export type PanelSide = 'left' | 'right';
const SIDE_KEY = 'hh3-panel-side';
export function loadPanelSide(): PanelSide {
  try {
    return localStorage.getItem(SIDE_KEY) === 'right' ? 'right' : 'left';
  } catch {
    return 'left';
  }
}
export function savePanelSide(side: PanelSide) {
  try {
    localStorage.setItem(SIDE_KEY, side);
  } catch {
    /* not remembered */
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
