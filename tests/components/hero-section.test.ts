import { describe, expect, it } from 'vitest';
import { shouldShowDownloadButton } from '@/components/hero-section';

describe('shouldShowDownloadButton', () => {
  it('returns false while compression is in progress', () => {
    expect(
      shouldShowDownloadButton({
        isCompressing: true,
        result: { success: true, downloadUrl: 'https://example.com/file.jpg' } as never,
      }),
    ).toBe(false);
  });

  it('returns true only after a successful compression with a download URL', () => {
    expect(
      shouldShowDownloadButton({
        isCompressing: false,
        result: { success: true, downloadUrl: 'https://example.com/file.jpg' } as never,
      }),
    ).toBe(true);
  });

  it('returns false after a failed compression', () => {
    expect(
      shouldShowDownloadButton({
        isCompressing: false,
        result: { success: false, downloadUrl: null } as never,
      }),
    ).toBe(false);
  });
});
