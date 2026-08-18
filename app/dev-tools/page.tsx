'use client';
import { useState } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';


type Tab = 'base64' | 'url' | 'hash' | 'jwt' | 'uuid' | 'regex';

export default function DevToolsPage() {
  const [tab, setTab] = useState<Tab>('base64');

  // Base64
  const [b64Input, setB64Input] = useState('');
  const [b64Output, setB64Output] = useState('');
  const [b64Mode, setB64Mode] = useState<'encode' | 'decode'>('encode');

  // URL
  const [urlInput, setUrlInput] = useState('');
  const [urlOutput, setUrlOutput] = useState('');
  const [urlMode, setUrlMode] = useState<'encode' | 'decode'>('encode');

  // Hash
  const [hashInput, setHashInput] = useState('');
  const [hashResults, setHashResults] = useState<Record<string, string>>({});

  // JWT
  const [jwtInput, setJwtInput] = useState('');
  const [jwtDecoded, setJwtDecoded] = useState<{ header: object; payload: object; signature: string } | null>(null);
  const [jwtError, setJwtError] = useState('');

  // UUID
  const [uuids, setUuids] = useState<string[]>([]);
  const [uuidCount, setUuidCount] = useState(5);

  // Regex
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [testStr, setTestStr] = useState('');
  const [regexMatches, setRegexMatches] = useState<string[]>([]);
  const [regexError, setRegexError] = useState('');

  const handleBase64 = () => {
    try {
      if (b64Mode === 'encode') setB64Output(btoa(unescape(encodeURIComponent(b64Input))));
      else setB64Output(decodeURIComponent(escape(atob(b64Input))));
    } catch { setB64Output('Error: Invalid input'); }
  };

  const handleUrl = () => {
    try {
      if (urlMode === 'encode') setUrlOutput(encodeURIComponent(urlInput));
      else setUrlOutput(decodeURIComponent(urlInput));
    } catch { setUrlOutput('Error: Invalid input'); }
  };

  const handleHash = async () => {
    if (!hashInput) return;
    setHashResults({
      MD5: (await import('crypto-js')).default.MD5(hashInput).toString(),
      'SHA-1': (await import('crypto-js')).default.SHA1(hashInput).toString(),
      'SHA-256': (await import('crypto-js')).default.SHA256(hashInput).toString(),
      'SHA-512': (await import('crypto-js')).default.SHA512(hashInput).toString(),
    });
  };

  const handleJWT = () => {
    setJwtError('');
    try {
      const parts = jwtInput.trim().split('.');
      if (parts.length !== 3) throw new Error('Invalid JWT format (expected 3 parts)');
      const decode = (str: string) => JSON.parse(atob(str.replace(/-/g, '+').replace(/_/g, '/')));
      setJwtDecoded({ header: decode(parts[0]), payload: decode(parts[1]), signature: parts[2] });
    } catch (e: unknown) { setJwtError((e as Error).message); setJwtDecoded(null); }
  };

  const generateUUIDs = () => {
    const newUuids = Array.from({ length: uuidCount }, () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      })
    );
    setUuids(newUuids);
  };

  const testRegex = () => {
    setRegexError('');
    try {
      const re = new RegExp(pattern, flags);
      const matches = Array.from(testStr.matchAll(re)).map(m => m[0]);
      setRegexMatches(matches);
    } catch (e: unknown) { setRegexError((e as Error).message); setRegexMatches([]); }
  };

  const copy = (text: string) => navigator.clipboard.writeText(text);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'base64', label: 'Base64' },
    { key: 'url', label: 'URL Encode' },
    { key: 'hash', label: 'Hash' },
    { key: 'jwt', label: 'JWT' },
    { key: 'uuid', label: 'UUID' },
    { key: 'regex', label: 'Regex' },
  ];

  return (
    <ToolPageWrapper title="Developer Tools" description="Base64, URL encode, hash, JWT, UUID, regex tester" emoji="🔧">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Base64 */}
      {tab === 'base64' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['encode', 'decode'] as const).map(m => (
              <button key={m} onClick={() => setB64Mode(m)}
                className={`px-4 py-2 rounded-xl text-sm capitalize ${b64Mode === m ? 'btn-primary' : 'btn-secondary'}`}>{m}</button>
            ))}
          </div>
          <textarea className="textarea-field" rows={5} value={b64Input} onChange={e => setB64Input(e.target.value)}
            placeholder={b64Mode === 'encode' ? 'Text to encode...' : 'Base64 to decode...'} />
          <button className="btn-primary" onClick={handleBase64}>{b64Mode === 'encode' ? 'Encode' : 'Decode'}</button>
          {b64Output && (
            <div className="tool-card p-4">
              <div className="flex justify-between mb-2"><span className="text-sm text-[var(--muted-text)]">Result</span><button className="text-xs text-[var(--foreground)] hover:underline" onClick={() => copy(b64Output)}>Copy</button></div>
              <pre className="font-mono text-sm text-[var(--foreground)] break-all whitespace-pre-wrap">{b64Output}</pre>
            </div>
          )}
        </div>
      )}

      {/* URL */}
      {tab === 'url' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['encode', 'decode'] as const).map(m => (
              <button key={m} onClick={() => setUrlMode(m)}
                className={`px-4 py-2 rounded-xl text-sm capitalize ${urlMode === m ? 'btn-primary' : 'btn-secondary'}`}>{m}</button>
            ))}
          </div>
          <textarea className="textarea-field" rows={5} value={urlInput} onChange={e => setUrlInput(e.target.value)}
            placeholder={urlMode === 'encode' ? 'URL to encode...' : 'Encoded URL to decode...'} />
          <button className="btn-primary" onClick={handleUrl}>{urlMode === 'encode' ? 'Encode' : 'Decode'}</button>
          {urlOutput && (
            <div className="tool-card p-4">
              <div className="flex justify-between mb-2"><span className="text-sm text-[var(--muted-text)]">Result</span><button className="text-xs text-[var(--foreground)] hover:underline" onClick={() => copy(urlOutput)}>Copy</button></div>
              <pre className="font-mono text-sm text-[var(--foreground)] break-all whitespace-pre-wrap">{urlOutput}</pre>
            </div>
          )}
        </div>
      )}

      {/* Hash */}
      {tab === 'hash' && (
        <div className="space-y-4">
          <textarea className="textarea-field" rows={4} value={hashInput} onChange={e => setHashInput(e.target.value)} placeholder="Text to hash..." />
          <button className="btn-primary" onClick={handleHash}>Generate Hashes</button>
          {Object.keys(hashResults).length > 0 && (
            <div className="space-y-3">
              {Object.entries(hashResults).map(([algo, hash]) => (
                <div key={algo} className="tool-card p-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-semibold text-[var(--foreground)]">{algo}</span>
                    <button className="text-xs text-[var(--muted-text)] hover:text-[var(--foreground)]" onClick={() => copy(hash)}>Copy</button>
                  </div>
                  <p className="font-mono text-xs text-[var(--foreground)] break-all">{hash}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* JWT */}
      {tab === 'jwt' && (
        <div className="space-y-4">
          <textarea className="textarea-field font-mono text-xs" rows={4} value={jwtInput} onChange={e => setJwtInput(e.target.value)} placeholder="Paste JWT token here..." />
          <button className="btn-primary" onClick={handleJWT}>Decode JWT</button>
          {jwtError && <p className="text-red-400 text-sm">{jwtError}</p>}
          {jwtDecoded && (
            <div className="space-y-3">
              {[['Header', jwtDecoded.header], ['Payload', jwtDecoded.payload]].map(([label, data]) => (
                <div key={label as string} className="tool-card p-4">
                  <h4 className="text-xs font-semibold text-[var(--foreground)] mb-2">{label as string}</h4>
                  <pre className="font-mono text-xs text-[var(--foreground)] whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
                </div>
              ))}
              <div className="tool-card p-4">
                <h4 className="text-xs font-semibold text-yellow-400 mb-2">Signature (not verified)</h4>
                <p className="font-mono text-xs text-[var(--muted-text)] break-all">{jwtDecoded.signature}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* UUID */}
      {tab === 'uuid' && (
        <div className="space-y-4">
          <div className="flex gap-4 items-end">
            <div>
              <label className="text-sm text-[var(--muted-text)] block mb-2">Count: {uuidCount}</label>
              <input type="range" min={1} max={20} value={uuidCount} onChange={e => setUuidCount(+e.target.value)} className="accent-[var(--accent)]" />
            </div>
            <button className="btn-primary" onClick={generateUUIDs}>Generate UUIDs</button>
            {uuids.length > 0 && (
              <button className="btn-secondary" onClick={() => copy(uuids.join('\n'))}>Copy All</button>
            )}
          </div>
          {uuids.length > 0 && (
            <div className="space-y-2">
              {uuids.map((u, i) => (
                <div key={i} className="tool-card p-3 flex justify-between items-center">
                  <span className="font-mono text-sm text-[var(--foreground)]">{u}</span>
                  <button className="text-xs text-[var(--muted-text)] hover:text-[var(--foreground)] ml-4" onClick={() => copy(u)}>Copy</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Regex */}
      {tab === 'regex' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="text-sm text-[var(--muted-text)] block mb-2">Pattern</label>
              <input className="input-field font-mono" value={pattern} onChange={e => setPattern(e.target.value)} placeholder="e.g. \d+" />
            </div>
            <div>
              <label className="text-sm text-[var(--muted-text)] block mb-2">Flags</label>
              <input className="input-field font-mono" value={flags} onChange={e => setFlags(e.target.value)} placeholder="g, i, m..." />
            </div>
          </div>
          <div>
            <label className="text-sm text-[var(--muted-text)] block mb-2">Test String</label>
            <textarea className="textarea-field" rows={5} value={testStr} onChange={e => setTestStr(e.target.value)} placeholder="Text to test regex against..." />
          </div>
          <button className="btn-primary" onClick={testRegex}>Test Regex</button>
          {regexError && <p className="text-red-400 text-sm">{regexError}</p>}
          {regexMatches.length > 0 && (
            <div className="tool-card p-4">
              <p className="text-sm text-green-400 mb-3">✅ {regexMatches.length} match{regexMatches.length !== 1 ? 'es' : ''} found</p>
              <div className="flex flex-wrap gap-2">
                {regexMatches.map((m, i) => (
                  <span key={i} className="bg-indigo-900/40 border border-indigo-500/30 rounded-lg px-2 py-1 text-sm font-mono text-[var(--foreground)]">{m}</span>
                ))}
              </div>
            </div>
          )}
          {!regexError && regexMatches.length === 0 && pattern && testStr && (
            <p className="text-[var(--muted-text)] text-sm">No matches found.</p>
          )}
        </div>
      )}
    </ToolPageWrapper>
  );
}


