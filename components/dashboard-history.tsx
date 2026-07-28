'use client';

import { ArrowDownToLine, Clock3, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCompressionHistoryForDashboard, type DashboardHistoryItem } from '@/services/compression-history-service';

export function DashboardHistory() {
  const [history, setHistory] = useState<DashboardHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getCompressionHistoryForDashboard()
      .then((items) => {
        if (!active) return;
        setHistory(items);
      })
      .catch(() => {
        if (!active) return;
        setError('Unable to load compression history.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 p-8 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
        <Loader2 size={18} className="animate-spin" />
        Loading compression history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mt-8 rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
        No compressed images yet. Run a compression from the home screen to see it appear here.
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-4">
      {history.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">{item.fileName}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
              <span>{item.format}</span>
              <span>
                {item.originalSize} → {item.compressedSize}
              </span>
              <span>{item.savedPercentage} saved</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              <Clock3 size={16} />
              {new Date(item.createdAt).toLocaleDateString()}
            </div>
            {item.downloadUrl ? (
              <a
                href={item.downloadUrl}
                download={item.downloadFileName}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-3 py-2 text-sm font-semibold text-white"
              >
                <ArrowDownToLine size={16} />
                Download
              </a>
            ) : (
              <Link href="/" className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                Re-compress
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
