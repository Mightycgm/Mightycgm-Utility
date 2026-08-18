'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

export default function BackgroundRemoverPage() {
  const [original, setOriginal] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [imageName, setImageName] = useState('image');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, WEBP, etc.)');
      return;
    }

    setResult('');
    setErrorMessage('');
    setProgress('Reading image data...');
    setProgressPercent(5);
    setLoading(true);

    const name = file.name.replace(/\.[^/.]+$/, '');
    setImageName(name || 'removed-bg');

    const reader = new FileReader();
    reader.onload = (e) => setOriginal(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      setProgress('Initializing AI model (First run may take a moment to download)...');
      setProgressPercent(15);

      // Dynamically import @imgly/background-removal
      const { removeBackground } = await import('@imgly/background-removal');

      setProgress('Removing background...');
      setProgressPercent(30);

      const blob = await removeBackground(file, {
        publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const percent = Math.min(95, Math.round((current / total) * 100));
            setProgressPercent(percent);
            setProgress(`Processing AI model (${percent}%)...`);
          }
        },
        debug: false,
      });

      const url = URL.createObjectURL(blob);
      setResult(url);
      setProgressPercent(100);
      setProgress('');
    } catch (err: unknown) {
      console.error('Background removal failed:', err);
      setErrorMessage(
        err instanceof Error
          ? `Error: ${err.message}. Please try again or use another image.`
          : 'Background removal failed. Please try a different image.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Drag & drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // Clipboard Paste (Ctrl+V) handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.clipboardData && e.clipboardData.items) {
        const items = Array.from(e.clipboardData.items);
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              processFile(file);
              break;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFile]);

  return (
    <ToolPageWrapper
      title="Background Remover"
      description="AI-powered background removal running 100% locally in your browser"
      emoji="✂️"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Upload Zone */}
        <div
          className={`drop-zone py-12 transition-all ${
            dragging ? 'border-[var(--foreground)] bg-[var(--muted)]' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-4xl mb-3">✂️</div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            Drop image here, <span className="underline underline-offset-4">browse file</span>, or press{' '}
            <kbd className="px-2 py-0.5 rounded bg-[var(--muted)] border border-[var(--card-border)] text-xs font-mono">
              Ctrl + V
            </kbd>{' '}
            to paste
          </p>
          <p className="text-xs text-[var(--muted-text)] mt-1.5">
            PNG, JPG, WebP supported • Processed entirely on your device with WebAssembly AI
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processFile(f);
            }}
          />
        </div>

        {/* Loading / Progress State */}
        {loading && (
          <div className="tool-card p-6 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-[var(--card-border)] border-t-[var(--foreground)] rounded-full animate-spin mx-auto" />
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">{progress}</p>
              <div className="w-full max-w-xs bg-[var(--card-border)] h-1.5 rounded-full mx-auto mt-3 overflow-hidden">
                <div
                  className="bg-[var(--foreground)] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <p className="text-[11px] text-[var(--muted-text)]">
              Powered by @imgly AI WebAssembly • No data is uploaded to any server
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {errorMessage}
          </div>
        )}

        {/* Before / After Preview */}
        {(original || result) && !loading && (
          <div className="grid md:grid-cols-2 gap-6">
            {original && (
              <div className="tool-card p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-medium text-[var(--muted-text)]">
                  <span>Original Image</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={original}
                  alt="Original"
                  className="w-full rounded-lg object-contain max-h-80 bg-[var(--muted)] border border-[var(--card-border)]"
                />
              </div>
            )}

            {result && (
              <div className="tool-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-green-500">✅ Background Removed</span>
                  <a
                    href={result}
                    download={`${imageName}-no-bg.png`}
                    className="btn-primary text-xs py-1.5 px-3 font-medium"
                  >
                    ⬇ Download PNG
                  </a>
                </div>

                {/* Transparency Preview Background */}
                <div
                  className="w-full rounded-lg overflow-hidden max-h-80 flex items-center justify-center border border-[var(--card-border)]"
                  style={{
                    background:
                      'repeating-conic-gradient(var(--card-border) 0% 25%, transparent 0% 50%) 50% / 20px 20px',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result} alt="Background Removed" className="max-h-80 object-contain" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Privacy Info Note */}
        <div className="tool-card p-4 flex items-center gap-3 text-xs text-[var(--muted-text)]">
          <span className="text-base">🔒</span>
          <p>
            100% Privacy Guaranteed: All image processing and neural network AI execution happen directly in your browser. Your images never leave your machine.
          </p>
        </div>
      </div>
    </ToolPageWrapper>
  );
}
