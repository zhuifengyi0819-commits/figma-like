'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { Play, GitBranch, Edit3 } from 'lucide-react';

type PrototypeMode = 'edit' | 'preview' | 'flow';

interface PrototypeToolbarProps {
  mode: PrototypeMode;
  onModeChange: (mode: PrototypeMode) => void;
  onPreview: () => void;
}

export default function PrototypeToolbar({ mode, onModeChange, onPreview }: PrototypeToolbarProps) {
  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-1 px-2 py-1.5 bg-[var(--bg-surface)]/95 backdrop-blur-sm border border-[var(--border)] rounded-xl shadow-lg shadow-black/20">
      {/* Mode tabs */}
      <div className="flex items-center gap-0.5 mr-1">
        <button
          onClick={() => onModeChange('edit')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
            mode === 'edit'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
          }`}
          title="编辑模式"
        >
          <Edit3 size={13} />
          编辑
        </button>
        <button
          onClick={() => onModeChange('flow')}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
            mode === 'flow'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
          }`}
          title="流程连线模式"
        >
          <GitBranch size={13} />
          流程
        </button>
      </div>

      <div className="w-px h-5 bg-[var(--border)] mx-0.5" />

      {/* Play button */}
      <button
        onClick={onPreview}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-all"
        title="预览原型"
      >
        <Play size={13} className="fill-current" />
        预览
      </button>
    </div>
  );
}
