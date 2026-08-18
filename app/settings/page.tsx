'use client';
import { useState, useEffect } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [withoutBgKey, setWithoutBgKey] = useState('');
  const [withoutBgEndpoint, setWithoutBgEndpoint] = useState('');
  const [saved, setSaved] = useState(false);
  const [withoutBgSaved, setWithoutBgSaved] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setApiKey(localStorage.getItem('jsonbin_api_key') || '');
      setWithoutBgKey(localStorage.getItem('withoutbg_api_key') || '');
      setWithoutBgEndpoint(localStorage.getItem('withoutbg_endpoint') || '');
    }, 0);
  }, []);

  const saveJsonBin = () => {
    localStorage.setItem('jsonbin_api_key', apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearJsonBin = () => {
    localStorage.removeItem('jsonbin_api_key');
    setApiKey('');
  };

  const saveWithoutBg = () => {
    localStorage.setItem('withoutbg_api_key', withoutBgKey.trim());
    localStorage.setItem('withoutbg_endpoint', withoutBgEndpoint.trim());
    setWithoutBgSaved(true);
    setTimeout(() => setWithoutBgSaved(false), 2000);
  };

  const clearWithoutBg = () => {
    localStorage.removeItem('withoutbg_api_key');
    localStorage.removeItem('withoutbg_endpoint');
    setWithoutBgKey('');
    setWithoutBgEndpoint('');
  };

  return (
    <ToolPageWrapper title="Settings" description="Configure API keys and preferences" emoji="⚙️">
      <div className="max-w-2xl space-y-8">
        {/* withoutBG Integration */}
        <div className="tool-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✂️</span>
            <div>
              <h2 className="font-semibold text-white">withoutBG Configuration (Optional)</h2>
              <p className="text-sm text-[var(--muted-text)]">
                Connect to withoutBG Cloud API or your own self-hosted inference server
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-[var(--muted-text)] block">withoutBG API Key (Optional)</label>
              <input
                className="input-field font-mono text-sm"
                type="password"
                value={withoutBgKey}
                onChange={(e) => setWithoutBgKey(e.target.value)}
                placeholder="sk_withoutbg_..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-[var(--muted-text)] block">
                Custom Inference Endpoint (Optional)
              </label>
              <input
                className="input-field font-mono text-sm"
                type="text"
                value={withoutBgEndpoint}
                onChange={(e) => setWithoutBgEndpoint(e.target.value)}
                placeholder="http://localhost:8000/v1/removebg or https://your-server.hf.space"
              />
              <p className="text-xs text-[var(--muted-text)]">
                Leave blank to use official withoutBG Cloud API or default In-Browser Open Weights.
              </p>
            </div>

            <div className="flex gap-3">
              <button className="btn-primary px-6" onClick={saveWithoutBg}>
                {withoutBgSaved ? '✓ Saved!' : 'Save withoutBG Config'}
              </button>
              {(withoutBgKey || withoutBgEndpoint) && (
                <button
                  className="btn-secondary px-6 text-red-400 hover:text-red-300"
                  onClick={clearWithoutBg}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* JSONBin API Key */}
        <div className="tool-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔑</span>
            <div>
              <h2 className="font-semibold text-white">JSONBin.io API Key (Optional)</h2>
              <p className="text-sm text-[var(--muted-text)]">Used for custom Text Share and Log Share storage</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-[var(--muted-text)] block">API Key (Master Key)</label>
            <input
              className="input-field font-mono text-sm"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="$2b$10$..."
            />
            <div className="flex gap-3">
              <button className="btn-primary px-6" onClick={saveJsonBin}>
                {saved ? '✓ Saved!' : 'Save Key'}
              </button>
              {apiKey && (
                <button
                  className="btn-secondary px-6 text-red-400 hover:text-red-300"
                  onClick={clearJsonBin}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="tool-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <h2 className="font-semibold text-white">Privacy & On-Device Processing</h2>
          </div>
          <div className="space-y-2 text-sm text-[var(--muted-text)]">
            {[
              ['Background Remover', 'Runs on withoutBG Open-Weights (In-Browser) or via your withoutBG server.'],
              ['URL Shortener', '100% Self-Hosted & Local Redirect Gateway on your domain.'],
              ['PDF Tools', 'All PDF processing is client-side. Files never leave your device.'],
              ['QR Code', 'Generated and decoded locally. No server involved.'],
              ['Color Picker', 'Fully client-side. No data sent anywhere.'],
              ['Image Compressor & Converter', 'Client-side only. Your images stay private.'],
            ].map(([tool, desc]) => (
              <div key={tool} className="flex gap-3">
                <span className="text-green-400 mt-0.5">✓</span>
                <div>
                  <strong className="text-[var(--foreground)]">{tool}:</strong> {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ToolPageWrapper>
  );
}
