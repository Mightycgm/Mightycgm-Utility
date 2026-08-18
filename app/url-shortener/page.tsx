'use client';
import { useState, useEffect } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

interface ShortHistoryItem {
  id: string;
  originalUrl: string;
  shortUrl: string;
  provider: string;
  createdAt: string;
}

export default function UrlShortenerPage() {
  const [url, setUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [providerUsed, setProviderUsed] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<ShortHistoryItem[]>([]);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('shortener_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        setTimeout(() => setHistory(parsed), 0);
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveToHistory = (originalUrl: string, short: string, provider: string) => {
    const newItem: ShortHistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      originalUrl,
      shortUrl: short,
      provider,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updated = [newItem, ...history.slice(0, 9)];
    setHistory(updated);
    try {
      localStorage.setItem('shortener_history', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('shortener_history');
    } catch {
      // Ignore
    }
  };

  const shortenUrl = async () => {
    if (!url.trim()) return;

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    setLoading(true);
    setError('');
    setShortUrl('');
    setCopied(false);
    setProviderUsed('');

    let resultShortUrl = '';
    let resultProvider = '';

    // 1. Try CleanURI (fast JSON POST API)
    try {
      const res = await fetch('https://cleanuri.com/api/v1/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ url: targetUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result_url) {
          resultShortUrl = data.result_url;
          resultProvider = 'CleanURI';
        }
      }
    } catch (e) {
      console.warn('CleanURI attempt failed:', e);
    }

    // 2. Try Ulvis (GET API)
    if (!resultShortUrl) {
      try {
        const res = await fetch(`https://ulvis.net/api.php?url=${encodeURIComponent(targetUrl)}`);
        if (res.ok) {
          const text = (await res.text()).trim();
          if (text.startsWith('http')) {
            resultShortUrl = text;
            resultProvider = 'Ulvis';
          }
        }
      } catch (e) {
        console.warn('Ulvis attempt failed:', e);
      }
    }

    // 3. Try TinyURL (via direct & CORS proxy fallback)
    if (!resultShortUrl) {
      try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(targetUrl)}`);
        if (res.ok) {
          const text = (await res.text()).trim();
          if (text.startsWith('http')) {
            resultShortUrl = text;
            resultProvider = 'TinyURL';
          }
        }
      } catch (e) {
        console.warn('TinyURL attempt failed:', e);
      }
    }

    // 4. Try is.gd with AllOrigins Proxy fallback
    if (!resultShortUrl) {
      try {
        const isGd = `https://is.gd/create.php?format=json&url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(isGd)}`);
        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.contents);
          if (parsed.shorturl) {
            resultShortUrl = parsed.shorturl;
            resultProvider = 'is.gd';
          }
        }
      } catch (e) {
        console.warn('is.gd proxy attempt failed:', e);
      }
    }

    if (resultShortUrl) {
      setShortUrl(resultShortUrl);
      setProviderUsed(resultProvider);
      saveToHistory(targetUrl, resultShortUrl, resultProvider);
    } else {
      setError('Could not shorten this URL. Please verify the link or try again later.');
    }

    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateQR = async (link: string) => {
    setQrModalUrl(link);
    try {
      const { default: QRCode } = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(link, {
        width: 320,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      setQrCodeDataUrl(dataUrl);
    } catch (e) {
      console.error('Failed to generate QR code', e);
    }
  };

  return (
    <ToolPageWrapper
      title="URL Shortener"
      description="Create clean, fast, and shareable short links instantly without signup"
      emoji="🔗"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Main Card */}
        <div className="tool-card p-6 md:p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[var(--foreground)] block">
              Enter Long URL
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                placeholder="https://example.com/very/long/url/path..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') shortenUrl();
                }}
                className="input-field flex-1 text-base py-3 px-4"
              />
              <button
                onClick={shortenUrl}
                disabled={!url.trim() || loading}
                className="btn-primary py-3 px-7 whitespace-nowrap min-w-[130px] flex justify-center items-center text-sm font-medium"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  '⚡ Shorten Link'
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Short URL Result Card */}
          {shortUrl && (
            <div className="p-6 rounded-lg bg-[var(--muted)] border border-[var(--card-border)] space-y-4">
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                <span>Shortened URL ({providerUsed})</span>
                <span>Ready to share</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-lg md:text-xl font-bold font-mono text-[var(--foreground)] hover:underline break-all text-center sm:text-left flex-1"
                >
                  {shortUrl}
                </a>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                  <button
                    onClick={() => copyToClipboard(shortUrl)}
                    className="btn-primary text-xs py-2 px-4"
                  >
                    {copied ? '✅ Copied!' : '📋 Copy'}
                  </button>
                  <button
                    onClick={() => generateQR(shortUrl)}
                    className="btn-secondary text-xs py-2 px-3"
                    title="View QR Code"
                  >
                    📷 QR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent History */}
        {history.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
              <span>Recently Shortened ({history.length})</span>
              <button
                onClick={clearHistory}
                className="hover:text-red-400 transition-colors text-[11px]"
              >
                Clear History
              </button>
            </div>
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="tool-card p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={item.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono font-semibold text-sm text-[var(--foreground)] hover:underline block truncate"
                    >
                      {item.shortUrl}
                    </a>
                    <p className="text-[var(--muted-text)] truncate mt-0.5 max-w-md">
                      {item.originalUrl}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-[10px] text-[var(--muted-text)] bg-[var(--muted)] px-2 py-0.5 rounded">
                      {item.provider} • {item.createdAt}
                    </span>
                    <button
                      onClick={() => copyToClipboard(item.shortUrl)}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => generateQR(item.shortUrl)}
                      className="btn-secondary text-xs py-1 px-2"
                      title="Show QR"
                    >
                      QR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {qrModalUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setQrModalUrl(null)}
          >
            <div
              className="tool-card max-w-sm w-full p-6 text-center space-y-4 bg-[var(--card)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-base text-[var(--foreground)]">QR Code for Short URL</h3>
              {qrCodeDataUrl ? (
                <div className="bg-white p-4 rounded-lg inline-block mx-auto border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeDataUrl} alt="QR Code" className="w-56 h-56 mx-auto" />
                </div>
              ) : (
                <div className="w-56 h-56 flex items-center justify-center mx-auto text-xs text-[var(--muted-text)]">
                  Generating QR...
                </div>
              )}
              <p className="font-mono text-xs text-[var(--muted-text)] break-all">{qrModalUrl}</p>
              <div className="flex gap-2 justify-center">
                {qrCodeDataUrl && (
                  <a
                    href={qrCodeDataUrl}
                    download="qrcode.png"
                    className="btn-primary text-xs py-2 px-4"
                  >
                    ⬇ Download PNG
                  </a>
                )}
                <button
                  onClick={() => setQrModalUrl(null)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolPageWrapper>
  );
}
