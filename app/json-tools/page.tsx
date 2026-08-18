'use client';
import { useState } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

export default function JsonToolsPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [indent, setIndent] = useState(2);

  const format = () => {
    try { setOutput(JSON.stringify(JSON.parse(input), null, indent)); setError(''); }
    catch (e: unknown) { setError((e as Error).message); setOutput(''); }
  };
  const minify = () => {
    try { setOutput(JSON.stringify(JSON.parse(input))); setError(''); }
    catch (e: unknown) { setError((e as Error).message); setOutput(''); }
  };
  const validate = () => {
    try { JSON.parse(input); setError(''); setOutput('? Valid JSON!'); }
    catch (e: unknown) { setError((e as Error).message); setOutput(''); }
  };

  return (
    <ToolPageWrapper title="JSON Tools" description="Format, validate, and minify JSON" emoji="{}">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <button className="btn-primary" onClick={format}>Format</button>
          <button className="btn-secondary" onClick={minify}>Minify</button>
          <button className="btn-secondary" onClick={validate}>Validate</button>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-[var(--muted-text)]">Indent:</label>
            {[2, 4].map(n => (
              <button key={n} onClick={() => setIndent(n)}
                className={`px-3 py-1 rounded-lg text-sm ${ indent === n ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-[var(--muted-text)]' }`}>{n}</button>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-[var(--muted-text)] block mb-2">Input JSON</label>
            <textarea
              className="textarea-field font-mono text-xs"
              style={{ minHeight: '400px' }}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={'{ "key": "value" }'}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[var(--muted-text)]">Output</label>
              {output && <button className="text-xs text-[var(--foreground)] hover:underline" onClick={() => navigator.clipboard.writeText(output)}>Copy</button>}
            </div>
            {error ? (
              <div className="tool-card border-red-900/50 p-4 h-full rounded-xl">
                <p className="text-red-400 text-sm font-mono">{error}</p>
              </div>
            ) : (
              <textarea
                className="textarea-field font-mono text-xs"
                style={{ minHeight: '400px' }}
                value={output}
                readOnly
              />
            )}
          </div>
        </div>
      </div>
    </ToolPageWrapper>
  );
}


