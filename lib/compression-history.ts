export type CompressionHistoryEntry = {
  id: string;
  fileName: string;
  format: string;
  originalSize: string;
  compressedSize: string;
  savedSpace: string;
  savedPercentage: string;
  resolution: string;
  compressionRatio: string;
  createdAt: string;
  downloadUrl: string;
  downloadFileName: string;
};

const STORAGE_KEY = 'compress-image-history';
const memoryStore = new Map<string, string>();

const getStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
    clear: () => {
      memoryStore.clear();
    },
  } as Storage;
};

export function appendCompressionHistory(userId: string, entry: CompressionHistoryEntry) {
  const storage = getStorage();
  const current = getCompressionHistory(userId);
  const next = [entry, ...current].slice(0, 12);
  storage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(next));
}

export function getCompressionHistory(userId: string) {
  const storage = getStorage();
  const stored = storage.getItem(`${STORAGE_KEY}:${userId}`);
  if (!stored) return [] as CompressionHistoryEntry[];

  try {
    return JSON.parse(stored) as CompressionHistoryEntry[];
  } catch {
    return [] as CompressionHistoryEntry[];
  }
}
