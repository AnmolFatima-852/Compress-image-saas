import Link from 'next/link';
import { ArrowDownToLine, Clock3 } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { getCompressionHistory } from '@/lib/compression-history';

export default function DashboardPage() {
  const history = getCompressionHistory('demo-user');

  return (
    <AuthGuard>
      <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Dashboard</p>
          <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-100">Compression history</h1>
        </div>
        <Link href="/" className="text-sm font-semibold text-violet-600">Back to compressor</Link>
      </div>

      {history.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          No compressed images yet. Run a compression from the home screen to see it appear here.
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {history.map((item) => (
            <div key={item.id} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">{item.fileName}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <span>{item.format}</span>
                  <span>{item.originalSize} → {item.compressedSize}</span>
                  <span>{item.savedPercentage} saved</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  <Clock3 size={16} />
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>
                <a
                  href={item.downloadUrl}
                  download={item.downloadFileName}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-3 py-2 text-sm font-semibold text-white"
                >
                  <ArrowDownToLine size={16} />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </AuthGuard>
  );
}
