import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCompressedImagesPdf,
  buildImagesToPdfDownloadName,
  collectPdfEntriesFromBatchItems,
  computeCenteredImageFit,
  detectImageMimeType,
  isJsPdfNativeMime,
  mimeToPdfNativeFormat,
  resolvePdfImageFormat,
  toFriendlyPdfError,
} from '@/lib/batch-pdf';
import type { BatchImageItem } from '@/lib/batch-upload';

/** 1×1 PNG used to smoke-test PDF generation. */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Minimal JPEG (1×1) */
const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z';

describe('computeCenteredImageFit', () => {
  it('preserves aspect ratio and centers within the page', () => {
    const fit = computeCenteredImageFit({
      pageWidth: 600,
      pageHeight: 800,
      imageWidth: 300,
      imageHeight: 150,
      margin: 50,
    });

    expect(fit.width).toBe(500);
    expect(fit.height).toBeCloseTo(250, 5);
    expect(fit.x).toBeCloseTo(50, 5);
    expect(fit.y).toBeCloseTo((800 - 250) / 2, 5);
    expect(fit.width / fit.height).toBeCloseTo(300 / 150, 5);
  });

  it('supports portrait images without distortion', () => {
    const fit = computeCenteredImageFit({
      pageWidth: 600,
      pageHeight: 800,
      imageWidth: 100,
      imageHeight: 400,
      margin: 40,
    });

    expect(fit.height).toBe(720);
    expect(fit.width).toBeCloseTo(180, 5);
    expect(fit.x).toBeCloseTo((600 - 180) / 2, 5);
    expect(fit.y).toBe(40);
  });
});

describe('detectImageMimeType', () => {
  it('detects MIME from data URL, filename, and treats WEBP as non-native', () => {
    expect(detectImageMimeType('data:image/png;base64,aaa', 'x.jpg')).toBe('image/png');
    expect(detectImageMimeType('data:image/jpeg;base64,aaa', 'photo.png')).toBe('image/jpeg');
    expect(detectImageMimeType('data:application/octet-stream;base64,aaa', 'photo.webp')).toBe('image/webp');
    expect(detectImageMimeType(TINY_PNG, 'mystery.bin')).toBe('image/png');
    expect(detectImageMimeType('data:image/webp;base64,aaa', 'a.webp')).toBe('image/webp');
  });

  it('marks only JPEG and PNG as jsPDF-native', () => {
    expect(isJsPdfNativeMime('image/jpeg')).toBe(true);
    expect(isJsPdfNativeMime('image/png')).toBe(true);
    expect(isJsPdfNativeMime('image/webp')).toBe(false);
    expect(isJsPdfNativeMime('image/avif')).toBe(false);
    expect(mimeToPdfNativeFormat('image/webp')).toBeNull();
    expect(mimeToPdfNativeFormat('image/jpeg')).toBe('JPEG');
  });
});

describe('resolvePdfImageFormat', () => {
  it('detects format from data URL and filename', () => {
    expect(resolvePdfImageFormat('x.jpg', 'data:image/png;base64,aaa')).toBe('PNG');
    expect(resolvePdfImageFormat('photo.webp', 'data:application/octet-stream;base64,aaa')).toBe('WEBP');
    expect(resolvePdfImageFormat('photo.jpg', 'data:image/jpeg;base64,aaa')).toBe('JPEG');
    expect(resolvePdfImageFormat('photo.avif', 'data:application/octet-stream;base64,aaa')).toBe('UNKNOWN');
  });
});

describe('toFriendlyPdfError', () => {
  it('never surfaces the raw UNKNOWN addImage error', () => {
    expect(toFriendlyPdfError(new Error('addImage does not support files of type UNKNOWN'))).toMatch(
      /Unable to create the PDF/i,
    );
    expect(toFriendlyPdfError(new Error('addImage does not support files of type UNKNOWN'))).not.toMatch(
      /UNKNOWN/,
    );
  });
});

describe('buildCompressedImagesPdf', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a multi-page PDF blob from PNG images', async () => {
    const pdf = await buildCompressedImagesPdf([
      { fileName: 'one-compressed.png', dataUrl: TINY_PNG },
      { fileName: 'two-compressed.png', dataUrl: TINY_PNG },
    ]);

    expect(pdf).toBeInstanceOf(Blob);
    expect(pdf.type).toContain('pdf');
    expect(pdf.size).toBeGreaterThan(100);
  });

  it('embeds JPEG images without UNKNOWN errors', async () => {
    const pdf = await buildCompressedImagesPdf([{ fileName: 'photo.jpg', dataUrl: TINY_JPEG }]);
    expect(pdf).toBeInstanceOf(Blob);
    expect(pdf.size).toBeGreaterThan(50);
  });

  it('converts WEBP to PNG in memory before embedding', async () => {
    const webpDataUrl = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

    class MockImage {
      naturalWidth = 2;
      naturalHeight = 2;
      width = 2;
      height = 2;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        clearRect: vi.fn(),
        drawImage: vi.fn(),
      }),
      toDataURL: () => TINY_PNG,
    };

    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') return canvas;
        throw new Error(`Unexpected element: ${tag}`);
      },
    });

    const pdf = await buildCompressedImagesPdf([{ fileName: 'shot.webp', dataUrl: webpDataUrl }]);
    expect(pdf).toBeInstanceOf(Blob);
    expect(pdf.size).toBeGreaterThan(50);
    expect(canvas.toDataURL()).toBe(TINY_PNG);
  });
});

describe('images-to-pdf helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('names downloads without compression wording', () => {
    expect(buildImagesToPdfDownloadName(1)).toMatch(/^image-to-pdf-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(buildImagesToPdfDownloadName(3)).toMatch(/^images-to-pdf-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('collects original files in list order for PDF pages', async () => {
    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(file: File) {
        this.result = `data:${file.type};base64,mock-${file.name}`;
        this.onload?.();
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    const items: BatchImageItem[] = [
      {
        id: '1',
        file: new File([new Uint8Array([1])], 'first.png', { type: 'image/png' }),
        previewUrl: 'blob:1',
      },
      {
        id: '2',
        file: new File([new Uint8Array([2])], 'second.png', { type: 'image/png' }),
        previewUrl: 'blob:2',
      },
    ];

    const entries = await collectPdfEntriesFromBatchItems(items);
    expect(entries.map((entry) => entry.fileName)).toEqual(['first.png', 'second.png']);
    expect(entries[0]?.dataUrl).toBe('data:image/png;base64,mock-first.png');
  });
});
