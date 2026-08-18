'use client';
import { useState, useRef, useCallback } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';



type Tab = 'decode' | 'generate';

export default function QRPage() {
  const [tab, setTab] = useState<Tab>('generate');
  // Generate state
  const [genText, setGenText] = useState('');
  const [genSize, setGenSize] = useState(256);
  const [genQR, setGenQR] = useState('');
  // Decode state
  const [decResult, setDecResult] = useState('');
  const [decError, setDecError] = useState('');
  const [decDragging, setDecDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const generateQR = async () => {
    if (!genText.trim()) return;
    try {
      const { default: QRCode } = await import('qrcode');
      const url = await QRCode.toDataURL(genText, { width: genSize, margin: 2, color: { dark: '#ffffff', light: '#111827' } });
      setGenQR(url);
    } catch (e) { console.error(e); }
  };

  const decodeFile = useCallback((file: File) => {
    setDecResult(''); setDecError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        const { default: jsQR } = await import('jsqr');
          const code = jsQR(data.data, data.width, data.height);
        if (code) setDecResult(code.data);
        else setDecError('No QR code found in the image.');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDecDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) decodeFile(file);
  };

  return (
    <ToolPageWrapper title="QR Code Suite" description="Generate & decode QR codes instantly" emoji="??">
      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {(['generate', 'decode'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md font-medium text-sm capitalize transition-all ${
              tab === t ? 'btn-primary' : 'btn-secondary'
            }`}>{t}</button>
        ))}
      </div>

      {tab === 'generate' && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-[var(--muted-text)] mb-2 block">Text or URL</label>
              <textarea
                className="textarea-field"
                placeholder="Enter text, URL, email, phone..."
                rows={5}
                value={genText}
                onChange={e => setGenText(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-[var(--muted-text)] mb-2 block">Size: {genSize}px</label>
              <input type="range" min={128} max={512} step={64} value={genSize}
                onChange={e => setGenSize(+e.target.value)}
                className="w-full accent-[var(--accent)]" />
            </div>
            <button className="btn-primary w-full py-3" onClick={generateQR}>Generate QR Code</button>
          </div>
          <div className="flex flex-col items-center justify-center">
            {genQR ? (
              <div className="space-y-4 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={genQR} alt="QR Code" className="rounded-xl mx-auto" style={{ width: Math.min(genSize, 280), height: Math.min(genSize, 280) }} />
                <a href={genQR} download="qrcode.png" className="btn-secondary inline-block px-6">? Download PNG</a>
              </div>
            ) : (
              <div className="w-full h-64 border-2 border-dashed border-[var(--card-border)] rounded-xl flex items-center justify-center text-[var(--muted-text)]">
                QR preview will appear here
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'decode' && (
        <div className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              decDragging ? 'border-indigo-500 bg-indigo-900/20' : 'border-[var(--card-border)] hover:border-[var(--muted-text)]'
            }`}
            onDragOver={e => { e.preventDefault(); setDecDragging(true); }}
            onDragLeave={() => setDecDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-5xl mb-3">??</div>
            <p className="text-[var(--muted-text)] font-medium">Drop QR image here or click to upload</p>
            <p className="text-[var(--muted-text)] text-sm mt-1">PNG, JPG, WebP supported</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) decodeFile(f); }} />
          </div>
          {decResult && (
            <div className="tool-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-green-400">? Decoded Successfully</h3>
                <button className="btn-secondary text-xs px-3 py-1" onClick={() => navigator.clipboard.writeText(decResult)}>Copy</button>
              </div>
              <p className="text-sm font-mono bg-gray-800 p-3 rounded-lg break-all text-[var(--foreground)]">{decResult}</p>
              {decResult.startsWith('http') && (
                <a href={decResult} target="_blank" rel="noopener noreferrer" className="text-[var(--foreground)] text-sm hover:underline">?? Open Link ?</a>
              )}
            </div>
          )}
          {decError && <p className="text-red-400 text-sm text-center">{decError}</p>}
        </div>
      )}
    </ToolPageWrapper>
  );
}


