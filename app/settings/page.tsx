'use client';
import { useState, useEffect } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [removeBgKey, setRemoveBgKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [removeBgSaved, setRemoveBgSaved] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setApiKey(localStorage.getItem('jsonbin_api_key') || '');
      setRemoveBgKey(localStorage.getItem('removebg_api_key') || '');
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

  const saveRemoveBg = () => {
    localStorage.setItem('removebg_api_key', removeBgKey.trim());
    setRemoveBgSaved(true);
    setTimeout(() => setRemoveBgSaved(false), 2000);
  };

  const clearRemoveBg = () => {
    localStorage.removeItem('removebg_api_key');
    setRemoveBgKey('');
  };

  return (
    <ToolPageWrapper title="Settings" description="Configure API keys and preferences" emoji="⚙️">
      <div className="max-w-2xl space-y-8">
        {/* Remove.bg API Key */}
        <div className="tool-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✂️</span>
            <div>
              <h2 className="font-semibold text-white">Remove.bg Official API Key (Optional)</h2>
              <p className="text-sm text-[var(--muted-text)]">
                For instant 0.5s cloud background removal. (Leave blank to use free on-device AI)
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-[var(--muted-text)] block">Remove.bg API Key</label>
            <input
              className="input-field font-mono text-sm"
              type="password"
              value={removeBgKey}
              onChange={(e) => setRemoveBgKey(e.target.value)}
              placeholder="Paste your remove.bg API key here..."
            />
            <div className="flex gap-3">
              <button className="btn-primary px-6" onClick={saveRemoveBg}>
                {removeBgSaved ? '✓ Saved!' : 'Save Key'}
              </button>
              {removeBgKey && (
                <button
                  className="btn-secondary px-6 text-red-400 hover:text-red-300"
                  onClick={clearRemoveBg}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Get a free key (50 free images/month):</h3>
            <ol className="text-sm text-[var(--muted-text)] space-y-1 list-decimal list-inside">
              <li>
                Go to{' '}
                <a
                  href="https://www.remove.bg/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--foreground)] hover:underline"
                >
                  remove.bg/api
                </a>
              </li>
              <li>Sign up for a free account</li>
              <li>Get your API key from the dashboard</li>
              <li>Paste it here and click Save</li>
            </ol>
          </div>
        </div>

        {/* JSONBin API Key */}
        <div className="tool-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔑</span>
            <div>
              <h2 className="font-semibold text-white">JSONBin.io API Key</h2>
              <p className="text-sm text-[var(--muted-text)]">Required for custom Text Share and Log Share storage</p>
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
            <h2 className="font-semibold text-white">Privacy</h2>
          </div>
          <div className="space-y-2 text-sm text-[var(--muted-text)]">
            {[
              ['Background Remover', 'Runs on-device (WASM/AI) or via direct remove.bg API if key is set.'],
              ['PDF Tools', 'All PDF processing is client-side. Files never leave your device.'],
              ['QR Code', 'Generated and decoded locally. No server involved.'],
              ['Color Picker', 'Fully client-side. No data sent anywhere.'],
              ['Image Compressor', 'Client-side only. Your images stay private.'],
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
