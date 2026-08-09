import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { compressImageAction } from '@/services/compress-image';
import { resolveOutputFormat } from '@/lib/compress-format';
import { COMPRESS_REASON } from '@/lib/compress-outcome';
import { PNG_TARGET_UNREACHABLE_MESSAGE } from '@/lib/compress-result-message';
import { targetSizeToBytes } from '@/lib/target-size';

async function createNoisyJpeg(width: number, height: number, quality = 95) {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 1) {
    raw[i] = (i * 37 + (i % 251)) % 256;
  }

  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality })
    .toBuffer();
}

async function createNoisyPng(width: number, height: number) {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 1) {
    raw[i] = (i * 91 + (i % 199)) % 256;
  }

  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/** Node Buffer is not always assignable to BlobPart under strict DOM typings. */
function fileFromBuffer(buffer: Buffer, name: string, type: string) {
  return new File([Uint8Array.from(buffer)], name, { type });
}

describe('targetSizeToBytes', () => {
  it('converts KB and MB to bytes correctly', () => {
    expect(targetSizeToBytes(20, 'KB')).toBe(20 * 1024);
    expect(targetSizeToBytes(1, 'MB')).toBe(1024 * 1024);
    expect(targetSizeToBytes(1.5, 'MB')).toBe(Math.round(1.5 * 1024 * 1024));
  });

  it('rejects non-positive sizes', () => {
    expect(() => targetSizeToBytes(0, 'KB')).toThrow(/positive/);
    expect(() => targetSizeToBytes(-5, 'MB')).toThrow(/positive/);
  });
});

describe('resolveOutputFormat', () => {
  it('maps UI values without silently forcing JPEG', () => {
    expect(resolveOutputFormat('png')).toBe('png');
    expect(resolveOutputFormat('webp')).toBe('webp');
    expect(resolveOutputFormat('jpeg')).toBe('jpeg');
    expect(resolveOutputFormat('JPG')).toBe('jpeg');
  });

  it('rejects unknown formats', () => {
    expect(() => resolveOutputFormat('gif')).toThrow(/Unsupported output format/);
    expect(() => resolveOutputFormat(undefined)).toThrow(/Unsupported output format/);
  });
});

