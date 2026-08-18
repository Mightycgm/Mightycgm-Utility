'use client';
import { useState, useCallback } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

export default function BackgroundRemoverPage() {
  const [original, setOriginal] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [dragging, setDragging] = useState(false);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setResult('');
    setProgress('Loading image...');
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => setOriginal(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      setProgress('Loading AI model (first time may take ~30s)...');
      // Dynamic import to avoid SSR/build-time issues
      const bgRemoval = await import('@imgly/background-removal');
      setProgress('Removing background...');

      const blob = await bgRemoval.removeBackground(file, {
        progress: (_key: string, cur: number, total: number) => {
          if (total > 0) setProgress(`Processing: ${Math.round((cur / total) * 100)}%`);
        },
        debug: false,
      });
      const url = URL.createObjectURL(blob);
      setResult(url);
      setProgress('');
    } catch (err) {
      console.error(err);
      setProgress('Error removing background. Try a different image.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <ToolPageWrapper title="Background Remover" description="AI-powered background removal — runs 100% in your browser" emoji="✂️">
      <div className="space-y-6">
        {/* Upload zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            dragging ? 'border-indigo-500 bg-indigo-900/20' : 'border-[var(--card-border)] hover:border-[var(--muted-text)]'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('bg-file-input')?.click()}
        >
          <div className="text-5xl mb-3">✂️</div>
          <p className="text-[var(--muted-text)] font-medium">Drop image here or click to upload</p>
          <p className="text-[var(--muted-text)] text-sm mt-1">PNG, JPG, WebP — processed locally</p>
          <input
            id="bg-file-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="tool-card p-6 text-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[var(--foreground)] font-medium">{progress}</p>
            <p className="text-[var(--muted-text)] text-xs mt-2">Powered by @imgly/background-removal (WASM)</p>
          </div>
        )}

        {/* Before / After */}
        {(original || result) && !loading && (
          <div className="grid md:grid-cols-2 gap-6">
            {original && (
              <div className="tool-card p-4">
                <h3 className="text-sm font-semibold text-[var(--muted-text)] mb-3">Original</h3>
                <img src={original} alt="Original" className="w-full rounded-xl object-contain max-h-80" />
              </div>
            )}
            {result && (
              <div className="tool-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-green-400">✅ Background Removed</h3>
                  <a href={result} download="removed-bg.png" className="btn-primary text-xs px-3 py-1">⬇ Download PNG</a>
                </div>
                {/* Checkered background to show transparency */}
                <div
                  className="w-full rounded-xl overflow-hidden max-h-80 flex items-center justify-center"
                  style={{ background: 'repeating-conic-gradient(#374151 0% 25%, #1f2937 0% 50%) 0 0 / 20px 20px' }}
                >
                  <img src={result} alt="Result" className="max-h-80 object-contain" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="tool-card p-4 flex gap-3">
          <span className="text-blue-400">ℹ️</span>
          <p className="text-sm text-[var(--muted-text)]">
            Background removal runs entirely in your browser using WebAssembly. The first run downloads a ~40MB AI model which is then cached. No images are uploaded to any server.
          </p>
        </div>
      </div>
    </ToolPageWrapper>
  );
}


