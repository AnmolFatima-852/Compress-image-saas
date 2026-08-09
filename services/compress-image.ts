'use server';

import sharp, { type Metadata, type OutputInfo } from 'sharp';
import {
  buildDownloadFileName,
  buildDownloadMimeType,
  formatsMatch,
  normalizeDetectedFormat,
  resolveOutputFormat,
  toFileExtension,
  type OutputFormat,
} from '@/lib/compress-format';
import { COMPRESS_REASON, toUnifiedCompressReason } from '@/lib/compress-outcome';
import { buildCompressResultMessage } from '@/lib/compress-result-message';
import { formatBytes } from '@/lib/format-bytes';
import { targetSizeToBytes } from '@/lib/target-size';
import { persistCompressionHistory } from '@/services/compression-history';

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
  /** True when compression was skipped (should not compress — original kept). */
  skipped?: boolean;
  /** Raw byte sizes for batch history aggregation (optional on failures). */
  originalSizeBytes?: number;
  compressedSizeBytes?: number;
};

type EncodedResult = {
  buffer: Buffer;
  info: OutputInfo;
  width: number;
  height: number;
  exactMatch: boolean;
};

/** ±1 KB as required by product rules (JPEG / WEBP). */
const SIZE_TOLERANCE_BYTES = 1024;

/**
 * PNG is lossless — exact KB targets are often impossible.
 * Accept the closest result within ±10 KB.
 */
const PNG_TOLERANCE_BYTES = 10 * 1024;

/** Hard caps so compression can never hang the UI. */
const MAX_JPEG_WEBP_QUALITY_ITERS = 10;
const MAX_RESIZE_STEPS = 14;
const MAX_PNG_ENCODES = 36;
const MAX_PNG_SCALE_ITERS = 10;
const COMPRESSION_TIMEOUT_MS = 20_000;

const PNG_PALETTE_COLORS = [256, 128, 64, 32, 16] as const;
const PNG_SCALE_COLOR_PROBES = [256, 64, 32] as const;
const MIN_PNG_DIMENSION = 12;

const formatBytesDisplay = formatBytes;

const buildDownloadUrl = (buffer: Buffer, format: OutputFormat) => {
  return `data:${buildDownloadMimeType(format)};base64,${buffer.toString('base64')}`;
};

const buildRawDownloadUrl = (buffer: Buffer, mimeType: string) => {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

const withinTolerance = (size: number, targetBytes: number, toleranceBytes = SIZE_TOLERANCE_BYTES) =>
  Math.abs(size - targetBytes) <= toleranceBytes;

function resolveSourceMimeType(file: File, metadata: Metadata): string {
  if (file.type && file.type.startsWith('image/')) {
    return file.type;
  }

  const format = metadata.format?.toLowerCase();
  if (format === 'jpeg' || format === 'jpg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  if (format === 'avif') return 'image/avif';
  return 'application/octet-stream';
}

function resolveSourceFormatLabel(file: File, metadata: Metadata): string {
  const mime = resolveSourceMimeType(file, metadata);
  if (mime === 'image/jpeg') return 'JPEG';
  if (mime === 'image/png') return 'PNG';
  if (mime === 'image/webp') return 'WEBP';
  if (mime === 'image/avif') return 'AVIF';
  return (metadata.format ?? 'IMAGE').toUpperCase();
}

function resolveSourceOutputFormat(file: File, metadata: Metadata): OutputFormat | null {
  const fromMime = normalizeDetectedFormat(resolveSourceMimeType(file, metadata).replace('image/', ''));
  if (fromMime) return fromMime;
  return normalizeDetectedFormat(metadata.format);
}

/**
 * Ensures the encoded bytes are actually the selected format.
 * Never silently substitute another format.
 */
async function assertEncodedMatchesFormat(buffer: Buffer, expected: OutputFormat) {
  const detected = (await sharp(buffer, { failOn: 'none' }).metadata()).format;
  if (!formatsMatch(detected, expected)) {
    throw new Error(
      `Failed to encode as ${expected.toUpperCase()} (got ${detected ?? 'unknown'}). Please try again or choose a different format.`,
    );
  }
}

function logDev(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[compress]', ...args);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function toEncodedResult(
  buffer: Buffer,
  info: OutputInfo,
  width: number,
  height: number,
  targetBytes: number,
  toleranceBytes = SIZE_TOLERANCE_BYTES,
): EncodedResult {
  return {
    buffer,
    info,
    width: info.width ?? width,
    height: info.height ?? height,
    exactMatch: withinTolerance(info.size, targetBytes, toleranceBytes),
  };
}

function pickCloser(
  current: EncodedResult | null,
  candidate: EncodedResult,
  targetBytes: number,
  originalBytes?: number,
): EncodedResult {
  // Never prefer a candidate that enlarges the file when an alternative exists.
  if (originalBytes !== undefined && candidate.info.size > originalBytes) {
    if (current && current.info.size <= originalBytes) {
      return current;
    }
  }

  if (!current) return candidate;

  if (originalBytes !== undefined && current.info.size > originalBytes && candidate.info.size <= originalBytes) {
    return candidate;
  }

  const currentDelta = Math.abs(current.info.size - targetBytes);
  const candidateDelta = Math.abs(candidate.info.size - targetBytes);
  return candidateDelta < currentDelta ? candidate : current;
}

async function encodeJpegOrWebp(
  inputBuffer: Buffer,
  format: 'jpeg' | 'webp',
  quality: number,
  width: number,
  height: number,
): Promise<{ buffer: Buffer; info: OutputInfo }> {
  const pipeline = sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: Math.max(1, width),
      height: Math.max(1, height),
      fit: 'inside',
      withoutEnlargement: true,
    });

  if (format === 'webp') {
    return pipeline
      .webp({ quality: Math.round(quality), effort: 4 })
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => ({ buffer: data, info }));
  }

  return pipeline
    .jpeg({ quality: Math.round(quality), mozjpeg: true, progressive: true })
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => ({ buffer: data, info }));
}

