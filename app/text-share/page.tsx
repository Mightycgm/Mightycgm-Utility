'use client';
import { useState } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';
import axios from 'axios';
import { nanoid } from 'nanoid';

const JSONBIN_URL = 'https://api.jsonbin.io/v3/b';

export default function TextSharePage() {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Retrieve
  const [retrieveId, setRetrieveId] = useState('');
  const [retrieved, setRetrieved] = useState<{ title: string; text: string } | null>(null);
  const [retrieving, setRetrieving] = useState(false);

  const [tab, setTab] = useState<'share' | 'retrieve'>('share');

  const getApiKey = () => {
    if (typeof window !== 'undefined') return localStorage.getItem('jsonbin_api_key') || '';
    return '';
  };

  const share = async () => {
    if (!text.trim()) { setError('Please enter some text'); return; }
    const apiKey = getApiKey();
    if (!apiKey) {
      setError('No JSONBin API key set. Go to Settings to add your free API key from jsonbin.io');
      return;
    }
    setLoading(true); setError('');
    try {
      const payload = { title: title || 'Untitled', text, createdAt: new Date().toISOString() };
      const res = await axios.post(JSONBIN_URL, payload, {
        headers: { 'X-Master-Key': apiKey, 'X-Bin-Name': title || 'text-share', 'Content-Type': 'application/json' },
      });
      const binId = res.data.metadata.id;
      const url = `${window.location.origin}${window.location.pathname}?id=${binId}`;
      setShareUrl(url);
    } catch (e: unknown) {
      setError('Failed to share. Check your API key in Settings.');
      console.error(e);
    }
    setLoading(false);
  };

  const retrieve = async () => {
    if (!retrieveId.trim()) return;
    const apiKey = getApiKey();
    if (!apiKey) { setError('No JSONBin API key set. Go to Settings.'); return; }
    setRetrieving(true); setError('');
    // Extract bin ID from URL or raw ID
    const id = retrieveId.includes('?id=') ? retrieveId.split('?id=')[1] : retrieveId.trim();
    try {
      const res = await axios.get(`${JSONBIN_URL}/${id}/latest`, {
        headers: { 'X-Master-Key': apiKey },
      });
      setRetrieved(res.data.record);
    } catch (e) {
      setError('Could not retrieve. Check the ID or your API key.');
    }
    setRetrieving(false);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ToolPageWrapper title="Text Share" description="Share long text via a short link using JSONBin.io" emoji="📝">
      <div className="flex gap-2 mb-8">
        {(['share', 'retrieve'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-medium text-sm capitalize ${tab === t ? 'btn-primary' : 'btn-secondary'}`}>
            {t === 'share' ? '📤 Share Text' : '📥 Retrieve Text'}
          </button>
        ))}
      </div>

      {tab === 'share' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Title (optional)</label>
            <input className="input-field" value={title} onChange={e => setTitle(e.target.value)} placeholder="My Note..." />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">Text Content</label>
            <textarea className="textarea-field" style={{ minHeight: '300px' }} value={text}
              onChange={e => setText(e.target.value)} placeholder="Paste your long text here..." />
            <div className="text-xs text-gray-600 mt-1 text-right">{text.length.toLocaleString()} characters</div>
          </div>
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
          <div className="tool-card p-4 flex gap-3">
            <span className="text-blue-400">ℹ️</span>
            <p className="text-sm text-gray-400">
              Requires a free JSONBin.io API key. <a href="/settings" className="text-indigo-400 hover:underline">Set it in Settings →</a>
            </p>
          </div>
        </div>
      )}

      {tab === 'retrieve' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Share Link or Bin ID</label>
            <div className="flex gap-3">
              <input className="input-field font-mono" value={retrieveId} onChange={e => setRetrieveId(e.target.value)}
                placeholder="Paste share link or bin ID..." />
              <button className="btn-primary px-6" onClick={retrieve} disabled={retrieving}>
                {retrieving ? 'Loading...' : 'Retrieve'}
              </button>
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {retrieved && (
            <div className="tool-card p-5 space-y-3">
              {retrieved.title && <h3 className="font-semibold text-white">{retrieved.title}</h3>}
              <div className="flex justify-end">
                <button className="btn-secondary text-sm" onClick={() => copy(retrieved.text)}>Copy Text</button>
              </div>
              <pre className="font-mono text-sm text-gray-300 whitespace-pre-wrap bg-gray-800 p-4 rounded-xl max-h-96 overflow-y-auto scrollbar-thin">
                {retrieved.text}
              </pre>
            </div>
          )}
        </div>
      )}
    </ToolPageWrapper>
  );
}
