'use client';
import { useState } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';

type Tab = 'unit' | 'base' | 'timestamp';

const unitCategories = {
  Length: { base: 'm', units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 } },
  Weight: { base: 'kg', units: { mg: 1e-6, g: 0.001, kg: 1, t: 1000, oz: 0.028349, lb: 0.453592 } },
  Temperature: { base: 'C', units: { C: 1, F: 1, K: 1 } },
  Speed: { base: 'ms', units: { ms: 1, kmh: 1/3.6, mph: 0.44704, knot: 0.514444 } },
};

function convertTemp(val: number, from: string, to: string) {
  const c = from === 'C' ? val : from === 'F' ? (val - 32) * 5/9 : val - 273.15;
  if (to === 'C') return c;
  if (to === 'F') return c * 9/5 + 32;
  return c + 273.15;
}

export default function ConvertersPage() {
  const [tab, setTab] = useState<Tab>('unit');
  const [catKey, setCatKey] = useState<keyof typeof unitCategories>('Length');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('ft');
  const [unitVal, setUnitVal] = useState('');
  const [unitResult, setUnitResult] = useState('');

  const [baseInput, setBaseInput] = useState('');
  const [baseFrom, setBaseFrom] = useState(10);
  const [baseResults, setBaseResults] = useState<Record<string,string>>({});

  const [tsInput, setTsInput] = useState('');
  const [tsResult, setTsResult] = useState('');

  const cat = unitCategories[catKey];
  const unitKeys = Object.keys(cat.units) as string[];

  const convertUnit = () => {
    const v = parseFloat(unitVal);
    if (isNaN(v)) { setUnitResult('Invalid number'); return; }
    let result: number;
    if (catKey === 'Temperature') {
      result = convertTemp(v, fromUnit, toUnit);
    } else {
      const units = cat.units as Record<string, number>;
      const inBase = v * units[fromUnit];
      result = inBase / units[toUnit];
    }
    setUnitResult(`${v} ${fromUnit} = ${result.toPrecision(8).replace(/\.?0+$/, '')} ${toUnit}`);
  };

  const convertBase = () => {
    try {
      const dec = parseInt(baseInput, baseFrom);
      if (isNaN(dec)) { setBaseResults({}); return; }
      setBaseResults({ bin: dec.toString(2), oct: dec.toString(8), dec: dec.toString(10), hex: dec.toString(16).toUpperCase() });
    } catch { setBaseResults({}); }
  };

  const convertTimestamp = () => {
    const v = tsInput.trim();
    if (/^\d+$/.test(v)) {
      const ms = v.length === 10 ? +v * 1000 : +v;
      const d = new Date(ms);
      setTsResult(`UTC: ${d.toUTCString()}\nLocal: ${d.toLocaleString()}\nISO: ${d.toISOString()}`);
    } else {
      const d = new Date(v);
      if (isNaN(d.getTime())) { setTsResult('Invalid date'); return; }
      setTsResult(`Unix (s): ${Math.floor(d.getTime()/1000)}\nUnix (ms): ${d.getTime()}\nISO: ${d.toISOString()}`);
    }
  };

  return (
    <ToolPageWrapper title="Converters" description="Unit, number base & timestamp converter" emoji="🔄">
      <div className="flex gap-2 mb-8">
        {(['unit', 'base', 'timestamp'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl font-medium text-sm capitalize ${ tab === t ? 'btn-primary' : 'btn-secondary' }`}>
            {t === 'unit' ? 'Unit' : t === 'base' ? 'Number Base' : 'Timestamp'}
          </button>
        ))}
      </div>

      {tab === 'unit' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(unitCategories) as (keyof typeof unitCategories)[]).map(k => (
              <button key={k} onClick={() => { setCatKey(k); setFromUnit(Object.keys(unitCategories[k].units)[0]); setToUnit(Object.keys(unitCategories[k].units)[1]); setUnitResult(''); }}
                className={`px-4 py-2 rounded-xl text-sm ${ catKey === k ? 'btn-primary' : 'btn-secondary' }`}>{k}</button>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Value</label>
              <input className="input-field" type="number" value={unitVal} onChange={e => setUnitVal(e.target.value)} placeholder="Enter value" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">From</label>
              <select className="input-field" value={fromUnit} onChange={e => setFromUnit(e.target.value)}>
                {unitKeys.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">To</label>
              <select className="input-field" value={toUnit} onChange={e => setToUnit(e.target.value)}>
                {unitKeys.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <button className="btn-primary" onClick={convertUnit}>Convert</button>
          {unitResult && <div className="tool-card p-4 text-lg font-semibold text-indigo-300">{unitResult}</div>}
        </div>
      )}

      {tab === 'base' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Input</label>
              <input className="input-field font-mono" value={baseInput} onChange={e => setBaseInput(e.target.value)} placeholder="Enter number..." />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">From Base</label>
              <select className="input-field" value={baseFrom} onChange={e => setBaseFrom(+e.target.value)}>
                <option value={2}>Binary (2)</option>
                <option value={8}>Octal (8)</option>
                <option value={10}>Decimal (10)</option>
                <option value={16}>Hexadecimal (16)</option>
              </select>
            </div>
          </div>
          <button className="btn-primary" onClick={convertBase}>Convert All Bases</button>
          {Object.keys(baseResults).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[['Binary', 'bin', 2], ['Octal', 'oct', 8], ['Decimal', 'dec', 10], ['Hexadecimal', 'hex', 16]].map(([label, key, base]) => (
                <div key={key as string} className="tool-card p-4">
                  <div className="text-xs text-gray-500 mb-1">{label} (base {base})</div>
                  <div className="font-mono text-sm text-indigo-300 break-all">{baseResults[key as string] || '-'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'timestamp' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">Unix timestamp or Date string</label>
            <div className="flex gap-3">
              <input className="input-field" value={tsInput} onChange={e => setTsInput(e.target.value)}
                placeholder="1700000000 or 2024-01-15T10:30:00Z" />
              <button className="btn-secondary whitespace-nowrap" onClick={() => setTsInput(String(Math.floor(Date.now()/1000)))}>Now</button>
              <button className="btn-primary" onClick={convertTimestamp}>Convert</button>
            </div>
          </div>
          {tsResult && (
            <pre className="tool-card p-4 font-mono text-sm text-indigo-300 whitespace-pre-wrap">{tsResult}</pre>
          )}
        </div>
      )}
    </ToolPageWrapper>
  );
}
