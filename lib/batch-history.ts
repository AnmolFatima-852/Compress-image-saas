import type { BatchJobMap } from '@/lib/batch-compress';
import { getSuccessfulBatchResults } from '@/lib/batch-compress';

export type BatchHistoryTotals = {
  imageCount: number;
  originalTotalSize: number;
  compressedTotalSize: number;
  savedSpace: number;
  compressionRatio: string;
};

/** Aggregates successful batch jobs into history totals. */
export function summarizeSuccessfulBatch(jobs: BatchJobMap): BatchHistoryTotals | null {
  const successes = getSuccessfulBatchResults(jobs);
  if (successes.length === 0) {
    return null;
  }

  let originalTotalSize = 0;
  let compressedTotalSize = 0;

  for (const { result } of successes) {
    originalTotalSize += Math.max(0, result.originalSizeBytes ?? 0);
    compressedTotalSize += Math.max(0, result.compressedSizeBytes ?? 0);
  }

  const savedSpace = Math.max(originalTotalSize - compressedTotalSize, 0);
  const compressionRatio =
    originalTotalSize > 0
      ? `${(originalTotalSize / Math.max(compressedTotalSize, 1)).toFixed(2)}:1`
      : '1.00:1';

  return {
    imageCount: successes.length,
    originalTotalSize,
    compressedTotalSize,
    savedSpace,
    compressionRatio,
  };
}

export function formatProcessingDuration(durationMs: number): string {
  const ms = Math.max(0, Math.round(durationMs));
  if (ms < 1000) return `${ms} ms`;

  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(totalSeconds < 10 ? 1 : 0)} s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

export function batchZipStoragePath(userId: string, batchId: string) {
  return `${userId}/batches/${batchId}.zip`;
}

export function batchPdfStoragePath(userId: string, batchId: string) {
  return `${userId}/batches/${batchId}.pdf`;
}

export function shortBatchId(batchId: string) {
  return batchId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Normalize UI / form format values into a stable history label. */
export function normalizeBatchOutputFormat(format: string | undefined | null): string {
  const value = (format ?? '').trim().toLowerCase();
  if (value === 'jpg' || value === 'jpeg') return 'JPEG';
  if (value === 'png') return 'PNG';
  if (value === 'webp') return 'WEBP';
  if (value === 'avif') return 'AVIF';
  if (!value) return 'JPEG';
  return value.toUpperCase();
}
