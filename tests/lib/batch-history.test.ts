import { describe, expect, it } from 'vitest';
import type { BatchJobMap } from '@/lib/batch-compress';
import {
  batchPdfStoragePath,
  batchZipStoragePath,
  formatProcessingDuration,
  normalizeBatchOutputFormat,
  shortBatchId,
  summarizeSuccessfulBatch,
} from '@/lib/batch-history';

function makeDoneJob(originalBytes: number, compressedBytes: number) {
  return {
    status: 'done' as const,
    progress: 100,
    result: {
      success: true,
      originalSize: `${originalBytes}`,
      compressedSize: `${compressedBytes}`,
      savedSpace: `${originalBytes - compressedBytes}`,
      savedPercentage: '50%',
      format: 'JPEG',
      resolution: '100 × 100',
      compressionRatio: '2.00:1',
      message: 'ok',
      downloadUrl: 'data:image/jpeg;base64,aa',
      downloadFileName: 'photo.jpg',
      originalSizeBytes: originalBytes,
      compressedSizeBytes: compressedBytes,
    },
  };
}

describe('summarizeSuccessfulBatch', () => {
  it('aggregates successful jobs and ignores failures', () => {
    const jobs: BatchJobMap = {
      a: makeDoneJob(1000, 400),
      b: makeDoneJob(2000, 800),
      c: { status: 'error', progress: 100, error: 'failed' },
    };

    expect(summarizeSuccessfulBatch(jobs)).toEqual({
      imageCount: 2,
      originalTotalSize: 3000,
      compressedTotalSize: 1200,
      savedSpace: 1800,
      compressionRatio: '2.50:1',
    });
  });

  it('returns null when nothing succeeded', () => {
    const jobs: BatchJobMap = {
      a: { status: 'error', progress: 100, error: 'failed' },
    };
    expect(summarizeSuccessfulBatch(jobs)).toBeNull();
  });
});

describe('batch history helpers', () => {
  it('formats processing duration', () => {
    expect(formatProcessingDuration(450)).toBe('450 ms');
    expect(formatProcessingDuration(1500)).toBe('1.5 s');
    expect(formatProcessingDuration(65_000)).toBe('1m 5s');
  });

  it('builds storage paths and short ids', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(batchZipStoragePath('user-1', id)).toBe(`user-1/batches/${id}.zip`);
    expect(batchPdfStoragePath('user-1', id)).toBe(`user-1/batches/${id}.pdf`);
    expect(shortBatchId(id)).toBe('A1B2C3D4');
  });

  it('normalizes output format labels', () => {
    expect(normalizeBatchOutputFormat('jpeg')).toBe('JPEG');
    expect(normalizeBatchOutputFormat('jpg')).toBe('JPEG');
    expect(normalizeBatchOutputFormat('webp')).toBe('WEBP');
    expect(normalizeBatchOutputFormat('png')).toBe('PNG');
    expect(normalizeBatchOutputFormat('')).toBe('JPEG');
  });
});
