'use client';
import { useState } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';
import { HexColorPicker, HslaStringColorPicker, RgbaStringColorPicker } from 'react-colorful';

type PickerType = 'hex' | 'rgb' | 'hsl' | 'disk' | 'slider' | 'material' | 'compact';
type CopyFormat = 'hex' | 'rgb' | 'hsl' | 'cmyk' | 'hsv';

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
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
  { key: 'hex', label: 'Corel / Disk', desc: 'Circular hue wheel' },
  { key: 'rgb', label: 'RGB Sliders', desc: 'Red, Green, Blue channels' },
  { key: 'hsl', label: 'HSL Picker', desc: 'Hue, Saturation, Lightness' },
  { key: 'slider', label: 'Lucid Slider', desc: 'Precision slider input' },
  { key: 'material', label: 'Material / Dino', desc: 'Flat color grid' },
  { key: 'compact', label: 'Atom / Shop', desc: 'Compact swatch picker' },
];

const MATERIAL_COLORS = [
  '#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3','#03a9f4','#00bcd4',
  '#009688','#4caf50','#8bc34a','#cddc39','#ffeb3b','#ffc107','#ff9800','#ff5722',
  '#795548','#9e9e9e','#607d8b','#000000','#212121','#424242','#616161','#ffffff',
  '#ffcdd2','#f8bbd0','#e1bee7','#c5cae9','#bbdefb','#b3e5fc','#b2dfdb','#c8e6c9',
];

export default function ColorPickerPage() {
  const [color, setColor] = useState('#6366f1');
  const [pickerType, setPickerType] = useState<PickerType>('hex');
  const [rgbaStr, setRgbaStr] = useState('rgba(99, 102, 241, 1)');
  const [hslaStr, setHslaStr] = useState('hsla(239, 84%, 67%, 1)');
  const [copied, setCopied] = useState('');

  // Sliders state
  const rgb = hexToRgb(color.startsWith('#') ? color : '#6366f1');
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

  const [rVal, setRVal] = useState(rgb.r);
  const [gVal, setGVal] = useState(rgb.g);
  const [bVal, setBVal] = useState(rgb.b);

  const applyRGB = () => {
    const hex = '#' + [rVal, gVal, bVal].map(v => v.toString(16).padStart(2, '0')).join('');
    setColor(hex);
  };

  const copyFormat = (fmt: CopyFormat) => {
    let text = '';
    switch (fmt) {
      case 'hex': text = color; break;
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
    <ToolPageWrapper title="Color Picker" description="7 picker types + HEX/RGB/HSL/CMYK/HSV converter" emoji="🎨">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Picker type selector */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Picker Type</h3>
          {PICKER_TYPES.map(pt => (
            <button key={pt.key} onClick={() => setPickerType(pt.key)}
              className={`w-full text-left p-3 rounded-xl transition-all ${pickerType === pt.key ? 'bg-indigo-900/50 border border-indigo-500' : 'tool-card hover:border-gray-600'}`}>
              <div className="text-sm font-medium text-white">{pt.label}</div>
              <div className="text-xs text-gray-500">{pt.desc}</div>
            </button>
          ))}
        </div>

        {/* Active Picker */}
        <div className="flex flex-col items-center gap-6">
          {(pickerType === 'hex') && (
            <HexColorPicker color={color} onChange={setColor} style={{ width: '100%', height: '220px' }} />
          )}
          {pickerType === 'rgb' && (
            <RgbaStringColorPicker color={rgbaStr} onChange={setRgbaStr} style={{ width: '100%', height: '220px' }} />
          )}
          {pickerType === 'hsl' && (
            <HslaStringColorPicker color={hslaStr} onChange={setHslaStr} style={{ width: '100%', height: '220px' }} />
          )}
          {pickerType === 'slider' && (
            <div className="w-full space-y-4">
              {[['R', rVal, setRVal, '#ef4444'], ['G', gVal, setGVal, '#22c55e'], ['B', bVal, setBVal, '#3b82f6']].map(([l, v, setter, c]) => (
                <div key={l as string} className="space-y-1">
                  <div className="flex justify-between text-sm"><span style={{ color: c as string }}>{l as string}</span><span className="text-gray-400">{v as number}</span></div>
                  <input type="range" min={0} max={255} value={v as number}
                    onChange={e => { (setter as (v: number) => void)(+e.target.value); applyRGB(); }}
                    className="w-full" style={{ accentColor: c as string }} />
                </div>
              ))}
              <button className="btn-primary w-full" onClick={applyRGB}>Apply</button>
            </div>
          )}
          {pickerType === 'material' && (
            <div className="grid grid-cols-8 gap-2">
              {MATERIAL_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-lg border-2 transition-all"
                  style={{ background: c, borderColor: color === c ? '#6366f1' : 'transparent' }}
                />
              ))}
            </div>
          )}
          {pickerType === 'compact' && (
            <div className="space-y-4 w-full">
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-full h-32 rounded-xl cursor-pointer border-0" />
              <input className="input-field font-mono text-center uppercase" value={color}
                onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(e.target.value); }} />
            </div>
          )}

          {/* Preview */}
          <div className="w-full rounded-2xl h-20 shadow-lg" style={{ background: color }} />
          <p className="font-mono text-lg font-bold text-white">{color.toUpperCase()}</p>
        </div>

        {/* Color Values */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Color Values</h3>
          {([
            ['hex', 'HEX', color.toUpperCase()],
            ['rgb', 'RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`],
            ['hsl', 'HSL', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`],
            ['cmyk', 'CMYK', `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`],
            ['hsv', 'HSV', `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`],
          ] as [CopyFormat, string, string][]).map(([fmt, label, val]) => (
            <div key={fmt} className="tool-card p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-gray-500">{label}</div>
                <div className="font-mono text-sm text-indigo-300">{val}</div>
              </div>
              <button
                onClick={() => copyFormat(fmt)}
                className={`text-xs px-3 py-1 rounded-lg transition-all ${copied === fmt ? 'bg-green-800 text-green-300' : 'bg-gray-700 hover:bg-indigo-700 text-gray-400 hover:text-white'}`}
              >
                {copied === fmt ? '✓' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToolPageWrapper>
  );
}