describe('compressImageAction', () => {
  it('skips compression and keeps the original when already at or under the target', async () => {
    const sourceBuffer = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();

    const file = fileFromBuffer(sourceBuffer, 'tiny.png', 'image/png');
    const result = await compressImageAction(file, 500, 'KB', 'png');

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.message).toBe(COMPRESS_REASON.alreadySmaller);
    expect(result.compressedSize).toBe(result.originalSize);
    expect(result.format).toBe('PNG');
    expect(result.downloadFileName).toBe('tiny.png');
    expect(result.downloadUrl).toContain('data:image/png;base64,');

    const base64 = result.downloadUrl?.split(',')[1] ?? '';
    expect(Buffer.from(base64, 'base64').byteLength).toBe(sourceBuffer.length);
  });

  it('skips even when a different output format is selected if the original is already under target', async () => {
    const sourceBuffer = await sharp({
      create: {
        width: 24,
        height: 24,
        channels: 3,
        background: { r: 40, g: 50, b: 60 },
      },
    })
      .png()
      .toBuffer();

    const file = fileFromBuffer(sourceBuffer, 'tiny.png', 'image/png');
    const result = await compressImageAction(file, 1, 'MB', 'jpeg');

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.format).toBe('PNG');
    expect(result.downloadUrl).toContain('data:image/png;base64,');
    expect(result.downloadFileName).toBe('tiny.png');
  });

  it('honors PNG output format in MIME type and filename', async () => {
    const sourceBuffer = await createNoisyJpeg(900, 700);
    expect(sourceBuffer.length).toBeGreaterThan(targetSizeToBytes(50, 'KB'));

    const file = fileFromBuffer(sourceBuffer, 'photo.jpg', 'image/jpeg');
    const result = await compressImageAction(file, 50, 'KB', 'png');

    expect(result.success).toBe(true);
    expect(result.format).toBe('PNG');
    expect(result.downloadUrl).toContain('data:image/png;base64,');
    expect(result.downloadFileName).toBe('photo-compressed.png');

    const base64 = result.downloadUrl?.split(',')[1] ?? '';
    expect(Buffer.from(base64, 'base64').byteLength).toBeLessThanOrEqual(sourceBuffer.length);
  }, 30_000);

  it('compresses PNG toward the target within ±10 KB without converting to JPEG', async () => {
    // Photo-like JPEG sources become large when re-encoded as PNG, so the
    // compressor must resize/optimize to approach the KB target.
    const sourceBuffer = await createNoisyJpeg(1600, 1200, 92);
    const targetKb = 100;
    const targetBytes = targetSizeToBytes(targetKb, 'KB');
    expect(sourceBuffer.length).toBeGreaterThan(targetBytes);

    const file = fileFromBuffer(sourceBuffer, 'diagram.jpg', 'image/jpeg');
    const result = await compressImageAction(file, targetKb, 'KB', 'png');

    expect(result.success).toBe(true);
    expect(result.format).toBe('PNG');
    expect(result.downloadUrl).toContain('data:image/png;base64,');
    expect(result.downloadFileName).toBe('diagram-compressed.png');
    expect(result.downloadUrl).not.toContain('data:image/jpeg');

    const base64 = result.downloadUrl?.split(',')[1] ?? '';
    const outputBytes = Buffer.from(base64, 'base64').byteLength;
    expect(outputBytes).toBeLessThanOrEqual(sourceBuffer.length);
    expect(Math.abs(outputBytes - targetBytes)).toBeLessThanOrEqual(10 * 1024);

    const meta = await sharp(Buffer.from(base64, 'base64')).metadata();
    expect(meta.format).toBe('png');
  }, 30_000);

  it('preserves PNG transparency while compressing', async () => {
    const width = 1200;
    const height = 900;
    const raw = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      const offset = i * 4;
      // High-entropy RGBA so the source stays above the target size.
      raw[offset] = (i * 1103515245 + 12345) >>> 16 & 0xff;
      raw[offset + 1] = (i * 214013 + 2531011) >>> 16 & 0xff;
      raw[offset + 2] = (i * 1664525 + 1013904223) >>> 16 & 0xff;
      raw[offset + 3] = 64 + ((i * 17) % 192);
    }

    const sourceBuffer = await sharp(raw, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 1 })
      .toBuffer();
    expect(sourceBuffer.length).toBeGreaterThan(targetSizeToBytes(80, 'KB'));

    const file = fileFromBuffer(sourceBuffer, 'glass.png', 'image/png');
    const result = await compressImageAction(file, 80, 'KB', 'png');

    expect(result.success).toBe(true);
    expect(result.format).toBe('PNG');

    const base64 = result.downloadUrl?.split(',')[1] ?? '';
    const output = Buffer.from(base64, 'base64');
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('png');
    expect(meta.hasAlpha).toBe(true);
    expect(output.byteLength).toBeLessThanOrEqual(sourceBuffer.length);
  }, 30_000);

  it('honors WEBP output format and approaches the target size', async () => {
    const sourceBuffer = await createNoisyPng(1200, 900);
    expect(sourceBuffer.length).toBeGreaterThan(targetSizeToBytes(30, 'KB'));

    const file = fileFromBuffer(sourceBuffer, 'metrics.png', 'image/png');
    const result = await compressImageAction(file, 30, 'KB', 'webp');

    expect(result.success).toBe(true);
    expect(result.format).toBe('WEBP');
    expect(result.downloadUrl).toContain('data:image/webp;base64,');
    expect(result.downloadFileName).toBe('metrics-compressed.webp');

    const base64 = result.downloadUrl?.split(',')[1] ?? '';
    const output = Buffer.from(base64, 'base64');
    expect(output.byteLength).toBeLessThanOrEqual(sourceBuffer.length);

    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('webp');
  }, 30_000);

  it('encodes JPEG sources to real WEBP bytes with a .webp download name', async () => {
    const sourceBuffer = await createNoisyJpeg(1000, 800, 90);
    expect(sourceBuffer.length).toBeGreaterThan(targetSizeToBytes(40, 'KB'));

    const file = fileFromBuffer(sourceBuffer, 'camera.jpg', 'image/jpeg');
    const result = await compressImageAction(file, 40, 'KB', 'webp');

    expect(result.success).toBe(true);
    expect(result.format).toBe('WEBP');
    expect(result.downloadFileName).toBe('camera-compressed.webp');
    expect(result.downloadUrl).toContain('data:image/webp;base64,');
    expect(result.downloadUrl).not.toContain('data:image/jpeg');
    expect(result.downloadFileName).not.toMatch(/\.jpe?g$/i);

    const base64 = result.downloadUrl?.split(',')[1] ?? '';
    const output = Buffer.from(base64, 'base64');
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('webp');
  }, 30_000);

  it('compresses JPEG toward a small target without increasing size', async () => {
    const sourceBuffer = await createNoisyJpeg(1200, 900);
    expect(sourceBuffer.length).toBeGreaterThan(targetSizeToBytes(20, 'KB'));

    const file = fileFromBuffer(sourceBuffer, 'large.jpg', 'image/jpeg');
    const result = await compressImageAction(file, 20, 'KB', 'jpeg');

    expect(result.success).toBe(true);
    expect(result.format).toBe('JPEG');
    expect(result.downloadUrl).toContain('data:image/jpeg;base64,');
    expect(result.downloadFileName).toBe('large-compressed.jpg');

    const base64 = result.downloadUrl?.split(',')[1];
    expect(base64).toBeTruthy();
    const outputBytes = Buffer.from(base64 ?? '', 'base64').byteLength;
    expect(outputBytes).toBeLessThanOrEqual(sourceBuffer.length);
  });

  it('returns a downloadable closest result for an extremely small target', async () => {
    const sourceBuffer = await createNoisyJpeg(1400, 1000, 95);
    const targetKb = 0.1;
    const targetBytes = targetSizeToBytes(targetKb, 'KB');
    expect(sourceBuffer.length).toBeGreaterThan(targetBytes);

    const file = fileFromBuffer(sourceBuffer, 'huge.jpg', 'image/jpeg');
    const result = await compressImageAction(file, targetKb, 'KB', 'jpeg');

    expect(result.success).toBe(true);
    expect(result.format).toBe('JPEG');
    expect(result.downloadUrl).toContain('data:image/jpeg;base64,');
    expect(result.message).toBeTruthy();

    const base64 = result.downloadUrl?.split(',')[1] ?? '';
    const outputBytes = Buffer.from(base64, 'base64').byteLength;
    expect(outputBytes).toBeGreaterThan(0);
    expect(outputBytes).toBeLessThanOrEqual(sourceBuffer.length);
  }, 30_000);

  it('explains impossible tiny PNG targets and still returns a valid PNG', async () => {
    const sourceBuffer = await createNoisyJpeg(1600, 1200, 92);
    const targetKb = 1;
    const targetBytes = targetSizeToBytes(targetKb, 'KB');
    expect(sourceBuffer.length).toBeGreaterThan(targetBytes);

    const file = fileFromBuffer(sourceBuffer, 'photo.jpg', 'image/jpeg');
    const result = await compressImageAction(file, targetKb, 'KB', 'png');

    expect(result.success).toBe(true);
    expect(result.format).toBe('PNG');
    expect(result.downloadUrl).toContain('data:image/png;base64,');
    expect(result.downloadUrl).not.toContain('data:image/jpeg');

    const base64 = result.downloadUrl?.split(',')[1] ?? '';
    const output = Buffer.from(base64, 'base64');
    expect(output.byteLength).toBeGreaterThan(0);
    expect(output.byteLength).toBeLessThanOrEqual(sourceBuffer.length);

    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('png');

    // If compression got at/under the tiny target, that is ideal; otherwise explain
    // that lossless PNG cannot shrink further.
    if (output.byteLength > targetBytes) {
      expect(result.message).toBe(PNG_TARGET_UNREACHABLE_MESSAGE);
    }
  }, 35_000);
});
