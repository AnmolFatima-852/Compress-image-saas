'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, UserCircle2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/profile', label: 'Profile', icon: UserCircle2 },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.14),_transparent_24%)] px-4 py-6 text-slate-900 transition-colors dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between rounded-full border border-slate-200/80 bg-white/80 px-5 py-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold">Compress Image</Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setIsMenuOpen((value) => !value)}
              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Menu
            </button>
          </div>
        </header>

        {isMenuOpen ? (
          <div className="flex flex-wrap items-center justify-end gap-3 rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${active ? 'bg-violet-600 text-white' : 'text-slate-700 dark:text-slate-200'}`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}

        <div>{children}</div>
      </div>
    </div>
  );
}
