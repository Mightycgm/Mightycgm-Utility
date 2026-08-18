'use client';
import { useState, useEffect } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setApiKey(localStorage.getItem('jsonbin_api_key') || '');
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

  return (
    <ToolPageWrapper title="Settings" description="Configure API keys and preferences" emoji="⚙️">
      <div className="max-w-2xl space-y-8">
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
              ['Background Remover', 'Runs 100% on-device (WASM/GPU Neural AI). Zero external API dependencies.'],
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
