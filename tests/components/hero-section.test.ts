import { describe, expect, it } from 'vitest';
import { shouldDisableCompressButton, shouldShowDownloadButton } from '@/components/hero-section';

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

describe('shouldDisableCompressButton', () => {
  it('disables the compress button while compression is in progress', () => {
    expect(shouldDisableCompressButton({ file: new File(['test'], 'test.png', { type: 'image/png' }), isCompressing: true })).toBe(true);
  });

  it('disables the compress button until an image is selected', () => {
    expect(shouldDisableCompressButton({ file: null, isCompressing: false })).toBe(true);
  });

  it('keeps the compress button enabled when a file is ready and compression is not in progress', () => {
    expect(shouldDisableCompressButton({ file: new File(['test'], 'test.png', { type: 'image/png' }), isCompressing: false })).toBe(false);
  });
});
