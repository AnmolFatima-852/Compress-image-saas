import {
  batchPdfStoragePath,
  batchZipStoragePath,
  formatProcessingDuration,
  normalizeBatchOutputFormat,
  shortBatchId,
} from '@/lib/batch-history';
import { ensureProfileForUser } from '@/lib/ensure-profile';
import { formatBytes } from '@/lib/format-bytes';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export type DashboardBatchHistoryItem = {
  id: string;
  shortId: string;
  imageCount: number;
  originalTotalSize: string;
  compressedTotalSize: string;
  savedSpace: string;
  savedPercentage: string;
  compressionRatio: string;
  processingDuration: string;
  outputFormat: string;
  createdAt: string;
  zipDownloadUrl: string | null;
  pdfDownloadUrl: string | null;
  zipFileName: string;
  pdfFileName: string;
};

export type PersistBatchHistoryInput = {
  imageCount: number;
  originalTotalSize: number;
  compressedTotalSize: number;
  savedSpace: number;
  processingDurationMs: number;
  outputFormat: string;
  zipBuffer?: Buffer | null;
  pdfBuffer?: Buffer | null;
};

export type PersistBatchHistoryResult = {
  ok: boolean;
  batchId?: string;
  reason?: string;
};

function formatSavedPercentage(originalSize: number, savedSpace: number) {
  if (originalSize <= 0) return '0%';
  return `${Math.round((Math.max(savedSpace, 0) / originalSize) * 100)}%`;
}

function formatCompressionRatio(originalSize: number, compressedSize: number) {
  if (originalSize <= 0) return '1.00:1';
  return `${(originalSize / Math.max(compressedSize, 1)).toFixed(2)}:1`;
}

function logDev(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[batch_history]', ...args);
  }
}

/**
 * Inserts exactly one batch_history row for the signed-in user.
 * ZIP/PDF uploads are best-effort and only flip zip_downloaded / pdf_downloaded.
 * Guests are skipped so homepage compression stays public.
 */
export async function persistBatchHistory(input: PersistBatchHistoryInput): Promise<PersistBatchHistoryResult> {
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
    logDev('skip: no authenticated user (guest batch)');
    return { ok: false, reason: 'unauthenticated' };
  }

  await ensureProfileForUser(supabase, user);

  const batchId = crypto.randomUUID();
  const totalSavedSpace = Math.max(input.savedSpace, 0);
  const outputFormat = normalizeBatchOutputFormat(input.outputFormat);
  const durationMs = Math.max(0, Math.round(input.processingDurationMs));
  const zipPath = batchZipStoragePath(user.id, batchId);
  const pdfPath = batchPdfStoragePath(user.id, batchId);

  const { error: insertError } = await supabase.from('batch_history').insert({
    id: batchId,
    user_id: user.id,
    image_count: input.imageCount,
    total_original_size: input.originalTotalSize,
    total_compressed_size: input.compressedTotalSize,
    total_saved_space: totalSavedSpace,
    output_format: outputFormat,
    zip_downloaded: false,
    pdf_downloaded: false,
    duration_ms: durationMs,
  });

  if (insertError) {
    logDev('insert failed:', insertError.message, insertError.code, insertError.details);
    return { ok: false, reason: insertError.message };
  }

  let zipDownloaded = false;
  let pdfDownloaded = false;

  if (input.zipBuffer && input.zipBuffer.length > 0) {
    const { error: zipError } = await supabase.storage.from('compression-outputs').upload(zipPath, input.zipBuffer, {
      contentType: 'application/zip',
      upsert: false,
    });

    if (zipError) {
      logDev('zip upload failed:', zipError.message);
    } else {
      zipDownloaded = true;
    }
  }

  if (input.pdfBuffer && input.pdfBuffer.length > 0) {
    const { error: pdfError } = await supabase.storage.from('compression-outputs').upload(pdfPath, input.pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

    if (pdfError) {
      logDev('pdf upload failed:', pdfError.message);
    } else {
      pdfDownloaded = true;
    }
  }

  if (zipDownloaded || pdfDownloaded) {
    const { error: updateError } = await supabase
      .from('batch_history')
      .update({ zip_downloaded: zipDownloaded, pdf_downloaded: pdfDownloaded })
      .eq('id', batchId)
      .eq('user_id', user.id);

    if (updateError) {
      logDev('flag update failed:', updateError.message);
    }
  }

  logDev('batch saved:', batchId, 'user:', user.id, { zipDownloaded, pdfDownloaded, outputFormat });
  return { ok: true, batchId };
}

/**
 * Loads the signed-in user's batch_history rows (newest first) with signed ZIP/PDF URLs.
 */
export async function fetchBatchHistoryForUser(): Promise<DashboardBatchHistoryItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('batch_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) {
    logDev('fetch failed:', error?.message);
    return [];
  }

  const stamp = (iso: string) => iso.slice(0, 10);

  return Promise.all(
    data.map(async (row) => {
      const originalTotalSize = Number(row.total_original_size);
      const compressedTotalSize = Number(row.total_compressed_size);
      const savedSpace = Number(row.total_saved_space ?? Math.max(originalTotalSize - compressedTotalSize, 0));
      const dateStamp = stamp(row.created_at);
      const outputFormat = normalizeBatchOutputFormat(row.output_format);

      let zipDownloadUrl: string | null = null;
      let pdfDownloadUrl: string | null = null;

      if (row.zip_downloaded) {
        const { data: signed } = await supabase.storage
          .from('compression-outputs')
          .createSignedUrl(batchZipStoragePath(user.id, row.id), 60 * 60);
        zipDownloadUrl = signed?.signedUrl ?? null;
      }

      if (row.pdf_downloaded) {
        const { data: signed } = await supabase.storage
          .from('compression-outputs')
          .createSignedUrl(batchPdfStoragePath(user.id, row.id), 60 * 60);
        pdfDownloadUrl = signed?.signedUrl ?? null;
      }

      return {
        id: row.id,
        shortId: shortBatchId(row.id),
        imageCount: Number(row.image_count),
        originalTotalSize: formatBytes(originalTotalSize),
        compressedTotalSize: formatBytes(compressedTotalSize),
        savedSpace: formatBytes(savedSpace),
        savedPercentage: formatSavedPercentage(originalTotalSize, savedSpace),
        compressionRatio: formatCompressionRatio(originalTotalSize, compressedTotalSize),
        processingDuration: formatProcessingDuration(Number(row.duration_ms)),
        outputFormat,
        createdAt: row.created_at,
        zipDownloadUrl,
        pdfDownloadUrl,
        zipFileName: `batch-${shortBatchId(row.id)}-${dateStamp}.zip`,
        pdfFileName: `batch-${shortBatchId(row.id)}-${dateStamp}.pdf`,
      } satisfies DashboardBatchHistoryItem;
    }),
  );
}
