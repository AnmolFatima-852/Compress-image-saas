const THEME_STORAGE_KEY = 'compress-image-theme';

export type ThemeMode = 'light' | 'dark';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

export function setStoredTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}
