import { describe, expect, it } from 'vitest';
import {
  compressionSettingsChanged,
  shouldDisableCompressButton,
  shouldShowDownloadButton,
} from '@/components/hero-section';

describe('shouldShowDownloadButton', () => {
  it('returns false while compression is in progress', () => {
    expect(
      shouldShowDownloadButton({
        isCompressing: true,
        successCount: 2,
      }),
    ).toBe(false);
  });

  it('returns true after at least one successful compression', () => {
    expect(
      shouldShowDownloadButton({
        isCompressing: false,
        successCount: 1,
      }),
    ).toBe(true);
  });

  it('returns false when no images succeeded', () => {
    expect(
      shouldShowDownloadButton({
        isCompressing: false,
        successCount: 0,
      }),
    ).toBe(false);
  });
});

describe('shouldDisableCompressButton', () => {
  it('disables the compress button while compression is in progress', () => {
    expect(shouldDisableCompressButton({ fileCount: 1, isCompressing: true })).toBe(true);
  });

  it('disables the compress button until an image is selected', () => {
    expect(shouldDisableCompressButton({ fileCount: 0, isCompressing: false })).toBe(true);
  });

  it('keeps the compress button enabled when files are ready and compression is not in progress', () => {
    expect(shouldDisableCompressButton({ fileCount: 3, isCompressing: false })).toBe(false);
  });

  it('disables compress after a completed run until settings change', () => {
    expect(
      shouldDisableCompressButton({
        fileCount: 2,
        isCompressing: false,
        batchComplete: true,
        settingsChanged: false,
      }),
    ).toBe(true);

    expect(
      shouldDisableCompressButton({
        fileCount: 2,
        isCompressing: false,
        batchComplete: true,
        settingsChanged: true,
      }),
    ).toBe(false);
  });
});

describe('compressionSettingsChanged', () => {
  it('detects target size, unit, and format changes', () => {
    const previous = { targetSize: 100, unit: 'KB' as const, outputFormat: 'jpeg' as const };
    expect(compressionSettingsChanged(previous, null)).toBe(true);
    expect(compressionSettingsChanged(previous, previous)).toBe(false);
    expect(
      compressionSettingsChanged({ ...previous, targetSize: 50 }, previous),
    ).toBe(true);
    expect(
      compressionSettingsChanged({ ...previous, unit: 'MB' }, previous),
    ).toBe(true);
    expect(
      compressionSettingsChanged({ ...previous, outputFormat: 'webp' }, previous),
    ).toBe(true);
  });
});
