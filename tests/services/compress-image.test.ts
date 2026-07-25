import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { compressImageAction } from '@/services/compress-image';

describe('compressImageAction', () => {
  it('compresses a PNG image down toward the target size', async () => {
    const sourceBuffer = await sharp({
      create: {
        width: 128,
        height: 128,
        channels: 3,
        background: { r: 35, g: 120, b: 220 },
      },
    })
      .png()
      .toBuffer();

    const file = new File([sourceBuffer], 'test-image.png', { type: 'image/png' });
    const result = await compressImageAction(file, 20, 'KB');

    expect(result.success).toBe(true);
    expect(result.originalSize).toMatch(/(B|KB|MB)/);
    expect(result.compressedSize).toMatch(/(B|KB|MB)/);
    expect(result.savedSpace).not.toBe('—');
    expect(result.message).toMatch(/(Compressed|already within)/);
    expect(result.downloadUrl).toContain('data:image/png;base64,');
    expect(result.downloadFileName).toBe('test-image-compressed.png');
  });
});
