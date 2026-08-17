'use client';
import { useState, useEffect } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';
import axios from 'axios';
import { Highlight, themes } from 'prism-react-renderer';

const JSONBIN_URL = 'https://api.jsonbin.io/v3/b';

const LANGUAGES = ['javascript', 'typescript', 'python', 'bash', 'json', 'yaml', 'css', 'html', 'sql', 'go', 'rust', 'plaintext'];

export default function LogSharePage() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('bash');
  const [title, setTitle] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'share' | 'view'>('share');

  // Retrieve
  const [retrieveId, setRetrieveId] = useState('');
  const [retrieved, setRetrieved] = useState<{ title: string; code: string; language: string } | null>(null);
  const [retrieving, setRetrieving] = useState(false);

  const getApiKey = () => typeof window !== 'undefined' ? localStorage.getItem('jsonbin_api_key') || '' : '';

  const share = async () => {
    if (!code.trim()) { setError('Please enter some code or log'); return; }
    const apiKey = getApiKey();
    if (!apiKey) { setError('No JSONBin API key. Go to Settings →'); return; }
    setLoading(true); setError('');
    try {
      const payload = { title: title || 'Log Share', code, language, createdAt: new Date().toISOString() };
      const res = await axios.post(JSONBIN_URL, payload, {
        headers: { 
          'X-Master-Key': apiKey, 
          'X-Bin-Name': title || 'log-share', 
          'Content-Type': 'application/json',
          'X-Bin-Private': 'false'
        },
      });
      const binId = res.data.metadata.id;
      setShareUrl(`${window.location.origin}${window.location.pathname}?id=${binId}`);
    } catch { setError('Failed to share. Check your API key.'); }
    setLoading(false);
  };

  const retrieve = async (idToFetch?: string) => {
    const id = idToFetch || (retrieveId.includes('?id=') ? retrieveId.split('?id=')[1] : retrieveId.trim());
    if (!id) return;
    
    setRetrieving(true); setError('');
    try {
      const res = await axios.get(`${JSONBIN_URL}/${id}/latest`);
      setRetrieved(res.data.record);
    } catch { setError('Could not retrieve. Link might be invalid or deleted.'); }
    setRetrieving(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      setTab('view');
      setRetrieveId(id);
      retrieve(id);
    }
  }, []);

  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <ToolPageWrapper title="Log Share" description="Share code & logs with syntax highlighting" emoji="📋">
      <div className="flex gap-2 mb-8">
        {(['share', 'view'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-medium text-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`}>
            {t === 'share' ? '📤 Share Log' : '📥 View Log'}
          </button>
        ))}
      </div>

      {tab === 'share' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Title</label>
              <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} placeholder="My Log..." />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">Language</label>
              <select className="input-field" value={language} onChange={e => setLanguage(e.target.value)}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">Code / Log</label>
            <textarea className="textarea-field font-mono text-xs" style={{ minHeight: '350px' }}
              value={code} onChange={e => setCode(e.target.value)} placeholder="Paste code or log output here..." />
          </div>

          {/* Live preview */}
          {code && (
            <div className="tool-card p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs text-gray-500 font-mono">{language}</span>
                <button className="text-xs text-gray-500 hover:text-indigo-400" onClick={() => copy(code)}>Copy code</button>
              </div>
              <Highlight theme={themes.vsDark} code={code} language={language as Parameters<typeof Highlight>[0]['language']}>
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                  <pre className="font-mono text-xs overflow-auto max-h-64 scrollbar-thin rounded-lg p-4" style={style}>
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })}>
                        <span className="select-none text-gray-600 mr-4">{String(i + 1).padStart(3)}</span>
                        {line.map((token, j) => <span key={j} {...getTokenProps({ token })} />)}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </div>
          )}

          <button className="btn-primary w-full py-3" onClick={share} disabled={loading}>
            {loading ? 'Creating link...' : '🔗 Create Share Link'}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {shareUrl && (
            <div className="tool-card p-5 space-y-3">
              <p className="text-green-400 font-semibold">✅ Link Created!</p>
              <div className="flex gap-3">
                <input className="input-field font-mono text-sm flex-1" value={shareUrl} readOnly />
                <button className={`btn-secondary px-4 ${copied ? 'text-green-400' : ''}`} onClick={() => copy(shareUrl)}>
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'view' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Share Link or Bin ID</label>
            <div className="flex gap-3">
              <input className="input-field font-mono" value={retrieveId} onChange={e => setRetrieveId(e.target.value)} placeholder="Paste link or bin ID..." />
              <button className="btn-primary px-6" onClick={retrieve} disabled={retrieving}>
                {retrieving ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {retrieved && (
            <div className="tool-card p-5 space-y-3">
              {retrieved.title && <h3 className="font-semibold text-white">{retrieved.title}</h3>}
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-gray-500">{retrieved.language}</span>
                <button className="btn-secondary text-sm" onClick={() => copy(retrieved.code)}>Copy Code</button>
              </div>
              <Highlight theme={themes.vsDark} code={retrieved.code} language={retrieved.language as Parameters<typeof Highlight>[0]['language']}>
                {({ style, tokens, getLineProps, getTokenProps }) => (
                  <pre className="font-mono text-xs overflow-auto max-h-[60vh] scrollbar-thin rounded-lg p-4" style={style}>
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })}>
                        <span className="select-none text-gray-600 mr-4">{String(i + 1).padStart(3)}</span>
                        {line.map((token, j) => <span key={j} {...getTokenProps({ token })} />)}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </div>
          )}
        </div>
      )}
    </ToolPageWrapper>
  );
}
