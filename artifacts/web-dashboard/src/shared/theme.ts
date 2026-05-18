export type Theme = 'dark' | 'light';
const KEY = 'memory_theme';

export function getTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme) ?? 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(KEY, theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function initTheme(): void {
  applyTheme(getTheme());
}
