import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ensureProfileForUser } from '@/lib/ensure-profile';
import { formatBytes } from '@/lib/format-bytes';

export type DashboardHistoryItem = {
  id: string;
  fileName: string;
  format: string;
  originalSize: string;
  compressedSize: string;
  savedSpace: string;
  savedPercentage: string;
  compressionRatio: string;
  createdAt: string;
  downloadUrl: string | null;
  downloadFileName: string;
};

export type PersistCompressionInput = {
  originalFilename: string;
  originalSize: number;
  compressedSize: number;
  savedSpace: number;
  compressionRatio: string;
  imageFormat: string;
  width: number;
  height: number;
  compressedBuffer: Buffer;
  fileExtension: string;
};

export type PersistCompressionResult = {
  ok: boolean;
  historyId?: string;
  reason?: string;
};

function formatSavedPercentage(originalSize: number, savedSpace: number) {
  if (originalSize <= 0) return '0%';
  return `${Math.round((Math.max(savedSpace, 0) / originalSize) * 100)}%`;
}

function logDev(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[compression_history]', ...args);
  }
}

/**
 * Persists a successful compression for the authenticated user into compression_history.
 * Guests (no session) are skipped — homepage compression stays public.
 * This module is NOT a Server Action file so Buffer stays in-process (no serialization).
 */
export async function persistCompressionHistory(input: PersistCompressionInput): Promise<PersistCompressionResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    logDev('skip: Supabase env vars missing');
    return { ok: false, reason: 'supabase_unavailable' };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    logDev('getUser failed:', userError.message);
  }

  if (!user) {
    logDev('skip: no authenticated user (guest compression)');
    return { ok: false, reason: 'unauthenticated' };
  }

  await ensureProfileForUser(supabase, user);

  const historyId = crypto.randomUUID();
  const storagePath = `${user.id}/${historyId}.${input.fileExtension}`;
  const savedSpace = Math.max(input.savedSpace, 0);

  const { error: insertError } = await supabase.from('compression_history').insert({
    id: historyId,
    user_id: user.id,
    original_filename: input.originalFilename,
    original_size: input.originalSize,
    compressed_size: input.compressedSize,
    saved_space: savedSpace,
    compression_ratio: input.compressionRatio,
    image_format: input.imageFormat,
    width: input.width,
    height: input.height,
  });

  if (insertError) {
    logDev('insert failed:', insertError.message, insertError.code, insertError.details);
    return { ok: false, reason: insertError.message };
  }

  logDev('insert ok:', historyId, 'user:', user.id);

  const mimeType =
    input.fileExtension === 'jpg' ? 'image/jpeg' : `image/${input.fileExtension === 'jpeg' ? 'jpeg' : input.fileExtension}`;

  const { error: uploadError } = await supabase.storage
    .from('compression-outputs')
    .upload(storagePath, input.compressedBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    logDev('storage upload failed (row still saved):', uploadError.message);
  }

  return { ok: true, historyId };
}

/**
 * Loads the signed-in user's compression_history rows (newest first).
 */
export async function fetchCompressionHistoryForUser(): Promise<DashboardHistoryItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('compression_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) {
    logDev('fetch failed:', error?.message);
    return [];
  }

  const items = await Promise.all(
    data.map(async (row) => {
      const ext = row.image_format.toLowerCase() === 'jpeg' ? 'jpg' : row.image_format.toLowerCase();
      const storagePath = `${user.id}/${row.id}.${ext}`;
      const { data: signed } = await supabase.storage.from('compression-outputs').createSignedUrl(storagePath, 60 * 60);

      const originalSize = Number(row.original_size);
      const compressedSize = Number(row.compressed_size);
      const savedSpace = Number(row.saved_space ?? Math.max(originalSize - compressedSize, 0));

      return {
        id: row.id,
        fileName: row.original_filename,
        format: row.image_format,
        originalSize: formatBytes(originalSize),
        compressedSize: formatBytes(compressedSize),
        savedSpace: formatBytes(savedSpace),
        savedPercentage: formatSavedPercentage(originalSize, savedSpace),
        compressionRatio: row.compression_ratio,
        createdAt: row.created_at,
        downloadUrl: signed?.signedUrl ?? null,
        downloadFileName: row.original_filename.replace(/\.[^.]+$/, '') + `-compressed.${ext}`,
      } satisfies DashboardHistoryItem;
    }),
  );

  return items;
}
