'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

type ViewMode = 'slider' | 'cutout' | 'original';
type EditorTool = 'erase' | 'restore' | 'magic_erase' | 'magic_restore';

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

// Fast Queue-based Flood Fill for Magic Restorer (restores from original image)
function floodFillRestore(
  canvas: HTMLCanvasElement,
  sourceImg: HTMLImageElement,
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

  // Offscreen canvas to sample original source image
  const offCanvas = document.createElement('canvas');
  offCanvas.width = width;
  offCanvas.height = height;
  const offCtx = offCanvas.getContext('2d', { willReadFrequently: true })!;
  offCtx.drawImage(sourceImg, 0, 0, width, height);
  const origData = offCtx.getImageData(0, 0, width, height).data;

  const startIndex = (startY * width + startX) * 4;
  const targetR = origData[startIndex];
  const targetG = origData[startIndex + 1];
  const targetB = origData[startIndex + 2];

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

    const r = origData[dataIdx];
    const g = origData[dataIdx + 1];
    const b = origData[dataIdx + 2];
    const a = origData[dataIdx + 3];

    const dr = r - targetR;
    const dg = g - targetG;
    const db = b - targetB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist <= tolDist) {
      // Restore pixel from original
      data[dataIdx] = r;
      data[dataIdx + 1] = g;
      data[dataIdx + 2] = b;
      data[dataIdx + 3] = a > 0 ? a : 255;

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

  // Erase / Restore / Magic Editor
  const [showEditor, setShowEditor] = useState(false);
  const [activeTool, setActiveTool] = useState<EditorTool>('erase');
  const [brushSize, setBrushSize] = useState<number>(35);
  const [brushSoftness, setBrushSoftness] = useState<number>(20);
  const [magicTolerance, setMagicTolerance] = useState<number>(10);
  const [showGhostOverlay, setShowGhostOverlay] = useState<boolean>(true);
  const [ghostOpacity, setGhostOpacity] = useState<number>(35);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [clientCursor, setClientCursor] = useState<{ x: number; y: number } | null>(null);

  // Undo / Redo Stacks
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoStackRef = useRef<HistoryState[]>([]);
  const redoStackRef = useRef<HistoryState[]>([]);

  // Canvas Refs & Lag-Free Stroke Tracking
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const resultImageRef = useRef<HTMLImageElement | null>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPaintingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
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

      const isZKey =
        e.code === 'KeyZ' ||
        e.key.toLowerCase() === 'z' ||
        e.keyCode === 90 ||
        e.which === 90;

      const isYKey =
        e.code === 'KeyY' ||
        e.key.toLowerCase() === 'y' ||
        e.keyCode === 89 ||
        e.which === 89;

      if ((e.ctrlKey || e.metaKey) && isZKey) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && isYKey) {
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

  // High-Performance 120 FPS Direct Canvas Stroke Rendering (No toDataURL in mousemove!)
  const paintDirect = (clientX: number, clientY: number) => {
    const canvas = editorCanvasRef.current;
    if (!canvas || !isPaintingRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const currentX = (clientX - rect.left) * scaleX;
    const currentY = (clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d')!;
    const actualRadius = (brushSize / 2) * scaleX;

    const last = lastPointRef.current || { x: currentX, y: currentY };

    ctx.save();

    if (activeTool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = actualRadius * 2;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();

      // Ensure start circle is filled
      ctx.beginPath();
      ctx.arc(currentX, currentY, actualRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (activeTool === 'restore' && sourceImageRef.current) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = actualRadius * 2;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(currentX, currentY, actualRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.clip();
      ctx.drawImage(sourceImageRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    ctx.restore();
    lastPointRef.current = { x: currentX, y: currentY };
  };

  // Finish Stroke & Commit History (Only called once on mouseup/pointerup!)
  const commitCanvasStroke = () => {
    const canvas = editorCanvasRef.current;
    if (!canvas || !isPaintingRef.current) return;

    isPaintingRef.current = false;
    lastPointRef.current = null;
    pushHistory(canvas);

    // Update result blob asynchronously
    const dataUrl = canvas.toDataURL('image/png');
    setResultUrl(dataUrl);
    canvas.toBlob((b) => b && setResultBlob(b), 'image/png');
  };

  // 1-Click Magic Tools Execution (Magic Erase & Magic Restore)
  const handleMagicClick = (clientX: number, clientY: number) => {
    const canvas = editorCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const targetX = Math.floor(Math.max(0, Math.min(canvas.width - 1, x)));
    const targetY = Math.floor(Math.max(0, Math.min(canvas.height - 1, y)));

    if (activeTool === 'magic_erase') {
      floodFillErase(canvas, targetX, targetY, magicTolerance);
    } else if (activeTool === 'magic_restore' && sourceImageRef.current) {
      floodFillRestore(canvas, sourceImageRef.current, targetX, targetY, magicTolerance);
    }

    pushHistory(canvas);
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

  // Smooth Before / After Split Slider Pointer Drag
  const handleSliderPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const container = sliderContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const updatePosition = (clientX: number) => {
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(pct);
    };

    updatePosition(e.clientX);

    const onPointerMove = (moveEvt: PointerEvent) => {
      updatePosition(moveEvt.clientX);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

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
                  <span>🧹 Erase / Restore Editor</span>
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

            {/* withoutBG Erase / Restore / Magic Restorer Editor Panel */}
            {showEditor && (
              <div className="tool-card p-4 space-y-4 bg-[var(--card)] border border-[var(--card-border)]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--card-border)] pb-3 text-xs">
                  {/* Tool Selection (4 Tools) */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-[var(--foreground)] mr-1">Tool:</span>
                    <button
                      type="button"
                      onClick={() => setActiveTool('erase')}
                      className={`px-3 py-1.5 rounded font-medium border cursor-pointer select-none ${
                        activeTool === 'erase'
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)] shadow-sm'
                          : 'bg-[var(--muted)] border-[var(--card-border)] text-[var(--foreground)]'
                      }`}
                    >
                      🧹 Erase Brush
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool('restore')}
                      className={`px-3 py-1.5 rounded font-medium border cursor-pointer select-none ${
                        activeTool === 'restore'
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)] shadow-sm'
                          : 'bg-[var(--muted)] border-[var(--card-border)] text-[var(--foreground)]'
                      }`}
                    >
                      🖌️ Restore Brush
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool('magic_erase')}
                      className={`px-3 py-1.5 rounded font-medium border cursor-pointer select-none ${
                        activeTool === 'magic_erase'
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)] shadow-sm'
                          : 'bg-[var(--muted)] border-[var(--card-border)] text-[var(--foreground)]'
                      }`}
                      title="Click on any connected background color region to erase it in 1 click"
                    >
                      🪄 Magic Erase
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTool('magic_restore');
                        setShowGhostOverlay(true);
                      }}
                      className={`px-3 py-1.5 rounded font-medium border cursor-pointer select-none ${
                        activeTool === 'magic_restore'
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)] shadow-sm'
                          : 'bg-[var(--muted)] border-[var(--card-border)] text-[var(--foreground)]'
                      }`}
                      title="Click on any removed part (hair, arm, clothing) to restore it in 1 click"
                    >
                      ✨ Magic Restore
                    </button>
                  </div>

                  {/* Magic Tolerance or Brush Sliders */}
                  {activeTool === 'magic_erase' || activeTool === 'magic_restore' ? (
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
                          max={120}
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

                  {/* Ghost Overlay & Undo / Redo */}
                  <div className="flex items-center gap-2">
                    {/* Ghost Preview Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowGhostOverlay(!showGhostOverlay)}
                      className={`px-2.5 py-1 rounded text-xs border font-medium cursor-pointer transition-all ${
                        showGhostOverlay
                          ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                          : 'bg-[var(--muted)] border-[var(--card-border)] text-[var(--muted-text)]'
                      }`}
                      title="Show translucent ghost of original image to see removed parts clearly"
                    >
                      👁️ Ghost Guide: {showGhostOverlay ? `${ghostOpacity}%` : 'Off'}
                    </button>

                    {showGhostOverlay && (
                      <input
                        type="range"
                        min={10}
                        max={80}
                        value={ghostOpacity}
                        onChange={(e) => setGhostOpacity(+e.target.value)}
                        className="w-16 accent-indigo-500"
                        title="Ghost Guide Opacity"
                      />
                    )}

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

                {/* Subtitle helper tip */}
                <div className="text-[11px] text-[var(--muted-text)] flex items-center gap-2">
                  {activeTool === 'magic_restore' && (
                    <span className="text-indigo-400 font-medium">
                      💡 Magic Restore Tip: The faint translucent ghost shows removed parts. Click on any lost area to restore it instantly!
                    </span>
                  )}
                  {activeTool === 'magic_erase' && (
                    <span>💡 Magic Erase Tip: Click on any leftover background patch to erase it completely.</span>
                  )}
                  {activeTool === 'restore' && (
                    <span>💡 Restore Brush Tip: Brush over ghost areas to paint back original details.</span>
                  )}
                  {activeTool === 'erase' && (
                    <span>💡 Erase Brush Tip: Brush over any unwanted pixels to erase them.</span>
                  )}
                </div>

                {/* Interactive Editor Canvas Workspace */}
                <div
                  className="w-full rounded-lg overflow-auto border border-[var(--card-border)] flex items-center justify-center min-h-[480px] p-4 relative select-none"
                  style={{
                    background:
                      'repeating-conic-gradient(var(--card-border) 0% 25%, transparent 0% 50%) 50% / 20px 20px',
                  }}
                  onMouseLeave={() => {
                    commitCanvasStroke();
                    setClientCursor(null);
                  }}
                >
                  <div
                    className="relative max-h-[500px] w-auto inline-block"
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    {/* Ghost Guide of Original Image (Shown behind cutout so user clearly sees what is missing!) */}
                    {showGhostOverlay && originalUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={originalUrl}
                        alt="Ghost Guide"
                        style={{ opacity: ghostOpacity / 100 }}
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded select-none filter contrast-125"
                      />
                    )}

                    <canvas
                      ref={editorCanvasRef}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        if (activeTool === 'magic_erase' || activeTool === 'magic_restore') {
                          handleMagicClick(e.clientX, e.clientY);
                        } else {
                          isPaintingRef.current = true;
                          const canvas = editorCanvasRef.current;
                          if (canvas) {
                            const rect = canvas.getBoundingClientRect();
                            const scaleX = canvas.width / rect.width;
                            const scaleY = canvas.height / rect.height;
                            lastPointRef.current = {
                              x: (e.clientX - rect.left) * scaleX,
                              y: (e.clientY - rect.top) * scaleY,
                            };
                          }
                          paintDirect(e.clientX, e.clientY);
                        }
                      }}
                      onPointerMove={(e) => {
                        setClientCursor({ x: e.clientX, y: e.clientY });
                        if (isPaintingRef.current) {
                          paintDirect(e.clientX, e.clientY);
                        }
                      }}
                      onPointerUp={commitCanvasStroke}
                      className={`relative z-10 max-h-[500px] object-contain w-auto mx-auto rounded transition-transform ${
                        activeTool === 'magic_erase' || activeTool === 'magic_restore'
                          ? 'cursor-crosshair'
                          : 'cursor-none'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Custom Fixed Viewport Brush Circle Indicator */}
            {showEditor && clientCursor && activeTool !== 'magic_erase' && activeTool !== 'magic_restore' && (
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
              <div className="tool-card p-6 space-y-4">
                {/* 1. Before/After Split Comparison Slider */}
                {viewMode === 'slider' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                        <span>Original (Left)</span>
                        <span className="text-[var(--foreground)]">• Drag Bar ◀▶ to Compare •</span>
                        <span className="text-green-500">Cutout (Right)</span>
                      </div>

                      {/* Quick Percentage Presets */}
                      <div className="flex items-center gap-1.5 bg-[var(--muted)] p-1 rounded-md border border-[var(--card-border)]">
                        {[
                          { label: 'Original', val: 100 },
                          { label: '75%', val: 75 },
                          { label: '50% (Split)', val: 50 },
                          { label: '25%', val: 25 },
                          { label: 'Cutout', val: 0 },
                        ].map((btn) => (
                          <button
                            key={btn.label}
                            type="button"
                            onClick={() => setSliderPosition(btn.val)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                              sliderPosition === btn.val
                                ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                                : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Smooth Aspect-Ratio Matched Comparison Container */}
                    <div
                      className="relative w-full rounded-xl overflow-hidden border border-[var(--card-border)] select-none min-h-[480px] flex items-center justify-center p-4"
                      style={{
                        background:
                          'repeating-conic-gradient(#374151 0% 25%, #1f2937 0% 50%) 0 0 / 20px 20px',
                      }}
                    >
                      <div
                        ref={sliderContainerRef}
                        onPointerDown={handleSliderPointerDown}
                        className="relative max-h-[500px] w-auto inline-block cursor-ew-resize touch-none shadow-2xl rounded-lg overflow-hidden"
                        style={{
                          background:
                            'repeating-conic-gradient(#374151 0% 25%, #1f2937 0% 50%) 0 0 / 20px 20px',
                        }}
                      >
                        {/* 1. Base Layer: Transparent Cutout Image (Revealed on Right side over checkered background) */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resultUrl}
                          alt="Cutout (Right)"
                          className="max-h-[500px] w-auto object-contain block pointer-events-none rounded select-none"
                        />

                        {/* 2. Top Layer: Original Image (Clipped to Left side) */}
                        <div
                          className="absolute inset-0 pointer-events-none overflow-hidden"
                          style={{
                            clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={originalUrl}
                            alt="Original (Left)"
                            className="max-h-[500px] w-auto object-contain block rounded select-none"
                          />
                        </div>

                        {/* 3. Draggable Vertical Divider Handle */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-2xl pointer-events-none z-10"
                          style={{ left: `${sliderPosition}%` }}
                        >
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white text-black rounded-full shadow-2xl flex items-center justify-center text-[10px] font-bold border border-gray-300">
                            ◀▶
                          </div>
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
