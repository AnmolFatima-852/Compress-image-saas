import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { DashboardHistory } from '@/components/dashboard-history';
import { textEyebrow, textHeading, textLink } from '@/lib/ui-text';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-sm font-medium uppercase tracking-[0.24em] ${textEyebrow}`}>Dashboard</p>
            <h1 className={`text-3xl font-semibold ${textHeading}`}>Compression history</h1>
          </div>
          <Link href="/" className={`text-sm ${textLink}`}>
            Back to compressor
          </Link>
        </div>

        <DashboardHistory />
      </div>
    </AuthGuard>
  );
}
