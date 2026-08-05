import { describe, expect, it } from 'vitest';
import {
  buildDownloadFileName,
  buildDownloadMimeType,
  formatsMatch,
  resolveOutputFormat,
} from '@/lib/compress-format';

describe('resolveOutputFormat', () => {
  it('never silently coerces WEBP or PNG to JPEG', () => {
    expect(resolveOutputFormat('webp')).toBe('webp');
    expect(resolveOutputFormat('WEBP')).toBe('webp');
    expect(resolveOutputFormat('png')).toBe('png');
    expect(resolveOutputFormat('jpeg')).toBe('jpeg');
  });
});

describe('download naming and MIME', () => {
  it('keeps extension and MIME aligned with the selected format', () => {
    expect(buildDownloadFileName('photo.jpg', 'webp')).toBe('photo-compressed.webp');
    expect(buildDownloadFileName('photo.png', 'jpeg')).toBe('photo-compressed.jpg');
    expect(buildDownloadMimeType('webp')).toBe('image/webp');
    expect(buildDownloadMimeType('png')).toBe('image/png');
    expect(buildDownloadMimeType('jpeg')).toBe('image/jpeg');
  });
});

describe('formatsMatch', () => {
  it('treats jpg and jpeg as the same format', () => {
    expect(formatsMatch('jpg', 'jpeg')).toBe(true);
    expect(formatsMatch('jpeg', 'jpeg')).toBe(true);
    expect(formatsMatch('webp', 'jpeg')).toBe(false);
    expect(formatsMatch('webp', 'webp')).toBe(true);
  });
});
