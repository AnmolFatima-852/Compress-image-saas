import { jsPDF } from 'jspdf';
import type { BatchJobMap } from '@/lib/batch-compress';
import { getSuccessfulBatchResults } from '@/lib/batch-compress';
import type { BatchImageItem } from '@/lib/batch-upload';

export type PdfImageEntry = {
  fileName: string;
  dataUrl: string;
};

export type AppToolMode = 'compress' | 'images-to-pdf';

/** Formats jsPDF can embed reliably without UNKNOWN errors. */
export type PdfNativeFormat = 'JPEG' | 'PNG';

const PAGE_MARGIN_PT = 28;
const FRIENDLY_PDF_ERROR =
  'Unable to create the PDF from one or more images. Please try again with JPEG, PNG, or WEBP files.';

/** Fit an image inside a page box while preserving aspect ratio and centering it. */
export function computeCenteredImageFit({
  pageWidth,
  pageHeight,
  imageWidth,
  imageHeight,
  margin = PAGE_MARGIN_PT,
}: {
  pageWidth: number;
  pageHeight: number;
  imageWidth: number;
  imageHeight: number;
  margin?: number;
}) {
  const maxWidth = Math.max(1, pageWidth - margin * 2);
  const maxHeight = Math.max(1, pageHeight - margin * 2);
  const imageRatio = imageWidth / Math.max(imageHeight, 1);
  const boxRatio = maxWidth / maxHeight;

  let width: number;
  let height: number;

  if (imageRatio > boxRatio) {
    width = maxWidth;
    height = maxWidth / imageRatio;
  } else {
    height = maxHeight;
    width = maxHeight * imageRatio;
  }

  return {
    width,
    height,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
  };
}

function normalizeMimeSubtype(value: string): string {
  const subtype = value.toLowerCase().replace(/^image\//, '');
  if (subtype === 'jpg') return 'jpeg';
  return subtype;
}

/** Sniff image type from base64 payload magic bytes. */
export function sniffMimeFromDataUrlBytes(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;

  const meta = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  if (!meta.includes(';base64') || payload.length < 8) return null;

  try {
    const binary = atob(payload.slice(0, 48));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    // JPEG
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }

    // PNG
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return 'image/png';
    }

    // WEBP (RIFF....WEBP)
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image/webp';
    }

    // AVIF / HEIC family via ftyp brand
    const asText = String.fromCharCode(...bytes.slice(0, 16));
    if (asText.includes('ftyp')) {
      if (asText.includes('avif') || asText.includes('avis')) return 'image/avif';
      if (asText.includes('heic') || asText.includes('heif')) return 'image/heic';
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Detect image MIME type from data URL header, magic bytes, then filename.
 * Prefers declared MIME when it is a known image type.
 */
export function detectImageMimeType(dataUrl: string, fileName = ''): string {
  const mimeMatch = dataUrl.match(/^data:([^;,]+)[;,]/i);
  const declared = mimeMatch?.[1]?.toLowerCase() ?? '';

  if (declared.startsWith('image/')) {
    const subtype = normalizeMimeSubtype(declared);
    if (subtype === 'jpeg' || subtype === 'png' || subtype === 'webp' || subtype === 'avif' || subtype === 'gif') {
      return `image/${subtype}`;
    }
  }

  const sniffed = sniffMimeFromDataUrlBytes(dataUrl);
  if (sniffed) return sniffed;

  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.avif')) return 'image/avif';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';

  return declared.startsWith('image/') ? declared : 'application/octet-stream';
}

/** True when jsPDF can embed the MIME natively (JPEG/PNG only — WEBP often becomes UNKNOWN). */
export function isJsPdfNativeMime(mime: string): boolean {
  const subtype = normalizeMimeSubtype(mime);
  return subtype === 'jpeg' || subtype === 'png';
}

export function mimeToPdfNativeFormat(mime: string): PdfNativeFormat | null {
  const subtype = normalizeMimeSubtype(mime);
  if (subtype === 'jpeg') return 'JPEG';
  if (subtype === 'png') return 'PNG';
  return null;
}

/**
 * Resolves the format label for an image. Returns JPEG/PNG when native;
 * WEBP (and other types) are reported so callers can convert before addImage.
 */
export function resolvePdfImageFormat(fileName: string, dataUrl: string): 'JPEG' | 'PNG' | 'WEBP' | 'UNKNOWN' {
  const mime = detectImageMimeType(dataUrl, fileName);
  const subtype = normalizeMimeSubtype(mime);
  if (subtype === 'jpeg') return 'JPEG';
  if (subtype === 'png') return 'PNG';
  if (subtype === 'webp') return 'WEBP';
  return 'UNKNOWN';
}

export function toFriendlyPdfError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/UNKNOWN|addImage|does not support|decode|canvas|Image/i.test(message)) {
    return FRIENDLY_PDF_ERROR;
  }
  if (message && message.length <= 160 && !/TypeError|Error:/i.test(message)) {
    return message;
  }
  return 'Unable to create the PDF. Please try again.';
}

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image decoding is unavailable in this environment.'));
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to decode the image for PDF generation.'));
    image.src = dataUrl;
  });
}

