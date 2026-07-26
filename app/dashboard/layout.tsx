import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-6 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <ArrowLeft size={16} />
            Back to app
          </Link>
          <Link href="/profile" className="rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-3 py-2 text-sm font-semibold text-white">
            Profile
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
