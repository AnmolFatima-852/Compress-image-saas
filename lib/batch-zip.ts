import JSZip from 'jszip';
import type { BatchJobMap } from '@/lib/batch-compress';
import { getSuccessfulBatchResults } from '@/lib/batch-compress';
import {
  dataUrlToUint8Array,
  ensureDownloadFileName,
  extractMimeTypeFromDataUrl,
  uint8ArrayToBlob,
} from '@/lib/download-file';

export type ZipImageEntry = {
  fileName: string;
  dataUrl: string;
};

export { dataUrlToUint8Array };

/** Ensures ZIP entry names stay unique while keeping the original extension. */
export function uniqueZipFileName(fileName: string, usedNames: Set<string>): string {
  const trimmed = fileName.trim() || 'compressed-image';
  if (!usedNames.has(trimmed)) {
    return trimmed;
  }

  const extensionMatch = trimmed.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1] ?? '';
  const baseName = extension ? trimmed.slice(0, -extension.length) : trimmed;

  let index = 2;
  let candidate = `${baseName}-${index}${extension}`;
  while (usedNames.has(candidate)) {
    index += 1;
    candidate = `${baseName}-${index}${extension}`;
  }

  return candidate;
}

/**
 * Builds a ZIP containing every compressed image, preserving filenames/extensions
 * (including .webp). Uses a real application/zip Blob for browser downloads.
 */
export async function buildCompressedImagesZip(entries: ZipImageEntry[]): Promise<Blob> {
  if (entries.length === 0) {
    throw new Error('No compressed images available to zip.');
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const entry of entries) {
    const mimeType = extractMimeTypeFromDataUrl(entry.dataUrl);
    const safeName = ensureDownloadFileName(entry.fileName, {
      mimeType,
      fallbackExt: extensionHintFromMime(mimeType),
      fallbackBase: 'compressed-image',
    });
    const fileName = uniqueZipFileName(safeName, usedNames);
    usedNames.add(fileName);

    const bytes = dataUrlToUint8Array(entry.dataUrl);
    // Pass a copied Uint8Array so JSZip always receives a plain buffer view.
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    zip.file(fileName, copy);
  }

  // Prefer JSZip's blob output; fall back to a manually constructed Blob.
  try {
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    if (blob instanceof Blob && blob.size > 0) {
      return blob.type ? blob : new Blob([await blob.arrayBuffer()], { type: 'application/zip' });
    }
  } catch {
    // Fall through to uint8array path.
  }

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  return uint8ArrayToBlob(bytes, 'application/zip');
}

function extensionHintFromMime(mimeType: string): string | undefined {
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  return undefined;
}

export function collectZipEntriesFromBatchJobs(jobs: BatchJobMap): ZipImageEntry[] {
  return getSuccessfulBatchResults(jobs).flatMap(({ result }, index) => {
    if (!result.downloadUrl) {
      return [];
    }

    const mimeType = extractMimeTypeFromDataUrl(result.downloadUrl);
    const fileName = ensureDownloadFileName(result.downloadFileName, {
      mimeType,
      fallbackExt: extensionHintFromMime(mimeType) ?? 'bin',
      fallbackBase: `compressed-image-${index + 1}`,
    });

    return [
      {
        fileName,
        dataUrl: result.downloadUrl,
      },
    ];
  });
}

export function buildBatchZipDownloadName(imageCount: number) {
  const stamp = new Date().toISOString().slice(0, 10);
  return imageCount > 1 ? `compressed-images-${stamp}.zip` : `compressed-image-${stamp}.zip`;
}