/**
 * Converts any decodable image data URL to a PNG data URL in memory (canvas),
 * preserving the source pixel dimensions for quality.
 */
export async function convertDataUrlToPngDataUrl(dataUrl: string): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('PNG conversion requires a browser environment.');
  }

  const image = await loadHtmlImage(dataUrl);
  const width = Math.max(1, image.naturalWidth || image.width);
  const height = Math.max(1, image.naturalHeight || image.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to prepare the image for PDF generation.');
  }

  // Transparent PNG background for formats with alpha.
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/png');
}

export type PreparedPdfImage = {
  dataUrl: string;
  format: PdfNativeFormat;
  width: number;
  height: number;
};

/**
 * Ensures the image is in a jsPDF-safe format before addImage.
 * JPEG/PNG pass through; WEBP and other types convert to PNG in memory.
 */
export async function prepareImageForPdf(entry: PdfImageEntry): Promise<PreparedPdfImage> {
  const mime = detectImageMimeType(entry.dataUrl, entry.fileName);
  const nativeFormat = mimeToPdfNativeFormat(mime);

  if (nativeFormat) {
    // Prefer HTMLImage dimensions (more reliable than jsPDF probes for odd headers).
    try {
      const image = await loadHtmlImage(entry.dataUrl);
      return {
        dataUrl: entry.dataUrl,
        format: nativeFormat,
        width: Math.max(1, image.naturalWidth || image.width),
        height: Math.max(1, image.naturalHeight || image.height),
      };
    } catch {
      const probe = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const props = probe.getImageProperties(entry.dataUrl);
      return {
        dataUrl: entry.dataUrl,
        format: nativeFormat,
        width: Math.max(1, props.width),
        height: Math.max(1, props.height),
      };
    }
  }

  // WEBP / AVIF / UNKNOWN → PNG so addImage never sees UNKNOWN.
  const pngDataUrl = await convertDataUrlToPngDataUrl(entry.dataUrl);
  const image = await loadHtmlImage(pngDataUrl);

  return {
    dataUrl: pngDataUrl,
    format: 'PNG',
    width: Math.max(1, image.naturalWidth || image.width),
    height: Math.max(1, image.naturalHeight || image.height),
  };
}

export function collectPdfEntriesFromBatchJobs(jobs: BatchJobMap): PdfImageEntry[] {
  return getSuccessfulBatchResults(jobs).flatMap(({ result }, index) => {
    if (!result.downloadUrl) {
      return [];
    }

    const fileName = result.downloadFileName?.trim() || `compressed-image-${index + 1}`;
    // Preserve .webp (and other) extensions in the entry name for logging / consistency.
    // Embedding still converts unsupported types to PNG inside prepareImageForPdf.
    return [
      {
        fileName,
        dataUrl: result.downloadUrl,
      },
    ];
  });
}

