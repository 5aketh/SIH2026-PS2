import { useCallback, useState } from 'react';

const STORAGE_KEY = 'packwise-theme';

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/**
 * The inline <head> script applies the saved theme before first paint;
 * this hook reads it from <html data-theme> and keeps it in sync.
 */
export function useTheme() {
  const [theme, setTheme] = useState(currentTheme);

  const toggleTheme = useCallback(() => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
    setTheme(next);
  }, []);

  return { theme, toggleTheme };
}
