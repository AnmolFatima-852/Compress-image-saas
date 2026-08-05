'use client';

import { ArrowDownToLine, Clock3, FileArchive, FileText, Images, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatLocalDate, formatLocalTime } from '@/lib/format-local-datetime';
import { getBatchHistoryForDashboard, type DashboardBatchHistoryItem } from '@/services/batch-history-service';

function imageCountLabel(count: number) {
  return `${count} ${count === 1 ? 'Image' : 'Images'}`;
}

export function DashboardBatchHistory() {
  const [history, setHistory] = useState<DashboardBatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getBatchHistoryForDashboard()
      .then((items) => {
        if (!active) return;
        setHistory(items);
      })
      .catch(() => {
        if (!active) return;
        setError('Unable to load batch history.');
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
      <div className="mt-6 flex items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-300 p-8 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
        <Loader2 size={18} className="animate-spin" />
        Loading batch history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mt-6 rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
        No completed batches yet. Compress one or more images while signed in to save batch history here.
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4">
      {history.map((item, index) => (
        <div
          key={item.id}
          className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                Batch #{index + 1}
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Images size={14} />
                {imageCountLabel(item.imageCount)} • {item.outputFormat}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span>Ratio {item.compressionRatio}</span>
                <span>{item.savedSpace} saved ({item.savedPercentage})</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 size={14} />
                  {item.processingDuration}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
                <span>{formatLocalDate(item.createdAt)}</span>
                <span>{formatLocalTime(item.createdAt)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {item.zipDownloadUrl ? (
                <a
                  href={item.zipDownloadUrl}
                  download={item.zipFileName}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-3 py-2 text-sm font-semibold text-white"
                >
                  <FileArchive size={16} />
                  ZIP
                </a>
              ) : null}
              {item.pdfDownloadUrl ? (
                <a
                  href={item.pdfDownloadUrl}
                  download={item.pdfFileName}
                  className="flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 dark:border-violet-500/40 dark:bg-slate-900/80 dark:text-violet-300"
                >
                  <FileText size={16} />
                  PDF
                </a>
              ) : null}
              {!item.zipDownloadUrl && !item.pdfDownloadUrl ? (
                <Link
                  href="/"
                  className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  <ArrowDownToLine size={16} />
                  Re-compress
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
