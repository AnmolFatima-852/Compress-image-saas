import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { DashboardBatchHistory } from '@/components/dashboard-batch-history';
import { DashboardHistory } from '@/components/dashboard-history';
import { textEyebrow, textHeading, textLink, textMuted } from '@/lib/ui-text';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={`text-sm font-medium uppercase tracking-[0.24em] ${textEyebrow}`}>Dashboard</p>
              <h1 className={`text-3xl font-semibold ${textHeading}`}>Batch history</h1>
              <p className={`mt-2 max-w-2xl text-sm ${textMuted}`}>
                Every completed batch is saved with image count, sizes, saved space, duration, output
                format, and ZIP/PDF downloads when available.
              </p>
            </div>
            <Link href="/" className={`text-sm ${textLink}`}>
              Back to compressor
            </Link>
          </div>

          <DashboardBatchHistory />
        </div>

        <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div>
            <p className={`text-sm font-medium uppercase tracking-[0.24em] ${textEyebrow}`}>Individual downloads</p>
            <h2 className={`mt-2 text-2xl font-semibold ${textHeading}`}>Compressed images</h2>
            <p className={`mt-2 max-w-2xl text-sm ${textMuted}`}>
              Download each compressed file from completed runs.
            </p>
          </div>

          <DashboardHistory />
        </div>
      </div>
    </AuthGuard>
  );
}
