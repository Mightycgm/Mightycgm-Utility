'use client';
import { useState, useRef } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

type Tab = 'convert' | 'compress';

interface FormatInfo {
  id: string;
  name: string;
  ext: string;
  mime: string;
  lossy: boolean;
  desc: string;
}

const SUPPORTED_FORMATS: FormatInfo[] = [
  { id: 'webp', name: 'WEBP', ext: 'webp', mime: 'image/webp', lossy: true, desc: 'Modern web format with superior compression' },
  { id: 'png', name: 'PNG', ext: 'png', mime: 'image/png', lossy: false, desc: 'Lossless quality with full transparency support' },
  { id: 'jpeg', name: 'JPG / JPEG', ext: 'jpg', mime: 'image/jpeg', lossy: true, desc: 'Universal standard photography format' },
  { id: 'avif', name: 'AVIF', ext: 'avif', mime: 'image/avif', lossy: true, desc: 'Next-gen compact web format' },
  { id: 'ico', name: 'ICO', ext: 'ico', mime: 'image/x-icon', lossy: false, desc: 'Website favicon & application icon format' },
  { id: 'bmp', name: 'BMP', ext: 'bmp', mime: 'image/bmp', lossy: false, desc: 'Standard uncompressed Windows bitmap' },
  { id: 'svg', name: 'SVG', ext: 'svg', mime: 'image/svg+xml', lossy: false, desc: 'Scalable vector graphic container' },
  { id: 'gif', name: 'GIF', ext: 'gif', mime: 'image/gif', lossy: false, desc: 'Standard graphics interchange format' },
];

interface PresetPair {
  id: string;
  formatA: string;
  nameA: string;
  formatB: string;
  nameB: string;
}

const PRESET_PAIRS: PresetPair[] = [
  { id: 'png-webp', formatA: 'png', nameA: 'PNG', formatB: 'webp', nameB: 'WEBP' },
  { id: 'jpg-png', formatA: 'jpeg', nameA: 'JPG', formatB: 'png', nameB: 'PNG' },
  { id: 'jpg-webp', formatA: 'jpeg', nameA: 'JPG', formatB: 'webp', nameB: 'WEBP' },
  { id: 'png-ico', formatA: 'png', nameA: 'PNG', formatB: 'ico', nameB: 'ICO' },
  { id: 'svg-png', formatA: 'svg', nameA: 'SVG', formatB: 'png', nameB: 'PNG' },
  { id: 'png-bmp', formatA: 'png', nameA: 'PNG', formatB: 'bmp', nameB: 'BMP' },
  { id: 'png-avif', formatA: 'png', nameA: 'PNG', formatB: 'avif', nameB: 'AVIF' },
];

const ICO_SIZES = [
  { label: 'Original Size', value: 0 },
  { label: '256 × 256 (HD Icon)', value: 256 },
  { label: '128 × 128 (Large)', value: 128 },
  { label: '64 × 64 (Medium)', value: 64 },
  { label: '48 × 48 (Windows App)', value: 48 },
  { label: '32 × 32 (Standard Favicon)', value: 32 },
  { label: '16 × 16 (Small Tab Icon)', value: 16 },
];

interface FileItem {
  id: string;
  file: File;
  previewUrl: string;
  sourceFormat: string;
  targetFormat: string;
  convertedBlob?: Blob;
  convertedUrl?: string;
  convertedSize?: number;
  originalSize: number;
  width?: number;
  height?: number;
  status: 'idle' | 'converting' | 'done' | 'error';
  errorMessage?: string;
}

function detectFormat(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg'].includes(ext) || file.type === 'image/jpeg') return 'jpeg';
  if (ext === 'png' || file.type === 'image/png') return 'png';
  if (ext === 'webp' || file.type === 'image/webp') return 'webp';
  if (ext === 'avif' || file.type === 'image/avif') return 'avif';
  if (ext === 'ico' || file.type === 'image/x-icon' || file.type === 'image/vnd.microsoft.icon') return 'ico';
  if (ext === 'bmp' || file.type === 'image/bmp') return 'bmp';
  if (ext === 'svg' || file.type === 'image/svg+xml') return 'svg';
  if (ext === 'gif' || file.type === 'image/gif') return 'gif';
  return 'png';
}

