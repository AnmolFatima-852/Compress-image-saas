import type { BatchJobMap } from '@/lib/batch-compress';
import { revokeAllTrackedObjectUrls } from '@/lib/download-file';

/**
 * Drops large in-memory data URLs from batch job results so GC can reclaim memory
 * after hundreds of compressions / clears.
 */
export function releaseBatchJobBuffers(jobs: BatchJobMap): void {
  for (const job of Object.values(jobs)) {
    if (job.result?.downloadUrl) {
      job.result.downloadUrl = undefined;
    }
    job.result = undefined;
    job.error = undefined;
  }
}

/** Full client cleanup used on clear / unmount. */
export function releaseClientBatchResources(options?: {
  jobs?: BatchJobMap;
  objectUrl?: string | null;
}): void {
  if (options?.jobs) {
    releaseBatchJobBuffers(options.jobs);
  }

  if (options?.objectUrl?.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(options.objectUrl);
    } catch {
      // Ignore.
    }
  }

  revokeAllTrackedObjectUrls();
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String((error as { name?: string }).name) : '';
  return name === 'AbortError';
}
