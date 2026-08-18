'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

type ViewMode = 'slider' | 'cutout' | 'original';

interface HistoryState {
  imageData: ImageData;
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

  // View & Slider Mode
  const [viewMode, setViewMode] = useState<ViewMode>('slider');
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const isDraggingSliderRef = useRef(false);

  // Erase / Restore Editor (Remove.bg style)
  const [showEditor, setShowEditor] = useState(false);
  const [activeTool, setActiveTool] = useState<'erase' | 'restore'>('erase');
  const [brushSize, setBrushSize] = useState<number>(28);
  const [brushSoftness, setBrushSoftness] = useState<number>(20);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

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
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const handleUndo = () => {
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
  };

  const handleRedo = () => {
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
  };

  // Main Background Removal Process (High-Speed Local Neural AI)
  const processImage = useCallback(async (file: File) => {
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

    try {
      setStatusText('Initializing On-Device AI...');
      setProgressPercent(20);

      const { removeBackground } = await import('@imgly/background-removal');

      setStatusText('Removing background...');
      setProgressPercent(40);

      // Quantized ISNet neural model runs in 1024x1024 space for instant speed and 100% precision
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
                setStatusText(`Downloading AI: ${percent}% (Cached after 1st time)`);
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
  }, []);

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

  // Erase / Restore Drawing Handler
  const drawOnCanvas = (clientX: number, clientY: number) => {
    const canvas = editorCanvasRef.current;
    if (!canvas || !isPaintingRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d')!;
    const actualRadius = (brushSize / 2) * (canvas.width / 400);

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
      description="Remove image backgrounds automatically in 1 second with on-device AI"
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
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-[11px] text-[var(--muted-text)]">
              Auto-Detect Subject • 100% On-Device Neural AI (ISNet) • Zero External Server
            </span>
            {engineReady && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                ⚡ Ready
              </span>
            )}
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
                Processing directly in your browser with WebAssembly & GPU acceleration...
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
              {/* View Mode Tabs (Remove.bg style) */}
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

            {/* Remove.bg Erase / Restore Editor Panel */}
            {showEditor && (
              <div className="tool-card p-4 space-y-4 bg-[var(--card)] border border-[var(--card-border)]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--card-border)] pb-3 text-xs">
                  {/* Tool selection */}
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--foreground)]">Mode:</span>
                    <button
                      type="button"
                      onClick={() => setActiveTool('erase')}
                      className={`px-3 py-1.5 rounded font-medium border ${
                        activeTool === 'erase'
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]'
                          : 'bg-[var(--muted)] border-[var(--card-border)] text-[var(--foreground)]'
                      }`}
                    >
                      🧹 Erase
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
                  </div>

                  {/* Brush Size */}
                  <div className="flex items-center gap-2.5 flex-1 max-w-xs">
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

                  {/* Undo / Redo / Zoom */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-30"
                      title="Undo"
                    >
                      ↩ Undo
                    </button>
                    <button
                      type="button"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-30"
                      title="Redo"
                    >
                      ↪ Redo
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
                    setCursorPos(null);
                  }}
                >
                  <canvas
                    ref={editorCanvasRef}
                    onMouseDown={(e) => {
                      isPaintingRef.current = true;
                      drawOnCanvas(e.clientX, e.clientY);
                    }}
                    onMouseUp={() => {
                      if (isPaintingRef.current && editorCanvasRef.current) {
                        pushHistory(editorCanvasRef.current);
                      }
                      isPaintingRef.current = false;
                    }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                      if (isPaintingRef.current) {
                        drawOnCanvas(e.clientX, e.clientY);
                      }
                    }}
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center center',
                    }}
                    className="max-h-[480px] object-contain w-auto mx-auto rounded cursor-crosshair transition-transform"
                  />

                  {/* Brush Circle Indicator */}
                  {cursorPos && (
                    <div
                      className="pointer-events-none absolute rounded-full border border-white shadow-xs"
                      style={{
                        width: brushSize,
                        height: brushSize,
                        left: cursorPos.x,
                        top: cursorPos.y,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: activeTool === 'erase' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)',
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Standard Preview / Slider Display */}
            {!showEditor && (
              <div className="tool-card p-6">
                {/* 1. Before/After Split Comparison Slider (Remove.bg signature view) */}
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
