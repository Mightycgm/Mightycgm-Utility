'use client';
import { useState, useCallback } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';


type Tab = 'compress' | 'convert';

export default function ImageToolsPage() {
  const [tab, setTab] = useState<Tab>('compress');
  // Compress
  const [origFile, setOrigFile] = useState<File | null>(null);
  const [origPreview, setOrigPreview] = useState('');
  const [compressedUrl, setCompressedUrl] = useState('');
  const [origSize, setOrigSize] = useState(0);
  const [compSize, setCompSize] = useState(0);
  const [quality, setQuality] = useState(0.8);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [compressing, setCompressing] = useState(false);
  // Convert
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [convertPreview, setConvertPreview] = useState('');
  const [targetFormat, setTargetFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/webp');
  const [convertedUrl, setConvertedUrl] = useState('');

  const handleCompressUpload = (file: File) => {
    setOrigFile(file); setCompressedUrl('');
    setOrigSize(file.size);
    const reader = new FileReader();
    reader.onload = e => setOrigPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const compress = async () => {
    if (!origFile) return;
    setCompressing(true);
    try {
      const { default: imageCompression } = await import('browser-image-compression');
      const compressed = await imageCompression(origFile, {
        maxSizeMB: 10,
        maxWidthOrHeight: maxWidth,
        useWebWorker: true,
        initialQuality: quality,
      });
      setCompSize(compressed.size);
      const url = URL.createObjectURL(compressed);
      setCompressedUrl(url);
    } catch (e) { console.error(e); }
    setCompressing(false);
  };

  const handleConvertUpload = (file: File) => {
    setConvertFile(file); setConvertedUrl('');
    const reader = new FileReader();
    reader.onload = e => setConvertPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const convert = () => {
    if (!convertPreview) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (blob) setConvertedUrl(URL.createObjectURL(blob));
      }, targetFormat, 0.92);
    };
    img.src = convertPreview;
  };

  const fmtSize = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`;

  return (
    <ToolPageWrapper title="Image Tools" description="Compress & convert images in your browser" emoji="???">
      <div className="flex gap-2 mb-8">
        {(['compress', 'convert'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-medium text-sm capitalize ${ tab === t ? 'btn-primary' : 'btn-secondary' }`}>{t}</button>
        ))}
      </div>

      {tab === 'compress' && (
        <div className="space-y-6">
          <div
            className="border-2 border-dashed border-gray-700 rounded-2xl p-10 text-center cursor-pointer hover:border-gray-600 transition-all"
            onClick={() => document.getElementById('comp-input')?.click()}
          >
            <div className="text-4xl mb-2">???</div>
            {origFile ? <p className="text-gray-300">{origFile.name} ({fmtSize(origSize)})</p> : <p className="text-gray-500">Click or drop image to compress</p>}
            <input id="comp-input" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleCompressUpload(f); }} />
          </div>
          {origFile && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--muted-text)] font-medium">Quality</span>
                    <span className="font-semibold tabular-nums">{Math.round(quality * 100)}%</span>
                  </div>
                  <input type="range" min={0.1} max={1} step={0.05} value={quality} onChange={e => setQuality(+e.target.value)} className="app-slider" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--muted-text)] font-medium">Max Width</span>
                    <span className="font-semibold tabular-nums">{maxWidth}px</span>
                  </div>
                  <input type="range" min={640} max={4096} step={320} value={maxWidth} onChange={e => setMaxWidth(+e.target.value)} className="app-slider" />
                </div>
                <button className="btn-primary w-full py-3" onClick={compress} disabled={compressing}>
                  {compressing ? 'Compressing...' : 'Compress Image'}
                </button>
                {compressedUrl && (
                  <div className="tool-card p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Original:</span><span className="text-red-400">{fmtSize(origSize)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Compressed:</span><span className="text-green-400">{fmtSize(compSize)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-400">Saved:</span>
                      <span className="text-indigo-400">{Math.round((1 - compSize / origSize) * 100)}%</span>
                    </div>
                    <a href={compressedUrl} download="compressed.jpg" className="btn-primary w-full text-center block mt-2 text-sm">? Download</a>
                  </div>
                )}
              </div>
              {origPreview && <img src={origPreview} alt="Preview" className="rounded-xl object-contain max-h-64 w-full" />}
            </div>
          )}
        </div>
      )}

      {tab === 'convert' && (
        <div className="space-y-6">
          <div
            className="border-2 border-dashed border-gray-700 rounded-2xl p-10 text-center cursor-pointer hover:border-gray-600"
            onClick={() => document.getElementById('conv-input')?.click()}
          >
            <div className="text-4xl mb-2">??</div>
            {convertFile ? <p className="text-gray-300">{convertFile.name}</p> : <p className="text-gray-500">Click to upload image to convert</p>}
            <input id="conv-input" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleConvertUpload(f); }} />
          </div>
          {convertFile && (
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Target Format</label>
                <select className="input-field w-auto" value={targetFormat} onChange={e => setTargetFormat(e.target.value as typeof targetFormat)}>
                  <option value="image/webp">WebP</option>
                  <option value="image/png">PNG</option>
                  <option value="image/jpeg">JPEG</option>
                </select>
              </div>
              <button className="btn-primary px-8" onClick={convert}>Convert</button>
              {convertedUrl && (
                <a href={convertedUrl} download={`converted.${targetFormat.split('/')[1]}`} className="btn-secondary px-8">? Download</a>
              )}
            </div>
          )}
          {convertPreview && <img src={convertPreview} alt="Preview" className="rounded-xl max-h-64 object-contain" />}
        </div>
      )}
    </ToolPageWrapper>
  );
}
