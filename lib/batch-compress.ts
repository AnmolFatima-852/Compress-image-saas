import type { CompressImageResult } from '@/services/compress-image';
import type { BatchImageItem } from '@/lib/batch-upload';
import { COMPRESS_REASON, toUnifiedCompressReason } from '@/lib/compress-outcome';

export type BatchItemJobStatus = 'idle' | 'queued' | 'compressing' | 'done' | 'skipped' | 'error';

export type BatchItemJobState = {
  status: BatchItemJobStatus;
  progress: number;
  result?: CompressImageResult;
  error?: string;
};

export type BatchJobMap = Record<string, BatchItemJobState>;

export function createInitialBatchJobs(items: BatchImageItem[]): BatchJobMap {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        status: 'queued' as const,
        progress: 0,
      },
    ]),
  );
}

/** Overall batch progress from completed items + current item progress (0–100). */
export function computeOverallBatchProgress(
  completedCount: number,
  totalCount: number,
  currentItemProgress: number,
): number {
  if (totalCount <= 0) return 0;
  const unit = 100 / totalCount;
  const value = completedCount * unit + (Math.min(100, Math.max(0, currentItemProgress)) / 100) * unit;
  return Math.min(100, Math.round(value));
}

/** Yields to the browser so React can paint between sequential compressions. */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
      return;
    }

    setTimeout(resolve, 0);
  });
}

type CompressFn = (
  file: File,
  targetSize: number,
  unit: 'KB' | 'MB',
  outputFormat: string,
) => Promise<CompressImageResult>;

type RunBatchCompressionArgs = {
  items: BatchImageItem[];
  targetSize: number;
  unit: 'KB' | 'MB';
  outputFormat: string;
  compressFn: CompressFn;
  onJobsChange: (jobs: BatchJobMap) => void;
  onOverallProgress: (progress: number) => void;
  timeoutMs?: number;
  /** When aborted, stops scheduling further images (in-flight item still settles). */
  signal?: AbortSignal;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error('Compression cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

/**
 * Compresses every image sequentially (worker-queue style) so the UI stays responsive.
 * Images already under the target are marked skipped; failures do not stop the batch.
 * Supports AbortSignal cancellation between items.
 */
export async function runBatchCompression({
  items,
  targetSize,
  unit,
  outputFormat,
  compressFn,
  onJobsChange,
  onOverallProgress,
  timeoutMs = 35_000,
  signal,
}: RunBatchCompressionArgs): Promise<BatchJobMap> {
  let jobs = createInitialBatchJobs(items);
  onJobsChange(jobs);
  onOverallProgress(0);

  const patchJob = (id: string, patch: Partial<BatchItemJobState>) => {
    jobs = {
      ...jobs,
      [id]: {
        ...jobs[id]!,
        ...patch,
      },
    };
    onJobsChange(jobs);
  };

  for (let index = 0; index < items.length; index += 1) {
    throwIfAborted(signal);

    const item = items[index]!;
    await yieldToUi();
    throwIfAborted(signal);

    // Drop any previous result buffer for this slot before compressing again.
    patchJob(item.id, { status: 'compressing', progress: 8, result: undefined, error: undefined });
    onOverallProgress(computeOverallBatchProgress(index, items.length, 8));

    let softProgress = 8;
    const softTimer = setInterval(() => {
      if (signal?.aborted) {
        clearInterval(softTimer);
        return;
      }
      softProgress = Math.min(88, softProgress + 4);
      patchJob(item.id, { status: 'compressing', progress: softProgress });
      onOverallProgress(computeOverallBatchProgress(index, items.length, softProgress));
    }, 220);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const response = await Promise.race([
        compressFn(item.file, targetSize, unit, outputFormat),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Compression took too long. Please try a larger target size or a different format.'));
          }, timeoutMs);
        }),
      ]);

      clearInterval(softTimer);
      if (timeoutId) clearTimeout(timeoutId);
      throwIfAborted(signal);

      if (response.success && response.skipped) {
        patchJob(item.id, {
          status: 'skipped',
          progress: 100,
          result: response,
          error: undefined,
        });
      } else if (response.success) {
        patchJob(item.id, { status: 'done', progress: 100, result: response, error: undefined });
      } else {
        // Fail this item only — never abort the rest of the batch.
        patchJob(item.id, {
          status: 'error',
          progress: 100,
          result: response,
          error: response.message || COMPRESS_REASON.compressionFailed,
        });
      }
    } catch (error) {
      clearInterval(softTimer);
      if (timeoutId) clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      // Continue with remaining images after an unexpected per-item failure.
      patchJob(item.id, {
        status: 'error',
        progress: 100,
        error: toUnifiedCompressReason(error),
        result: undefined,
      });
    }

    onOverallProgress(computeOverallBatchProgress(index + 1, items.length, 0));
    await yieldToUi();
  }

  throwIfAborted(signal);
  onOverallProgress(100);
  return jobs;
}

export function countBatchOutcomes(jobs: BatchJobMap) {
  const values = Object.values(jobs);
  return {
    total: values.length,
    done: values.filter((job) => job.status === 'done').length,
    skipped: values.filter((job) => job.status === 'skipped').length,
    failed: values.filter((job) => job.status === 'error').length,
  };
}

/** Compressed successes + skipped originals that still have a downloadable file. */
export function getSuccessfulBatchResults(jobs: BatchJobMap) {
  return Object.entries(jobs)
    .filter(
      ([, job]) =>
        (job.status === 'done' || job.status === 'skipped') &&
        job.result?.success &&
        Boolean(job.result.downloadUrl),
    )
    .map(([id, job]) => ({
      id,
      result: job.result!,
    }));
}
