import { describe, expect, it } from 'vitest';
import type { BatchJobMap } from '@/lib/batch-compress';
import {
  COMPRESS_REASON,
  buildBatchSummaryToast,
  toUnifiedCompressReason,
} from '@/lib/compress-outcome';

describe('toUnifiedCompressReason', () => {
  it('maps common failures to unified reasons', () => {
    expect(toUnifiedCompressReason(new Error('Unsupported output format: gif'))).toBe(
      COMPRESS_REASON.unsupportedFormat,
    );
    expect(toUnifiedCompressReason(new Error('Could not be reached without invalid image'))).toBe(
      COMPRESS_REASON.severeQualityLoss,
    );
    expect(toUnifiedCompressReason(new Error('boom'))).toBe(COMPRESS_REASON.compressionFailed);
  });
});

describe('buildBatchSummaryToast', () => {
  it('summarizes mixed batch outcomes without stopping language', () => {
    const jobs: BatchJobMap = {
      a: {
        status: 'done',
        progress: 100,
        result: {
          success: true,
          originalSize: '1',
          compressedSize: '1',
          savedSpace: '0',
          savedPercentage: '0%',
          format: 'JPEG',
          resolution: '1 × 1',
          compressionRatio: '1:1',
          message: 'ok',
        },
      },
      b: {
        status: 'skipped',
        progress: 100,
        result: {
          success: true,
          skipped: true,
          originalSize: '1',
          compressedSize: '1',
          savedSpace: '0',
          savedPercentage: '0%',
          format: 'JPEG',
          resolution: '1 × 1',
          compressionRatio: '1:1',
          message: COMPRESS_REASON.alreadySmaller,
        },
      },
      c: {
        status: 'error',
        progress: 100,
        error: COMPRESS_REASON.compressionFailed,
      },
    };

    expect(buildBatchSummaryToast(jobs)).toEqual({
      type: 'success',
      message: 'Batch complete: 1 compressed, 1 skipped, 1 failed of 3.',
    });
  });

  it('uses a clear error toast when every image fails', () => {
    const jobs: BatchJobMap = {
      a: { status: 'error', progress: 100, error: COMPRESS_REASON.unsupportedFormat },
    };
    expect(buildBatchSummaryToast(jobs)).toEqual({
      type: 'error',
      message: COMPRESS_REASON.unsupportedFormat,
    });
  });
});
