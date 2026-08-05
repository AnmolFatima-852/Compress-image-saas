"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Droplets, FileArchive, FileText, ImagePlus, RefreshCw, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BatchUploadList } from '@/components/batch-upload-list';
import { HeaderAuthNav } from '@/components/header-auth-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  countBatchOutcomes,
  getSuccessfulBatchResults,
  runBatchCompression,
  type BatchJobMap,
} from '@/lib/batch-compress';
import { summarizeSuccessfulBatch } from '@/lib/batch-history';
import { buildBatchSummaryToast } from '@/lib/compress-outcome';
import {
  appendFilesToBatch,
  clearBatchItems,
  moveBatchItem,
  removeBatchItem,
  type BatchImageItem,
} from '@/lib/batch-upload';
import {
  buildBatchPdfDownloadName,
  buildCompressedImagesPdf,
  buildImagesToPdfDownloadName,
  collectPdfEntriesFromBatchItems,
  collectPdfEntriesFromBatchJobs,
  toFriendlyPdfError,
  type AppToolMode,
} from '@/lib/batch-pdf';
import {
  buildBatchZipDownloadName,
  buildCompressedImagesZip,
  collectZipEntriesFromBatchJobs,
} from '@/lib/batch-zip';
import {
  ensureDownloadFileName,
  extractMimeTypeFromDataUrl,
  isDownloadLocked,
  revokeAllTrackedObjectUrls,
  trackObjectUrl,
  triggerBrowserDownload,
  withDownloadLock,
} from '@/lib/download-file';
import { isAbortError, releaseBatchJobBuffers, releaseClientBatchResources } from '@/lib/resource-cleanup';
import {
  alertError,
  surfaceCard,
  surfaceMuted,
  textBody,
  textEyebrow,
  textHeading,
  textLabel,
  textMuted,
  textNav,
} from '@/lib/ui-text';
import { persistCompletedBatchHistory } from '@/services/batch-history-service';
import { compressImageAction } from '@/services/compress-image';