function fmtSize(b: number): string {
  if (b === 0) return '0 B';
  if (b > 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  return `${(b / 1024).toFixed(1)} KB`;
}

// Pure JS BMP Encoder (24-bit RGB with row padding)
function canvasToBmpBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    const ctx = canvas.getContext('2d')!;
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const fileHeaderSize = 14;
    const dibHeaderSize = 40;
    const fileSize = fileHeaderSize + dibHeaderSize + pixelArraySize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // Bitmap File Header (14 bytes)
    view.setUint16(0, 0x424d, false); // 'BM'
    view.setUint32(2, fileSize, true); // File size
    view.setUint16(6, 0, true); // Reserved
    view.setUint16(8, 0, true); // Reserved
    view.setUint32(10, fileHeaderSize + dibHeaderSize, true); // Offset to pixel data

    // DIB Header (BITMAPINFOHEADER - 40 bytes)
    view.setUint32(14, dibHeaderSize, true); // Header size
    view.setInt32(18, width, true); // Width
    view.setInt32(22, height, true); // Height (bottom-to-top)
    view.setUint16(26, 1, true); // Color planes
    view.setUint16(28, 24, true); // Bits per pixel (24-bit RGB)
    view.setUint32(30, 0, true); // Compression (none)
    view.setUint32(34, pixelArraySize, true); // Image data size
    view.setInt32(38, 2835, true); // 72 DPI
    view.setInt32(42, 2835, true);
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);

    let offset = fileHeaderSize + dibHeaderSize;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const srcPos = (y * width + x) * 4;
        // BGR order
        view.setUint8(offset++, data[srcPos + 2]); // B
        view.setUint8(offset++, data[srcPos + 1]); // G
        view.setUint8(offset++, data[srcPos]);     // R
      }
      for (let p = 0; p < rowSize - width * 3; p++) {
        view.setUint8(offset++, 0);
      }
    }

    resolve(new Blob([buffer], { type: 'image/bmp' }));
  });
}

// Pure JS ICO Encoder (wraps PNG data with ICO container)
async function canvasToIcoBlob(canvas: HTMLCanvasElement, targetSize: number = 0): Promise<Blob> {
  let finalCanvas = canvas;
  if (targetSize > 0 && (canvas.width !== targetSize || canvas.height !== targetSize)) {
    const resized = document.createElement('canvas');
    resized.width = targetSize;
    resized.height = targetSize;
    const rCtx = resized.getContext('2d')!;
    rCtx.imageSmoothingQuality = 'high';
    rCtx.drawImage(canvas, 0, 0, targetSize, targetSize);
    finalCanvas = resized;
  }

  const pngBlob = await new Promise<Blob>((res) => finalCanvas.toBlob((b) => res(b!), 'image/png'));
  const pngBuffer = await pngBlob.arrayBuffer();

  const w = finalCanvas.width > 255 ? 0 : finalCanvas.width;
  const h = finalCanvas.height > 255 ? 0 : finalCanvas.height;

  const headerSize = 6;
  const dirEntrySize = 16;
  const totalSize = headerSize + dirEntrySize + pngBuffer.byteLength;

  const icoBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(icoBuffer);

  // ICONDIR
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true); // 1 = ICO
  view.setUint16(4, 1, true); // 1 image

  // ICONDIRENTRY
  view.setUint8(6, w);
  view.setUint8(7, h);
  view.setUint8(8, 0);
  view.setUint8(9, 0);
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, pngBuffer.byteLength, true);
  view.setUint32(18, headerSize + dirEntrySize, true);

  new Uint8Array(icoBuffer, headerSize + dirEntrySize).set(new Uint8Array(pngBuffer));

  return new Blob([icoBuffer], { type: 'image/x-icon' });
}

