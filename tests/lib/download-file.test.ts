import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dataUrlToBlob,
  ensureDownloadFileName,
  extractMimeTypeFromDataUrl,
  extensionFromMimeType,
  getTrackedObjectUrlCount,
  isDownloadLocked,
  releaseDownloadLock,
  revokeAllTrackedObjectUrls,
  trackObjectUrl,
  tryAcquireDownloadLock,
  withDownloadLock,
} from '@/lib/download-file';

describe('download-file helpers', () => {
  afterEach(() => {
    revokeAllTrackedObjectUrls();
    releaseDownloadLock();
  });

  it('extracts MIME types including WEBP', () => {
    expect(extractMimeTypeFromDataUrl('data:image/webp;base64,aa')).toBe('image/webp');
    expect(extractMimeTypeFromDataUrl('data:image/jpeg;base64,aa')).toBe('image/jpeg');
    expect(extensionFromMimeType('image/webp')).toBe('webp');
  });

  it('preserves and repairs .webp filenames', () => {
    expect(ensureDownloadFileName('photo-compressed.webp')).toBe('photo-compressed.webp');
    expect(
      ensureDownloadFileName('photo-compressed', {
        mimeType: 'image/webp',
        fallbackBase: 'compressed-image',
      }),
    ).toBe('photo-compressed.webp');
  });

  it('builds a WEBP Blob with the correct MIME type', () => {
    const payload = Buffer.from('RIFF....WEBP').toString('base64');
    const blob = dataUrlToBlob(`data:image/webp;base64,${payload}`);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/webp');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('prevents overlapping downloads with a process lock', async () => {
    expect(tryAcquireDownloadLock()).toBe(true);
    expect(isDownloadLocked()).toBe(true);
    expect(tryAcquireDownloadLock()).toBe(false);

    await expect(withDownloadLock(async () => 'nope')).rejects.toThrow(/already in progress/i);

    releaseDownloadLock();
    expect(isDownloadLocked()).toBe(false);

    await expect(withDownloadLock(async () => 'ok')).resolves.toBe('ok');
    expect(isDownloadLocked()).toBe(false);
  });

  it('tracks and revokes blob object URLs', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    trackObjectUrl('blob:test-url-1');
    trackObjectUrl('blob:test-url-2');
    expect(getTrackedObjectUrlCount()).toBe(2);

    revokeAllTrackedObjectUrls();
    expect(getTrackedObjectUrlCount()).toBe(0);
    expect(revokeSpy).toHaveBeenCalledTimes(2);
    revokeSpy.mockRestore();
  });
});
