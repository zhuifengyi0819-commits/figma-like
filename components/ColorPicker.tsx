'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PRESET_COLORS, Gradient } from '@/lib/types';

interface ColorPickerProps {
  label: string;
  value: string;
  gradient?: Gradient;
  onChange: (color: string) => void;
  onGradientChange?: (g: Gradient | undefined) => void;
}

const RECENT_KEY = 'ai-canvas:recent-colors';
const MAX_RECENT = 10;

function getRecentColors(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function addRecentColor(color: string) {
  const recent = getRecentColors().filter(c => c !== color);
  recent.unshift(color);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function GradientEditor({ gradient, onChange }: { gradient: Gradient; onChange: (g: Gradient) => void }) {
  const updateStop = (idx: number, patch: Partial<{ offset: number; color: string }>) => {
    const stops = gradient.stops.map((s, i) => i === idx ? { ...s, ...patch } : s);
    onChange({ ...gradient, stops });
  };
  const addStop = () => {
    const stops = [...gradient.stops, { offset: 0.5, color: '#888888' }].sort((a, b) => a.offset - b.offset);
    onChange({ ...gradient, stops });
  };
  const removeStop = (idx: number) => {
    if (gradient.stops.length <= 2) return;
    onChange({ ...gradient, stops: gradient.stops.filter((_, i) => i !== idx) });
  };

  const gradientCSS = gradient.type === 'linear'
    ? `linear-gradient(${gradient.angle || 0}deg, ${gradient.stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`
    : `radial-gradient(circle, ${gradient.stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <select
          value={gradient.type}
          onChange={e => onChange({ ...gradient, type: e.target.value as 'linear' | 'radial' })}
          className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-[11px] text-[var(--text-primary)] px-1.5 py-1 focus:outline-none"
        >
          <option value="linear">线性</option>
          <option value="radial">径向</option>
        </select>
        {gradient.type === 'linear' && (
          <div className="flex items-center gap-1">
            <input
              type="range" min={0} max={360} value={gradient.angle || 0}
              onChange={e => onChange({ ...gradient, angle: parseInt(e.target.value) })}
              className="w-16 h-1 accent-[var(--accent)]"
            />
            <span className="text-[10px] text-[var(--text-tertiary)] font-mono w-8">{gradient.angle || 0}°</span>
          </div>
        )}
      </div>
      <div className="h-6 rounded-md border border-[var(--border)]" style={{ background: gradientCSS }} />
      <div className="space-y-1.5">
        {gradient.stops.map((stop, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="color" value={stop.color}
              onChange={e => updateStop(i, { color: e.target.value })}
              className="w-6 h-6 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0"
            />
            <input
              type="number" min={0} max={100} value={Math.round(stop.offset * 100)}
              onChange={e => updateStop(i, { offset: parseInt(e.target.value) / 100 })}
              className="w-14 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[11px] text-[var(--text-primary)] font-mono focus:outline-none"
            />
            <span className="text-[10px] text-[var(--text-tertiary)]">%</span>
            {gradient.stops.length > 2 && (
              <button onClick={() => removeStop(i)} className="text-[var(--text-tertiary)] hover:text-[var(--danger)] text-[11px] px-1" aria-label="删除色标">×</button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addStop} className="text-[11px] text-[var(--accent)] hover:underline">+ 添加色标</button>
    </div>
  );
}

export default function ColorPicker({ label, value, gradient, onChange, onGradientChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [mode, setMode] = useState<'solid' | 'gradient'>(gradient ? 'gradient' : 'solid');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setHex(value); }, [value]);
  useEffect(() => { setRecentColors(getRecentColors()); }, [open]);
  useEffect(() => { setMode(gradient ? 'gradient' : 'solid'); }, [gradient]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const commitColor = useCallback((c: string) => {
    onChange(c);
    if (onGradientChange) onGradientChange(undefined);
    addRecentColor(c);
    setRecentColors(getRecentColors());
  }, [onChange, onGradientChange]);

  const previewBg = gradient
    ? (gradient.type === 'linear'
      ? `linear-gradient(${gradient.angle || 0}deg, ${gradient.stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`
      : `radial-gradient(circle, ${gradient.stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`)
    : value === 'transparent' ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px' : value;

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{label}</label>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1.5 hover:border-[var(--border-active)] transition-colors"
        >
          <div className="w-6 h-6 rounded border border-[var(--border)]" style={{ background: previewBg }} />
          <span className="text-sm font-mono text-[var(--text-primary)]">
            {gradient ? '渐变' : value === 'transparent' ? 'None' : value.toUpperCase()}
          </span>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 w-[280px] p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/40 animate-scale-in">
            {/* Mode toggle */}
            {onGradientChange && (
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => { setMode('solid'); if (gradient) onGradientChange(undefined); }}
                  className={`flex-1 py-1 text-[11px] rounded transition-colors ${mode === 'solid' ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}
                >
                  纯色
                </button>
                <button
                  onClick={() => {
                    setMode('gradient');
                    if (!gradient) onGradientChange({ type: 'linear', angle: 90, stops: [{ offset: 0, color: value }, { offset: 1, color: '#000000' }] });
                  }}
                  className={`flex-1 py-1 text-[11px] rounded transition-colors ${mode === 'gradient' ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}
                >
                  渐变
                </button>
              </div>
            )}

            {mode === 'gradient' && gradient && onGradientChange ? (
              <GradientEditor gradient={gradient} onChange={onGradientChange} />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="color"
                    value={value === 'transparent' ? '#000000' : value}
                    onChange={(e) => { setHex(e.target.value); commitColor(e.target.value); }}
                    className="w-10 h-10 rounded-lg border border-[var(--border)] cursor-pointer bg-transparent" style={{ padding: 0 }}
                  />
                  <div className="flex-1">
                    <input
                      type="text" value={hex}
                      onChange={(e) => setHex(e.target.value)}
                      onBlur={() => { if (/^#[0-9a-f]{3,8}$/i.test(hex) || hex === 'transparent') commitColor(hex); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (/^#[0-9a-f]{3,8}$/i.test(hex) || hex === 'transparent')) { commitColor(hex); setOpen(false); } }}
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1 text-sm text-[var(--text-primary)] font-mono focus:border-[var(--accent)] focus:outline-none"
                      placeholder="#000000"
                    />
                  </div>
                  <button
                    onClick={() => { commitColor('transparent'); setOpen(false); }}
                    className="px-2 py-1 text-[10px] rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    title="透明"
                  >无</button>
                </div>
                <div className="grid grid-cols-10 gap-1 mb-3">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => { commitColor(color); setOpen(false); }}
                      className={`w-5 h-5 rounded-sm border transition-transform hover:scale-125 ${value === color ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border)]'}`}
                      style={{ background: color }} title={color}
                    />
                  ))}
                </div>
                {recentColors.length > 0 && (
                  <div>
                    <span className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">最近使用</span>
                    <div className="flex gap-1 mt-1">
                      {recentColors.map((color, i) => (
                        <button key={`${color}-${i}`} onClick={() => { commitColor(color); setOpen(false); }} className="w-5 h-5 rounded-sm border border-[var(--border)] hover:scale-125 transition-transform" style={{ background: color }} title={color} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
