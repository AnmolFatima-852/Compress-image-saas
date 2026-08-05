import type { BatchJobMap } from '@/lib/batch-compress';
import { countBatchOutcomes } from '@/lib/batch-compress';

/** Short, unified reasons shown for Skipped / Failed items (all formats). */
export const COMPRESS_REASON = {
  alreadySmaller: 'Already smaller than target',
  severeQualityLoss: 'Cannot reach target without severe quality loss',
  unsupportedFormat: 'Unsupported format',
  compressionFailed: 'Compression failed',
} as const;

export type CompressReason = (typeof COMPRESS_REASON)[keyof typeof COMPRESS_REASON];

export type CompressOutcomeKind = 'done' | 'skipped' | 'failed';

/** Maps thrown / raw errors to a unified failure reason. */
export function toUnifiedCompressReason(error: unknown): CompressReason {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (/unsupported|not supported|unknown format|invalid format/i.test(message)) {
    return COMPRESS_REASON.unsupportedFormat;
  }

  if (/severe quality|could not be reached|unreachable|invalid image/i.test(message)) {
    return COMPRESS_REASON.severeQualityLoss;
  }

  if (/already smaller|already at or under|already ≤|already under/i.test(message)) {
    return COMPRESS_REASON.alreadySmaller;
  }

  return COMPRESS_REASON.compressionFailed;
}

/**
 * Builds a single end-of-batch summary toast.
 * Never implies the whole batch stopped because of one failure.
 */
export function buildBatchSummaryToast(jobs: BatchJobMap): { type: 'success' | 'error'; message: string } {
  const { done, skipped, failed, total } = countBatchOutcomes(jobs);

  if (total === 0) {
    return { type: 'error', message: COMPRESS_REASON.compressionFailed };
  }

  if (done === 0 && skipped === 0) {
    return {
      type: 'error',
      message:
        total === 1
          ? Object.values(jobs)[0]?.error || COMPRESS_REASON.compressionFailed
          : `All ${total} images failed. ${COMPRESS_REASON.compressionFailed}.`,
    };
  }

  if (total === 1) {
    if (done === 1) {
      return { type: 'success', message: 'Compression finished and your download is ready.' };
    }
    if (skipped === 1) {
      const reason = Object.values(jobs)[0]?.result?.message || COMPRESS_REASON.alreadySmaller;
      return { type: 'success', message: `Skipped — ${reason}` };
    }
  }

  const parts: string[] = [];
  if (done > 0) parts.push(`${done} compressed`);
  if (skipped > 0) parts.push(`${skipped} skipped`);
  if (failed > 0) parts.push(`${failed} failed`);

  return {
    type: 'success',
    message: `Batch complete: ${parts.join(', ')} of ${total}.`,
  };
}
