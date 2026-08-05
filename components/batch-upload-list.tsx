'use client';

import { ArrowDownToLine, Check, ChevronDown, ChevronUp, Loader2, Trash2, X } from 'lucide-react';
import type { BatchJobMap } from '@/lib/batch-compress';
import { countBatchOutcomes } from '@/lib/batch-compress';
import type { BatchImageItem } from '@/lib/batch-upload';
import { getBatchOriginalTotalBytes } from '@/lib/batch-upload';
import { formatBytes } from '@/lib/format-bytes';
import { surfaceMuted, textHeading, textMuted } from '@/lib/ui-text';

type BatchUploadListProps = {
  items: BatchImageItem[];
  jobs?: BatchJobMap;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  /** Label for the batch clear action. */
  clearLabel?: string;
  onDownloadItem?: (id: string) => void;
  onMoveItem?: (id: string, direction: -1 | 1) => void;
  reorderable?: boolean;
  disabled?: boolean;
  /** When true, shows compress-mode batch summary (done/failed/saved) for multi-image batches. */
  showCompressSummary?: boolean;
};

function statusLabel(status: string | undefined) {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'compressing':
      return 'Compressing';
    case 'done':
      return 'Done';
    case 'skipped':
      return 'Skipped';
    case 'error':
      return 'Failed';
    default:
      return null;
  }
}

function statusBadgeClass(status: string | undefined) {
  switch (status) {
    case 'done':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200';
    case 'skipped':
      return 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
    case 'error':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200';
    default:
      return 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200';
  }
}

