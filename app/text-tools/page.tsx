'use client';
import { useState } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as Diff from 'diff';

type Tab = 'diff' | 'markdown' | 'counter';

export default function TextToolsPage() {
  const [tab, setTab] = useState<Tab>('counter');
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [mdText, setMdText] = useState('# Hello\n\nType **markdown** here...');
  const [counterText, setCounterText] = useState('');

  const diffs = Diff.diffLines(textA, textB);

  const words = counterText.trim() ? counterText.trim().split(/\s+/).length : 0;
  const chars = counterText.length;
  const sentences = counterText.split(/[.!?]+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.ceil(words / 200));

  return (
    <ToolPageWrapper title="Text Tools" description="Diff, Markdown preview & word counter" emoji="??">
      <div className="flex gap-2 mb-8">
        {(['counter', 'diff', 'markdown'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md font-medium text-sm capitalize ${ tab === t ? 'btn-primary' : 'btn-secondary' }`}>
            {t === 'counter' ? 'Word Counter' : t === 'diff' ? 'Text Diff' : 'Markdown'}
          </button>
        ))}
      </div>

      {tab === 'counter' && (
        <div className="space-y-4">
          <textarea className="textarea-field" style={{ minHeight: '300px' }}
            value={counterText} onChange={e => setCounterText(e.target.value)}
            placeholder="Paste text here to count words, characters, sentences..."
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[['Words', words], ['Characters', chars], ['Sentences', sentences], ['Read time', `~${readTime} min`]].map(([l, v]) => (
              <div key={l as string} className="tool-card p-4 text-center">
                <div className="text-2xl font-bold gradient-text">{v}</div>
                <div className="text-xs text-[var(--muted-text)] mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'diff' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[var(--muted-text)] mb-2 block">Text A (Original)</label>
              <textarea className="textarea-field font-mono text-xs" style={{ minHeight: '250px' }}
                value={textA} onChange={e => setTextA(e.target.value)} placeholder="Original text..." />
            </div>
            <div>
              <label className="text-sm text-[var(--muted-text)] mb-2 block">Text B (Modified)</label>
              <textarea className="textarea-field font-mono text-xs" style={{ minHeight: '250px' }}
                value={textB} onChange={e => setTextB(e.target.value)} placeholder="Modified text..." />
            </div>
          </div>
          {(textA || textB) && (
            <div className="tool-card p-4">
              <h3 className="text-sm font-semibold mb-3 text-[var(--foreground)]">Diff Result</h3>
              <div className="font-mono text-xs space-y-0.5 max-h-64 overflow-y-auto scrollbar-thin">
                {diffs.map((part, i) => (
                  <div key={i} className={`px-3 py-0.5 rounded ${
                    part.added ? 'bg-green-900/40 text-green-300' :
                    part.removed ? 'bg-red-900/40 text-red-300' :
                    'text-[var(--muted-text)]'
                  }`}>
                    <span className="mr-2">{part.added ? '+' : part.removed ? '-' : ' '}</span>
                    {part.value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'markdown' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-[var(--muted-text)] block mb-2">Markdown Input</label>
            <textarea className="textarea-field font-mono text-xs" style={{ minHeight: '500px' }}
              value={mdText} onChange={e => setMdText(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-[var(--muted-text)] block mb-2">Preview</label>
            <div className="tool-card p-6 prose prose-invert prose-sm max-w-none overflow-auto" style={{ minHeight: '500px' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{mdText}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </ToolPageWrapper>
  );
}

