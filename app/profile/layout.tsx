import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-6 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <ArrowLeft size={16} />
            Back to app
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Dashboard
            </Link>
            <Link href="/auth/logout" className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              Log out
            </Link>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
