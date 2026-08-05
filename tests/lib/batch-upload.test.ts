import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_BATCH_IMAGES,
  appendFilesToBatch,
  clearBatchItems,
  getBatchOriginalTotalBytes,
  moveBatchItem,
  removeBatchItem,
} from '@/lib/batch-upload';

function makeImageFile(name: string, size = 128) {
  return new File([new Uint8Array(size)], name, { type: 'image/png', lastModified: 1 });
}

describe('appendFilesToBatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds multiple valid images and skips duplicates', () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });

    const first = makeImageFile('a.png');
    const second = makeImageFile('b.png');
    const duplicate = makeImageFile('a.png');

    const once = appendFilesToBatch([], [first, second]);
    expect(once.added).toBe(2);
    expect(once.items).toHaveLength(2);

    const twice = appendFilesToBatch(once.items, [duplicate]);
    expect(twice.added).toBe(0);
    expect(twice.items).toHaveLength(2);

    clearBatchItems(twice.items);
  });

  it('rejects unsupported types and enforces the batch limit', () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });

    const invalid = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const invalidResult = appendFilesToBatch([], [invalid]);
    expect(invalidResult.added).toBe(0);
    expect(invalidResult.errors[0]).toMatch(/Unsupported file type/i);

    const filled = Array.from({ length: MAX_BATCH_IMAGES }, (_, index) =>
      makeImageFile(`image-${index}.png`, 64 + index),
    );
    const full = appendFilesToBatch([], filled);
    expect(full.items).toHaveLength(MAX_BATCH_IMAGES);

    const overflow = appendFilesToBatch(full.items, [makeImageFile('extra.png', 999)]);
    expect(overflow.added).toBe(0);
    expect(overflow.errors[0]).toMatch(/up to 100 images/i);

    clearBatchItems(full.items);
  });

  it('removes individual images and clears the batch', () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });

    const { items } = appendFilesToBatch([], [makeImageFile('one.png'), makeImageFile('two.png')]);
    const remaining = removeBatchItem(items, items[0]!.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.file.name).toBe('two.png');

    expect(clearBatchItems(remaining)).toEqual([]);
  });

  it('sums original batch size', () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });

    const { items } = appendFilesToBatch([], [makeImageFile('a.png', 100), makeImageFile('b.png', 250)]);
    expect(getBatchOriginalTotalBytes(items)).toBe(350);
    clearBatchItems(items);
  });

  it('reorders images up and down', () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });

    const { items } = appendFilesToBatch([], [
      makeImageFile('one.png'),
      makeImageFile('two.png'),
      makeImageFile('three.png'),
    ]);

    const down = moveBatchItem(items, items[0]!.id, 1);
    expect(down.map((item) => item.file.name)).toEqual(['two.png', 'one.png', 'three.png']);

    const up = moveBatchItem(down, down[2]!.id, -1);
    expect(up.map((item) => item.file.name)).toEqual(['two.png', 'three.png', 'one.png']);

    expect(moveBatchItem(up, up[0]!.id, -1)).toBe(up);
    expect(moveBatchItem(up, up[2]!.id, 1)).toBe(up);

    clearBatchItems(up);
  });
});
