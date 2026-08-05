import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  buildCompressedImagesZip,
  dataUrlToUint8Array,
  uniqueZipFileName,
} from '@/lib/batch-zip';

function toDataUrl(text: string) {
  return `data:image/png;base64,${Buffer.from(text, 'utf8').toString('base64')}`;
}

describe('uniqueZipFileName', () => {
  it('preserves the original name and extension, then suffixes duplicates', () => {
    const used = new Set<string>();
    const first = uniqueZipFileName('photo-compressed.webp', used);
    used.add(first);
    const second = uniqueZipFileName('photo-compressed.webp', used);
    used.add(second);

    expect(first).toBe('photo-compressed.webp');
    expect(second).toBe('photo-compressed-2.webp');
  });
});

describe('buildCompressedImagesZip', () => {
  it('includes every compressed image with preserved filenames and extensions', async () => {
    const webpDataUrl = `data:image/webp;base64,${Buffer.from('webp-bytes', 'utf8').toString('base64')}`;
    const zipBlob = await buildCompressedImagesZip([
      { fileName: 'alpha-compressed.jpg', dataUrl: toDataUrl('jpeg-bytes') },
      { fileName: 'beta-compressed.png', dataUrl: toDataUrl('png-bytes') },
      { fileName: 'gamma-compressed.webp', dataUrl: webpDataUrl },
    ]);

    expect(zipBlob.type).toContain('zip');

    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    const names = Object.keys(zip.files).sort();

    expect(names).toEqual([
      'alpha-compressed.jpg',
      'beta-compressed.png',
      'gamma-compressed.webp',
    ]);

    const jpg = await zip.file('alpha-compressed.jpg')?.async('uint8array');
    expect(jpg).toEqual(dataUrlToUint8Array(toDataUrl('jpeg-bytes')));

    const webp = await zip.file('gamma-compressed.webp')?.async('uint8array');
    expect(webp).toEqual(dataUrlToUint8Array(webpDataUrl));
  });

  it('adds a .webp extension when the MIME type is WEBP but the name has none', async () => {
    const webpDataUrl = `data:image/webp;base64,${Buffer.from('webp-only', 'utf8').toString('base64')}`;
    const zipBlob = await buildCompressedImagesZip([{ fileName: 'shot-compressed', dataUrl: webpDataUrl }]);
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual(['shot-compressed.webp']);
  });
});
