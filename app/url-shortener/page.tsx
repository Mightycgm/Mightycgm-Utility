'use client';
import { useState } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

export default function UrlShortenerPage() {
  const [url, setUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const shortenUrl = async () => {
    if (!url) return;
    
    // Basic validation
    let validUrl = url;
    if (!/^https?:\/\//i.test(validUrl)) {
      validUrl = 'https://' + validUrl;
    }

    setLoading(true);
    setError('');
    setShortUrl('');
    setCopied(false);

    try {
      // 1. Try is.gd API via CORS proxy
      const isGdUrl = `https://is.gd/create.php?format=json&url=${encodeURIComponent(validUrl)}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(isGdUrl)}`;
      
      const res = await fetch(proxyUrl);
      const data = await res.json();
      const parsed = JSON.parse(data.contents);
      
      if (parsed.shorturl) {
        setShortUrl(parsed.shorturl);
      } else {
        throw new Error(parsed.errormessage || 'is.gd failed');
      }
    } catch (err1) {
      console.warn('is.gd failed, trying tinyurl...', err1);
      
      try {
        // 2. Fallback to TinyURL via CORS proxy
        const tinyUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(validUrl)}`;
        const proxyUrl2 = `https://api.allorigins.win/get?url=${encodeURIComponent(tinyUrl)}`;
        
        const res2 = await fetch(proxyUrl2);
        const data2 = await res2.json();
        
        if (data2.contents && data2.contents.startsWith('http')) {
          setShortUrl(data2.contents);
        } else {
          throw new Error('TinyURL failed');
        }
      } catch (err2) {
        console.error('All shorten APIs failed:', err2);
        setError('Failed to shorten URL. Please check the URL or try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (shortUrl) {
      navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ToolPageWrapper 
      title="URL Shortener" 
      description="Create short, shareable links instantly. No signup required." 
      emoji="🔗"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        
        <div className="tool-card p-6 md:p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[var(--foreground)]">Enter a long URL</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                placeholder="https://example.com/very/long/path/to/page"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') shortenUrl(); }}
                className="input-field flex-1 text-base py-3 px-4"
              />
              <button
                onClick={shortenUrl}
                disabled={!url || loading}
                className="btn-primary py-3 px-6 whitespace-nowrap min-w-[120px] flex justify-center items-center"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  'Shorten'
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {shortUrl && (
            <div className="p-6 rounded-xl bg-[var(--muted)] border border-[var(--card-border)] space-y-4 animate-fadeIn">
              <h3 className="text-sm font-semibold text-[var(--muted-text)] uppercase tracking-wider text-center">Your Short URL</h3>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <a 
                  href={shortUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xl md:text-2xl font-bold text-[var(--foreground)] hover:underline break-all text-center flex-1"
                >
                  {shortUrl}
                </a>
                <button
                  onClick={copyToClipboard}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all w-full sm:w-auto ${
                    copied 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                      : 'btn-secondary'
                  }`}
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-[var(--muted-text)]">
          By using this tool, you agree to the terms of service of the third-party URL shortening providers (is.gd / TinyURL).
        </div>
      </div>
    </ToolPageWrapper>
  );
}
