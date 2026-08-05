'use server';

import { normalizeBatchOutputFormat } from '@/lib/batch-history';
import { persistBatchHistory, fetchBatchHistoryForUser, type DashboardBatchHistoryItem } from '@/services/batch-history';

export type { DashboardBatchHistoryItem };

/**
 * Server Action: load batch history for the Dashboard.
 */
export async function getBatchHistoryForDashboard(): Promise<DashboardBatchHistoryItem[]> {
  return fetchBatchHistoryForUser();
}

/**
 * Server Action: persist exactly one batch_history row from a completed homepage batch.
 * Metrics are required; ZIP/PDF files are optional best-effort attachments.
 */
export async function persistCompletedBatchHistory(formData: FormData): Promise<{ ok: boolean; reason?: string }> {
  const imageCount = Number(formData.get('imageCount'));
  const originalTotalSize = Number(formData.get('originalTotalSize'));
  const compressedTotalSize = Number(formData.get('compressedTotalSize'));
  const savedSpace = Number(formData.get('savedSpace'));
  const processingDurationMs = Number(formData.get('processingDurationMs'));
  const outputFormat = normalizeBatchOutputFormat(String(formData.get('outputFormat') || ''));
  const zipFile = formData.get('zip');
  const pdfFile = formData.get('pdf');

  if (
    !Number.isFinite(imageCount) ||
    imageCount < 1 ||
    !Number.isFinite(originalTotalSize) ||
    originalTotalSize < 0 ||
    !Number.isFinite(compressedTotalSize) ||
    compressedTotalSize < 0
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }

  let zipBuffer: Buffer | null = null;
  let pdfBuffer: Buffer | null = null;

  if (zipFile instanceof File && zipFile.size > 0) {
    zipBuffer = Buffer.from(await zipFile.arrayBuffer());
  }

  if (pdfFile instanceof File && pdfFile.size > 0) {
    pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
  }

  const result = await persistBatchHistory({
    imageCount,
    originalTotalSize,
    compressedTotalSize,
    savedSpace: Number.isFinite(savedSpace) ? savedSpace : Math.max(originalTotalSize - compressedTotalSize, 0),
    processingDurationMs: Number.isFinite(processingDurationMs) ? processingDurationMs : 0,
    outputFormat,
    zipBuffer,
    pdfBuffer,
  });

  return { ok: result.ok, reason: result.reason };
}
