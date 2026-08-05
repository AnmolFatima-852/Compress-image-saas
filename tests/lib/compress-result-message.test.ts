import { describe, expect, it } from 'vitest';
import {
  PNG_TARGET_UNREACHABLE_MESSAGE,
  TARGET_UNREACHABLE_MESSAGE,
  buildCompressResultMessage,
} from '@/lib/compress-result-message';

describe('buildCompressResultMessage', () => {
  it('explains when the target cannot be reached without an invalid image', () => {
    expect(
      buildCompressResultMessage({
        compressedSize: 8_000,
        targetBytes: 1024,
        exactMatch: false,
        format: 'jpeg',
        resized: true,
      }),
    ).toBe(TARGET_UNREACHABLE_MESSAGE);
  });

  it('explains when an impossible PNG target is limited by lossless encoding', () => {
    expect(
      buildCompressResultMessage({
        compressedSize: 50 * 1024,
        targetBytes: 1 * 1024,
        exactMatch: false,
        format: 'png',
        resized: true,
      }),
    ).toBe(PNG_TARGET_UNREACHABLE_MESSAGE);
  });

  it('reports a tolerance match when the result is close enough', () => {
    expect(
      buildCompressResultMessage({
        compressedSize: 20 * 1024 + 500,
        targetBytes: 20 * 1024,
        exactMatch: true,
        format: 'jpeg',
        resized: false,
      }),
    ).toMatch(/matched the target within ±1 KB/i);
  });

  it('reports the closest under-target result when slightly undershooting', () => {
    expect(
      buildCompressResultMessage({
        compressedSize: 18 * 1024,
        targetBytes: 20 * 1024,
        exactMatch: false,
        format: 'png',
        resized: true,
      }),
    ).toMatch(/Closest match under the target after resizing/i);
  });
});
