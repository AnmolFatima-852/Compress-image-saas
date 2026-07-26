import { beforeEach, describe, expect, it } from 'vitest';
import { appendCompressionHistory, getCompressionHistory } from '@/lib/compression-history';

describe('compression history helpers', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
  });

  it('stores and retrieves history entries for a user', () => {
    const entry = {
      id: 'entry-1',
      fileName: 'photo.png',
      format: 'JPEG',
      originalSize: '2.1 MB',
      compressedSize: '450 KB',
      savedSpace: '1.7 MB',
      savedPercentage: '80%',
      resolution: '1200 × 800',
      compressionRatio: '4.67:1',
      createdAt: '2026-07-26T00:00:00.000Z',
      downloadUrl: 'data:image/jpeg;base64,abc',
      downloadFileName: 'photo-compressed.jpg',
    };

    appendCompressionHistory('user-1', entry);

    expect(getCompressionHistory('user-1')).toHaveLength(1);
    expect(getCompressionHistory('user-2')).toHaveLength(0);
  });
});