function scrollToSection(event: React.MouseEvent<HTMLAnchorElement>, sectionId: string) {
  event.preventDefault();
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const schema = z.object({
  targetSize: z.number().min(1),
  unit: z.enum(['KB', 'MB']),
  outputFormat: z.enum(['jpeg', 'png', 'webp']),
});

type FormValues = z.infer<typeof schema>;

const initialValues: FormValues = {
  targetSize: 100,
  unit: 'KB',
  outputFormat: 'jpeg',
};

export type CompressionRunSettings = {
  targetSize: number;
  unit: 'KB' | 'MB';
  outputFormat: 'jpeg' | 'png' | 'webp';
};

export function compressionSettingsChanged(
  current: CompressionRunSettings,
  previous: CompressionRunSettings | null,
): boolean {
  if (!previous) return true;
  return (
    current.targetSize !== previous.targetSize ||
    current.unit !== previous.unit ||
    current.outputFormat !== previous.outputFormat
  );
}

export function shouldDisableCompressButton({
  fileCount,
  isCompressing,
  batchComplete = false,
  settingsChanged = true,
}: {
  fileCount: number;
  isCompressing: boolean;
  /** True after a run finished and results are still on screen. */
  batchComplete?: boolean;
  /** True when target size / unit / format differ from the last run. */
  settingsChanged?: boolean;
}) {
  if (fileCount < 1 || isCompressing) return true;
  // After a completed run, require a settings change before recompressing.
  if (batchComplete && !settingsChanged) return true;
  return false;
}

export function shouldShowDownloadButton({
  isCompressing,
  successCount,
}: {
  isCompressing: boolean;
  successCount: number;
}) {
  return !isCompressing && successCount > 0;
}

function triggerDownload(source: string | Blob, fileName: string) {
  triggerBrowserDownload(source, fileName);
}

export function HeroSection() {
  const [mode, setMode] = useState<AppToolMode>('compress');
  const [batchItems, setBatchItems] = useState<BatchImageItem[]>([]);
  const batchItemsRef = useRef<BatchImageItem[]>([]);
  const [batchJobs, setBatchJobs] = useState<BatchJobMap>({});
  const batchJobsRef = useRef<BatchJobMap>({});
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isZipping, setIsZipping] = useState(false);
  const [isBuildingPdf, setIsBuildingPdf] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imagesToPdfUrl, setImagesToPdfUrl] = useState<string | null>(null);
  const imagesToPdfUrlRef = useRef<string | null>(null);
  const compressAbortRef = useRef<AbortController | null>(null);
  const individualDownloadTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [lastRunSettings, setLastRunSettings] = useState<CompressionRunSettings | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  const watchedTargetSize = watch('targetSize');
  const watchedUnit = watch('unit');
  const watchedOutputFormat = watch('outputFormat');

  useEffect(() => {
    batchItemsRef.current = batchItems;
  }, [batchItems]);

  useEffect(() => {
    batchJobsRef.current = batchJobs;
  }, [batchJobs]);

  const clearIndividualDownloadTimers = () => {
    individualDownloadTimersRef.current.forEach((timer) => clearTimeout(timer));
    individualDownloadTimersRef.current = [];
  };

  const cancelCompression = () => {
    compressAbortRef.current?.abort();
    compressAbortRef.current = null;
  };

  const handleFilesSelection = (incoming: FileList | File[]) => {
    if (isCompressing || isDownloading || isZipping || isBuildingPdf) return;

    const { items, added, errors } = appendFilesToBatch(batchItemsRef.current, incoming);
    batchItemsRef.current = items;
    setBatchItems(items);
    releaseBatchJobBuffers(batchJobsRef.current);
    setBatchJobs({});
    setLastRunSettings(null);
    revokeImagesToPdfUrl();
    setIsDragActive(false);
    setProgress(0);

    if (errors.length > 0) {
      const reason = errors[0] ?? 'Unable to upload one or more files.';
      setUploadError(reason);
      setToast({ type: 'error', message: reason });
      return;
    }

    if (added === 0) {
      return;
    }

    setUploadError(null);
    setToast({
      type: 'success',
      message: added === 1 ? '1 image is ready to compress.' : `${added} images are ready to compress.`,
    });
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const pastedFiles = Array.from(event.clipboardData?.files ?? []).filter((item) =>
        item.type.startsWith('image/'),
      );
      if (pastedFiles.length > 0) {
        event.preventDefault();
        handleFilesSelection(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      cancelCompression();
      clearIndividualDownloadTimers();
      releaseClientBatchResources({
        jobs: batchJobsRef.current,
        objectUrl: imagesToPdfUrlRef.current,
      });
      clearBatchItems(batchItemsRef.current);
      revokeAllTrackedObjectUrls();
    };
  }, []);

  const revokeImagesToPdfUrl = () => {
    if (imagesToPdfUrlRef.current) {
      URL.revokeObjectURL(imagesToPdfUrlRef.current);
      imagesToPdfUrlRef.current = null;
    }
    setImagesToPdfUrl(null);
  };

  const handleModeChange = (nextMode: AppToolMode) => {
    if (nextMode === mode || isCompressing || isBuildingPdf || isZipping || isDownloading) return;
    setMode(nextMode);
    releaseBatchJobBuffers(batchJobsRef.current);
    setBatchJobs({});
    setProgress(0);
    setUploadError(null);
    setLastRunSettings(null);
    revokeImagesToPdfUrl();
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles?.length) {
      handleFilesSelection(droppedFiles);
    }
  };

  const handleRemoveItem = (id: string) => {
    if (isCompressing || isBuildingPdf || isDownloading || isZipping) return;
    const next = removeBatchItem(batchItemsRef.current, id);
    batchItemsRef.current = next;
    setBatchItems(next);
    setBatchJobs((current) => {
      const removed = current[id];
      if (removed?.result?.downloadUrl) {
        removed.result.downloadUrl = undefined;
      }
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
    if (next.length === 0) {
      setLastRunSettings(null);
      setProgress(0);
    }
    revokeImagesToPdfUrl();
  };

  const handleClearImages = () => {
    // Block while a download is mid-flight so the download lock can settle cleanly.
    if (isDownloading || isZipping || isBuildingPdf) return;
    if (isCompressing) {
      cancelCompression();
    }
    clearIndividualDownloadTimers();
    releaseClientBatchResources({
      jobs: batchJobsRef.current,
      objectUrl: imagesToPdfUrlRef.current,
    });
    const next = clearBatchItems(batchItemsRef.current);
    batchItemsRef.current = next;
    setBatchItems(next);
    setBatchJobs({});
    setUploadError(null);
    setProgress(0);
    setLastRunSettings(null);
    setIsCompressing(false);
    imagesToPdfUrlRef.current = null;
    setImagesToPdfUrl(null);
  };

  const handleCompressAnother = () => {
    if (isCompressing || isBuildingPdf || isZipping || isDownloading) return;
    handleClearImages();
    setToast({
      type: 'success',
      message: 'Ready for a new batch. Upload images to continue.',
    });
    window.setTimeout(() => {
      document.getElementById('image-upload')?.click();
    }, 120);
  };

  const handleMoveItem = (id: string, direction: -1 | 1) => {
    if (isCompressing || isBuildingPdf || isDownloading || isZipping) return;
    const next = moveBatchItem(batchItemsRef.current, id, direction);
    batchItemsRef.current = next;
    setBatchItems(next);
    revokeImagesToPdfUrl();
  };

  const handleDownloadItem = async (id: string) => {
    if (isDownloading || isZipping || isBuildingPdf || isDownloadLocked()) return;

    const job = batchJobs[id];
    if (
      !job?.result?.success ||
      !job.result.downloadUrl ||
      (job.status !== 'done' && job.status !== 'skipped')
    ) {
      return;
    }

    setIsDownloading(true);
    try {
      await withDownloadLock(() => {
        const mimeType = extractMimeTypeFromDataUrl(job.result!.downloadUrl!);
        const fileName = ensureDownloadFileName(job.result!.downloadFileName, {
          mimeType,
          fallbackBase: 'compressed-image',
        });
        triggerDownload(job.result!.downloadUrl!, fileName);
        setToast({
          type: 'success',
          message: `Downloaded ${fileName}`,
        });
      });
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to download this image. Please try again.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (isDownloading || isZipping || isBuildingPdf || isDownloadLocked()) return;

    const successes = getSuccessfulBatchResults(batchJobs);
    if (successes.length === 0) {
      setToast({ type: 'error', message: 'No compressed images are ready to download.' });
      return;
    }

    setIsDownloading(true);
    clearIndividualDownloadTimers();

    try {
      await withDownloadLock(async () => {
        let started = 0;
        let failed = 0;

        for (let index = 0; index < successes.length; index += 1) {
          const { result } = successes[index]!;
          try {
            if (!result.downloadUrl) {
              failed += 1;
            } else {
              const mimeType = extractMimeTypeFromDataUrl(result.downloadUrl);
              const fileName = ensureDownloadFileName(result.downloadFileName, {
                mimeType,
                fallbackBase: `compressed-image-${index + 1}`,
              });
              triggerDownload(result.downloadUrl, fileName);
              started += 1;
            }
          } catch {
            failed += 1;
          }

          if (index < successes.length - 1) {
            await new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, 180);
              individualDownloadTimersRef.current.push(timer);
            });
          }
        }

        if (started > 0 && failed === 0) {
          setToast({
            type: 'success',
            message:
              started === 1
                ? 'Downloaded your compressed image.'
                : `Downloaded ${started} compressed images.`,
          });
        } else if (started > 0) {
          setToast({
            type: 'success',
            message: `Downloaded ${started} images. ${failed} failed.`,
          });
        } else {
          setToast({
            type: 'error',
            message: 'Unable to download the compressed images. Please try again.',
          });
        }
      });
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to download the compressed images.',
      });
    } finally {
      clearIndividualDownloadTimers();
      setIsDownloading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (isZipping || isBuildingPdf || isDownloading || isDownloadLocked()) return;
    const entries = collectZipEntriesFromBatchJobs(batchJobs);
    if (entries.length === 0) return;

    setIsZipping(true);
    setIsDownloading(true);
    try {
      await withDownloadLock(async () => {
        const zipBlob = await buildCompressedImagesZip(entries);
        triggerDownload(zipBlob, buildBatchZipDownloadName(entries.length));
        setToast({
          type: 'success',
          message:
            entries.length === 1
              ? 'ZIP download ready with your compressed image.'
              : `ZIP download ready with ${entries.length} compressed images.`,
        });
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to create the ZIP archive. Please try again.';
      setToast({ type: 'error', message });
    } finally {
      setIsZipping(false);
      setIsDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isBuildingPdf || isZipping || isDownloading || isDownloadLocked()) return;
    const entries = collectPdfEntriesFromBatchJobs(batchJobs);
    if (entries.length === 0) return;

    setIsBuildingPdf(true);
    setIsDownloading(true);
    try {
      await withDownloadLock(async () => {
        const pdfBlob = await buildCompressedImagesPdf(entries);
        triggerDownload(pdfBlob, buildBatchPdfDownloadName(entries.length));
        setToast({
          type: 'success',
          message:
            entries.length === 1
              ? 'PDF download ready with your compressed image.'
              : `PDF download ready with ${entries.length} images (one per page).`,
        });
      });
    } catch (error) {
      setToast({ type: 'error', message: toFriendlyPdfError(error) });
    } finally {
      setIsBuildingPdf(false);
      setIsDownloading(false);
    }
  };

  const persistBatchHistoryInBackground = async (
    jobs: BatchJobMap,
    durationMs: number,
    outputFormat: string,
  ) => {
    // Snapshot metrics + archive payloads immediately so later buffer cleanup cannot erase them.
    const totals = summarizeSuccessfulBatch(jobs);
    if (!totals) return;

    const zipEntries = collectZipEntriesFromBatchJobs(jobs);
    const pdfEntries = collectPdfEntriesFromBatchJobs(jobs);

    const formData = new FormData();
    formData.set('imageCount', String(totals.imageCount));
    formData.set('originalTotalSize', String(totals.originalTotalSize));
    formData.set('compressedTotalSize', String(totals.compressedTotalSize));
    formData.set('savedSpace', String(totals.savedSpace));
    formData.set('processingDurationMs', String(Math.max(0, Math.round(durationMs))));
    formData.set('outputFormat', outputFormat);

    const zipName = buildBatchZipDownloadName(totals.imageCount);
    const pdfName = buildBatchPdfDownloadName(totals.imageCount);

    try {
      if (zipEntries.length > 0) {
        try {
          const zipBlob = await buildCompressedImagesZip(zipEntries);
          formData.set('zip', new File([zipBlob], zipName, { type: 'application/zip' }));
        } catch {
          // Metrics still persist without ZIP.
        }
      }

      if (pdfEntries.length > 0) {
        try {
          const pdfBlob = await buildCompressedImagesPdf(pdfEntries);
          formData.set('pdf', new File([pdfBlob], pdfName, { type: 'application/pdf' }));
        } catch {
          // Metrics still persist without PDF.
        }
      }

      // Exactly one batch_history insert per completed batch (signed-in users only).
      const result = await persistCompletedBatchHistory(formData);
      if (!result.ok && result.reason && result.reason !== 'unauthenticated') {
        // Retry metrics-only if a large ZIP/PDF payload caused the action to fail.
        if (formData.has('zip') || formData.has('pdf')) {
          const metricsOnly = new FormData();
          for (const key of [
            'imageCount',
            'originalTotalSize',
            'compressedTotalSize',
            'savedSpace',
            'processingDurationMs',
            'outputFormat',
          ] as const) {
            const value = formData.get(key);
            if (typeof value === 'string') metricsOnly.set(key, value);
          }
          await persistCompletedBatchHistory(metricsOnly);
        }
      }
    } catch {
      // History persist must never block homepage downloads for guests or failed auth.
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (mode !== 'compress' || batchItems.length === 0 || isCompressing || isDownloading) return;

    // Cancel any in-flight run and drop prior result buffers before recompressing.
    cancelCompression();
    releaseBatchJobBuffers(batchJobsRef.current);

    const controller = new AbortController();
    compressAbortRef.current = controller;

    const itemsSnapshot = [...batchItems];
    setBatchJobs({});
    setIsCompressing(true);
    setUploadError(null);
    setProgress(0);
    const startedAt = performance.now();

    try {
      const finalJobs = await runBatchCompression({
        items: itemsSnapshot,
        targetSize: values.targetSize,
        unit: values.unit,
        outputFormat: values.outputFormat,
        compressFn: compressImageAction,
        onJobsChange: setBatchJobs,
        onOverallProgress: setProgress,
        signal: controller.signal,
      });

      setLastRunSettings({
        targetSize: values.targetSize,
        unit: values.unit,
        outputFormat: values.outputFormat,
      });

      const durationMs = performance.now() - startedAt;
      const { done, skipped } = countBatchOutcomes(finalJobs);
      setToast(buildBatchSummaryToast(finalJobs));

      if (done > 0 || skipped > 0) {
        void persistBatchHistoryInBackground(finalJobs, durationMs, values.outputFormat);
      }
      setProgress(100);
    } catch (error) {
      if (isAbortError(error)) {
        // Cancelled via clear / unmount — do not surface as a hard failure.
        return;
      }
      const message =
        error instanceof Error ? error.message : 'Compression could not be completed. Please try again.';
      setToast({ type: 'error', message });
    } finally {
      if (compressAbortRef.current === controller) {
        compressAbortRef.current = null;
      }
      setIsCompressing(false);
    }
  };

  const handleCreateImagesToPdf = async () => {
    if (
      mode !== 'images-to-pdf' ||
      batchItems.length === 0 ||
      isBuildingPdf ||
      isDownloading ||
      isDownloadLocked()
    ) {
      return;
    }

    setIsBuildingPdf(true);
    setIsDownloading(true);
    setUploadError(null);

    try {
      await withDownloadLock(async () => {
        const entries = await collectPdfEntriesFromBatchItems(batchItemsRef.current);
        const pdfBlob = await buildCompressedImagesPdf(entries);
        const pdfUrl = trackObjectUrl(URL.createObjectURL(pdfBlob));
        if (imagesToPdfUrlRef.current) {
          URL.revokeObjectURL(imagesToPdfUrlRef.current);
        }
        imagesToPdfUrlRef.current = pdfUrl;
        setImagesToPdfUrl(pdfUrl);

        triggerDownload(pdfBlob, buildImagesToPdfDownloadName(entries.length));
        setToast({
          type: 'success',
          message:
            entries.length === 1
              ? 'PDF created from your image (no compression applied).'
              : `PDF created with ${entries.length} images (no compression applied).`,
        });
      });
    } catch (error) {
      setToast({ type: 'error', message: toFriendlyPdfError(error) });
    } finally {
      setIsBuildingPdf(false);
      setIsDownloading(false);
    }
  };

  const handleDownloadImagesToPdf = async () => {
    if (!imagesToPdfUrl || isBuildingPdf || isDownloading || isDownloadLocked()) return;

    setIsDownloading(true);
    try {
      await withDownloadLock(() => {
        triggerDownload(imagesToPdfUrl, buildImagesToPdfDownloadName(batchItems.length));
      });
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to download the PDF. Please try again.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const quickPresets = useMemo(() => [20, 50, 100, 200, 500, 1000], []);
  const batchOutcomes = countBatchOutcomes(batchJobs);
  const successCount = batchOutcomes.done + batchOutcomes.skipped;
  const isCompressMode = mode === 'compress';
  const batchComplete =
    !isCompressing &&
    batchOutcomes.total > 0 &&
    batchOutcomes.done + batchOutcomes.skipped + batchOutcomes.failed === batchOutcomes.total;
  const currentSettings: CompressionRunSettings = {
    targetSize: Number(watchedTargetSize) || initialValues.targetSize,
    unit: watchedUnit,
    outputFormat: watchedOutputFormat,
  };
  const settingsChanged = compressionSettingsChanged(currentSettings, lastRunSettings);
  const showDownloadButton = isCompressMode && shouldShowDownloadButton({ isCompressing, successCount });
  const downloadsBusy = isDownloading || isZipping || isBuildingPdf;
  const disablePrimaryAction = shouldDisableCompressButton({
    fileCount: batchItems.length,
    isCompressing: isCompressing || isBuildingPdf || isDownloading,
    batchComplete: isCompressMode ? batchComplete : false,
    settingsChanged: isCompressMode ? settingsChanged : true,
  });
  const hasBatch = batchItems.length > 0;
  const isMultiBatch = batchItems.length > 1;
  const singleResult =
    isCompressMode && batchItems.length === 1 && batchOutcomes.total === 1
      ? Object.values(batchJobs)[0]?.result ?? null
      : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.14),_transparent_24%)] px-4 py-10 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-slate-200/80 bg-white/70 px-5 py-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-pink-500 to-cyan-400 text-white shadow-lg">
              <Droplets size={18} />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">Compress Image</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Exact KB & MB</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
            <nav className={`hidden items-center gap-6 text-sm md:flex ${textNav}`}>
              <a href="#features" onClick={(event) => scrollToSection(event, 'features')}>
                Features
              </a>
              <a href="#pricing" onClick={(event) => scrollToSection(event, 'pricing')}>
                Pricing
              </a>
              <a href="#faq" onClick={(event) => scrollToSection(event, 'faq')}>
                FAQ
              </a>
            </nav>
            <ThemeToggle />
            <HeaderAuthNav />
          </div>
          <nav className={`flex w-full flex-wrap items-center justify-center gap-4 text-sm md:hidden ${textNav}`}>
            <a href="#features" onClick={(event) => scrollToSection(event, 'features')}>
              Features
            </a>
            <a href="#pricing" onClick={(event) => scrollToSection(event, 'pricing')}>
              Pricing
            </a>
            <a href="#faq" onClick={(event) => scrollToSection(event, 'faq')}>
              FAQ
            </a>
          </nav>
        </header>

        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700 dark:border-violet-500/40 dark:bg-violet-950/40 dark:text-violet-200">
              <Sparkles size={16} />
              Smart compression. Exact size. Maximum quality.
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl dark:text-slate-50">
                Compress images to exact{' '}
                <span className="bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent dark:from-violet-300 dark:to-cyan-300">
                  KB/MB
                </span>{' '}
                targets.
              </h1>
              <p className="max-w-xl text-lg text-slate-600 dark:text-slate-200">
                Upload an image, set your goal, and let the engine reduce file size while preserving stunning quality.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm shadow-sm ${surfaceMuted} ${textBody}`}>
                <Check size={16} className="text-emerald-500 dark:text-emerald-400" /> PNG, JPEG, WEBP, AVIF
              </div>
              <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm shadow-sm ${surfaceMuted} ${textBody}`}>
                <Check size={16} className="text-emerald-500 dark:text-emerald-400" /> Up to 100 MB uploads
              </div>
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={
              isCompressMode
                ? handleSubmit(onSubmit)
                : (event) => {
                    event.preventDefault();
                  }
            }
            className={`rounded-[32px] p-6 shadow-[0_20px_80px_-20px_rgba(15,23,42,0.25)] backdrop-blur ${surfaceCard}`}
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <p className={`text-sm font-medium uppercase tracking-[0.24em] ${textEyebrow}`}>Upload images</p>
                <h2 className={`text-2xl font-semibold ${textHeading}`}>Start with your source files</h2>
              </div>

              <div
                role="tablist"
                aria-label="Application mode"
                className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-600 dark:bg-slate-800/80"
              >
                {(
                  [
                    ['compress', 'Compress Images'],
                    ['images-to-pdf', 'Images to PDF'],
                  ] as const
                ).map(([value, label]) => {
                  const active = mode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={isCompressing || isBuildingPdf || isZipping || isDownloading}
                      onClick={() => handleModeChange(value)}
                      className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        active
                          ? 'bg-white text-violet-700 shadow-sm dark:bg-slate-900 dark:text-violet-300'
                          : `${textMuted} hover:text-slate-800 dark:hover:text-slate-200`
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <motion.div
                role="button"
                tabIndex={0}
                aria-label="Upload image files"
                onDrop={onDrop}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    document.getElementById('image-upload')?.click();
                  }
                }}
                initial={false}
                animate={{
                  scale: isDragActive ? 1.01 : 1,
                  borderColor: isDragActive ? '#8b5cf6' : hasBatch ? '#34d399' : '#cbd5e1',
                  boxShadow: isDragActive ? '0 0 0 4px rgba(124, 58, 237, 0.12)' : 'none',
                }}
                transition={{ duration: 0.2 }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 text-center transition hover:border-violet-400 hover:bg-violet-50/60 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-violet-400 dark:hover:bg-violet-950/30 ${
                  isMultiBatch ? 'px-4 py-4 sm:px-5 sm:py-5' : 'px-6 py-10'
                }`}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  className="hidden"
                  id="image-upload"
                  multiple
                  aria-label="Upload image files"
                  onChange={(event) => {
                    if (event.target.files?.length) {
                      handleFilesSelection(event.target.files);
                    }
                    event.target.value = '';
                  }}
                />
                {isMultiBatch ? (
                  <label htmlFor="image-upload" className="flex w-full cursor-pointer flex-row items-center gap-3 text-left">
                    <motion.div
                      animate={{ rotate: isDragActive ? 2 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg"
                    >
                      <ImagePlus size={20} />
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold sm:text-base ${textHeading}`}>Add more images</p>
                      <p className={`mt-0.5 text-sm ${textMuted}`}>
                        {batchItems.length} selected · drop or browse to add more (max 100)
                      </p>
                    </div>
                    <div className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:text-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                      {batchItems.length}
                    </div>
                  </label>
                ) : (
                  <label htmlFor="image-upload" className="flex cursor-pointer flex-col items-center gap-3">
                    <motion.div
                      animate={{ scale: hasBatch ? 1.02 : 1, rotate: isDragActive ? 2 : 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg ${hasBatch ? 'bg-emerald-500' : 'bg-gradient-to-br from-violet-600 to-cyan-400'}`}
                    >
                      {hasBatch ? <Check size={24} /> : <ImagePlus size={24} />}
                    </motion.div>
                    <div>
                      <p className={`text-lg font-semibold ${textHeading}`}>
                        {hasBatch
                          ? isCompressMode
                            ? 'Images ready for compression'
                            : 'Images ready for PDF'
                          : 'Drag & drop or browse files'}
                      </p>
                      <p className={`mt-1 text-sm ${textMuted}`}>
                        {isCompressMode
                          ? 'PNG, JPEG, WEBP, and AVIF supported · up to 100 images'
                          : 'Combine images into a PDF · no compression · up to 100 images'}
                      </p>
                    </div>
                    {hasBatch ? (
                      <div className="mt-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                        1 image selected
                      </div>
                    ) : null}
                  </label>
                )}
              </motion.div>

              {uploadError ? <div className={alertError}>{uploadError}</div> : null}

              <BatchUploadList
                items={batchItems}
                jobs={isCompressMode ? batchJobs : {}}
                onRemove={handleRemoveItem}
                onClearAll={handleClearImages}
                clearLabel="Clear Images"
                onDownloadItem={isCompressMode ? handleDownloadItem : undefined}
                onMoveItem={handleMoveItem}
                reorderable={!isCompressMode}
                disabled={isCompressing || isBuildingPdf || isDownloading || isZipping}
                showCompressSummary={isCompressMode && isMultiBatch}
              />

              {isCompressMode ? (
                <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className={`text-sm font-medium ${textLabel}`}>Target size</label>
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/80">
                        <input
                          type="number"
                          min="1"
                          {...register('targetSize', { valueAsNumber: true })}
                          className={`w-full bg-transparent text-lg font-semibold outline-none ${textHeading}`}
                        />
                        <select
                          {...register('unit')}
                          className={`rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-600 dark:bg-slate-900 ${textLabel}`}
                        >
                          <option value="KB">KB</option>
                          <option value="MB">MB</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={`text-sm font-medium ${textLabel}`}>Output format</label>
                      <select
                        {...register('outputFormat')}
                        className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium outline-none dark:border-slate-600 dark:bg-slate-800/80 ${textLabel}`}
                      >
                        <option value="jpeg">JPEG</option>
                        <option value="png">PNG</option>
                        <option value="webp">WebP</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={`text-sm font-medium ${textLabel}`}>Quick presets</label>
                    <div className="flex flex-wrap gap-2">
                      {quickPresets.map((preset) => {
                        const label = preset >= 1000 ? '1 MB' : `${preset} KB`;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setValue('targetSize', preset >= 1000 ? 1 : preset, { shouldDirty: true });
                              setValue('unit', preset >= 1000 ? 'MB' : 'KB', { shouldDirty: true });
                            }}
                            className={`rounded-full px-3 py-2 text-sm font-medium transition hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 ${surfaceMuted} ${textLabel}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <p className={`rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 dark:border-slate-600 dark:bg-slate-800/50 ${textMuted}`}>
                  Images are combined into a PDF in the order shown. Use the arrows to reorder. No compression is applied.
                </p>
              )}

              <div className={`flex w-full flex-col ${isMultiBatch ? 'gap-3 sm:gap-4' : 'gap-4'}`}>
                {isCompressMode && (isCompressing || progress > 0) ? (
                  <div
                    className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-500/40 dark:bg-violet-950/30"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-label={isMultiBatch ? 'Overall batch progress' : 'Compression progress'}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                      <span>
                        {isCompressing
                          ? isMultiBatch
                            ? `Overall progress · ${batchOutcomes.done + batchOutcomes.skipped + batchOutcomes.failed}/${batchItems.length} processed`
                            : 'Compressing image'
                          : isMultiBatch
                            ? 'Batch complete'
                            : batchOutcomes.skipped > 0
                              ? 'Image skipped'
                              : 'Compression complete'}
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <div className={`overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/60 ${isMultiBatch ? 'h-2.5' : 'h-2'}`}>
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                ) : null}

                {isCompressMode ? (
                  <button
                    type="submit"
                    disabled={disablePrimaryAction}
                    aria-busy={isCompressing}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-4 py-3 text-base font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCompressing
                      ? 'Compressing…'
                      : batchComplete && settingsChanged
                        ? isMultiBatch
                          ? `Recompress ${batchItems.length} Images`
                          : 'Recompress Image'
                        : isMultiBatch
                          ? `Compress ${batchItems.length} Images`
                          : 'Compress Image'}
                    <ArrowRight size={18} />
                  </button>
                ) : null}

                {isCompressMode && batchComplete && !settingsChanged && hasBatch ? (
                  <p className={`text-center text-sm ${textMuted}`}>
                    Change the target size or output format to recompress without reuploading.
                  </p>
                ) : null}

                {!isCompressMode ? (
                  <button
                    type="button"
                    disabled={disablePrimaryAction}
                    aria-busy={isBuildingPdf}
                    onClick={handleCreateImagesToPdf}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-4 py-3 text-base font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBuildingPdf
                      ? 'Creating PDF…'
                      : isMultiBatch
                        ? `Create PDF (${batchItems.length} pages)`
                        : 'Create PDF'}
                    <ArrowRight size={18} />
                  </button>
                ) : null}

                {showDownloadButton && isMultiBatch ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <button
                      type="button"
                      onClick={handleDownloadZip}
                      disabled={downloadsBusy}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
                    >
                      <FileArchive size={18} />
                      {isZipping ? 'Preparing ZIP…' : `Download ZIP (${successCount})`}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={downloadsBusy}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-white/90 px-4 py-3 text-sm font-semibold text-violet-700 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-500/40 dark:bg-slate-900/80 dark:text-violet-300 dark:hover:bg-violet-950/40 sm:text-base"
                    >
                      <FileText size={18} />
                      {isBuildingPdf ? 'Preparing PDF…' : `Download PDF (${successCount})`}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadAll}
                      disabled={downloadsBusy}
                      className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-500 dark:hover:text-violet-300 sm:col-span-2 sm:text-base"
                    >
                      Download {successCount} images individually
                    </button>
                    <button
                      type="button"
                      onClick={handleCompressAnother}
                      disabled={downloadsBusy || isCompressing}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:border-violet-500 dark:hover:text-violet-300 sm:col-span-2 sm:text-base"
                    >
                      <RefreshCw size={18} />
                      Compress Another
                    </button>
                  </motion.div>
                ) : null}

                {showDownloadButton && !isMultiBatch ? (
                  <>
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      onClick={handleDownloadZip}
                      disabled={downloadsBusy}
                      className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-4 py-3 text-base font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isZipping ? 'Preparing ZIP…' : 'Download ZIP'}
                    </motion.button>
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut', delay: 0.04 }}
                      onClick={handleDownloadPdf}
                      disabled={downloadsBusy}
                      className="flex w-full items-center justify-center rounded-2xl border border-violet-200 bg-white/90 px-4 py-3 text-base font-semibold text-violet-700 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-500/40 dark:bg-slate-900/80 dark:text-violet-300 dark:hover:bg-violet-950/40"
                    >
                      {isBuildingPdf ? 'Preparing PDF…' : 'Download PDF'}
                    </motion.button>
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut', delay: 0.08 }}
                      onClick={handleDownloadAll}
                      disabled={downloadsBusy}
                      className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-violet-500 dark:hover:text-violet-300"
                    >
                      Download compressed image
                    </motion.button>
                  </>
                ) : null}

                {!isCompressMode && imagesToPdfUrl ? (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    onClick={handleDownloadImagesToPdf}
                    disabled={downloadsBusy}
                    className="flex w-full items-center justify-center rounded-2xl border border-violet-200 bg-white/90 px-4 py-3 text-base font-semibold text-violet-700 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-500/40 dark:bg-slate-900/80 dark:text-violet-300 dark:hover:bg-violet-950/40"
                  >
                    Download PDF
                  </motion.button>
                ) : null}
              </div>
            </div>
          </motion.form>
        </section>

        <section id="features" className="grid gap-4 rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 md:grid-cols-3">
          {[
            ['Premium quality', 'AI-assisted compression keeps images sharp and clear.'],
            ['Exact targets', 'Aim for precise KB or MB output sizes.'],
            ['Lightning fast', 'Optimized workflows deliver results in seconds.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{body}</p>
            </div>
          ))}
        </section>

        <section id="pricing" className="rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <p className={`text-sm font-medium uppercase tracking-[0.24em] ${textEyebrow}`}>Pricing</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-100">Start free, scale when you need more</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['Free', '$0', 'Unlimited compressions on the homepage', 'Exact KB/MB targeting', 'Download instantly'],
              ['Pro', 'Coming soon', 'Cloud compression history', 'Team workspaces', 'Priority processing'],
            ].map(([name, price, ...features]) => (
              <div key={name} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-800/70">
                <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">{name}</p>
                <p className="mt-2 text-3xl font-semibold text-violet-600 dark:text-violet-400">{price}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check size={16} className="text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <p className={`text-sm font-medium uppercase tracking-[0.24em] ${textEyebrow}`}>FAQ</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-100">Common questions</h2>
          <div className="mt-6 grid gap-4">
            {[
              ['Do I need an account to compress images?', 'No. Anyone can compress and download from the homepage without signing in.'],
              ['Where is my history saved?', 'Signed-in users get compression history on the dashboard, stored securely in your account.'],
              ['Which formats are supported?', 'PNG, JPEG, WebP, and AVIF uploads with JPEG, PNG, or WebP output options.'],
            ].map(([question, answer]) => (
              <div key={question} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-800/70">
                <p className="font-semibold text-slate-950 dark:text-slate-100">{question}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{answer}</p>
              </div>
            ))}
          </div>
        </section>

        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200'}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            <p className="text-sm font-medium">{toast.message}</p>
          </motion.div>
        ) : null}

        {singleResult ? (
          <section className={`rounded-[32px] p-6 shadow-sm ${surfaceCard}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className={`text-sm font-medium uppercase tracking-[0.24em] ${textEyebrow}`}>Result</p>
                <h3 className={`text-2xl font-semibold ${textHeading}`}>
                  {singleResult.skipped
                    ? 'Compression skipped'
                    : singleResult.success
                      ? 'Compression complete'
                      : 'Compression failed'}
                </h3>
              </div>
              <div
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  singleResult.skipped
                    ? 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                    : singleResult.success
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                }`}
              >
                {singleResult.skipped ? 'Skipped' : singleResult.success ? 'Exact Match' : 'Try another target'}
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                ['Original', singleResult.originalSize],
                ['Compressed', singleResult.compressedSize],
                ['Saved', singleResult.savedSpace],
                ['Resolution', singleResult.resolution],
                ['Format', singleResult.format],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-2xl p-4 ${surfaceMuted}`}>
                  <p className={`text-sm ${textMuted}`}>{label}</p>
                  <p className={`mt-1 text-xl font-semibold ${textHeading}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className={`rounded-2xl p-4 ${surfaceMuted}`}>
                <p className={`text-sm ${textMuted}`}>Saved percentage</p>
                <p className={`mt-1 text-xl font-semibold ${textHeading}`}>{singleResult.savedPercentage}</p>
              </div>
              <div className={`rounded-2xl p-4 ${surfaceMuted}`}>
                <p className={`text-sm ${textMuted}`}>Compression ratio</p>
                <p className={`mt-1 text-xl font-semibold ${textHeading}`}>{singleResult.compressionRatio}</p>
              </div>
            </div>
            {singleResult.message ? <p className={`mt-4 text-sm ${textBody}`}>{singleResult.message}</p> : null}
          </section>
        ) : null}

        {!singleResult &&
        batchOutcomes.total > 1 &&
        (batchOutcomes.done > 0 || batchOutcomes.skipped > 0 || batchOutcomes.failed > 0) ? (
          <section className={`rounded-[32px] p-6 shadow-sm ${surfaceCard}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className={`text-sm font-medium uppercase tracking-[0.24em] ${textEyebrow}`}>Batch result</p>
                <h3 className={`text-2xl font-semibold ${textHeading}`}>
                  {batchOutcomes.failed === 0 ? 'Batch compression complete' : 'Batch compression finished'}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {batchOutcomes.done} compressed
                </div>
                {batchOutcomes.skipped > 0 ? (
                  <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    {batchOutcomes.skipped} skipped
                  </div>
                ) : null}
                {batchOutcomes.failed > 0 ? (
                  <div className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                    {batchOutcomes.failed} failed
                  </div>
                ) : null}
              </div>
            </div>
            <p className={`mt-4 text-sm ${textBody}`}>
              Skipped images were kept unchanged. Failed images did not stop the rest of the batch. Download a ZIP or
              PDF of every available result, or grab individual files from the list above.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
