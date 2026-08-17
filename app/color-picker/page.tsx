'use client';
import { useState } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';
import { RgbaColorPicker, HslaColorPicker } from 'react-colorful';

type PickerType = 'rgb' | 'hsl';
type CopyFormat = 'hex' | 'rgb' | 'hsl' | 'cmyk' | 'hsv';

// --- Conversions (Single Source of Truth is RGBA object) ---
function hexToRgba(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  const a = hex.length === 9 ? (parseInt(hex.slice(7, 9), 16) / 255) : 1;
  return { r, g, b, a: Number(a.toFixed(2)) };
}

function rgbaToHex(r: number, g: number, b: number, a: number) {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  const hexStr = '#' + [r, g, b].map(toHex).join('');
  if (a < 1) return hexStr + toHex(a * 255);
  return hexStr;
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
  { key: 'rgb', label: 'RGB Picker + Slider', desc: 'Red, Green, Blue, Alpha channels' },
  { key: 'hsl', label: 'HSL Picker', desc: 'Hue, Saturation, Lightness, Alpha' },
];

const MATERIAL_COLORS = [
  '#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4',
  '#009688','#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722',
  '#795548','#9e9e9e','#607d8b','#000000','#212121','#424242','#616161','#ffffff',
  '#ffcdd2','#f8bbd0','#e1bee7','#c5cae9','#bbdefb','#b3e5fc','#b2dfdb','#c8e6c9',
];

// Reusable Slider Component with dynamic backgrounds
const ColorSlider = ({ label, value, max, setter, gradient, isAlpha = false }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-xs font-semibold">
      <span className="text-[var(--foreground)]">{label}</span>
      <span>{isAlpha ? value.toFixed(2) : value}{max === 100 && !isAlpha ? '%' : max === 360 ? '°' : ''}</span>
    </div>
    {/* Checkerboard background for transparency preview */}
    <div 
      className="relative w-full h-3 rounded-full" 
      style={isAlpha ? { 
        background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 / 12px 12px',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' 
      } : {}}
    >
      <input 
        type="range" min={0} max={max} step={isAlpha ? 0.01 : 1} value={value}
        onChange={e => setter(+e.target.value)}
        className="color-slider absolute inset-0 w-full h-full"
        style={{ background: gradient }}
      />
    </div>
  </div>
);

