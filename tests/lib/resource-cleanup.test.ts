import { describe, expect, it } from 'vitest';
import type { BatchJobMap } from '@/lib/batch-compress';
import { isAbortError, releaseBatchJobBuffers } from '@/lib/resource-cleanup';

describe('resource-cleanup', () => {
  it('clears download URL buffers from batch jobs', () => {
    const jobs: BatchJobMap = {
      a: {
        status: 'done',
        progress: 100,
        result: {
          success: true,
          originalSize: '10 KB',
          compressedSize: '5 KB',
          savedSpace: '5 KB',
          savedPercentage: '50%',
          format: 'JPEG',
          resolution: '1 × 1',
          compressionRatio: '2.00:1',
          message: 'ok',
          downloadUrl: 'data:image/jpeg;base64,aaaa',
          downloadFileName: 'a.jpg',
        },
        error: undefined,
      },
    };

    releaseBatchJobBuffers(jobs);

    expect(jobs.a?.result).toBeUndefined();
    expect(jobs.a?.error).toBeUndefined();
  });

  it('detects AbortError by name', () => {
    const error = new Error('Compression cancelled.');
    error.name = 'AbortError';
    expect(isAbortError(error)).toBe(true);
    expect(isAbortError(new Error('other'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
