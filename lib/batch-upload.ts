import { validateImageFile } from '@/lib/file';

/** AI_RULES: support at least 100 images in one batch. */
export const MAX_BATCH_IMAGES = 100;

export type BatchImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

export function createBatchImageId(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
}

/** Total original bytes across the current batch selection. */
export function getBatchOriginalTotalBytes(items: BatchImageItem[]) {
  return items.reduce((sum, item) => sum + item.file.size, 0);
}

export function revokeBatchPreview(item: BatchImageItem) {
  if (item.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

export function revokeBatchPreviews(items: BatchImageItem[]) {
  items.forEach(revokeBatchPreview);
}

/**
 * Validates and appends files to an existing batch without exceeding the max count.
 * Skips duplicates (same name + size + lastModified + type).
 */
export function appendFilesToBatch(
  current: BatchImageItem[],
  incoming: FileList | File[],
): {
  items: BatchImageItem[];
  added: number;
  errors: string[];
} {
  const next = [...current];
  const seen = new Set(current.map((item) => item.id));
  const errors: string[] = [];
  let added = 0;

  for (const file of Array.from(incoming)) {
    if (next.length >= MAX_BATCH_IMAGES) {
      errors.push(`You can upload up to ${MAX_BATCH_IMAGES} images in one batch.`);
      break;
    }

    const id = createBatchImageId(file);
    if (seen.has(id)) {
      continue;
    }

    const validation = validateImageFile(file);
    if (!validation.valid) {
      errors.push(`${file.name}: ${validation.reason ?? 'Unable to upload this file.'}`);
      continue;
    }

    seen.add(id);
    next.push({
      id,
      file,
      previewUrl: URL.createObjectURL(file),
    });
    added += 1;
  }

  return { items: next, added, errors };
}

export function removeBatchItem(items: BatchImageItem[], id: string): BatchImageItem[] {
  const target = items.find((item) => item.id === id);
  if (target) {
    revokeBatchPreview(target);
  }
  return items.filter((item) => item.id !== id);
}

export function clearBatchItems(items: BatchImageItem[]): BatchImageItem[] {
  revokeBatchPreviews(items);
  return [];
}

/** Reorder a batch item up (-1) or down (+1). Returns the original array if the move is invalid. */
export function moveBatchItem(items: BatchImageItem[], id: string, direction: -1 | 1): BatchImageItem[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) {
    return items;
  }

  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(nextIndex, 0, moved!);
  return next;
}
