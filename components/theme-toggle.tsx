'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle color theme"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm transition hover:border-violet-400 hover:text-violet-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
    >
      {!mounted ? <Moon size={18} /> : isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
