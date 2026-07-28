'use server';

import sharp, { type Metadata, OutputInfo } from 'sharp';
import { formatBytes } from '@/lib/format-bytes';
import { persistCompressionHistory } from '@/services/compression-history-service';

export type CompressImageResult = {
  success: boolean;
  originalSize: string;
  compressedSize: string;
  savedSpace: string;
  savedPercentage: string;
  format: string;
  resolution: string;
  compressionRatio: string;
  message: string;
  downloadUrl?: string;
  downloadFileName?: string;
};

type SupportedFormat = 'jpeg' | 'png' | 'webp' | 'avif';

type CompressionSettings = {
  minQuality: number;
  maxQuality: number;
  formatOptions: Record<string, unknown>;
};

const formatBytesDisplay = formatBytes;

const toBytes = (size: number, unit: 'KB' | 'MB') => (unit === 'MB' ? size * 1024 * 1024 : size * 1024);

const normalizeFormat = (format: string | undefined): SupportedFormat => {
  if (format === 'png') return 'png';
  if (format === 'webp') return 'webp';
  if (format === 'avif') return 'avif';
  return 'jpeg';
};

const normalizeRequestedFormat = (format: string | undefined): SupportedFormat => {
  if (format === 'png') return 'png';
  if (format === 'jpeg') return 'jpeg';
  if (format === 'webp') return 'webp';
  return 'jpeg';
};

