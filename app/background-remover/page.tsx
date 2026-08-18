'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

interface BrushPoint {
  x: number;
  y: number;
}

export default function BackgroundRemoverPage() {
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [resultUrl, setResultUrl] = useState<string>('');
  const [imageName, setImageName] = useState('image');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragging, setDragging] = useState(false);

  const [bgReplace, setBgReplace] = useState<'transparent' | 'white' | 'black' | 'custom'>('transparent');
  const [customBgColor, setCustomBgColor] = useState('#3b82f6');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [finalDownloadUrl, setFinalDownloadUrl] = useState<string>('');

  // Manual Touch-up Tools
  const [showTouchup, setShowTouchup] = useState(false);
  const [activeTool, setActiveTool] = useState<'erase' | 'restore'>('erase');
  const [brushSize, setBrushSize] = useState<number>(30);
  const [cursorPos, setCursorPos] = useState<BrushPoint | null>(null);

  // Refs
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const resultImageRef = useRef<HTMLImageElement | null>(null);
  const touchupCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Run AI Background Removal (True Semantic Neural Network ISNet)
  const processImageWithAI = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, WEBP, etc.)');
      return;
    }

    setCurrentFile(file);
    setErrorMessage('');
    setResultUrl('');
    setLoading(true);
    setStatusText('Loading AI model...');
    setProgressPercent(10);

    const name = file.name.replace(/\.[^/.]+$/, '');
    setImageName(name || 'cutout');

    const previewUrl = URL.createObjectURL(file);
    setOriginalUrl(previewUrl);

    const origImg = new Image();
    origImg.onload = () => {
      sourceImageRef.current = origImg;
    };
    origImg.src = previewUrl;

    try {
      // Dynamic import to keep initial bundle ultra fast
      const { removeBackground } = await import('@imgly/background-removal');

      setStatusText('Processing image with AI...');
      setProgressPercent(25);

      // Run with isnet_quint8 (quantized fast production model ~20MB, cached in browser)
      const blob = await removeBackground(file, {
        publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
        model: 'isnet_quint8',
        rescale: true,
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const percent = Math.min(95, Math.round((current / total) * 100));
            setProgressPercent(percent);
            if (key.includes('fetch') || key.includes('download')) {
              setStatusText(`Downloading AI model: ${percent}% (Cached after 1st time)`);
            } else {
              setStatusText(`Segmenting subject: ${percent}%`);
            }
          }
        },
        debug: false,
      });

      const url = URL.createObjectURL(blob);
      setResultUrl(url);

      const resImg = new Image();
      resImg.onload = () => {
        resultImageRef.current = resImg;
        // Init touchup canvas with AI result
        if (touchupCanvasRef.current) {
          const canvas = touchupCanvasRef.current;
          canvas.width = resImg.naturalWidth;
          canvas.height = resImg.naturalHeight;
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(resImg, 0, 0);
        }
      };
      resImg.src = url;

      setProgressPercent(100);
      setStatusText('');
    } catch (err: unknown) {
      console.error('AI removal failed:', err);
      setErrorMessage(
        err instanceof Error
          ? `AI Processing error: ${err.message}. Please try another image.`
          : 'Failed to process image. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Synchronize composite download URL when background replacement changes
  useEffect(() => {
    if (!resultUrl) {
      setTimeout(() => setFinalDownloadUrl(''), 0);
      return;
    }

    if (bgReplace === 'transparent') {
      setTimeout(() => setFinalDownloadUrl(resultUrl), 0);
      return;
    }

    const img = touchupCanvasRef.current || resultImageRef.current;
    if (!img) {
      setTimeout(() => setFinalDownloadUrl(resultUrl), 0);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 'naturalWidth' in img ? img.naturalWidth : img.width;
    canvas.height = 'naturalHeight' in img ? img.naturalHeight : img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = bgReplace === 'white' ? '#FFFFFF' : bgReplace === 'black' ? '#000000' : customBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');
    setTimeout(() => setFinalDownloadUrl(dataUrl), 0);
  }, [resultUrl, bgReplace, customBgColor]);

  // Touch-up drawing handler
  const drawTouchup = (clientX: number, clientY: number) => {
    const canvas = touchupCanvasRef.current;
    if (!canvas || !isDrawingRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d')!;
    ctx.save();

    if (activeTool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushSize * (canvas.width / 500), 0, Math.PI * 2);
      ctx.fill();
    } else if (activeTool === 'restore' && sourceImageRef.current) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(x, y, brushSize * (canvas.width / 500), 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(sourceImageRef.current, 0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
    setResultUrl(canvas.toDataURL('image/png'));
  };

  // Reset touchup to original AI cutout
  const resetToAiCutout = () => {
    if (!resultImageRef.current || !touchupCanvasRef.current) return;
    const canvas = touchupCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(resultImageRef.current, 0, 0);
    setResultUrl(canvas.toDataURL('image/png'));
  };

  // Drag & drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processImageWithAI(file);
  };

  // Global Ctrl+V Clipboard Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.clipboardData && e.clipboardData.items) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              processImageWithAI(file);
              break;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processImageWithAI]);

  const activeDownloadUrl = finalDownloadUrl || resultUrl;

  return (
    <ToolPageWrapper
      title="Background Remover"
      description="Automatic AI background removal for photos, characters, anime, and products"
      emoji="✂️"
    >
      <div className="max-w-5xl mx-auto space-y-8">
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
            Drop image here, <span className="underline underline-offset-4">browse files</span>, or press{' '}
            <kbd className="px-2 py-0.5 rounded bg-[var(--muted)] border border-[var(--card-border)] text-xs font-mono">
              Ctrl + V
            </kbd>{' '}
            to paste
          </p>
          <p className="text-xs text-[var(--muted-text)] mt-1.5">
            Neural AI Model • 100% private in your browser (No images sent to servers)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processImageWithAI(f);
            }}
          />
        </div>

        {/* Loading Progress */}
        {loading && (
          <div className="tool-card p-8 text-center space-y-4">
            <div className="w-10 h-10 border-3 border-[var(--card-border)] border-t-[var(--foreground)] rounded-full animate-spin mx-auto" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-[var(--foreground)]">{statusText}</p>
              <p className="text-xs text-[var(--muted-text)]">
                The AI model runs directly in your browser. First time downloads ~20MB and caches automatically.
              </p>
            </div>
            <div className="w-full max-w-sm bg-[var(--card-border)] h-2 rounded-full mx-auto overflow-hidden">
              <div
                className="bg-[var(--foreground)] h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center space-y-2">
            <p className="font-semibold">{errorMessage}</p>
            {currentFile && (
              <button
                onClick={() => processImageWithAI(currentFile)}
                className="btn-secondary text-xs py-1 px-3"
              >
                🔄 Retry Removal
              </button>
            )}
          </div>
        )}

        {/* Result & Actions Bar */}
        {resultUrl && !loading && (
          <div className="space-y-6">
            <div className="tool-card p-4 flex flex-wrap items-center justify-between gap-4">
              {/* Background Replacement Picker */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-[var(--muted-text)]">Background:</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBgReplace('transparent')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                      bgReplace === 'transparent'
                        ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                        : 'border-[var(--card-border)] text-[var(--foreground)]'
                    }`}
                  >
                    Transparent
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgReplace('white')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                      bgReplace === 'white'
                        ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                        : 'border-[var(--card-border)] text-[var(--foreground)]'
                    }`}
                  >
                    White
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgReplace('black')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
                      bgReplace === 'black'
                        ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                        : 'border-[var(--card-border)] text-[var(--foreground)]'
                    }`}
                  >
                    Black
                  </button>
                  <div className="flex items-center gap-1.5 pl-1">
                    <input
                      type="color"
                      value={customBgColor}
                      onChange={(e) => {
                        setCustomBgColor(e.target.value);
                        setBgReplace('custom');
                      }}
                      className="w-7 h-7 rounded cursor-pointer border border-[var(--card-border)] bg-transparent"
                      title="Custom background color"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTouchup(!showTouchup)}
                  className={`btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 ${
                    showTouchup ? 'border-[var(--foreground)] font-semibold' : ''
                  }`}
                >
                  <span>🖌️ {showTouchup ? 'Hide Brush Touch-up' : 'Refine / Touch-up'}</span>
                </button>

                <a
                  href={activeDownloadUrl}
                  download={`${imageName}-no-bg.png`}
                  className="btn-primary text-xs py-2 px-5 font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <span>⬇ Download PNG</span>
                </a>
              </div>
            </div>

            {/* Manual Brush Touch-up Panel (Optional) */}
            {showTouchup && (
              <div className="tool-card p-4 space-y-3 bg-[var(--muted)] border-[var(--card-border)]">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--foreground)]">Brush Tool:</span>
                    <button
                      type="button"
                      onClick={() => setActiveTool('erase')}
                      className={`px-3 py-1 rounded text-xs border ${
                        activeTool === 'erase'
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                          : 'bg-[var(--card)] border-[var(--card-border)] text-[var(--foreground)]'
                      }`}
                    >
                      🧹 Erase Extra
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool('restore')}
                      className={`px-3 py-1 rounded text-xs border ${
                        activeTool === 'restore'
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                          : 'bg-[var(--card)] border-[var(--card-border)] text-[var(--foreground)]'
                      }`}
                    >
                      🖌️ Restore Subject
                    </button>
                  </div>

                  <div className="flex items-center gap-3 flex-1 max-w-xs">
                    <span className="text-[var(--muted-text)] whitespace-nowrap">Size: {brushSize}px</span>
                    <input
                      type="range"
                      min={6}
                      max={80}
                      value={brushSize}
                      onChange={(e) => setBrushSize(+e.target.value)}
                      className="app-slider"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={resetToAiCutout}
                    className="hover:text-red-400 text-xs transition-colors"
                  >
                    Reset Touch-ups
                  </button>
                </div>
                <p className="text-[11px] text-[var(--muted-text)]">
                  Tip: Paint directly on the cutout preview below to erase leftover background or restore parts of the subject.
                </p>
              </div>
            )}

            {/* Before / After Preview */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Original */}
              <div className="tool-card p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                  <span>Original Photo</span>
                </div>
                <div className="w-full rounded-lg overflow-hidden border border-[var(--card-border)] bg-[var(--muted)] flex items-center justify-center min-h-[360px] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="max-h-[460px] object-contain w-auto mx-auto rounded"
                  />
                </div>
              </div>

              {/* Result Preview & Touch-up Canvas */}
              <div className="tool-card p-4 space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider">
                  <span className="text-green-500 font-semibold">AI Cutout (No Background)</span>
                  <span className="text-[var(--muted-text)]">
                    {showTouchup ? 'Click & Drag to Paint' : 'Clean & Transparent'}
                  </span>
                </div>

                <div
                  className="w-full rounded-lg overflow-hidden border border-[var(--card-border)] flex items-center justify-center min-h-[360px] p-2 relative"
                  style={{
                    background:
                      bgReplace === 'transparent'
                        ? 'repeating-conic-gradient(var(--card-border) 0% 25%, transparent 0% 50%) 50% / 20px 20px'
                        : bgReplace === 'white'
                        ? '#FFFFFF'
                        : bgReplace === 'black'
                        ? '#000000'
                        : customBgColor,
                  }}
                  onMouseEnter={() => {}}
                  onMouseLeave={() => {
                    isDrawingRef.current = false;
                    setCursorPos(null);
                  }}
                >
                  {showTouchup ? (
                    <canvas
                      ref={touchupCanvasRef}
                      onMouseDown={(e) => {
                        isDrawingRef.current = true;
                        drawTouchup(e.clientX, e.clientY);
                      }}
                      onMouseUp={() => {
                        isDrawingRef.current = false;
                      }}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                        if (isDrawingRef.current) {
                          drawTouchup(e.clientX, e.clientY);
                        }
                      }}
                      className="max-h-[460px] object-contain w-auto mx-auto rounded cursor-crosshair"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={activeDownloadUrl}
                      alt="AI Cutout"
                      className="max-h-[460px] object-contain w-auto mx-auto rounded"
                    />
                  )}

                  {/* Custom Brush Circle Indicator when in touch-up mode */}
                  {showTouchup && cursorPos && (
                    <div
                      className="pointer-events-none absolute rounded-full border border-white shadow-xs"
                      style={{
                        width: brushSize * 2,
                        height: brushSize * 2,
                        left: cursorPos.x,
                        top: cursorPos.y,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: activeTool === 'erase' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolPageWrapper>
  );
}