export default function ColorPickerPage() {
  const [rgba, setRgba] = useState({ r: 99, g: 102, b: 241, a: 1 });
  const [pickerType, setPickerType] = useState<PickerType>('rgb');
  const [copied, setCopied] = useState('');

  // Derived states
  const hex = rgbaToHex(rgba.r, rgba.g, rgba.b, rgba.a);
  const hsl = rgbToHsl(rgba.r, rgba.g, rgba.b);
  const cmyk = rgbToCmyk(rgba.r, rgba.g, rgba.b);
  const hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);

  const handleHexChange = (newHex: string) => {
    setRgba(hexToRgba(newHex));
  };

  const handleHslChange = (newHsl: { h: number, s: number, l: number, a: number }) => {
    const rgb = hslToRgb(newHsl.h, newHsl.s, newHsl.l);
    setRgba({ ...rgb, a: newHsl.a });
  };

  const copyFormat = (fmt: CopyFormat) => {
    let text = '';
    switch (fmt) {
      case 'hex': text = hex.toUpperCase(); break;
      case 'rgb': text = rgba.a < 1 ? `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})` : `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`; break;
      case 'hsl': text = rgba.a < 1 ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${rgba.a})` : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`; break;
      case 'cmyk': text = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`; break;
      case 'hsv': text = `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`; break;
    }
    navigator.clipboard.writeText(text);
    setCopied(fmt);
    setTimeout(() => setCopied(''), 1500);
  };

  return (
    <ToolPageWrapper title="Color Picker" description="RGB/HSL Pickers + Alpha + Value Converter" emoji="🎨">
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

          <div 
            className="w-full rounded-2xl h-24 shadow-sm border border-[var(--card-border)] relative overflow-hidden" 
            style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 / 20px 20px' }}
          >
            <div className="absolute inset-0" style={{ background: `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})` }} />
          </div>
          <p className="font-mono text-2xl font-bold text-center uppercase tracking-widest">{hex}</p>
        </div>

        {/* Middle Column: Active Picker Controls */}
        <div className="flex flex-col gap-6">
          <h3 className="text-sm font-semibold text-[var(--muted-text)] uppercase tracking-wider">Controls</h3>
          
          <div className="tool-card p-4 space-y-6">
            {pickerType === 'rgb' && (
              <>
                <RgbaColorPicker color={rgba} onChange={setRgba} style={{ width: '100%', height: '200px' }} />
                
                <div className="space-y-5 pt-4 border-t border-[var(--card-border)]">
                  <ColorSlider label="Red (R)" value={rgba.r} max={255} setter={(v: number) => setRgba({...rgba, r: v})}
                    gradient={`linear-gradient(to right, rgba(0, ${rgba.g}, ${rgba.b}, 1), rgba(255, ${rgba.g}, ${rgba.b}, 1))`} />
                  <ColorSlider label="Green (G)" value={rgba.g} max={255} setter={(v: number) => setRgba({...rgba, g: v})}
                    gradient={`linear-gradient(to right, rgba(${rgba.r}, 0, ${rgba.b}, 1), rgba(${rgba.r}, 255, ${rgba.b}, 1))`} />
                  <ColorSlider label="Blue (B)" value={rgba.b} max={255} setter={(v: number) => setRgba({...rgba, b: v})}
                    gradient={`linear-gradient(to right, rgba(${rgba.r}, ${rgba.g}, 0, 1), rgba(${rgba.r}, ${rgba.g}, 255, 1))`} />
                  <ColorSlider label="Alpha (A)" value={rgba.a} max={1} isAlpha={true} setter={(v: number) => setRgba({...rgba, a: v})}
                    gradient={`linear-gradient(to right, rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 0), rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 1))`} />
                </div>
              </>
            )}

            {pickerType === 'hsl' && (
              <>
                <HslaColorPicker color={{ h: hsl.h, s: hsl.s, l: hsl.l, a: rgba.a }} onChange={handleHslChange} style={{ width: '100%', height: '200px' }} />
                
                <div className="space-y-5 pt-4 border-t border-[var(--card-border)]">
                  <ColorSlider label="Hue (H)" value={hsl.h} max={360} setter={(v: number) => handleHslChange({...hsl, a: rgba.a, h: v})}
                    gradient={`linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)`} />
                  <ColorSlider label="Saturation (S)" value={hsl.s} max={100} setter={(v: number) => handleHslChange({...hsl, a: rgba.a, s: v})}
                    gradient={`linear-gradient(to right, hsl(${hsl.h}, 0%, ${hsl.l}%), hsl(${hsl.h}, 100%, ${hsl.l}%))`} />
                  <ColorSlider label="Lightness (L)" value={hsl.l} max={100} setter={(v: number) => handleHslChange({...hsl, a: rgba.a, l: v})}
                    gradient={`linear-gradient(to right, #000, hsl(${hsl.h}, ${hsl.s}%, 50%), #fff)`} />
                  <ColorSlider label="Alpha (A)" value={rgba.a} max={1} isAlpha={true} setter={(v: number) => handleHslChange({...hsl, a: v})}
                    gradient={`linear-gradient(to right, hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0), hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 1))`} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Values & Material Grid */}
        <div className="flex flex-col gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--muted-text)] uppercase tracking-wider">Color Values</h3>
            
            {([
              ['hex', 'HEX', hex.toUpperCase()],
              ['rgb', 'RGB', rgba.a < 1 ? `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})` : `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`],
              ['hsl', 'HSL', rgba.a < 1 ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${rgba.a})` : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`],
              ['cmyk', 'CMYK', `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`],
            ] as [CopyFormat, string, string][]).map(([fmt, label, val]) => (
              <div key={fmt} className="tool-card p-3 flex items-center justify-between gap-2">
                <div className="flex-1 overflow-hidden">
                  <span className="text-xs font-bold mr-2">{label}</span>
                  <div className="font-mono text-sm text-[var(--foreground)] truncate mt-1">{val}</div>
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

          <div className="space-y-3 mt-4">
            <h3 className="text-sm font-semibold text-[var(--muted-text)] uppercase tracking-wider">Material Colors</h3>
            <div className="tool-card p-4 grid grid-cols-8 gap-2">
              {MATERIAL_COLORS.map(c => (
                <button key={c} onClick={() => handleHexChange(c)}
                  title={c}
                  className="w-full aspect-square rounded-md border transition-transform hover:scale-110 shadow-sm"
                  style={{ 
                    background: c, 
                    borderColor: hex.slice(0,7).toLowerCase() === c.toLowerCase() ? 'var(--foreground)' : 'rgba(0,0,0,0.1)' 
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
