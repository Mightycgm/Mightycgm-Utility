'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

type ViewMode = 'slider' | 'cutout' | 'original';

interface HistoryState {
  imageData: ImageData;
}

// Fast Queue-based Flood Fill for Magic Eraser
function floodFillErase(
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  tolerancePercent: number
) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const startIndex = (startY * width + startX) * 4;
  const targetR = data[startIndex];
  const targetG = data[startIndex + 1];
  const targetB = data[startIndex + 2];
  const targetA = data[startIndex + 3];

  if (targetA === 0) return; // Already transparent

  const maxDist = 441.67;
  const tolDist = (tolerancePercent / 100) * maxDist;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [startX + startY * width];
  visited[startX + startY * width] = 1;

  while (queue.length > 0) {
    const idx = queue.pop()!;
    const px = idx % width;
    const py = Math.floor(idx / width);
    const dataIdx = idx * 4;

    const r = data[dataIdx];
    const g = data[dataIdx + 1];
    const b = data[dataIdx + 2];
    const a = data[dataIdx + 3];

    if (a > 0) {
      const dr = r - targetR;
      const dg = g - targetG;
      const db = b - targetB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist <= tolDist) {
        data[dataIdx + 3] = 0; // Erase pixel

        // Check 4-connected neighbours
        if (px > 0 && !visited[idx - 1]) {
          visited[idx - 1] = 1;
          queue.push(idx - 1);
        }
        if (px < width - 1 && !visited[idx + 1]) {
          visited[idx + 1] = 1;
          queue.push(idx + 1);
        }
        if (py > 0 && !visited[idx - width]) {
          visited[idx - width] = 1;
          queue.push(idx - width);
        }
        if (py < height - 1 && !visited[idx + width]) {
          visited[idx + width] = 1;
          queue.push(idx + width);
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export default function BackgroundRemoverPage() {
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [resultUrl, setResultUrl] = useState<string>('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [imageName, setImageName] = useState('image');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [engineReady, setEngineReady] = useState(false);

  // Engine Mode
  const [engineMode, setEngineMode] = useState<'open_weights' | 'cloud'>('open_weights');

  // withoutBG Config
  const [withoutBgKey, setWithoutBgKey] = useState('');
  const [withoutBgEndpoint, setWithoutBgEndpoint] = useState('');

  // View & Slider Mode
  const [viewMode, setViewMode] = useState<ViewMode>('slider');
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const isDraggingSliderRef = useRef(false);

  // Erase / Restore / Magic Eraser Editor
  const [showEditor, setShowEditor] = useState(false);
  const [activeTool, setActiveTool] = useState<'erase' | 'restore' | 'magic'>('erase');
  const [brushSize, setBrushSize] = useState<number>(30);
  const [brushSoftness, setBrushSoftness] = useState<number>(20);
  const [magicTolerance, setMagicTolerance] = useState<number>(20);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [clientCursor, setClientCursor] = useState<{ x: number; y: number } | null>(null);

  // Undo / Redo Stacks
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoStackRef = useRef<HistoryState[]>([]);
  const redoStackRef = useRef<HistoryState[]>([]);

  // Canvas Refs
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const resultImageRef = useRef<HTMLImageElement | null>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPaintingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement | null>(null);

  // Load withoutBG config from localStorage
  useEffect(() => {
    setTimeout(() => {
      setWithoutBgKey(localStorage.getItem('withoutbg_api_key') || '');
      setWithoutBgEndpoint(localStorage.getItem('withoutbg_endpoint') || '');
    }, 0);
  }, []);

  // Background Pre-warm: initialize dynamic import and cache model in background
  useEffect(() => {
    let isMounted = true;
    const preloadModel = async () => {
      try {
        const { preload } = await import('@imgly/background-removal');
        if (preload) {
          await preload({
            model: 'isnet_quint8',
          });
        }
        if (isMounted) {
          setEngineReady(true);
        }
      } catch {
        if (isMounted) {
          setEngineReady(true);
        }
      }
    };

    preloadModel();
    return () => {
      isMounted = false;
    };
  }, []);

  // Save history state for Undo
  const pushHistory = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push({ imageData: imgData });
    if (undoStackRef.current.length > 25) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const handleUndo = useCallback(() => {
    const canvas = editorCanvasRef.current;
    if (!canvas || undoStackRef.current.length <= 1) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentState = undoStackRef.current.pop()!;
    redoStackRef.current.push(currentState);

    const prevState = undoStackRef.current[undoStackRef.current.length - 1];
    ctx.putImageData(prevState.imageData, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');
    setResultUrl(dataUrl);
    canvas.toBlob((b) => b && setResultBlob(b), 'image/png');

    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(true);
  }, []);

  const handleRedo = useCallback(() => {
    const canvas = editorCanvasRef.current;
    if (!canvas || redoStackRef.current.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextState = redoStackRef.current.pop()!;
    undoStackRef.current.push(nextState);
    ctx.putImageData(nextState.imageData, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');
    setResultUrl(dataUrl);
    canvas.toBlob((b) => b && setResultBlob(b), 'image/png');

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  // Global Keyboard Shortcuts (Ctrl+Z for Undo, Ctrl+Y / Ctrl+Shift+Z for Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Main Background Removal Process
  const processImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please upload a valid image file (PNG, JPG, WEBP, etc.)');
        return;
      }

      setCurrentFile(file);
      setErrorMessage('');
      setResultUrl('');
      setResultBlob(null);
      setLoading(true);
      setShowEditor(false);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setCanUndo(false);
      setCanRedo(false);

      const name = file.name.replace(/\.[^/.]+$/, '');
      setImageName(name || 'removed-bg');

      const previewUrl = URL.createObjectURL(file);
      setOriginalUrl(previewUrl);

      const origImg = new Image();
      origImg.onload = () => {
        sourceImageRef.current = origImg;
      };
      origImg.src = previewUrl;

      // 1. If user chose Cloud / Custom Inference Server
      if (engineMode === 'cloud' && (withoutBgKey || withoutBgEndpoint)) {
        setStatusText('Processing via withoutBG Server...');
        setProgressPercent(40);
        try {
          const endpoint = withoutBgEndpoint.trim() || 'https://api.withoutbg.com/v1/removebg';
          const formData = new FormData();
          formData.append('image_file', file);

          const headers: Record<string, string> = {};
          if (withoutBgKey) {
            headers['Authorization'] = `Bearer ${withoutBgKey}`;
          }

          const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: formData,
          });

          if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setResultUrl(url);
            setResultBlob(blob);
            setProgressPercent(100);
            setStatusText('');
            setLoading(false);
            return;
          } else {
            console.warn('withoutBG Server returned error, falling back to Open-Weights In-Browser');
          }
        } catch (apiErr) {
          console.warn('withoutBG Server request failed, falling back to Open-Weights In-Browser', apiErr);
        }
      }

      // 2. withoutBG Open-Weights Neural AI (In-Browser / WebGPU / WASM)
      try {
        setStatusText('Initializing withoutBG Open-Weights Engine...');
        setProgressPercent(20);

        const { removeBackground } = await import('@imgly/background-removal');

        setStatusText('Removing background with Open-Weights Model...');
        setProgressPercent(40);

        let blob: Blob;
        try {
          blob = await removeBackground(file, {
            model: 'isnet_quint8',
            rescale: true,
            device: 'gpu',
            progress: (key: string, current: number, total: number) => {
              if (total > 0) {
                const percent = Math.min(95, Math.round((current / total) * 100));
                setProgressPercent(percent);
                if (key.includes('fetch') || key.includes('download')) {
                  setStatusText(`Downloading AI Model: ${percent}% (Cached after 1st time)`);
                } else {
                  setStatusText(`Segmenting subject: ${percent}%`);
                }
              }
            },
            debug: false,
          });
        } catch (gpuErr) {
          console.warn('GPU segmentation fallback to CPU:', gpuErr);
          blob = await removeBackground(file, {
            model: 'isnet_quint8',
            rescale: true,
            device: 'cpu',
            progress: (_key: string, current: number, total: number) => {
              if (total > 0) {
                const percent = Math.min(95, Math.round((current / total) * 100));
                setProgressPercent(percent);
                setStatusText(`Processing on CPU: ${percent}%`);
              }
            },
            debug: false,
          });
        }

        const url = URL.createObjectURL(blob);
        setResultUrl(url);
        setResultBlob(blob);

        const resImg = new Image();
        resImg.onload = () => {
          resultImageRef.current = resImg;
          if (editorCanvasRef.current) {
            const canvas = editorCanvasRef.current;
            canvas.width = resImg.naturalWidth;
            canvas.height = resImg.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(resImg, 0, 0);
            pushHistory(canvas);
          }
        };
        resImg.src = url;

        setProgressPercent(100);
        setStatusText('');
      } catch (err: unknown) {
        console.error('AI removal failed:', err);
        setErrorMessage(
          err instanceof Error
            ? `AI Error: ${err.message}. Please try another image.`
            : 'Failed to remove background. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    },
    [engineMode, withoutBgKey, withoutBgEndpoint]
  );

  // Setup Editor canvas when switching to editor mode
  const openEditor = () => {
    setShowEditor(true);
    setTimeout(() => {
      if (editorCanvasRef.current && resultImageRef.current) {
        const canvas = editorCanvasRef.current;
        const img = resultImageRef.current;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        if (undoStackRef.current.length === 0) {
          pushHistory(canvas);
        }
      }
    }, 50);
  };

  // Erase / Restore / Magic Wand Canvas Drawing Handler
  const handleCanvasAction = (clientX: number, clientY: number) => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (activeTool === 'magic') {
      // Magic Eraser: Instant Connected Color Region Flood-Fill
      const targetX = Math.floor(Math.max(0, Math.min(canvas.width - 1, x)));
      const targetY = Math.floor(Math.max(0, Math.min(canvas.height - 1, y)));
      floodFillErase(canvas, targetX, targetY, magicTolerance);
      pushHistory(canvas);
      const dataUrl = canvas.toDataURL('image/png');
      setResultUrl(dataUrl);
      canvas.toBlob((b) => b && setResultBlob(b), 'image/png');
      return;
    }

    if (!isPaintingRef.current) return;

    const ctx = canvas.getContext('2d')!;
    const actualRadius = (brushSize / 2) * scaleX;

    ctx.save();

    if (activeTool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      if (brushSoftness > 0) {
        const grad = ctx.createRadialGradient(x, y, actualRadius * (1 - brushSoftness / 100), x, y, actualRadius);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, actualRadius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, actualRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (activeTool === 'restore' && sourceImageRef.current) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, actualRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(sourceImageRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    ctx.restore();

    const dataUrl = canvas.toDataURL('image/png');
    setResultUrl(dataUrl);
    canvas.toBlob((b) => b && setResultBlob(b), 'image/png');
  };

  // Copy Cutout PNG to Clipboard
  const copyCutoutToClipboard = async () => {
    if (!resultBlob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': resultBlob,
        }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (resultUrl) {
        navigator.clipboard.writeText(resultUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  // Split Comparison Slider Drag Handlers
  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current || !isDraggingSliderRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  // Drag & drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processImage(file);
  };

  // Clipboard Paste (Ctrl+V) handler
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
              processImage(file);
              break;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processImage]);

  return (
    <ToolPageWrapper
      title="Background Remover"
      description="Remove image backgrounds automatically in 1 second with withoutBG AI Engine"
      emoji="✂️"
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Engine Selector */}
        <div className="tool-card p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--foreground)]">AI Engine:</span>
            <div className="flex gap-1.5 bg-[var(--muted)] p-1 rounded-md border border-[var(--card-border)] text-xs">
              <button
                type="button"
                onClick={() => setEngineMode('open_weights')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  engineMode === 'open_weights'
                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                    : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                }`}
              >
                ⚡ withoutBG Open-Weights (Local WebGPU)
              </button>
              <button
                type="button"
                onClick={() => setEngineMode('cloud')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  engineMode === 'cloud'
                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                    : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                }`}
              >
                ☁️ withoutBG Server / Endpoint
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {engineMode === 'open_weights' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                {engineReady ? '⚡ Engine: Prewarmed & Ready' : '⏳ Initializing Web Worker...'}
              </span>
            ) : (
              <span className="text-[11px] text-[var(--muted-text)]">
                Endpoint: {withoutBgEndpoint || 'https://api.withoutbg.com'}
              </span>
            )}
          </div>
        </div>

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
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[11px] text-[var(--muted-text)]">
              Powered by withoutBG Open Weights (ISNet Neural Network) • 100% Private
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processImage(f);
            }}
          />
        </div>

        {/* Loading Progress Bar */}
        {loading && (
          <div className="tool-card p-8 text-center space-y-4">
            <div className="w-10 h-10 border-3 border-[var(--card-border)] border-t-[var(--foreground)] rounded-full animate-spin mx-auto" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-[var(--foreground)]">{statusText}</p>
              <p className="text-xs text-[var(--muted-text)]">
                Processing directly with withoutBG Neural Network...
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
              <button onClick={() => processImage(currentFile)} className="btn-secondary text-xs py-1 px-3">
                🔄 Try Again
              </button>
            )}
          </div>
        )}

        {/* Result Workspace */}
        {resultUrl && !loading && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="tool-card p-4 flex flex-wrap items-center justify-between gap-4">
              {/* View Mode Tabs */}
              <div className="flex items-center gap-1.5 bg-[var(--muted)] p-1 rounded-lg border border-[var(--card-border)] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('slider');
                    setShowEditor(false);
                  }}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    viewMode === 'slider' && !showEditor
                      ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                      : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                  }`}
                >
                  ↔️ Before / After Slider
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('cutout');
                    setShowEditor(false);
                  }}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    viewMode === 'cutout' && !showEditor
                      ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                      : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                  }`}
                >
                  ✂️ Removed Background
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('original');
                    setShowEditor(false);
                  }}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    viewMode === 'original' && !showEditor
                      ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                      : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                  }`}
                >
                  🖼️ Original
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openEditor}
                  className={`btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 ${
                    showEditor ? 'border-[var(--foreground)] font-semibold' : ''
                  }`}
                >
                  <span>🧹 Erase / Restore</span>
                </button>

                <button
                  type="button"
                  onClick={copyCutoutToClipboard}
                  className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
                >
                  <span>{copied ? '✅ Copied!' : '📋 Copy Image'}</span>
                </button>

                <a
                  href={resultUrl}
                  download={`${imageName}-removed-bg.png`}
                  className="btn-primary text-xs py-2 px-5 font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <span>⬇ Download PNG</span>
                </a>
              </div>
            </div>

            {/* withoutBG Erase / Restore / Magic Eraser Editor Panel */}
            {showEditor && (
              <div className="tool-card p-4 space-y-4 bg-[var(--card)] border border-[var(--card-border)]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--card-border)] pb-3 text-xs">
                  {/* Tool selection */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[var(--foreground)] mr-1">Tool:</span>
                    <button
                      type="button"
                      onClick={() => setActiveTool('erase')}
                      className={`px-3 py-1.5 rounded font-medium border ${
                        activeTool === 'erase'
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                          : 'bg-[var(--muted)] border-[var(--card-border)] text-[var(--foreground)]'
                      }`}
                    >
                      🧹 Erase Brush
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool('restore')}
                      className={`px-3 py-1.5 rounded font-medium border ${
                        activeTool === 'restore'
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                          : 'bg-[var(--muted)] border-[var(--card-border)] text-[var(--foreground)]'
                      }`}
                    >
                      🖌️ Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool('magic')}
                      className={`px-3 py-1.5 rounded font-medium border ${
                        activeTool === 'magic'
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                          : 'bg-[var(--muted)] border-[var(--card-border)] text-[var(--foreground)]'
                      }`}
                      title="Click on any connected background color region to erase it in 1 click"
                    >
                      🪄 Magic Eraser
                    </button>
                  </div>

                  {/* Magic Tolerance or Brush Sliders */}
                  {activeTool === 'magic' ? (
                    <div className="flex items-center gap-2.5 flex-1 max-w-xs">
                      <span className="text-[var(--muted-text)] whitespace-nowrap">Tolerance: {magicTolerance}%</span>
                      <input
                        type="range"
                        min={1}
                        max={80}
                        value={magicTolerance}
                        onChange={(e) => setMagicTolerance(+e.target.value)}
                        className="app-slider"
                      />
                    </div>
                  ) : (
                    <>
                      {/* Brush Size */}
                      <div className="flex items-center gap-2.5 flex-1 max-w-xs">
                        <span className="text-[var(--muted-text)] whitespace-nowrap">Size: {brushSize}px</span>
                        <input
                          type="range"
                          min={6}
                          max={100}
                          value={brushSize}
                          onChange={(e) => setBrushSize(+e.target.value)}
                          className="app-slider"
                        />
                      </div>

                      {/* Softness */}
                      <div className="flex items-center gap-2.5 flex-1 max-w-xs">
                        <span className="text-[var(--muted-text)] whitespace-nowrap">Softness: {brushSoftness}%</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={brushSoftness}
                          onChange={(e) => setBrushSoftness(+e.target.value)}
                          className="app-slider"
                        />
                      </div>
                    </>
                  )}

                  {/* Undo / Redo / Zoom */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-30 flex items-center gap-1"
                      title="Undo (Ctrl + Z)"
                    >
                      <span>↩ Undo</span>
                      <kbd className="opacity-60 text-[10px]">Ctrl+Z</kbd>
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-30 flex items-center gap-1"
                      title="Redo (Ctrl + Y)"
                    >
                      <span>↪ Redo</span>
                      <kbd className="opacity-60 text-[10px]">Ctrl+Y</kbd>
                    </button>
                    <div className="flex items-center gap-1 pl-2 border-l border-[var(--card-border)]">
                      <button
                        type="button"
                        onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                        className="btn-secondary text-xs py-1 px-2"
                        title="Zoom out"
                      >
                        -
                      </button>
                      <span className="text-[11px] font-mono text-[var(--muted-text)] w-10 text-center">
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                        className="btn-secondary text-xs py-1 px-2"
                        title="Zoom in"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Interactive Editor Canvas Workspace */}
                <div
                  className="w-full rounded-lg overflow-auto border border-[var(--card-border)] flex items-center justify-center min-h-[460px] p-4 relative select-none"
                  style={{
                    background:
                      'repeating-conic-gradient(var(--card-border) 0% 25%, transparent 0% 50%) 50% / 20px 20px',
                  }}
                  onMouseLeave={() => {
                    isPaintingRef.current = false;
                    setClientCursor(null);
                  }}
                >
                  <canvas
                    ref={editorCanvasRef}
                    onClick={(e) => {
                      if (activeTool === 'magic') {
                        handleCanvasAction(e.clientX, e.clientY);
                      }
                    }}
                    onMouseDown={(e) => {
                      if (activeTool !== 'magic') {
                        isPaintingRef.current = true;
                        handleCanvasAction(e.clientX, e.clientY);
                      }
                    }}
                    onMouseUp={() => {
                      if (isPaintingRef.current && editorCanvasRef.current) {
                        pushHistory(editorCanvasRef.current);
                      }
                      isPaintingRef.current = false;
                    }}
                    onMouseMove={(e) => {
                      setClientCursor({ x: e.clientX, y: e.clientY });
                      if (isPaintingRef.current && activeTool !== 'magic') {
                        handleCanvasAction(e.clientX, e.clientY);
                      }
                    }}
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center center',
                    }}
                    className={`max-h-[480px] object-contain w-auto mx-auto rounded transition-transform ${
                      activeTool === 'magic' ? 'cursor-crosshair' : 'cursor-none'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Custom Fixed Viewport Brush Circle Indicator */}
            {showEditor && clientCursor && activeTool !== 'magic' && (
              <div
                className="pointer-events-none fixed rounded-full border-2 border-white shadow-md z-50 transition-none"
                style={{
                  width: brushSize,
                  height: brushSize,
                  left: clientCursor.x,
                  top: clientCursor.y,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor:
                    activeTool === 'erase' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
                }}
              />
            )}

            {/* Standard Preview / Slider Display */}
            {!showEditor && (
              <div className="tool-card p-6">
                {/* 1. Before/After Split Comparison Slider */}
                {viewMode === 'slider' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                      <span>Original</span>
                      <span className="text-[var(--foreground)]">Drag center bar ↔️ to compare</span>
                      <span className="text-green-500">Removed Background</span>
                    </div>

                    <div
                      ref={sliderContainerRef}
                      className="relative w-full rounded-xl overflow-hidden border border-[var(--card-border)] select-none h-[480px] flex items-center justify-center cursor-ew-resize"
                      style={{
                        background:
                          'repeating-conic-gradient(var(--card-border) 0% 25%, transparent 0% 50%) 50% / 20px 20px',
                      }}
                      onMouseDown={(e) => {
                        isDraggingSliderRef.current = true;
                        handleSliderMove(e.clientX);
                      }}
                      onMouseUp={() => {
                        isDraggingSliderRef.current = false;
                      }}
                      onMouseMove={(e) => {
                        if (isDraggingSliderRef.current) {
                          handleSliderMove(e.clientX);
                        }
                      }}
                      onTouchMove={(e) => {
                        if (e.touches[0]) {
                          handleSliderMove(e.touches[0].clientX);
                        }
                      }}
                    >
                      {/* Original (Underneath / Left clipped) */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={originalUrl}
                        alt="Original"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      />

                      {/* Cutout (Right side overlaid with clip-path) */}
                      <div
                        className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
                        style={{
                          clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)`,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resultUrl}
                          alt="Cutout"
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* Draggable Vertical Divider Handle */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-2xl pointer-events-none z-10"
                        style={{ left: `${sliderPosition}%` }}
                      >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white text-black rounded-full shadow-lg flex items-center justify-center text-[10px] font-bold">
                          ◀▶
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Full Cutout View */}
                {viewMode === 'cutout' && (
                  <div
                    className="w-full rounded-xl overflow-hidden border border-[var(--card-border)] flex items-center justify-center min-h-[480px] p-4"
                    style={{
                      background:
                        'repeating-conic-gradient(var(--card-border) 0% 25%, transparent 0% 50%) 50% / 20px 20px',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resultUrl}
                      alt="AI Cutout"
                      className="max-h-[480px] object-contain w-auto mx-auto rounded"
                    />
                  </div>
                )}

                {/* 3. Full Original View */}
                {viewMode === 'original' && (
                  <div className="w-full rounded-xl overflow-hidden border border-[var(--card-border)] bg-[var(--muted)] flex items-center justify-center min-h-[480px] p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={originalUrl}
                      alt="Original"
                      className="max-h-[480px] object-contain w-auto mx-auto rounded"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </ToolPageWrapper>
  );
}
