'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStoredTheme, setStoredTheme, type ThemeMode } from '@/lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const storedTheme = getStoredTheme();
    setTheme(storedTheme);
    setStoredTheme(storedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    setStoredTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
