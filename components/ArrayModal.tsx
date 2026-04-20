'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { X } from 'lucide-react';

interface ArrayModalProps {
  selectedIds: string[];
  onClose: () => void;
}

export default function ArrayModal({ selectedIds, onClose }: ArrayModalProps) {
  const { arrayCopy } = useEditorStore();
  const [count, setCount] = useState(5);
  const [spacing, setSpacing] = useState(60);
  const [rotation, setRotation] = useState(30);
  const [layout, setLayout] = useState<'circular' | 'linear' | 'grid'>('circular');

  const handleApply = () => {
    if (count < 2) return;
    arrayCopy(selectedIds, count, spacing, rotation, layout);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl shadow-black/60 w-[340px] overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-primary)]">阵列复制</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-tertiary)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Layout type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">排列方式</label>
            <div className="grid grid-cols-3 gap-1">
              {([['circular', '环形'], ['linear', '线性'], ['grid', '网格']] as [typeof layout, string][]).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setLayout(v)}
                  className={`py-1.5 text-[11px] rounded-lg transition-colors ${layout === v ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">数量</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={2}
                max={20}
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="text-xs text-[var(--text-primary)] font-mono w-6 text-right">{count}</span>
            </div>
          </div>

          {/* Spacing */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
              {layout === 'circular' ? '半径' : '间距'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={10}
                max={300}
                value={spacing}
                onChange={e => setSpacing(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="text-xs text-[var(--text-primary)] font-mono w-10 text-right">{spacing}px</span>
            </div>
          </div>

          {/* Rotation (only for circular) */}
          {layout === 'circular' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">每次旋转角度</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={5}
                  max={120}
                  value={rotation}
                  onChange={e => setRotation(Number(e.target.value))}
                  className="flex-1 accent-[var(--accent)]"
                />
                <span className="text-xs text-[var(--text-primary)] font-mono w-8 text-right">{rotation}°</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-xs rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
            取消
          </button>
          <button onClick={handleApply} className="px-4 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-[var(--bg-deep)] hover:opacity-90 transition-colors font-medium">
            应用 ({count - 1} 个副本)
          </button>
        </div>
      </div>
    </div>
  );
}