export function buildBatchPdfDownloadName(imageCount: number) {
  const stamp = new Date().toISOString().slice(0, 10);
  return imageCount > 1 ? `compressed-images-${stamp}.pdf` : `compressed-image-${stamp}.pdf`;
}

export function buildImagesToPdfDownloadName(imageCount: number) {
  const stamp = new Date().toISOString().slice(0, 10);
  return imageCount > 1 ? `images-to-pdf-${stamp}.pdf` : `image-to-pdf-${stamp}.pdf`;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      // Normalize empty/incorrect MIME so detection can fall back to magic bytes / filename.
      if (result.startsWith('data:') && (!file.type || result.startsWith('data:application/octet-stream'))) {
        const sniffed = sniffMimeFromDataUrlBytes(result);
        if (sniffed) {
          const comma = result.indexOf(',');
          resolve(`data:${sniffed};base64,${result.slice(comma + 1)}`);
          return;
        }
        if (file.type) {
          const comma = result.indexOf(',');
          resolve(`data:${file.type};base64,${result.slice(comma + 1)}`);
          return;
        }
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

/**
 * Builds PDF entries from original uploaded images (no compression).
 * Order matches the current batch list (supports reordering).
 */
export async function collectPdfEntriesFromBatchItems(items: BatchImageItem[]): Promise<PdfImageEntry[]> {
  const entries: PdfImageEntry[] = [];

  for (const item of items) {
    const dataUrl = await fileToDataUrl(item.file);
    entries.push({
      fileName: item.file.name,
      dataUrl,
    });
  }

  return entries;
}

function embedPreparedImage(doc: jsPDF, prepared: PreparedPdfImage) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const fit = computeCenteredImageFit({
    pageWidth,
    pageHeight,
    imageWidth: prepared.width,
    imageHeight: prepared.height,
  });

  // Explicit format + NONE compression preserves the highest quality embedding.
  doc.addImage(prepared.dataUrl, prepared.format, fit.x, fit.y, fit.width, fit.height, undefined, 'NONE');
}

async function forcePngPreparedImage(sourceDataUrl: string): Promise<PreparedPdfImage> {
  const pngDataUrl = await convertDataUrlToPngDataUrl(sourceDataUrl);
  const image = await loadHtmlImage(pngDataUrl);
  return {
    dataUrl: pngDataUrl,
    format: 'PNG',
    width: Math.max(1, image.naturalWidth || image.width),
    height: Math.max(1, image.naturalHeight || image.height),
  };
}

/**
 * Builds a PDF with one image per page.
 * JPEG/PNG embed natively; WEBP and other types are converted to PNG in memory first.
 */
export async function buildCompressedImagesPdf(entries: PdfImageEntry[]): Promise<Blob> {
  if (entries.length === 0) {
    throw new Error('No images available for PDF.');
  }

  let doc: jsPDF | null = null;

  try {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      let prepared = await prepareImageForPdf(entry);

      const landscape = prepared.width >= prepared.height;

      if (!doc) {
        doc = new jsPDF({
          orientation: landscape ? 'landscape' : 'portrait',
          unit: 'pt',
          format: 'a4',
          compress: true,
        });
      } else {
        doc.addPage('a4', landscape ? 'landscape' : 'portrait');
      }

      try {
        embedPreparedImage(doc, prepared);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Never surface "addImage does not support files of type UNKNOWN".
        if (!/UNKNOWN|does not support/i.test(message) && prepared.format === 'PNG') {
          throw error;
        }

        prepared = await forcePngPreparedImage(entry.dataUrl);
        embedPreparedImage(doc, prepared);
      }
    }
  } catch (error) {
    throw new Error(toFriendlyPdfError(error));
  }

  if (!doc) {
    throw new Error('Unable to create the PDF document.');
  }

  return doc.output('blob');
}