type PngEncodeOptions = {
  colors?: number;
  palette: boolean;
};

/**
 * PNG encoder — palette + zlib optimization only (never JPEG).
 * Alpha/transparency is preserved (no flatten).
 */
async function encodePng(
  inputBuffer: Buffer,
  width: number,
  height: number,
  options: PngEncodeOptions,
): Promise<{ buffer: Buffer; info: OutputInfo }> {
  const pipeline = sharp(inputBuffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: Math.max(1, width),
      height: Math.max(1, height),
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
    });

  if (options.palette) {
    return pipeline
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
        colors: options.colors ?? 256,
        // Keep effort modest — high effort can hang large PNGs.
        effort: 3,
      })
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => ({ buffer: data, info }));
  }

  return pipeline
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false,
      effort: 3,
    })
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => ({ buffer: data, info }));
}

function scaleDimensions(sourceWidth: number, sourceHeight: number, scale: number) {
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

/**
 * PNG is lossless — no JPEG quality search.
 * Binary-searches scale, then fine-tunes with palette color counts
 * so the result lands as close as possible to the target (±10 KB).
 * When the target is impossible, returns the smallest valid PNG (still PNG, alpha kept).
 */
async function compressPngToTarget(
  inputBuffer: Buffer,
  targetBytes: number,
  metadata: Metadata,
): Promise<EncodedResult> {
  const sourceWidth = metadata.width ?? 1;
  const sourceHeight = metadata.height ?? 1;
  // Reserve encodes so an impossible target can still finish at minimum valid size.
  const searchEncodeBudget = Math.max(8, MAX_PNG_ENCODES - 6);
  /**
   * Closest candidate is stored on an object so TypeScript control-flow analysis does not
   * treat `best` as permanently `null`. Assignments happen inside nested `consider` /
   * `tryEncode` closures; CFA ignores those writes for a bare `let`, which incorrectly
   * narrowed later `best && …` branches to `never`.
   */
  const selection: { best: EncodedResult | null } = { best: null };
  let encodes = 0;

  const consider = (candidate: EncodedResult) => {
    selection.best = pickCloser(selection.best, candidate, targetBytes, inputBuffer.length);
    return candidate;
  };

  const tryEncode = async (
    width: number,
    height: number,
    options: PngEncodeOptions,
    { force = false }: { force?: boolean } = {},
  ) => {
    if (!force && encodes >= searchEncodeBudget) {
      return null;
    }

    encodes += 1;
    const { buffer, info } = await encodePng(inputBuffer, width, height, options);
    return consider(toEncodedResult(buffer, info, width, height, targetBytes, PNG_TOLERANCE_BYTES));
  };

  const tryPaletteVariants = async (width: number, height: number, force = false) => {
    // Truecolor first (often closest when only mild compression is needed).
    let hit = await tryEncode(width, height, { palette: false }, { force });
    // Only early-return when at/under target — oversized ±10 KB "matches" keep searching.
    if (hit && hit.info.size <= targetBytes) {
      return {
        ...hit,
        exactMatch: withinTolerance(hit.info.size, targetBytes, PNG_TOLERANCE_BYTES),
      };
    }

    for (const colors of PNG_PALETTE_COLORS) {
      hit = await tryEncode(width, height, { palette: true, colors }, { force });
      if (hit && hit.info.size <= targetBytes) {
        return {
          ...hit,
          exactMatch: withinTolerance(hit.info.size, targetBytes, PNG_TOLERANCE_BYTES),
        };
      }
      if (!force && encodes >= searchEncodeBudget) break;
    }

    return hit;
  };

  // Phase 1 — full resolution optimization.
  let phaseHit = await tryPaletteVariants(sourceWidth, sourceHeight);
  if (phaseHit && phaseHit.info.size <= targetBytes) {
    return {
      ...phaseHit,
      exactMatch: withinTolerance(phaseHit.info.size, targetBytes, PNG_TOLERANCE_BYTES),
    };
  }

  // Already at/under target at full size: cannot grow the file; return closest.
  const bestAfterPhase1 = selection.best;
  if (bestAfterPhase1 && bestAfterPhase1.info.size <= targetBytes) {
    return {
      ...bestAfterPhase1,
      exactMatch: withinTolerance(bestAfterPhase1.info.size, targetBytes, PNG_TOLERANCE_BYTES),
    };
  }

  // Phase 2 — find a scale that gets under the target (coarse shrink).
  let scaleHigh = 1;
  let scaleLow = 0.12;
  let underFound = false;

  for (let step = 0; step < MAX_RESIZE_STEPS && encodes < searchEncodeBudget; step += 1) {
    const { width, height } = scaleDimensions(sourceWidth, sourceHeight, scaleLow);
    if (width < MIN_PNG_DIMENSION || height < MIN_PNG_DIMENSION) break;

    // Fewer colors compress more aggressively while probing for an under-target bound.
    const probe = await tryEncode(width, height, { palette: true, colors: 64 });
    if (!probe) break;

    if (probe.info.size <= targetBytes) {
      underFound = true;
      break;
    }

    scaleHigh = scaleLow;
    scaleLow *= 0.72;
  }

  const bestBeforeExtraShrink = selection.best;
  if (!underFound && bestBeforeExtraShrink && bestBeforeExtraShrink.info.size > targetBytes) {
    // Still oversized — keep shrinking with palette variants.
    let width = Math.max(1, Math.round(sourceWidth * scaleLow));
    let height = Math.max(1, Math.round(sourceHeight * scaleLow));

    for (let step = 0; step < MAX_RESIZE_STEPS && encodes < searchEncodeBudget; step += 1) {
      const hit = await tryPaletteVariants(width, height);
      if (hit && hit.info.size <= targetBytes) {
        underFound = true;
        scaleLow = Math.min(width / sourceWidth, height / sourceHeight);
        break;
      }

      const nextWidth = Math.max(1, Math.round(width * 0.78));
      const nextHeight = Math.max(1, Math.round(height * 0.78));
      if (nextWidth === width || nextWidth < MIN_PNG_DIMENSION || nextHeight < MIN_PNG_DIMENSION) break;
      width = nextWidth;
      height = nextHeight;
    }
  }

  // Phase 3 — binary search scale between last-over and first-under to minimize error.
  const bestBeforeScaleSearch = selection.best;
  if (underFound || (bestBeforeScaleSearch && bestBeforeScaleSearch.info.size <= targetBytes)) {
    for (let iteration = 0; iteration < MAX_PNG_SCALE_ITERS && encodes < searchEncodeBudget; iteration += 1) {
      const scaleMid = (scaleLow + scaleHigh) / 2;
      const { width, height } = scaleDimensions(sourceWidth, sourceHeight, scaleMid);

      if (
        width < MIN_PNG_DIMENSION ||
        height < MIN_PNG_DIMENSION ||
        (width >= sourceWidth && height >= sourceHeight && scaleMid >= 0.999)
      ) {
        break;
      }

      // At each scale, probe a few palette depths for finer size control.
      let probed = false;
      let anyUnder = false;

      for (const colors of PNG_SCALE_COLOR_PROBES) {
        const hit = await tryEncode(width, height, { palette: true, colors });
        if (!hit) break;
        probed = true;

        if (hit.info.size <= targetBytes) {
          anyUnder = true;
          if (withinTolerance(hit.info.size, targetBytes, PNG_TOLERANCE_BYTES)) {
            return { ...hit, exactMatch: true };
          }
        }
      }

      if (!probed) break;

      if (anyUnder) {
        // Room to grow dimensions for a closer undershoot/overshoot tradeoff.
        scaleLow = scaleMid;
      } else {
        scaleHigh = scaleMid;
      }

      // Converged enough on scale.
      if (scaleHigh - scaleLow < 0.01) {
        break;
      }
    }

    // Phase 4 — final palette sweep at the best under-target scale.
    const { width, height } = scaleDimensions(sourceWidth, sourceHeight, scaleLow);
    const finalHit = await tryPaletteVariants(width, height);
    if (finalHit && finalHit.info.size <= targetBytes) {
      return {
        ...finalHit,
        exactMatch: withinTolerance(finalHit.info.size, targetBytes, PNG_TOLERANCE_BYTES),
      };
    }
  }

  // Phase 5 — target is impossible for lossless PNG: force the smallest valid PNG.
  let forcedMinimumValid = false;
  const bestBeforeForce = selection.best;
  if (!bestBeforeForce || bestBeforeForce.info.size > targetBytes) {
    const minScale = Math.min(MIN_PNG_DIMENSION / sourceWidth, MIN_PNG_DIMENSION / sourceHeight, 1);
    const { width, height } = scaleDimensions(sourceWidth, sourceHeight, minScale);

    // Aggressive palette first (usually smallest), then a couple denser variants.
    for (const colors of [16, 32, 64] as const) {
      await tryEncode(width, height, { palette: true, colors }, { force: true });
    }
    await tryEncode(width, height, { palette: false }, { force: true });
    forcedMinimumValid = true;

    const forcedBest = selection.best;
    if (forcedBest) {
      logDev('PNG target impossible — returning smallest valid PNG', {
        size: forcedBest.info.size,
        targetBytes,
        width: forcedBest.width,
        height: forcedBest.height,
        encodes,
      });
    }
  }

  const best = selection.best;
  if (!best) {
    throw new Error('PNG compression produced no candidates.');
  }

  // Still over the target after the smallest valid PNG → not a tolerance match.
  if (best.info.size > targetBytes) {
    return {
      ...best,
      // Near-miss overshoots from normal search can match ±10 KB; once we have already
      // forced the minimum valid PNG, the target is treated as impossible.
      exactMatch: forcedMinimumValid
        ? false
        : withinTolerance(best.info.size, targetBytes, PNG_TOLERANCE_BYTES),
    };
  }

  return {
    ...best,
    exactMatch: withinTolerance(best.info.size, targetBytes, PNG_TOLERANCE_BYTES),
  };
}

async function binarySearchLossyQuality(
  inputBuffer: Buffer,
  format: 'jpeg' | 'webp',
  targetBytes: number,
  width: number,
  height: number,
): Promise<EncodedResult> {
  // Allow very low quality when chasing extremely small targets.
  let low = 1;
  let high = 95;
  let best: EncodedResult | null = null;

  for (let iteration = 0; iteration < MAX_JPEG_WEBP_QUALITY_ITERS && low <= high; iteration += 1) {
    const quality = Math.round((low + high) / 2);
    const { buffer, info } = await encodeJpegOrWebp(inputBuffer, format, quality, width, height);
    const candidate = toEncodedResult(buffer, info, width, height, targetBytes);
    best = pickCloser(best, candidate, targetBytes, inputBuffer.length);

    if (candidate.exactMatch) {
      return candidate;
    }

    if (info.size > targetBytes) {
      high = quality - 1;
    } else {
      low = quality + 1;
    }
  }

  if (!best) {
    throw new Error(`${format.toUpperCase()} compression produced no candidates.`);
  }

  return best;
}

async function compressLossyToTarget(
  inputBuffer: Buffer,
  format: 'jpeg' | 'webp',
  targetBytes: number,
  metadata: Metadata,
): Promise<EncodedResult> {
  const minDimension = 16;
  let width = metadata.width ?? 1;
  let height = metadata.height ?? 1;
  let bestOverall: EncodedResult | null = null;
  let attemptedMinDimensions = false;

  for (let step = 0; step < MAX_RESIZE_STEPS; step += 1) {
    const candidate = await binarySearchLossyQuality(inputBuffer, format, targetBytes, width, height);
    bestOverall = pickCloser(bestOverall, candidate, targetBytes, inputBuffer.length);

    if (candidate.exactMatch || candidate.info.size <= targetBytes) {
      return {
        ...candidate,
        exactMatch: withinTolerance(candidate.info.size, targetBytes),
      };
    }

    const nextWidth = Math.max(1, Math.round(width * 0.85));
    const nextHeight = Math.max(1, Math.round(height * 0.85));

    if (nextWidth === width && nextHeight === height) {
      logDev(`${format} stopped resizing: dimensions cannot shrink further`, { width, height });
      break;
    }

    if (nextWidth < minDimension || nextHeight < minDimension) {
      if (!attemptedMinDimensions && (width > minDimension || height > minDimension)) {
        // Final pass at the smallest valid dimensions before giving up.
        const scale = Math.min(minDimension / width, minDimension / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        attemptedMinDimensions = true;
        continue;
      }

      logDev(`${format} stopped resizing: minimum valid dimensions reached`, {
        width,
        height,
        bestSize: bestOverall?.info.size,
      });
      break;
    }

    width = nextWidth;
    height = nextHeight;
  }

  if (!bestOverall) {
    throw new Error(`Unable to compress image as ${format.toUpperCase()}.`);
  }

  return {
    ...bestOverall,
    exactMatch: withinTolerance(bestOverall.info.size, targetBytes),
  };
}

async function compressToTarget(
  inputBuffer: Buffer,
  format: OutputFormat,
  targetBytes: number,
  metadata: Metadata,
): Promise<EncodedResult> {
  if (format === 'png') {
    return compressPngToTarget(inputBuffer, targetBytes, metadata);
  }

  return compressLossyToTarget(inputBuffer, format, targetBytes, metadata);
}

async function saveHistoryIfAuthenticated({
  file,
  targetFormat,
  inputBuffer,
  compressedBuffer,
  compressedSize,
  compressionRatio,
  width,
  height,
}: {
  file: File;
  targetFormat: OutputFormat;
  inputBuffer: Buffer;
  compressedBuffer: Buffer;
  compressedSize: number;
  compressionRatio: string;
  width: number;
  height: number;
}) {
  const savedSpace = Math.max(inputBuffer.length - compressedSize, 0);

  const result = await persistCompressionHistory({
    originalFilename: file.name,
    originalSize: inputBuffer.length,
    compressedSize,
    savedSpace,
    compressionRatio,
    imageFormat: targetFormat.toUpperCase(),
    width,
    height,
    compressedBuffer,
    fileExtension: toFileExtension(targetFormat),
  });

  if (process.env.NODE_ENV === 'development' && !result.ok && result.reason !== 'unauthenticated') {
    console.error('[compressImageAction] history persist failed:', result.reason);
  }
}

/**
 * Compresses an uploaded image to the requested format and target size.
 * The selected output format always wins — never silently substitute JPEG/PNG/WEBP.
 */
export async function compressImageAction(
  file: File,
  targetSize: number,
  unit: 'KB' | 'MB',
  requestedFormat: string,
) {
  try {
    const targetFormat = resolveOutputFormat(requestedFormat);
    const targetBytes = targetSizeToBytes(targetSize, unit);

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const originalBytes = inputBuffer.length;
    const metadata = await sharp(inputBuffer, { failOn: 'none' }).metadata();
    const sourceWidth = metadata.width ?? 0;
    const sourceHeight = metadata.height ?? 0;
    const sourceMime = resolveSourceMimeType(file, metadata);
    const sourceFormatLabel = resolveSourceFormatLabel(file, metadata);
    const sourceOutputFormat = resolveSourceOutputFormat(file, metadata);
    // Never enlarge: if the original is already ≤ target, keep it and skip compression.
    // Do not convert format either — that can increase size and must not run here.
    if (originalBytes <= targetBytes) {
      logDev('skip compression: original already ≤ target', {
        originalBytes,
        targetBytes,
        unit,
        targetSize,
        targetFormat,
        sourceFormat: sourceFormatLabel,
      });

      const historyFormat = sourceOutputFormat ?? targetFormat;

      try {
        await saveHistoryIfAuthenticated({
          file,
          targetFormat: historyFormat,
          inputBuffer,
          compressedBuffer: inputBuffer,
          compressedSize: originalBytes,
          compressionRatio: '1.00:1',
          width: sourceWidth,
          height: sourceHeight,
        });
      } catch (historyError) {
        logDev('history save threw (unchanged original still returned):', historyError);
      }

      return {
        success: true,
        skipped: true,
        originalSize: formatBytesDisplay(originalBytes),
        compressedSize: formatBytesDisplay(originalBytes),
        savedSpace: formatBytesDisplay(0),
        savedPercentage: '0%',
        format: sourceFormatLabel,
        resolution: `${sourceWidth} × ${sourceHeight}`,
        compressionRatio: '1.00:1',
        message: COMPRESS_REASON.alreadySmaller,
        downloadUrl: buildRawDownloadUrl(inputBuffer, sourceMime),
        downloadFileName: file.name,
        originalSizeBytes: originalBytes,
        compressedSizeBytes: originalBytes,
      } satisfies CompressImageResult;
    }

    const encoded = await withTimeout(
      compressToTarget(inputBuffer, targetFormat, targetBytes, metadata),
      COMPRESSION_TIMEOUT_MS,
      `${targetFormat.toUpperCase()} compression`,
    );

    await assertEncodedMatchesFormat(encoded.buffer, targetFormat);

    // Never enlarge (JPEG / PNG / WEBP): keep the original and mark Skipped.
    if (encoded.info.size > originalBytes) {
      logDev('compressed output larger than original — skip', {
        originalBytes,
        compressedSize: encoded.info.size,
        format: targetFormat,
      });

      return {
        success: true,
        skipped: true,
        originalSize: formatBytesDisplay(originalBytes),
        compressedSize: formatBytesDisplay(originalBytes),
        savedSpace: formatBytesDisplay(0),
        savedPercentage: '0%',
        format: sourceFormatLabel,
        resolution: `${sourceWidth} × ${sourceHeight}`,
        compressionRatio: '1.00:1',
        message: COMPRESS_REASON.severeQualityLoss,
        downloadUrl: buildRawDownloadUrl(inputBuffer, sourceMime),
        downloadFileName: file.name,
        originalSizeBytes: originalBytes,
        compressedSizeBytes: originalBytes,
      } satisfies CompressImageResult;
    }

    const compressedBuffer = encoded.buffer;
    const compressedSize = encoded.info.size;
    const outputWidth = encoded.width || sourceWidth;
    const outputHeight = encoded.height || sourceHeight;
    const resized = outputWidth < sourceWidth || outputHeight < sourceHeight;

    const savedBytes = Math.max(originalBytes - compressedSize, 0);
    const savedPercentage = originalBytes > 0 ? `${Math.round((savedBytes / originalBytes) * 100)}%` : '0%';
    const compressionRatio =
      originalBytes > 0 ? `${(originalBytes / Math.max(compressedSize, 1)).toFixed(2)}:1` : '1.00:1';

    try {
      await saveHistoryIfAuthenticated({
        file,
        targetFormat,
        inputBuffer,
        compressedBuffer,
        compressedSize,
        compressionRatio,
        width: outputWidth,
        height: outputHeight,
      });
    } catch (historyError) {
      logDev('history save threw (compression still returned):', historyError);
    }

    return {
      success: true,
      originalSize: formatBytesDisplay(originalBytes),
      compressedSize: formatBytesDisplay(compressedSize),
      savedSpace: formatBytesDisplay(savedBytes),
      savedPercentage,
      format: targetFormat.toUpperCase(),
      resolution: `${outputWidth} × ${outputHeight}`,
      compressionRatio,
      message: buildCompressResultMessage({
        compressedSize,
        targetBytes,
        exactMatch: encoded.exactMatch,
        format: targetFormat,
        resized,
      }),
      downloadUrl: buildDownloadUrl(compressedBuffer, targetFormat),
      downloadFileName: buildDownloadFileName(file.name, targetFormat),
      originalSizeBytes: originalBytes,
      compressedSizeBytes: compressedSize,
    } satisfies CompressImageResult;
  } catch (error) {
    logDev('compression failed:', error instanceof Error ? error.message : error);

    return {
      success: false,
      originalSize: formatBytesDisplay(file.size),
      compressedSize: '—',
      savedSpace: '—',
      savedPercentage: '—',
      format: '—',
      resolution: '—',
      compressionRatio: '—',
      message: toUnifiedCompressReason(error),
      originalSizeBytes: file.size,
    } satisfies CompressImageResult;
  }
}
