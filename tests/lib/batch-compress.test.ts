import { describe, expect, it, vi } from 'vitest';
import {
  computeOverallBatchProgress,
  countBatchOutcomes,
  createInitialBatchJobs,
  runBatchCompression,
} from '@/lib/batch-compress';
import type { BatchImageItem } from '@/lib/batch-upload';
import type { CompressImageResult } from '@/services/compress-image';

function makeItem(name: string): BatchImageItem {
  return {
    id: name,
    file: new File([new Uint8Array(32)], name, { type: 'image/png' }),
    previewUrl: `blob:${name}`,
  };
}

function okResult(name: string): CompressImageResult {
  return {
    success: true,
    originalSize: '10 KB',
    compressedSize: '5 KB',
    savedSpace: '5 KB',
    savedPercentage: '50%',
    format: 'JPEG',
    resolution: '100 × 100',
    compressionRatio: '2.00:1',
    message: 'ok',
    downloadUrl: `data:image/jpeg;base64,${name}`,
    downloadFileName: `${name}-compressed.jpg`,
  };
}

describe('computeOverallBatchProgress', () => {
  it('weights completed items and the active item progress', () => {
    expect(computeOverallBatchProgress(0, 4, 0)).toBe(0);
    expect(computeOverallBatchProgress(1, 4, 0)).toBe(25);
    expect(computeOverallBatchProgress(1, 4, 50)).toBe(38);
    expect(computeOverallBatchProgress(4, 4, 0)).toBe(100);
  });
});

describe('runBatchCompression', () => {
  it('compresses every image sequentially with shared target settings', async () => {
    const items = [makeItem('a.png'), makeItem('b.png'), makeItem('c.png')];
    const calls: Array<{ name: string; targetSize: number; unit: string; format: string }> = [];
    const progressSamples: number[] = [];

    const compressFn = vi.fn(async (file: File, targetSize: number, unit: 'KB' | 'MB', outputFormat: string) => {
      calls.push({ name: file.name, targetSize, unit, format: outputFormat });
      if (file.name === 'b.png') {
        return {
          ...okResult(file.name),
          success: false,
          message: 'failed',
          downloadUrl: undefined,
        } satisfies CompressImageResult;
      }
      return okResult(file.name);
    });

    const finalJobs = await runBatchCompression({
      items,
      targetSize: 50,
      unit: 'KB',
      outputFormat: 'webp',
      compressFn,
      onJobsChange: () => undefined,
      onOverallProgress: (value) => {
        progressSamples.push(value);
      },
      timeoutMs: 5_000,
    });

    expect(compressFn).toHaveBeenCalledTimes(3);
    expect(calls.every((call) => call.targetSize === 50 && call.unit === 'KB' && call.format === 'webp')).toBe(
      true,
    );
    expect(finalJobs['a.png']?.status).toBe('done');
    expect(finalJobs['b.png']?.status).toBe('error');
    expect(finalJobs['c.png']?.status).toBe('done');
    expect(countBatchOutcomes(finalJobs)).toEqual({ total: 3, done: 2, skipped: 0, failed: 1 });
    expect(progressSamples.at(-1)).toBe(100);
    expect(createInitialBatchJobs(items)['a.png']?.status).toBe('queued');
  });

  it('marks already-under-target images as skipped and continues the batch', async () => {
    const items = [makeItem('small.png'), makeItem('big.png')];

    const compressFn = vi.fn(async (file: File) => {
      if (file.name === 'small.png') {
        return {
          ...okResult(file.name),
          skipped: true,
          message: 'Already smaller than target',
        } satisfies CompressImageResult;
      }
      return okResult(file.name);
    });

    const finalJobs = await runBatchCompression({
      items,
      targetSize: 50,
      unit: 'KB',
      outputFormat: 'jpeg',
      compressFn,
      onJobsChange: () => undefined,
      onOverallProgress: () => undefined,
      timeoutMs: 5_000,
    });

    expect(finalJobs['small.png']?.status).toBe('skipped');
    expect(finalJobs['big.png']?.status).toBe('done');
    expect(countBatchOutcomes(finalJobs)).toEqual({ total: 2, done: 1, skipped: 1, failed: 0 });
  });

  it('stops scheduling further images when AbortSignal is aborted', async () => {
    const items = [makeItem('a.png'), makeItem('b.png'), makeItem('c.png')];
    const controller = new AbortController();
    let calls = 0;

    const compressFn = vi.fn(async (file: File) => {
      calls += 1;
      if (file.name === 'a.png') {
        controller.abort();
      }
      return okResult(file.name);
    });

    await expect(
      runBatchCompression({
        items,
        targetSize: 50,
        unit: 'KB',
        outputFormat: 'jpeg',
        compressFn,
        onJobsChange: () => undefined,
        onOverallProgress: () => undefined,
        signal: controller.signal,
        timeoutMs: 5_000,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(calls).toBe(1);
    expect(compressFn).toHaveBeenCalledTimes(1);
  });
});
