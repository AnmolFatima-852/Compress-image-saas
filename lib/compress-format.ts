/** Formats selectable in the UI (never silently default to JPEG when a value is provided). */
export type OutputFormat = 'jpeg' | 'png' | 'webp';

/**
 * Parses the UI output-format value. Unknown values throw — never silently coerce to JPEG.
 */
export function resolveOutputFormat(requestedFormat: string | undefined): OutputFormat {
  const normalized = requestedFormat?.trim().toLowerCase();

  if (normalized === 'png') return 'png';
  if (normalized === 'webp') return 'webp';
  if (normalized === 'jpeg' || normalized === 'jpg') return 'jpeg';

  throw new Error(`Unsupported output format: ${requestedFormat ?? '(missing)'}. Choose JPEG, PNG, or WEBP.`);
}

/** Always uses the selected output format extension — never the source filename extension. */
export function buildDownloadFileName(fileName: string, format: OutputFormat) {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'compressed-image';
  const extension = format === 'jpeg' ? 'jpg' : format;
  return `${baseName}-compressed.${extension}`;
}

export function buildDownloadMimeType(format: OutputFormat) {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
}

export function toFileExtension(format: OutputFormat) {
  return format === 'jpeg' ? 'jpg' : format;
}

/** Normalizes sharp/lib formats (e.g. "jpg") to an OutputFormat when possible. */
export function normalizeDetectedFormat(detected: string | undefined): OutputFormat | null {
  const normalized = detected?.trim().toLowerCase();
  if (normalized === 'jpeg' || normalized === 'jpg') return 'jpeg';
  if (normalized === 'png') return 'png';
  if (normalized === 'webp') return 'webp';
  return null;
}

export function formatsMatch(detected: string | undefined, expected: OutputFormat): boolean {
  return normalizeDetectedFormat(detected) === expected;
}
