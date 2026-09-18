// Theme switching: only toggles data-theme; colors live in css/theme.css.
const KEY = 'yuan27.theme.v1';

export const THEMES = ['claude', 'light', 'matrix', 'dracula'];

export function initTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && THEMES.includes(saved)) {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch {
    /* ignore */
  }
}

export function getThemes() {
  return [...THEMES];
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'claude';
}

export function setTheme(name) {
  if (!THEMES.includes(name)) return false;
  document.documentElement.setAttribute('data-theme', name);
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* ignore */
  }
  return true;
}