// SVG Vector Container
function canvasToSvgBlob(canvas: HTMLCanvasElement): Blob {
  const dataUrl = canvas.toDataURL('image/png');
  const w = canvas.width;
  const h = canvas.height;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image width="${w}" height="${h}" xlink:href="${dataUrl}"/>
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

export default function ImageToolsPage() {
  const [tab, setTab] = useState<Tab>('convert');

  // Convert State
  const [items, setItems] = useState<FileItem[]>([]);
  const [globalTargetFormat, setGlobalTargetFormat] = useState<string>('webp');
  const [activePresetId, setActivePresetId] = useState<string>('png-webp');
  
  // Track direction (from ➔ to) for each preset pair button
  const [presetDirections, setPresetDirections] = useState<Record<string, { from: string; fromName: string; to: string; toName: string }>>(() => {
    const initial: Record<string, { from: string; fromName: string; to: string; toName: string }> = {};
    PRESET_PAIRS.forEach((p) => {
      initial[p.id] = { from: p.formatA, fromName: p.nameA, to: p.formatB, toName: p.nameB };
    });
    return initial;
  });

  const [quality, setQuality] = useState<number>(0.9);
  const [scale, setScale] = useState<number>(1);
  const [icoSize, setIcoSize] = useState<number>(0);
  const [bgFill, setBgFill] = useState<'transparent' | 'white' | 'black'>('transparent');
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress State
  const [compFile, setCompFile] = useState<File | null>(null);
  const [compPreview, setCompPreview] = useState('');
  const [compResultUrl, setCompResultUrl] = useState('');
  const [compOrigSize, setCompOrigSize] = useState(0);
  const [compResultSize, setCompResultSize] = useState(0);
  const [compQuality, setCompQuality] = useState(0.8);
  const [compMaxWidth, setCompMaxWidth] = useState(1920);
  const [compressing, setCompressing] = useState(false);

  // Add files to Converter
  const handleFilesAdded = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newItems: FileItem[] = [];

    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith('image/') && !file.name.match(/\.(jpg|jpeg|png|webp|avif|bmp|ico|svg|gif)$/i)) return;
      const detected = detectFormat(file);
      // Auto pick target format if same as source
      let target = globalTargetFormat;
      if (detected === globalTargetFormat) {
        target = detected === 'webp' ? 'png' : detected === 'png' ? 'webp' : 'png';
      }

      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        previewUrl,
        sourceFormat: detected,
        targetFormat: target,
        originalSize: file.size,
        status: 'idle',
      });
    });

    setItems((prev) => [...prev, ...newItems]);
  };

  // Convert a single image
  const processConvertItem = async (item: FileItem): Promise<FileItem> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(item.file);

      img.onload = async () => {
        try {
          const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
          const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d')!;

          // Background fill for opaque formats or user selection
          const requiresOpaqueBg = ['jpeg', 'bmp'].includes(item.targetFormat);
          if (requiresOpaqueBg || bgFill !== 'transparent') {
            ctx.fillStyle = bgFill === 'black' ? '#000000' : '#FFFFFF';
            ctx.fillRect(0, 0, targetW, targetH);
          }

          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);

          let resultBlob: Blob;

          if (item.targetFormat === 'bmp') {
            resultBlob = await canvasToBmpBlob(canvas);
          } else if (item.targetFormat === 'ico') {
            resultBlob = await canvasToIcoBlob(canvas, icoSize);
          } else if (item.targetFormat === 'svg') {
            resultBlob = canvasToSvgBlob(canvas);
          } else {
            const formatObj = SUPPORTED_FORMATS.find((f) => f.id === item.targetFormat) || SUPPORTED_FORMATS[0];
            const mime = formatObj.mime;
            const q = formatObj.lossy ? quality : undefined;
            resultBlob = await new Promise<Blob>((res, rej) => {
              canvas.toBlob(
                (b) => {
                  if (b) res(b);
                  else rej(new Error('Canvas export failed'));
                },
                mime,
                q
              );
            });
          }

          URL.revokeObjectURL(url);
          const convertedUrl = URL.createObjectURL(resultBlob);

          resolve({
            ...item,
            convertedBlob: resultBlob,
            convertedUrl,
            convertedSize: resultBlob.size,
            width: targetW,
            height: targetH,
            status: 'done',
          });
        } catch (err: unknown) {
          URL.revokeObjectURL(url);
          resolve({
            ...item,
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'Conversion failed',
          });
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({
          ...item,
          status: 'error',
          errorMessage: 'Failed to load image',
        });
      };

      img.src = url;
    });
  };

  // Convert all items
  const convertAll = async () => {
    if (items.length === 0) return;
    setIsConvertingAll(true);

    const updated = [...items];
    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'converting' };
      setItems([...updated]);
      const result = await processConvertItem(updated[i]);
      updated[i] = result;
      setItems([...updated]);
    }

    setIsConvertingAll(false);
  };

  // Preset Button Click (Selects preset or Swaps if already active)
  const handlePresetClick = (preset: PresetPair) => {
    setPresetDirections((prev) => {
      const current = prev[preset.id] || { from: preset.formatA, fromName: preset.nameA, to: preset.formatB, toName: preset.nameB };

      if (activePresetId === preset.id) {
        // Swap direction inside this button
        const swapped = {
          from: current.to,
          fromName: current.toName,
          to: current.from,
          toName: current.fromName,
        };
        setGlobalTargetFormat(swapped.to);
        if (items.length > 0) {
          setItems((prevItems) =>
            prevItems.map((item) => ({
              ...item,
              targetFormat: swapped.to,
              status: 'idle',
            }))
          );
        }
        return { ...prev, [preset.id]: swapped };
      } else {
        // Activate this preset
        setActivePresetId(preset.id);
        setGlobalTargetFormat(current.to);
        if (items.length > 0) {
          setItems((prevItems) =>
            prevItems.map((item) => ({
              ...item,
              targetFormat: current.to,
              status: 'idle',
            }))
          );
        }
        return prev;
      }
    });
  };

  // Swap Source and Target format (Swaps the active button's direction)
  const handleSwapFormats = () => {
    if (activePresetId && presetDirections[activePresetId]) {
      setPresetDirections((prev) => {
        const current = prev[activePresetId];
        const swapped = {
          from: current.to,
          fromName: current.toName,
          to: current.from,
          toName: current.fromName,
        };
        setGlobalTargetFormat(swapped.to);
        if (items.length > 0) {
          setItems((prevItems) =>
            prevItems.map((item) => ({
              ...item,
              targetFormat: swapped.to,
              status: 'idle',
            }))
          );
        }
        return { ...prev, [activePresetId]: swapped };
      });
    } else {
      const dominantSource = items.length > 0 ? items[0].sourceFormat : 'png';
      const currentTarget = globalTargetFormat;
      const newTarget = dominantSource === currentTarget ? (currentTarget === 'webp' ? 'png' : 'webp') : dominantSource;
      setGlobalTargetFormat(newTarget);

      if (items.length > 0) {
        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            targetFormat: item.targetFormat === newTarget ? item.sourceFormat : newTarget,
            status: 'idle',
          }))
        );
      }
    }
  };

  // Dropdown Target Format change
  const handleGlobalFormatChange = (newFmt: string) => {
    setGlobalTargetFormat(newFmt);
    setItems((prev) => prev.map((item) => ({ ...item, targetFormat: newFmt, status: 'idle' })));

    // Match or align active preset
    const matched = PRESET_PAIRS.find((p) => p.formatA === newFmt || p.formatB === newFmt);
    if (matched) {
      setActivePresetId(matched.id);
      setPresetDirections((prev) => {
        const current = prev[matched.id];
        if (current && current.to !== newFmt) {
          return {
            ...prev,
            [matched.id]: {
              from: current.to,
              fromName: current.toName,
              to: current.from,
              toName: current.fromName,
            },
          };
        }
        return prev;
      });
    }
  };

  // Single Item Target Format change
  const setItemTargetFormat = (id: string, newFormat: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, targetFormat: newFormat, status: 'idle' } : item))
    );
  };

  // Remove single item
  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item?.convertedUrl) URL.revokeObjectURL(item.convertedUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  // Clear all items
  const clearAll = () => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl);
    });
    setItems([]);
  };

  // Download all converted items
  const downloadAll = () => {
    items.forEach((item) => {
      if (item.convertedUrl && item.status === 'done') {
        const formatObj = SUPPORTED_FORMATS.find((f) => f.id === item.targetFormat);
        const ext = formatObj?.ext || item.targetFormat;
        const nameWithoutExt = item.file.name.replace(/\.[^/.]+$/, '');
        const a = document.createElement('a');
        a.href = item.convertedUrl;
        a.download = `${nameWithoutExt}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  };

  // Compress handler
  const handleCompressUpload = (file: File) => {
    setCompFile(file);
    setCompResultUrl('');
    setCompOrigSize(file.size);
    const reader = new FileReader();
    reader.onload = (e) => setCompPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const compress = async () => {
    if (!compFile) return;
    setCompressing(true);
    try {
      const { default: imageCompression } = await import('browser-image-compression');
      const compressed = await imageCompression(compFile, {
        maxSizeMB: 10,
        maxWidthOrHeight: compMaxWidth,
        useWebWorker: true,
        initialQuality: compQuality,
      });
      setCompResultSize(compressed.size);
      setCompResultUrl(URL.createObjectURL(compressed));
    } catch (e) {
      console.error(e);
    }
    setCompressing(false);
  };

  const currentTargetObj = SUPPORTED_FORMATS.find((f) => f.id === globalTargetFormat) || SUPPORTED_FORMATS[0];

  return (
    <ToolPageWrapper title="Image Tools" description="Convert & compress images directly in your browser" emoji="🖼️">
      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-8 border-b border-[var(--card-border)] pb-4">
        <button
          onClick={() => setTab('convert')}
          className={`px-5 py-2 rounded-md font-medium text-sm transition-colors ${
            tab === 'convert' ? 'btn-primary' : 'btn-secondary'
          }`}
        >
          🔄 Format Converter
        </button>
        <button
          onClick={() => setTab('compress')}
          className={`px-5 py-2 rounded-md font-medium text-sm transition-colors ${
            tab === 'compress' ? 'btn-primary' : 'btn-secondary'
          }`}
        >
          🗜️ Image Compressor
        </button>
      </div>

      {/* CONVERT TAB */}
      {tab === 'convert' && (
        <div className="space-y-8">
          {/* Quick Swap Preset Pills */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                Quick Swap & Convert Presets
              </span>
              <span className="text-xs text-[var(--muted-text)]">Click active button to swap direction (⇄)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_PAIRS.map((preset) => {
                const dir = presetDirections[preset.id] || {
                  from: preset.formatA,
                  fromName: preset.nameA,
                  to: preset.formatB,
                  toName: preset.nameB,
                };
                const isActive = activePresetId === preset.id && globalTargetFormat === dir.to;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                      isActive
                        ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                        : 'bg-[var(--card)] border border-[var(--card-border)] text-[var(--foreground)] hover:border-[var(--muted-text)]'
                    }`}
                    title={`Convert ${dir.fromName} ➔ ${dir.toName}. Click again to swap to ${dir.toName} ➔ ${dir.fromName}.`}
                  >
                    <span>
                      {dir.fromName} ➔ {dir.toName}
                    </span>
                    <span className="opacity-60 text-[10px]">⇄</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upload Drop Zone */}
          <div
            className="drop-zone relative group py-12"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilesAdded(e.dataTransfer.files);
            }}
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📂</div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Drop images here, or <span className="underline underline-offset-4">browse files</span>
            </p>
            <p className="text-xs text-[var(--muted-text)] mt-1.5">
              Supports JPG, PNG, WEBP, AVIF, ICO, BMP, SVG, GIF (Batch convert supported)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.svg,.ico,.bmp,.avif,.webp,.png,.jpg,.jpeg,.gif"
              multiple
              className="hidden"
              onChange={(e) => handleFilesAdded(e.target.files)}
            />
          </div>

          {/* Conversion Options Toolbar */}
          <div className="tool-card p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--card-border)] pb-4">
              {/* Target Format Selector & Swap Button */}
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--muted-text)] block">Convert All To</label>
                  <select
                    className="input-field py-1.5 text-sm font-medium w-auto cursor-pointer"
                    value={globalTargetFormat}
                    onChange={(e) => handleGlobalFormatChange(e.target.value)}
                  >
                    {SUPPORTED_FORMATS.map((fmt) => (
                      <option key={fmt.id} value={fmt.id}>
                        {fmt.name} (.{fmt.ext})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Instant Swap Button */}
                <button
                  type="button"
                  onClick={handleSwapFormats}
                  title="Swap format direction (e.g. PNG ➔ WEBP to WEBP ➔ PNG)"
                  className="mt-5 p-2 rounded-md btn-secondary text-sm flex items-center gap-1.5 hover:bg-[var(--muted)] cursor-pointer"
                >
                  <span className="text-base font-bold">⇄</span>
                  <span className="text-xs font-medium">Swap</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 mt-auto">
                {items.length > 0 && (
                  <button
                    onClick={clearAll}
                    disabled={isConvertingAll}
                    className="btn-secondary text-xs py-2 px-3 hover:text-red-500"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={convertAll}
                  disabled={items.length === 0 || isConvertingAll}
                  className="btn-primary py-2 px-5 text-sm shadow-sm"
                >
                  {isConvertingAll ? 'Converting...' : `Convert All (${items.length})`}
                </button>
                {items.some((i) => i.status === 'done') && (
                  <button onClick={downloadAll} className="btn-secondary py-2 px-4 text-sm font-medium">
                    ⬇ Download All
                  </button>
                )}
              </div>
            </div>

            {/* Fine-Tuning Controls */}
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {/* Quality Slider (for lossy formats) */}
              {currentTargetObj.lossy && (
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-text)] font-medium">Quality</span>
                    <span className="font-semibold tabular-nums">{Math.round(quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={quality}
                    onChange={(e) => setQuality(+e.target.value)}
                    className="app-slider"
                  />
                </div>
              )}

              {/* Scaling */}
              <div className="space-y-1.5">
                <span className="text-[var(--muted-text)] font-medium block">Resize Scale</span>
                <select
                  className="input-field py-1 text-xs"
                  value={scale}
                  onChange={(e) => setScale(+e.target.value)}
                >
                  <option value={1}>100% (Original Resolution)</option>
                  <option value={0.75}>75% Scale</option>
                  <option value={0.5}>50% Scale</option>
                  <option value={0.25}>25% Scale</option>
                  <option value={2}>200% (Upscale 2x)</option>
                </select>
              </div>

              {/* Background Fill */}
              <div className="space-y-1.5">
                <span className="text-[var(--muted-text)] font-medium block">Background Fill</span>
                <select
                  className="input-field py-1 text-xs"
                  value={bgFill}
                  onChange={(e) => setBgFill(e.target.value as 'transparent' | 'white' | 'black')}
                >
                  <option value="transparent">Transparent (Default)</option>
                  <option value="white">White (#FFFFFF)</option>
                  <option value="black">Black (#000000)</option>
                </select>
              </div>

              {/* ICO Size Preset */}
              {globalTargetFormat === 'ico' && (
                <div className="space-y-1.5">
                  <span className="text-[var(--muted-text)] font-medium block">Icon Dimensions</span>
                  <select
                    className="input-field py-1 text-xs"
                    value={icoSize}
                    onChange={(e) => setIcoSize(+e.target.value)}
                  >
                    {ICO_SIZES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Files List / Results */}
          {items.length > 0 ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)] px-1">
                <span>Files Queue ({items.length})</span>
                <span>Status & Download</span>
              </div>

              <div className="space-y-2.5">
                {items.map((item) => {
                  const targetObj = SUPPORTED_FORMATS.find((f) => f.id === item.targetFormat) || SUPPORTED_FORMATS[0];
                  const ext = targetObj.ext;
                  const nameWithoutExt = item.file.name.replace(/\.[^/.]+$/, '');

                  return (
                    <div
                      key={item.id}
                      className="tool-card p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      {/* Left: Thumbnail & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="w-12 h-12 rounded object-cover border border-[var(--card-border)] bg-[var(--muted)] flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--foreground)] truncate max-w-xs md:max-w-sm">
                            {item.file.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[var(--muted-text)] mt-0.5">
                            <span className="font-mono">{fmtSize(item.originalSize)}</span>
                            <span>•</span>
                            <span className="uppercase font-semibold px-1.5 py-0.5 rounded bg-[var(--muted)] text-[10px]">
                              {item.sourceFormat}
                            </span>
                            <span>➔</span>
                            <select
                              className="bg-[var(--card)] border border-[var(--card-border)] rounded px-1 py-0.5 text-xs text-[var(--foreground)] outline-none"
                              value={item.targetFormat}
                              onChange={(e) => setItemTargetFormat(item.id, e.target.value)}
                            >
                              {SUPPORTED_FORMATS.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Right: Status & Actions */}
                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        {item.status === 'done' && item.convertedSize !== undefined && (
                          <div className="text-right">
                            <span className="text-xs font-semibold font-mono block text-[var(--foreground)]">
                              {fmtSize(item.convertedSize)}
                            </span>
                            <span className="text-[10px] text-[var(--muted-text)]">
                              {item.convertedSize < item.originalSize
                                ? `Saved ${Math.round((1 - item.convertedSize / item.originalSize) * 100)}%`
                                : `${Math.round((item.convertedSize / item.originalSize) * 100)}% size`}
                            </span>
                          </div>
                        )}

                        {item.status === 'error' && (
                          <span className="text-xs text-red-400 font-medium">Failed</span>
                        )}

                        {item.status === 'converting' && (
                          <span className="text-xs text-[var(--muted-text)] animate-pulse">Converting...</span>
                        )}

                        <div className="flex items-center gap-1.5">
                          {item.status === 'done' && item.convertedUrl ? (
                            <a
                              href={item.convertedUrl}
                              download={`${nameWithoutExt}.${ext}`}
                              className="btn-primary text-xs py-1.5 px-3 font-medium"
                            >
                              ⬇ Save
                            </a>
                          ) : (
                            <button
                              onClick={async () => {
                                setItems((prev) =>
                                  prev.map((i) => (i.id === item.id ? { ...i, status: 'converting' } : i))
                                );
                                const res = await processConvertItem(item);
                                setItems((prev) => prev.map((i) => (i.id === item.id ? res : i)));
                              }}
                              disabled={item.status === 'converting'}
                              className="btn-secondary text-xs py-1.5 px-3"
                            >
                              Convert
                            </button>
                          )}

                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-xs text-[var(--muted-text)] hover:text-red-500 transition-colors rounded"
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="tool-card p-6 text-center text-[var(--muted-text)] text-xs space-y-1">
              <p className="font-medium text-[var(--foreground)] text-sm">No images queued yet</p>
              <p>Upload or drag-and-drop one or multiple images above to start converting.</p>
            </div>
          )}
        </div>
      )}

      {/* COMPRESS TAB */}
      {tab === 'compress' && (
        <div className="space-y-6">
          <div
            className="drop-zone py-12"
            onClick={() => document.getElementById('comp-input')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleCompressUpload(f);
            }}
          >
            <div className="text-4xl mb-2">🗜️</div>
            {compFile ? (
              <p className="text-sm font-medium text-[var(--foreground)]">
                {compFile.name} <span className="text-[var(--muted-text)]">({fmtSize(compOrigSize)})</span>
              </p>
            ) : (
              <p className="text-sm text-[var(--muted-text)]">Click or drop an image here to compress</p>
            )}
            <input
              id="comp-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleCompressUpload(f);
              }}
            />
          </div>

          {compFile && (
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--muted-text)] font-medium">Compression Quality</span>
                    <span className="font-semibold tabular-nums">{Math.round(compQuality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={compQuality}
                    onChange={(e) => setCompQuality(+e.target.value)}
                    className="app-slider"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--muted-text)] font-medium">Max Width Resolution</span>
                    <span className="font-semibold tabular-nums">{compMaxWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={640}
                    max={4096}
                    step={320}
                    value={compMaxWidth}
                    onChange={(e) => setCompMaxWidth(+e.target.value)}
                    className="app-slider"
                  />
                </div>
                <button
                  className="btn-primary w-full py-2.5"
                  onClick={compress}
                  disabled={compressing}
                >
                  {compressing ? 'Compressing...' : 'Compress Image'}
                </button>

                {compResultUrl && (
                  <div className="tool-card p-4 space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--muted-text)]">Original Size</span>
                      <span className="font-medium">{fmtSize(compOrigSize)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--muted-text)]">Compressed Size</span>
                      <span className="font-medium">{fmtSize(compResultSize)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-[var(--card-border)] pt-2">
                      <span className="text-[var(--muted-text)]">Saved Space</span>
                      <span className="font-semibold text-[var(--foreground)]">
                        {Math.round((1 - compResultSize / compOrigSize) * 100)}%
                      </span>
                    </div>
                    <a
                      href={compResultUrl}
                      download={`compressed_${compFile.name}`}
                      className="btn-secondary w-full text-center block text-sm"
                    >
                      ⬇ Download Compressed Image
                    </a>
                  </div>
                )}
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              {compPreview && (
                <div className="space-y-2">
                  <span className="text-xs text-[var(--muted-text)] font-medium block">Preview</span>
                  <img
                    src={compPreview}
                    alt="Preview"
                    className="rounded-lg object-contain max-h-64 w-full border border-[var(--card-border)] bg-[var(--card)]"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ToolPageWrapper>
  );
}
