'use client';
import { useState, useEffect } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    
    setTimeout(() => setApiKey(localStorage.getItem('jsonbin_api_key') || ''), 0);
  }, []);

  const save = () => {
    localStorage.setItem('jsonbin_api_key', apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clear = () => {
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
              <h2 className="font-semibold text-white">JSONBin.io API Key</h2>
              <p className="text-sm text-[var(--muted-text)]">Required for Text Share and Log Share features</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-[var(--muted-text)] block">API Key (Master Key)</label>
            <input
              className="input-field font-mono text-sm"
              type="password"
              value={apiKey}
              onChange={e => 
    setApiKey(e.target.value)}
              placeholder="$2b$10$..."
            />
            <div className="flex gap-3">
              <button className="btn-primary px-6" onClick={save}>
                {saved ? '✓ Saved!' : 'Save Key'}
              </button>
              {apiKey && (
                <button className="btn-secondary px-6 text-red-400 hover:text-red-300" onClick={clear}>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">How to get a free API key:</h3>
            <ol className="text-sm text-[var(--muted-text)] space-y-1 list-decimal list-inside">
              <li>Go to <a href="https://jsonbin.io" target="_blank" rel="noopener noreferrer" className="text-[var(--foreground)] hover:underline">jsonbin.io</a></li>
              <li>Create a free account</li>
              <li>Go to <strong className="text-[var(--foreground)]">API Keys</strong> section</li>
              <li>Copy your <strong className="text-[var(--foreground)]">Master Key</strong></li>
              <li>Paste it above and click Save</li>
            </ol>
            <p className="text-xs text-[var(--muted-text)] mt-2">
              ℹ️ Your API key is stored only in your browser&apos;s localStorage and never sent to any server other than JSONBin.io.
            </p>
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
              ['Background Remover', 'Runs entirely in your browser (WASM). Images never uploaded.'],
              ['PDF Tools', 'All PDF processing is client-side. Files never leave your device.'],
              ['QR Code', 'Generated and decoded locally. No server involved.'],
              ['Color Picker', 'Fully client-side. No data sent anywhere.'],
              ['Image Compressor', 'Client-side only. Your images stay private.'],
              ['Text/Log Share', 'Stored in JSONBin.io using your own API key.'],
            ].map(([tool, desc]) => (
              <div key={tool} className="flex gap-3">
                <span className="text-green-400 mt-0.5">✓</span>
                <div><strong className="text-[var(--foreground)]">{tool}:</strong> {desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ToolPageWrapper>
  );
}


