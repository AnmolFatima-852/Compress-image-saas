/**
 * Browser download helpers that convert data URLs to Blobs.
 * Tracks object URLs and download locks to avoid leaks and overlapping downloads.
 */

const REVOKE_DELAY_MS = 2_500;

const liveObjectUrls = new Set<string>();
const pendingRevokeTimers = new Set<ReturnType<typeof setTimeout>>();
let downloadLockHeld = false;

export function extractMimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/i);
  const mime = match?.[1]?.toLowerCase() ?? '';
  if (mime.startsWith('image/') || mime === 'application/zip' || mime === 'application/pdf') {
    return mime === 'image/jpg' ? 'image/jpeg' : mime;
  }
  return 'application/octet-stream';
}

export function extensionFromMimeType(mimeType: string): string | null {
  const mime = mimeType.toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/avif') return 'avif';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'application/zip') return 'zip';
  if (mime === 'application/pdf') return 'pdf';
  return null;
}

/** Copy into a standalone buffer so Blob construction works across browsers. */
export function uint8ArrayToBlob(bytes: Uint8Array, mimeType: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buffer = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
  return new Blob([buffer], { type: mimeType || 'application/octet-stream' });
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    throw new Error('Invalid image data URL.');
  }

  const meta = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);

  if (!meta.includes(';base64')) {
    const decoded = decodeURIComponent(payload);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  }

  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const mimeType = extractMimeTypeFromDataUrl(dataUrl);
  return uint8ArrayToBlob(dataUrlToUint8Array(dataUrl), mimeType);
}

export function ensureDownloadFileName(
  fileName: string | undefined,
  options?: { mimeType?: string; fallbackExt?: string; fallbackBase?: string },
): string {
  const fallbackBase = options?.fallbackBase ?? 'compressed-image';
  const trimmed = (fileName ?? '').trim() || fallbackBase;
  const hasExt = /\.[a-z0-9]+$/i.test(trimmed);

  if (hasExt) {
    return trimmed;
  }

  const fromMime = options?.mimeType ? extensionFromMimeType(options.mimeType) : null;
  const ext = (fromMime || options?.fallbackExt || 'bin').replace(/^\./, '');
  return `${trimmed}.${ext}`;
}

export function isDownloadLocked() {
  return downloadLockHeld;
}

/** Acquire a process-wide download lock. Returns false if another download is active. */
export function tryAcquireDownloadLock(): boolean {
  if (downloadLockHeld) return false;
  downloadLockHeld = true;
  return true;
}

export function releaseDownloadLock() {
  downloadLockHeld = false;
}

export async function withDownloadLock<T>(fn: () => Promise<T> | T): Promise<T> {
  if (!tryAcquireDownloadLock()) {
    throw new Error('Another download is already in progress. Please wait.');
  }
  try {
    return await fn();
  } finally {
    releaseDownloadLock();
  }
}

export function trackObjectUrl(url: string) {
  if (url.startsWith('blob:')) {
    liveObjectUrls.add(url);
  }
  return url;
}

/** Revoke a blob URL after a short delay so the browser can start the download. */
export function revokeObjectUrlSoon(url: string, delayMs = REVOKE_DELAY_MS) {
  if (!url.startsWith('blob:') || typeof URL === 'undefined') return;

  liveObjectUrls.add(url);
  const timer = setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore revoke races.
    }
    liveObjectUrls.delete(url);
    pendingRevokeTimers.delete(timer);
  }, delayMs);
  pendingRevokeTimers.add(timer);
}

/** Immediately revoke every tracked object URL (unmount / clear batch). */
export function revokeAllTrackedObjectUrls() {
  pendingRevokeTimers.forEach((timer) => clearTimeout(timer));
  pendingRevokeTimers.clear();

  liveObjectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore.
    }
  });
  liveObjectUrls.clear();
}

export function getTrackedObjectUrlCount() {
  return liveObjectUrls.size;
}

/**
 * Triggers a file download via a temporary object URL when needed.
 * Always schedules Blob URL revocation after the click.
 */
export function triggerBrowserDownload(source: string | Blob, fileName: string): void {
  if (typeof document === 'undefined') {
    throw new Error('Downloads are only available in the browser.');
  }

  let objectUrl: string | null = null;
  let href: string;
  let resolvedName = fileName.trim() || 'download';

  try {
    if (typeof source === 'string' && source.startsWith('data:')) {
      const mimeType = extractMimeTypeFromDataUrl(source);
      resolvedName = ensureDownloadFileName(resolvedName, { mimeType });
      const blob = dataUrlToBlob(source);
      objectUrl = trackObjectUrl(URL.createObjectURL(blob));
      href = objectUrl;
    } else if (source instanceof Blob) {
      resolvedName = ensureDownloadFileName(resolvedName, {
        mimeType: source.type,
        fallbackExt: extensionFromMimeType(source.type) ?? undefined,
      });
      objectUrl = trackObjectUrl(URL.createObjectURL(source));
      href = objectUrl;
    } else if (typeof source === 'string' && source.startsWith('blob:')) {
      href = source;
      trackObjectUrl(source);
    } else {
      href = String(source);
    }

    const link = document.createElement('a');
    link.href = href;
    link.download = resolvedName;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    if (objectUrl) {
      revokeObjectUrlSoon(objectUrl);
    }
  }
}
