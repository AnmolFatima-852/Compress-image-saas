/**
 * Converts a UI target size (KB/MB) to bytes.
 * Uses 1 KB = 1024 bytes and 1 MB = 1024 × 1024 bytes.
 */
export function targetSizeToBytes(size: number, unit: 'KB' | 'MB'): number {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Target size must be a positive number.');
  }

  if (unit === 'MB') {
    return Math.round(size * 1024 * 1024);
  }

  return Math.round(size * 1024);
}
