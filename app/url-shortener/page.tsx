'use client';
import { useState, useEffect } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

interface ShortHistoryItem {
  id: string;
  originalUrl: string;
  shortUrl: string;
  mode: string;
  createdAt: string;
}

// Encode long URL to URL-safe base64 string
function encodeUrl(url: string): string {
  try {
    return btoa(encodeURIComponent(url))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return encodeURIComponent(url);
  }
}

// Decode URL-safe base64 string back to URL
function decodeUrl(encoded: string): string {
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    return decodeURIComponent(atob(base64));
  } catch {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return '';
    }
  }
}

export default function UrlShortenerPage() {
  const [url, setUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [shortMode, setShortMode] = useState<'self' | 'cloud'>('self');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<ShortHistoryItem[]>([]);
  const [qrModalUrl, setQrModalUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Redirect State
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(2);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Check URL parameters for redirect on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toParam = params.get('to') || params.get('go') || params.get('url') || params.get('r');
    const idParam = params.get('id');

    if (toParam) {
      const target = decodeUrl(toParam);
      if (target && /^https?:\/\//i.test(target)) {
        setTimeout(() => {
          setRedirectTarget(target);
          setIsRedirecting(true);
        }, 0);
      }
    } else if (idParam) {
      // Fetch from JSONBin
      const fetchBin = async () => {
        try {
          const res = await fetch(`https://api.jsonbin.io/v3/b/${idParam}/latest`, {
            headers: {
              'X-Access-Key': '$2a$10$w4r0lC1o541Qe97VwR5JCOx9kP0rB72f1i0J3n0yG4r4mG8mG8mGy',
            },
          });
          if (res.ok) {
            const json = await res.json();
            const destination = json.record?.url || json.record?.destination;
            if (destination && /^https?:\/\//i.test(destination)) {
              setRedirectTarget(destination);
              setIsRedirecting(true);
            }
          }
        } catch (err) {
          console.error('Failed to load short link record', err);
        }
      };
      setTimeout(() => {
        fetchBin();
      }, 0);
    }
  }, []);

  // Countdown timer for automatic redirect
  useEffect(() => {
    if (!isRedirecting || !redirectTarget) return;

    if (countdown <= 0) {
      window.location.replace(redirectTarget);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isRedirecting, redirectTarget, countdown]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('self_shortener_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        setTimeout(() => setHistory(parsed), 0);
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveToHistory = (originalUrl: string, short: string, mode: string) => {
    const newItem: ShortHistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      originalUrl,
      shortUrl: short,
      mode,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const updated = [newItem, ...history.slice(0, 19)];
    setHistory(updated);
    try {
      localStorage.setItem('self_shortener_history', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('self_shortener_history');
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

    try {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const baseUrl = `${origin}${pathname}`;

      if (shortMode === 'self') {
        // 100% Self-Hosted URL (Zero external service dependency)
        const encoded = encodeUrl(targetUrl);
        let finalUrl = `${baseUrl}?to=${encoded}`;
        if (alias.trim()) {
          finalUrl += `&alias=${encodeURIComponent(alias.trim())}`;
        }
        setShortUrl(finalUrl);
        saveToHistory(targetUrl, finalUrl, 'Self-Hosted (Local)');
      } else {
        // Cloud ID Mode (Self-hosted redirect via JSONBin record)
        const binPayload = {
          url: targetUrl,
          alias: alias.trim() || undefined,
          created: new Date().toISOString(),
        };

        const res = await fetch('https://api.jsonbin.io/v3/b', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': '$2a$10$w4r0lC1o541Qe97VwR5JCOx9kP0rB72f1i0J3n0yG4r4mG8mG8mGy',
            'X-Bin-Private': 'false',
          },
          body: JSON.stringify(binPayload),
        });

        if (res.ok) {
          const json = await res.json();
          const binId = json.metadata.id;
          const finalUrl = `${baseUrl}?id=${binId}`;
          setShortUrl(finalUrl);
          saveToHistory(targetUrl, finalUrl, 'Cloud Short ID');
        } else {
          // Fallback to Self-Hosted
          const encoded = encodeUrl(targetUrl);
          const finalUrl = `${baseUrl}?to=${encoded}`;
          setShortUrl(finalUrl);
          saveToHistory(targetUrl, finalUrl, 'Self-Hosted');
        }
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to generate link. Please check your URL.');
    } finally {
      setLoading(false);
    }
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

  // REDIRECT INTERFACE SCREEN (when someone visits a shortened link)
  if (redirectTarget) {
    return (
      <ToolPageWrapper title="Redirecting..." description="Self-Hosted Link Gateway" emoji="🔗">
        <div className="max-w-xl mx-auto py-12">
          <div className="tool-card p-8 text-center space-y-6">
            <div className="w-14 h-14 bg-[var(--muted)] border border-[var(--card-border)] rounded-full flex items-center justify-center text-2xl mx-auto animate-pulse">
              🚀
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[var(--foreground)]">
                Redirecting you to external link
              </h2>
              <p className="text-xs text-[var(--muted-text)]">
                This link was created and hosted on UtilityHub
              </p>
            </div>

            <div className="p-4 bg-[var(--muted)] border border-[var(--card-border)] rounded-lg text-left space-y-1">
              <span className="text-[10px] uppercase font-semibold text-[var(--muted-text)] block tracking-wider">
                Destination URL
              </span>
              <a
                href={redirectTarget}
                className="font-mono text-sm font-medium text-[var(--foreground)] hover:underline break-all block"
              >
                {redirectTarget}
              </a>
            </div>

            {/* Countdown progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[var(--muted-text)]">
                <span>Redirecting in {countdown}s...</span>
                <span>{Math.round(((2 - countdown) / 2) * 100)}%</span>
              </div>
              <div className="w-full bg-[var(--card-border)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[var(--foreground)] h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${((2 - countdown) / 2) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-center pt-2">
              <a
                href={redirectTarget}
                className="btn-primary py-2.5 px-6 text-sm font-medium flex items-center gap-2"
              >
                <span>🚀 Go Immediately</span>
              </a>
              <button
                onClick={() => {
                  setIsRedirecting(false);
                  setRedirectTarget(null);
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                className="btn-secondary py-2.5 px-4 text-xs"
              >
                Cancel & Stay on Site
              </button>
            </div>
          </div>
        </div>
      </ToolPageWrapper>
    );
  }

  return (
    <ToolPageWrapper
      title="URL Shortener"
      description="Create self-hosted short links directly on your own website — 100% independent with zero external service reliance"
      emoji="🔗"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Main Shortener Card */}
        <div className="tool-card p-6 md:p-8 space-y-6">
          {/* Mode Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--card-border)] pb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Self-Hosted Shortener Engine</h3>
              <p className="text-xs text-[var(--muted-text)] mt-0.5">
                Generates redirect links using your own domain name
              </p>
            </div>
            <div className="flex gap-1.5 bg-[var(--muted)] p-1 rounded-md border border-[var(--card-border)] text-xs">
              <button
                type="button"
                onClick={() => setShortMode('self')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  shortMode === 'self'
                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                    : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                }`}
              >
                ⚡ 100% Local (Never Expires)
              </button>
              <button
                type="button"
                onClick={() => setShortMode('cloud')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  shortMode === 'cloud'
                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                    : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                }`}
              >
                ☁️ Short ID Link
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)] block">
                Destination URL
              </label>
              <input
                type="url"
                placeholder="https://example.com/any/long/path/to/share"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') shortenUrl();
                }}
                className="input-field py-3 px-4 text-sm"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--muted-text)] block">
                  Custom Label / Alias (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. project-docs"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  className="input-field py-2 px-3 text-xs"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={shortenUrl}
                  disabled={!url.trim() || loading}
                  className="btn-primary w-full py-2.5 px-6 text-sm font-medium flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    '⚡ Generate Own Short Link'
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Generated Result */}
          {shortUrl && (
            <div className="p-5 rounded-lg bg-[var(--muted)] border border-[var(--card-border)] space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
                <span>Your Website Link</span>
                <span className="text-green-500">✅ Ready to share</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  readOnly
                  value={shortUrl}
                  className="input-field py-2 px-3 font-mono text-xs text-[var(--foreground)] bg-[var(--card)] flex-1"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
                  <a
                    href={shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-xs py-2 px-3"
                    title="Test Link"
                  >
                    ↗ Test
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent History */}
        {history.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
              <span>My Created Links ({history.length})</span>
              <button onClick={clearHistory} className="hover:text-red-400 transition-colors text-[11px]">
                Clear All
              </button>
            </div>
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="tool-card p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-semibold text-xs text-[var(--foreground)] truncate">
                      {item.shortUrl}
                    </p>
                    <p className="text-[var(--muted-text)] text-[11px] truncate mt-0.5 max-w-md">
                      ➔ {item.originalUrl}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-[10px] text-[var(--muted-text)] bg-[var(--muted)] px-2 py-0.5 rounded">
                      {item.mode} • {item.createdAt}
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
                    <a
                      href={item.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary text-xs py-1 px-2"
                      title="Open"
                    >
                      ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QR Modal */}
        {qrModalUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setQrModalUrl(null)}
          >
            <div
              className="tool-card max-w-sm w-full p-6 text-center space-y-4 bg-[var(--card)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-base text-[var(--foreground)]">QR Code for Link</h3>
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
                    download="short-link-qr.png"
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
