'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

type Tab = 'generate' | 'decode';

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
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const generateQR = async () => {
    if (!genText.trim()) return;
    try {
      const { default: QRCode } = await import('qrcode');
      const url = await QRCode.toDataURL(genText, {
        width: genSize,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      setGenQR(url);
    } catch (e) {
      console.error(e);
    }
  };

  const decodeFile = useCallback((file: File) => {
    setDecResult('');
    setDecError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        const { default: jsQR } = await import('jsqr');
        const code = jsQR(data.data, data.width, data.height);
        if (code) {
          setDecResult(code.data);
          setTab('decode');
        } else {
          setDecError('No QR code found in the image.');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDecDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) decodeFile(file);
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
              decodeFile(file);
              setTab('decode');
              break;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [decodeFile]);

  return (
    <ToolPageWrapper title="QR Code Suite" description="Generate & decode QR codes instantly" emoji="📷">
      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-[var(--card-border)] pb-4">
        {(['generate', 'decode'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md font-medium text-sm capitalize transition-all ${
              tab === t ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            {t === 'generate' ? '⚡ Generate QR' : '🔍 Scan / Decode'}
          </button>
        ))}
      </div>

      {tab === 'generate' && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-[var(--muted-text)] mb-2 block">
                Text or URL Content
              </label>
              <textarea
                className="textarea-field"
                placeholder="Enter website URL, text, WiFi, email, phone number..."
                rows={5}
                value={genText}
                onChange={(e) => setGenText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted-text)] font-medium">QR Dimension</span>
                <span className="font-semibold tabular-nums">{genSize}px</span>
              </div>
              <input
                type="range"
                min={128}
                max={512}
                step={64}
                value={genSize}
                onChange={(e) => setGenSize(+e.target.value)}
                className="app-slider"
              />
            </div>
            <button className="btn-primary w-full py-3" onClick={generateQR}>
              Generate QR Code
            </button>
          </div>
          <div className="flex flex-col items-center justify-center">
            {genQR ? (
              <div className="space-y-4 text-center">
                <div className="bg-white p-4 rounded-xl inline-block border border-[var(--card-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={genQR}
                    alt="QR Code"
                    className="mx-auto"
                    style={{ width: Math.min(genSize, 280), height: Math.min(genSize, 280) }}
                  />
                </div>
                <div>
                  <a href={genQR} download="qrcode.png" className="btn-secondary inline-block px-6">
                    ⬇ Download PNG
                  </a>
                </div>
              </div>
            ) : (
              <div className="w-full h-64 border-2 border-dashed border-[var(--card-border)] rounded-xl flex items-center justify-center text-[var(--muted-text)] text-sm">
                QR preview will appear here
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'decode' && (
        <div className="space-y-6 max-w-2xl mx-auto">
          <div
            className={`drop-zone py-12 transition-all ${
              decDragging ? 'border-[var(--foreground)] bg-[var(--muted)]' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDecDragging(true);
            }}
            onDragLeave={() => setDecDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-4xl mb-3">📷</div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Drop QR image here, <span className="underline underline-offset-4">browse file</span>, or press{' '}
              <kbd className="px-2 py-0.5 rounded bg-[var(--muted)] border border-[var(--card-border)] text-xs font-mono">
                Ctrl + V
              </kbd>{' '}
              to paste
            </p>
            <p className="text-xs text-[var(--muted-text)] mt-1.5">PNG, JPG, WebP supported</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) decodeFile(f);
              }}
            />
          </div>

          {decResult && (
            <div className="tool-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-green-500">✅ Decoded Successfully</h3>
                <button
                  className="btn-primary text-xs px-3 py-1.5"
                  onClick={() => {
                    navigator.clipboard.writeText(decResult);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? 'Copied!' : 'Copy Text'}
                </button>
              </div>
              <p className="text-sm font-mono bg-[var(--muted)] p-3.5 rounded-lg break-all text-[var(--foreground)] border border-[var(--card-border)]">
                {decResult}
              </p>
              {decResult.startsWith('http') && (
                <a
                  href={decResult}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--foreground)] hover:underline inline-flex items-center gap-1 font-medium"
                >
                  🔗 Open Link in New Tab ➔
                </a>
              )}
            </div>
          )}

          {decError && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {decError}
            </div>
          )}
        </div>
      )}
    </ToolPageWrapper>
  );
}