const buildDownloadUrl = (buffer: Buffer, format: SupportedFormat) => {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

const buildDownloadFileName = (fileName: string, format: SupportedFormat) => {
  const extension = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.'))
    : `.${format === 'jpeg' ? 'jpg' : format}`;
  const baseName = fileName.replace(/\.[^.]+$/, '');
  return `${baseName}-compressed${extension}`;
};

const toFileExtension = (format: SupportedFormat) => (format === 'jpeg' ? 'jpg' : format);

async function saveHistoryIfAuthenticated({
  file,
  targetFormat,
  inputBuffer,
  compressedBuffer,
  compressedSize,
  compressionRatio,
  metadata,
}: {
  file: File;
  targetFormat: SupportedFormat;
  inputBuffer: Buffer;
  compressedBuffer: Buffer;
  compressedSize: number;
  compressionRatio: string;
  metadata: Metadata;
}) {
  await persistCompressionHistory({
    originalFilename: file.name,
    originalSize: inputBuffer.length,
    compressedSize,
    compressionRatio,
    imageFormat: targetFormat.toUpperCase(),
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    compressedBuffer,
    fileExtension: toFileExtension(targetFormat),
  });
}

const getCompressionSettings = (format: SupportedFormat): CompressionSettings => {
  switch (format) {
    case 'webp':
      return {
        minQuality: 20,
        maxQuality: 95,
        formatOptions: { effort: 4 },
      };
    case 'avif':
      return {
        minQuality: 20,
        maxQuality: 95,
        formatOptions: { effort: 4 },
      };
    case 'png':
      return {
        minQuality: 30,
        maxQuality: 100,
        formatOptions: {
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true,
        },
      };
    default:
      return {
        minQuality: 25,
        maxQuality: 95,
        formatOptions: { progressive: true, mozjpeg: true },
      };
  }
};

const compressBuffer = async (
  inputBuffer: Buffer,
  format: SupportedFormat,
  quality: number,
  options: Record<string, unknown>,
) => {
  const pipeline = sharp(inputBuffer).clone();

  switch (format) {
    case 'png':
      return pipeline.png({ quality, ...options }).toBuffer({ resolveWithObject: true });
    case 'webp':
      return pipeline.webp({ quality, ...options }).toBuffer({ resolveWithObject: true });
    case 'avif':
      return pipeline.avif({ quality, ...options }).toBuffer({ resolveWithObject: true });
    default:
      return pipeline.jpeg({ quality, ...options }).toBuffer({ resolveWithObject: true });
  }
};

const getBestCompression = async (
  inputBuffer: Buffer,
  format: SupportedFormat,
  targetBytes: number,
): Promise<OutputInfo & { buffer: Buffer }> => {
  const settings = getCompressionSettings(format);
  const candidates: Array<{ buffer: Buffer; info: OutputInfo }> = [];

  let low = settings.minQuality;
  let high = settings.maxQuality;
  let bestMatch: { buffer: Buffer; info: OutputInfo } | null = null;
  const tolerance = Math.max(Math.round(targetBytes * 0.03), 1024);

  while (low <= high && candidates.length < 12) {
    const quality = Math.round((low + high) / 2);
    const { data, info } = await compressBuffer(inputBuffer, format, quality, settings.formatOptions);
    candidates.push({ buffer: data, info });

    const delta = info.size - targetBytes;
    if (Math.abs(delta) <= tolerance) {
      bestMatch = { buffer: data, info };
      break;
    }

    if (info.size > targetBytes) {
      high = quality - 1;
    } else {
      low = quality + 1;
    }
  }

  if (!bestMatch) {
    bestMatch = candidates.reduce((previous, candidate) => {
      const previousDelta = Math.abs(previous.info.size - targetBytes);
      const currentDelta = Math.abs(candidate.info.size - targetBytes);
      return currentDelta < previousDelta ? candidate : previous;
    }, candidates[0]);
  }

  return { ...bestMatch.info, buffer: bestMatch.buffer };
};

export async function compressImageAction(file: File, targetSize: number, unit: 'KB' | 'MB', requestedFormat?: string) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const input = sharp(inputBuffer);
    const metadata = await input.metadata();
    const originalFormat = normalizeFormat(metadata.format);
    const targetFormat = requestedFormat ? normalizeRequestedFormat(requestedFormat) : originalFormat;
    const targetBytes = toBytes(targetSize, unit);

    if (inputBuffer.length <= targetBytes) {
      await saveHistoryIfAuthenticated({
        file,
        targetFormat,
        inputBuffer,
        compressedBuffer: inputBuffer,
        compressedSize: inputBuffer.length,
        compressionRatio: '1.00:1',
        metadata,
      });

      return {
        success: true,
        originalSize: formatBytesDisplay(inputBuffer.length),
        compressedSize: formatBytesDisplay(inputBuffer.length),
        savedSpace: formatBytesDisplay(0),
        savedPercentage: '0%',
        format: targetFormat.toUpperCase(),
        resolution: `${metadata.width ?? 0} × ${metadata.height ?? 0}`,
        compressionRatio: '1.00:1',
        message: 'Source image is already within the requested size target.',
        downloadUrl: buildDownloadUrl(inputBuffer, targetFormat),
        downloadFileName: buildDownloadFileName(file.name, targetFormat),
      } as CompressImageResult;
    }

    const { buffer: compressedBuffer, size: compressedSize } = await getBestCompression(
      inputBuffer,
      targetFormat,
      targetBytes,
    );

    const savedBytes = Math.max(inputBuffer.length - compressedSize, 0);
    const savedPercentage = inputBuffer.length > 0 ? `${Math.round((savedBytes / inputBuffer.length) * 100)}%` : '0%';
    const compressionRatio = inputBuffer.length > 0 ? `${(inputBuffer.length / Math.max(compressedSize, 1)).toFixed(2)}:1` : '1.00:1';

    await saveHistoryIfAuthenticated({
      file,
      targetFormat,
      inputBuffer,
      compressedBuffer,
      compressedSize,
      compressionRatio,
      metadata,
    });

    return {
      success: true,
      originalSize: formatBytesDisplay(inputBuffer.length),
      compressedSize: formatBytesDisplay(compressedSize),
      savedSpace: formatBytesDisplay(savedBytes),
      savedPercentage,
      format: targetFormat.toUpperCase(),
      resolution: `${metadata.width ?? 0} × ${metadata.height ?? 0}`,
      compressionRatio,
      message:
        compressedSize <= targetBytes
          ? `Compressed to ${formatBytesDisplay(compressedSize)} and met the target size.`
          : `Compressed to ${formatBytesDisplay(compressedSize)}. This is the best possible result for the selected image and format.`,
      downloadUrl: buildDownloadUrl(compressedBuffer, targetFormat),
      downloadFileName: buildDownloadFileName(file.name, targetFormat),
    } as CompressImageResult;
  } catch (error) {
    return {
      success: false,
      originalSize: formatBytesDisplay(file.size),
      compressedSize: '—',
      savedSpace: '—',
      savedPercentage: '—',
      format: '—',
      resolution: '—',
      compressionRatio: '—',
      message: error instanceof Error ? error.message : 'Compression failed.',
    } as CompressImageResult;
  }
}