function SingleImageRow({
  item,
  job,
  onRemove,
  onDownloadItem,
  disabled,
}: {
  item: BatchImageItem;
  job?: BatchJobMap[string];
  onRemove: (id: string) => void;
  onDownloadItem?: (id: string) => void;
  disabled: boolean;
}) {
  const label = statusLabel(job?.status);
  const showProgress = job && (job.status === 'compressing' || job.status === 'queued');
  const canDownload =
    (job?.status === 'done' || job?.status === 'skipped') && Boolean(job.result?.downloadUrl);

  return (
    <li className={`rounded-2xl px-3 py-2 ${surfaceMuted}`}>
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`truncate text-sm font-semibold ${textHeading}`} title={item.file.name}>
              {item.file.name}
            </p>
            {label ? (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(job?.status)}`}>
                {job?.status === 'compressing' ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" />
                    {label}
                  </span>
                ) : (
                  label
                )}
              </span>
            ) : null}
          </div>
          <p className={`mt-0.5 text-xs ${textMuted}`}>
            {formatBytes(item.file.size)}
            {job?.status === 'done' && job?.result?.compressedSize ? ` → ${job.result.compressedSize}` : ''}
            {job?.status === 'skipped' && job?.result?.message ? ` · ${job.result.message}` : ''}
            {job?.status === 'error' && (job.error || job.result?.message)
              ? ` · ${job.error || job.result?.message}`
              : ''}
          </p>
        </div>
        {canDownload && onDownloadItem ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={`Download ${item.file.name}`}
            onClick={() => onDownloadItem(item.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-white text-violet-600 transition hover:border-violet-400 disabled:opacity-60 dark:border-violet-500/40 dark:bg-slate-900 dark:text-violet-300"
          >
            <ArrowDownToLine size={14} />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${item.file.name}`}
            onClick={() => onRemove(item.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-500 dark:hover:text-rose-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showProgress ? (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-violet-700 dark:text-violet-300">
            <span>{job.status === 'queued' ? 'Waiting…' : 'Compressing…'}</span>
            <span>{job.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 transition-[width] duration-200"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function BatchUploadList({
  items,
  jobs = {},
  onRemove,
  onClearAll,
  clearLabel = 'Clear Images',
  onDownloadItem,
  onMoveItem,
  reorderable = false,
  disabled = false,
  showCompressSummary = false,
}: BatchUploadListProps) {
  if (items.length === 0) {
    return null;
  }

  const isBatchLayout = items.length > 1;
  const outcomes = countBatchOutcomes(jobs);
  const originalTotal = getBatchOriginalTotalBytes(items);
  const hasJobActivity = outcomes.total > 0;
  const savedBytes =
    hasJobActivity && outcomes.done > 0
      ? Math.max(
          Object.values(jobs).reduce((sum, job) => {
            if (job.status !== 'done' || !job.result?.success) return sum;
            return sum + Math.max(0, (job.result.originalSizeBytes ?? 0) - (job.result.compressedSizeBytes ?? 0));
          }, 0),
          0,
        )
      : 0;

  // Single-image: keep the original compact list row (unchanged experience).
  if (!isBatchLayout) {
    const item = items[0]!;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm font-medium ${textHeading}`}>1 image selected</p>
          <button
            type="button"
            disabled={disabled}
            onClick={onClearAll}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60 dark:hover:border-rose-500 dark:hover:text-rose-300 ${surfaceMuted}`}
          >
            <Trash2 size={14} />
            {clearLabel}
          </button>
        </div>
        <ul className="grid gap-2">
          <SingleImageRow
            item={item}
            job={jobs[item.id]}
            onRemove={onRemove}
            onDownloadItem={onDownloadItem}
            disabled={disabled}
          />
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/50 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className={`text-sm font-semibold ${textHeading}`}>Batch summary</p>
            <p className={`text-sm ${textMuted}`}>
              <span className="font-medium text-violet-700 dark:text-violet-300">
                {items.length} images selected
              </span>
              <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
              <span>{formatBytes(originalTotal)} total</span>
              {reorderable ? (
                <>
                  <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                  <span>reorder with arrows</span>
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={onClearAll}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60 dark:hover:border-rose-500 dark:hover:text-rose-300 ${surfaceMuted}`}
          >
            <Trash2 size={14} />
            {clearLabel}
          </button>
        </div>

        {showCompressSummary && hasJobActivity ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className={`rounded-xl px-3 py-2 ${surfaceMuted}`}>
              <p className={`text-[11px] font-medium uppercase tracking-wide ${textMuted}`}>Done</p>
              <p className={`mt-0.5 text-sm font-semibold ${textHeading}`}>
                {outcomes.done}/{items.length}
              </p>
            </div>
            <div className={`rounded-xl px-3 py-2 ${surfaceMuted}`}>
              <p className={`text-[11px] font-medium uppercase tracking-wide ${textMuted}`}>Skipped</p>
              <p className={`mt-0.5 text-sm font-semibold text-amber-700 dark:text-amber-300`}>
                {outcomes.skipped}
              </p>
            </div>
            <div className={`rounded-xl px-3 py-2 ${surfaceMuted}`}>
              <p className={`text-[11px] font-medium uppercase tracking-wide ${textMuted}`}>Failed</p>
              <p className={`mt-0.5 text-sm font-semibold ${textHeading}`}>{outcomes.failed}</p>
            </div>
            <div className={`rounded-xl px-3 py-2 ${surfaceMuted}`}>
              <p className={`text-[11px] font-medium uppercase tracking-wide ${textMuted}`}>Saved</p>
              <p className={`mt-0.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400`}>
                {outcomes.done > 0 ? formatBytes(savedBytes) : '—'}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <ul className="grid max-h-[22rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item, index) => {
          const job = jobs[item.id];
          const label = statusLabel(job?.status);
          const showProgress = job && (job.status === 'compressing' || job.status === 'queued' || job.status === 'done');
          const canDownload =
            (job?.status === 'done' || job?.status === 'skipped') && Boolean(job.result?.downloadUrl);
          const progressValue = job?.status === 'done' ? 100 : job?.progress ?? 0;

          return (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-600 dark:bg-slate-900/60"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />

                {job?.status === 'done' ? (
                  <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                    <Check size={12} />
                  </div>
                ) : null}

                {job?.status === 'skipped' ? (
                  <div className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                    Skipped
                  </div>
                ) : null}

                {job?.status === 'error' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-rose-950/40 px-2 text-center text-[11px] font-medium text-white">
                    Failed
                  </div>
                ) : null}

                {reorderable && onMoveItem ? (
                  <div className="absolute bottom-2 left-2 flex gap-1">
                    <button
                      type="button"
                      disabled={disabled || index === 0}
                      aria-label={`Move ${item.file.name} up`}
                      onClick={() => onMoveItem(item.id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/70 bg-white/90 text-slate-600 shadow-sm transition hover:text-violet-600 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={disabled || index === items.length - 1}
                      aria-label={`Move ${item.file.name} down`}
                      onClick={() => onMoveItem(item.id, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/70 bg-white/90 text-slate-600 shadow-sm transition hover:text-violet-600 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-200"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                ) : null}

                <div className="absolute right-2 top-2 flex gap-1">
                  {canDownload && onDownloadItem ? (
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Download ${item.file.name}`}
                      onClick={() => onDownloadItem(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-200 bg-white text-violet-600 shadow-sm transition hover:border-violet-400 disabled:opacity-60 dark:border-violet-500/40 dark:bg-slate-900 dark:text-violet-300"
                    >
                      <ArrowDownToLine size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => onRemove(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {showProgress && job?.status !== 'error' ? (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 to-transparent px-2 pb-2 pt-6">
                    <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-white">
                      <span className="inline-flex items-center gap-1">
                        {job?.status === 'compressing' ? <Loader2 size={10} className="animate-spin" /> : null}
                        {job?.status === 'queued' ? 'Waiting' : job?.status === 'done' ? 'Done' : 'Compressing'}
                      </span>
                      <span>{progressValue}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/30">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-300 transition-[width] duration-200"
                        style={{ width: `${progressValue}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1 px-2.5 py-2">
                <p className={`truncate text-xs font-semibold sm:text-sm ${textHeading}`} title={item.file.name}>
                  {reorderable ? `${index + 1}. ` : null}
                  {item.file.name}
                </p>
                <p className={`truncate text-[11px] ${textMuted}`}>
                  {formatBytes(item.file.size)}
                  {job?.status === 'done' && job?.result?.compressedSize ? ` → ${job.result.compressedSize}` : ''}
                </p>
                {label && !showProgress ? (
                  <p
                    className={`text-[11px] font-medium ${
                      job?.status === 'error'
                        ? 'text-rose-600 dark:text-rose-300'
                        : job?.status === 'skipped'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-violet-700 dark:text-violet-300'
                    }`}
                  >
                    {label}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
