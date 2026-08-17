'use client';
import { useState, useEffect } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';
import { RgbColorPicker, HslColorPicker } from 'react-colorful';

type PickerType = 'rgb' | 'hsl' | 'compact';
type CopyFormat = 'hex' | 'rgb' | 'hsl' | 'cmyk' | 'hsv';

// --- Conversions (Single Source of Truth is HEX or RGB) ---
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) };
}

function rgbToCmyk(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

const PICKER_TYPES: { key: PickerType; label: string; desc: string }[] = [
  { key: 'rgb', label: 'RGB Picker + Slider', desc: 'Red, Green, Blue channels' },
  { key: 'hsl', label: 'HSL Picker', desc: 'Hue, Saturation, Lightness' },
  { key: 'compact', label: 'Compact Native', desc: 'System native swatch picker' },
];

const MATERIAL_COLORS = [
  '#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4',
  '#009688','#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722',
  '#795548','#9e9e9e','#607d8b','#000000','#212121','#424242','#616161','#ffffff',
  '#ffcdd2','#f8bbd0','#e1bee7','#c5cae9','#bbdefb','#b3e5fc','#b2dfdb','#c8e6c9',
];

export default function ColorPickerPage() {
  // Single source of truth is RGB object for smooth slider dragging
  const [rgb, setRgb] = useState({ r: 99, g: 102, b: 241 });
  const [pickerType, setPickerType] = useState<PickerType>('rgb');
  const [copied, setCopied] = useState('');

  // Derived states
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

  const handleHexChange = (newHex: string) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
      setRgb(hexToRgb(newHex));
    }
  };

  const handleHslChange = (newHsl: { h: number, s: number, l: number }) => {
    setRgb(hslToRgb(newHsl.h, newHsl.s, newHsl.l));
  };

  const copyFormat = (fmt: CopyFormat) => {
    let text = '';
    switch (fmt) {
      case 'hex': text = hex.toUpperCase(); break;
      case 'rgb': text = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`; break;
      case 'hsl': text = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`; break;
      case 'cmyk': text = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`; break;
      case 'hsv': text = `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`; break;
    }
    navigator.clipboard.writeText(text);
    setCopied(fmt);
    setTimeout(() => setCopied(''), 1500);
  };

  return (
    <ToolPageWrapper title="Color Picker" description="RGB/HSL Pickers + Value Converter" emoji="🎨">
      <div className="grid lg:grid-cols-3 gap-8 mb-8">
        {/* Left Column: Picker Selection & Visual Preview */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--muted-text)] uppercase tracking-wider">Picker Type</h3>
            {PICKER_TYPES.map(pt => (
              <button key={pt.key} onClick={() => setPickerType(pt.key)}
                className={`w-full text-left p-3 rounded-xl transition-all ${pickerType === pt.key ? 'bg-[var(--foreground)] text-[var(--background)]' : 'tool-card'}`}>
                <div className="text-sm font-medium">{pt.label}</div>
                <div className={`text-xs ${pickerType === pt.key ? 'opacity-80' : 'text-[var(--muted-text)]'}`}>{pt.desc}</div>
              </button>
            ))}
          </div>

          <div className="w-full rounded-2xl h-24 shadow-sm border border-[var(--card-border)]" style={{ background: hex }} />
          <p className="font-mono text-2xl font-bold text-center uppercase tracking-widest">{hex}</p>
        </div>

        {/* Middle Column: Active Picker Controls */}
        <div className="flex flex-col gap-6">
          <h3 className="text-sm font-semibold text-[var(--muted-text)] uppercase tracking-wider">Controls</h3>
          
          <div className="tool-card p-4 space-y-6">
            {pickerType === 'rgb' && (
              <>
                {/* Visual RGB Picker */}
                <RgbColorPicker color={rgb} onChange={setRgb} style={{ width: '100%', height: '200px' }} />
                
                {/* RGB Sliders (Lucid Slider integration) */}
                <div className="space-y-4 pt-4 border-t border-[var(--card-border)]">
                  {[
                    ['R', rgb.r, (val: number) => setRgb({ ...rgb, r: val }), '#ef4444'],
                    ['G', rgb.g, (val: number) => setRgb({ ...rgb, g: val }), '#22c55e'],
                    ['B', rgb.b, (val: number) => setRgb({ ...rgb, b: val }), '#3b82f6']
                  ].map(([label, val, setter, colorHex]) => (
                    <div key={label as string} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span style={{ color: colorHex as string }}>{label as string}</span>
                        <span>{val as number}</span>
                      </div>
                      <input type="range" min={0} max={255} value={val as number}
                        onChange={e => (setter as (v: number) => void)(+e.target.value)}
                        className="w-full h-2 rounded-lg appearance-none bg-[var(--muted)] cursor-pointer" 
                        style={{ accentColor: colorHex as string }} 
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {pickerType === 'hsl' && (
              <>
                <HslColorPicker color={hsl} onChange={handleHslChange} style={{ width: '100%', height: '200px' }} />
                
                <div className="space-y-4 pt-4 border-t border-[var(--card-border)]">
                  {[
                    ['Hue (H)', hsl.h, 360, (val: number) => handleHslChange({ ...hsl, h: val }), '#a855f7'],
                    ['Saturation (S)', hsl.s, 100, (val: number) => handleHslChange({ ...hsl, s: val }), '#ec4899'],
                    ['Lightness (L)', hsl.l, 100, (val: number) => handleHslChange({ ...hsl, l: val }), '#64748b']
                  ].map(([label, val, max, setter, colorHex]) => (
                    <div key={label as string} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-[var(--foreground)]">{label as string}</span>
                        <span>{val as number}{max === 100 ? '%' : '°'}</span>
                      </div>
                      <input type="range" min={0} max={max as number} value={val as number}
                        onChange={e => (setter as (v: number) => void)(+e.target.value)}
                        className="w-full h-2 rounded-lg appearance-none bg-[var(--muted)] cursor-pointer" 
                        style={{ accentColor: colorHex as string }} 
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {pickerType === 'compact' && (
              <div className="space-y-4">
                <input type="color" value={hex} onChange={e => handleHexChange(e.target.value)}
                  className="w-full h-32 rounded-xl cursor-pointer border-0 p-0 overflow-hidden" />
                <input className="input-field font-mono text-center uppercase" value={hex}
                  onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleHexChange(e.target.value.padEnd(7, '0')); }} 
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Values & Material Grid */}
        <div className="flex flex-col gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--muted-text)] uppercase tracking-wider">Color Values</h3>
            
            {/* Color Value Rows */}
            {([
              ['hex', 'HEX', hex.toUpperCase(), null],
              ['rgb', 'RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, `Sat: ${hsl.s}%`], // Added Saturation info to RGB
              ['hsl', 'HSL', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, `Lightness: ${hsl.l}%`], // Emphasized Lightness in HSL
              ['cmyk', 'CMYK', `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`, null],
            ] as [CopyFormat, string, string, string | null][]).map(([fmt, label, val, extraInfo]) => (
              <div key={fmt} className="tool-card p-3 flex items-center justify-between gap-2">
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold">{label}</span>
                    {extraInfo && <span className="text-[10px] text-[var(--muted-text)] border border-[var(--card-border)] px-1 rounded">{extraInfo}</span>}
                  </div>
                  <div className="font-mono text-sm text-[var(--foreground)] truncate">{val}</div>
                </div>
                <button
                  onClick={() => copyFormat(fmt)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all border ${
                    copied === fmt 
                      ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' 
                      : 'bg-[var(--muted)] text-[var(--foreground)] border-[var(--card-border)] hover:border-[var(--foreground)]'
                  }`}
                >
                  {copied === fmt ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ))}
          </div>

          {/* Material / Dino Flat Color Grid - Now permanently on the right side */}
          <div className="space-y-3 mt-4">
            <h3 className="text-sm font-semibold text-[var(--muted-text)] uppercase tracking-wider">Material Colors</h3>
            <div className="tool-card p-4 grid grid-cols-8 gap-2">
              {MATERIAL_COLORS.map(c => (
                <button key={c} onClick={() => handleHexChange(c)}
                  title={c}
                  className="w-full aspect-square rounded-md border transition-transform hover:scale-110 shadow-sm"
                  style={{ 
                    background: c, 
                    borderColor: hex.toLowerCase() === c.toLowerCase() ? 'var(--foreground)' : 'rgba(0,0,0,0.1)' 
                  }}
                />
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </ToolPageWrapper>
  );
}
