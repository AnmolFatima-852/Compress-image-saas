'use server';

import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ensureProfileForUser } from '@/lib/ensure-profile';
import { formatBytes } from '@/lib/format-bytes';
export type DashboardHistoryItem = {
  id: string;
  fileName: string;
  format: string;
  originalSize: string;
  compressedSize: string;
  savedPercentage: string;
  compressionRatio: string;
  createdAt: string;
  downloadUrl: string | null;
  downloadFileName: string;
};

type PersistCompressionInput = {
  originalFilename: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string;
  imageFormat: string;
  width: number;
  height: number;
  compressedBuffer: Buffer;
  fileExtension: string;
};

function formatSavedPercentage(originalSize: number, compressedSize: number) {
  if (originalSize <= 0) return '0%';
  const saved = Math.max(originalSize - compressedSize, 0);
  return `${Math.round((saved / originalSize) * 100)}%`;
}

export async function persistCompressionHistory(input: PersistCompressionInput) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await ensureProfileForUser(supabase, user);

  const historyId = crypto.randomUUID();
  const storagePath = `${user.id}/${historyId}.${input.fileExtension}`;

  const { error: insertError } = await supabase.from('compression_history').insert({
    id: historyId,
    user_id: user.id,
    original_filename: input.originalFilename,
    original_size: input.originalSize,
    compressed_size: input.compressedSize,
    compression_ratio: input.compressionRatio,
    image_format: input.imageFormat,
    width: input.width,
    height: input.height,
  });

  if (insertError) {
    console.error('compression_history insert failed:', insertError.message);
    return;
  }

  const mimeType =
    input.fileExtension === 'jpg' ? 'image/jpeg' : `image/${input.fileExtension === 'jpeg' ? 'jpeg' : input.fileExtension}`;

  const { error: uploadError } = await supabase.storage
    .from('compression-outputs')
    .upload(storagePath, input.compressedBuffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    console.error('compression output upload failed:', uploadError.message);
  }
}

export async function getCompressionHistoryForDashboard(): Promise<DashboardHistoryItem[]> {
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
    console.error('compression history fetch failed:', error?.message);
    return [];
  }

  const items = await Promise.all(
    data.map(async (row) => {
      const ext = row.image_format.toLowerCase() === 'jpeg' ? 'jpg' : row.image_format.toLowerCase();
      const storagePath = `${user.id}/${row.id}.${ext}`;
      const { data: signed } = await supabase.storage.from('compression-outputs').createSignedUrl(storagePath, 60 * 60);

      const originalSize = Number(row.original_size);
      const compressedSize = Number(row.compressed_size);

      return {
        id: row.id,
        fileName: row.original_filename,
        format: row.image_format,
        originalSize: formatBytes(originalSize),
        compressedSize: formatBytes(compressedSize),
        savedPercentage: formatSavedPercentage(originalSize, compressedSize),
        compressionRatio: row.compression_ratio,
        createdAt: row.created_at,
        downloadUrl: signed?.signedUrl ?? null,
        downloadFileName: row.original_filename.replace(/\.[^.]+$/, '') + `-compressed.${ext}`,
      } satisfies DashboardHistoryItem;
    }),
  );

  return items;
}
