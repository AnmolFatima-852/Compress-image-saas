import { formatBytes } from '@/lib/format-bytes';
import type { OutputFormat } from '@/lib/compress-format';
import { COMPRESS_REASON } from '@/lib/compress-outcome';

/** @deprecated Prefer COMPRESS_REASON.alreadySmaller — kept for existing imports/tests. */
export const ALREADY_UNDER_TARGET_MESSAGE = COMPRESS_REASON.alreadySmaller;

/** Closest-result note when the target could not be met safely (JPEG/WEBP). */
export const TARGET_UNREACHABLE_MESSAGE = COMPRESS_REASON.severeQualityLoss;

/** Closest-result note when the target could not be met safely (PNG). */
export const PNG_TARGET_UNREACHABLE_MESSAGE = COMPRESS_REASON.severeQualityLoss;

export function buildCompressResultMessage({
  compressedSize,
  targetBytes,
  exactMatch,
  format,
  resized,
}: {
  compressedSize: number;
  targetBytes: number;
  exactMatch: boolean;
  format: OutputFormat;
  resized: boolean;
}) {
  const toleranceLabel = format === 'png' ? '±10 KB' : '±1 KB';

  if (exactMatch) {
    return `Compressed to ${formatBytes(compressedSize)} (${format.toUpperCase()}) and matched the target within ${toleranceLabel}.`;
  }

  // Still larger than the target after exhausting safe compression.
  if (compressedSize > targetBytes) {
    return COMPRESS_REASON.severeQualityLoss;
  }

  return `Compressed to ${formatBytes(compressedSize)} (${format.toUpperCase()}). Closest match under the target${resized ? ' after resizing' : ''}.`;
}
