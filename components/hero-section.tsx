"use client";

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Droplets, ImagePlus, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { compressImageAction } from '@/services/compress-image';
import { validateImageFile } from '@/lib/file';

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

export function shouldDisableCompressButton({
  file,
  isCompressing,
}: {
  file: File | null;
  isCompressing: boolean;
}) {
  return !file || isCompressing;
}

export function shouldShowDownloadButton({
  isCompressing,
  result,
}: {
  isCompressing: boolean;
  result: Awaited<ReturnType<typeof compressImageAction>> | null;
}) {
  return !isCompressing && Boolean(result?.success && result.downloadUrl);
}

export function HeroSection() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof compressImageAction>> | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { register, handleSubmit, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  const handleFileSelection = (selectedFile: File) => {
    const validation = validateImageFile(selectedFile);
    if (!validation.valid) {
      const reason = validation.reason ?? 'Unable to upload this file.';
      setUploadError(reason);
      setToast({ type: 'error', message: reason });
      return;
    }

    setUploadError(null);
    setFile(selectedFile);
    setIsDragActive(false);
    setToast({ type: 'success', message: `${selectedFile.name} is ready to compress.` });
  };

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const pastedFile = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith('image/'));
      if (pastedFile) {
        event.preventDefault();
        handleFileSelection(pastedFile);
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

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelection(droppedFile);
    }
  };

  const handleDownload = () => {
    if (!result?.success || !result.downloadUrl) return;

    const link = document.createElement('a');
    link.href = result.downloadUrl;
    link.download = result.downloadFileName ?? 'compressed-image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onSubmit = async (values: FormValues) => {
    if (!file) return;

    setIsCompressing(true);
    setResult(null);
    setUploadError(null);
    setProgress(0);

    const intervalId = window.setInterval(() => {
      setProgress((current) => (current < 90 ? current + 8 : current));
    }, 180);

    try {
      const response = await compressImageAction(file, values.targetSize, values.unit, values.outputFormat);
      setResult(response);
      setProgress(100);

      if (response.success) {
        setToast({ type: 'success', message: 'Compression finished and your download is ready.' });
      } else {
        setToast({ type: 'error', message: response.message ?? 'Compression failed. Please try another target.' });
      }
    } catch {
      setToast({ type: 'error', message: 'Compression could not be completed. Please try again.' });
    } finally {
      window.clearInterval(intervalId);
      setIsCompressing(false);
    }
  };

  const quickPresets = useMemo(() => [20, 50, 100, 200, 500, 1000], []);
  const showDownloadButton = shouldShowDownloadButton({ isCompressing, result });
  const disableCompressButton = shouldDisableCompressButton({ file, isCompressing });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.14),_transparent_24%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex items-center justify-between rounded-full border border-slate-200/80 bg-white/70 px-5 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-pink-500 to-cyan-400 text-white shadow-lg">
              <Droplets size={18} />
            </div>
            <div>
              <p className="text-lg font-semibold">Compress Image</p>
              <p className="text-sm text-slate-500">Exact KB & MB</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#features" className="transition hover:text-violet-600">Features</a>
            <a href="#pricing" className="transition hover:text-violet-600">Pricing</a>
            <a href="#faq" className="transition hover:text-violet-600">FAQ</a>
          </nav>
        </header>

        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
              <Sparkles size={16} />
              Smart compression. Exact size. Maximum quality.
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                Compress images to exact <span className="bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">KB/MB</span> targets.
              </h1>
              <p className="max-w-xl text-lg text-slate-600">
                Upload an image, set your goal, and let the engine reduce file size while preserving stunning quality.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                <Check size={16} className="text-emerald-500" /> PNG, JPEG, WEBP, AVIF
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                <Check size={16} className="text-emerald-500" /> Up to 100 MB uploads
              </div>
            </div>
          </motion.div>

          <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit(onSubmit)} className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_80px_-20px_rgba(15,23,42,0.25)] backdrop-blur">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Upload image</p>
                <h2 className="text-2xl font-semibold text-slate-950">Start with your source file</h2>
              </div>

              <motion.div
                role="button"
                tabIndex={0}
                aria-label="Upload an image file"
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
                  borderColor: isDragActive ? '#8b5cf6' : file ? '#34d399' : '#cbd5e1',
                  boxShadow: isDragActive ? '0 0 0 4px rgba(124, 58, 237, 0.12)' : 'none',
                }}
                transition={{ duration: 0.2 }}
                className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed bg-slate-50/80 px-6 py-10 text-center transition hover:border-violet-400 hover:bg-violet-50/60"
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  className="hidden"
                  id="image-upload"
                  aria-label="Upload an image file"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0];
                    if (selectedFile) handleFileSelection(selectedFile);
                    event.target.value = '';
                  }}
                />
                <label htmlFor="image-upload" className="flex cursor-pointer flex-col items-center gap-3">
                  <motion.div
                    animate={{ scale: file ? 1.02 : 1, rotate: isDragActive ? 2 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg ${file ? 'bg-emerald-500' : 'bg-gradient-to-br from-violet-600 to-cyan-400'}`}
                  >
                    {file ? <Check size={24} /> : <ImagePlus size={24} />}
                  </motion.div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{file ? 'Image ready for compression' : 'Drag & drop or browse files'}</p>
                    <p className="mt-1 text-sm text-slate-500">PNG, JPEG, WEBP, and AVIF supported</p>
                  </div>
                  {file ? (
                    <div className="mt-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                      {file.name}
                    </div>
                  ) : null}
                </label>
              </motion.div>

              {uploadError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {uploadError}
                </div>
              ) : null}

              {/* Preview removed: app shows compressed download after compression */}

              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Target size</label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        {...register('targetSize', { valueAsNumber: true })}
                        className="w-full bg-transparent text-lg font-semibold outline-none"
                      />
                      <select
                        {...register('unit')}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                      >
                        <option value="KB">KB</option>
                        <option value="MB">MB</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Output format</label>
                    <select
                      {...register('outputFormat')}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                    >
                      <option value="jpeg">JPEG</option>
                      <option value="png">PNG</option>
                      <option value="webp">WebP</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Quick presets</label>
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
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-violet-400 hover:text-violet-600"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-col gap-4">
                {isCompressing ? (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                    <div className="mb-2 flex items-center justify-between text-sm font-medium text-violet-700">
                      <span>Compressing image</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-violet-100">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={disableCompressButton}
                  aria-busy={isCompressing}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-400 px-4 py-3 text-base font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCompressing ? 'Compressing…' : 'Compress Image'}
                  <ArrowRight size={18} />
                </button>

                {showDownloadButton ? (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    onClick={handleDownload}
                    className="flex w-full items-center justify-center rounded-2xl border border-violet-200 bg-white/90 px-4 py-3 text-base font-semibold text-violet-700 shadow-sm transition hover:border-violet-400 hover:bg-violet-50"
                  >
                    Download compressed image
                  </motion.button>
                ) : null}
              </div>
            </div>
          </motion.form>
        </section>

        <section id="features" className="grid gap-4 rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-sm md:grid-cols-3">
          {[
            ['Premium quality', 'AI-assisted compression keeps images sharp and clear.'],
            ['Exact targets', 'Aim for precise KB or MB output sizes.'],
            ['Lightning fast', 'Optimized workflows deliver results in seconds.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
              <p className="text-lg font-semibold text-slate-950">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </section>

        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            <p className="text-sm font-medium">{toast.message}</p>
          </motion.div>
        ) : null}

        {result ? (
          <section className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">Result</p>
                <h3 className="text-2xl font-semibold text-slate-950">{result.success ? 'Compression complete' : 'Compression failed'}</h3>
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                {result.success ? 'Exact Match' : 'Try another target'}
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Original</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{result.originalSize}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Compressed</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{result.compressedSize}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Saved</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{result.savedSpace}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Resolution</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{result.resolution}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Format</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{result.format}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Saved percentage</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{result.savedPercentage}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Compression ratio</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{result.compressionRatio}</p>
              </div>
            </div>
            {result.message ? <p className="mt-4 text-sm text-slate-600">{result.message}</p> : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
