'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { Play, GitBranch, Edit3, Grid } from 'lucide-react';

interface PrototypeToolbarProps {
  onOverview: () => void;
  onPreview: () => void;
  onExit: () => void;
}

export default function PrototypeToolbar({ onOverview, onPreview, onExit }: PrototypeToolbarProps) {
  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-1 px-2 py-1.5 bg-[var(--bg-surface)]/95 backdrop-blur-sm border border-[var(--border)] rounded-xl shadow-lg shadow-black/20">
      {/* Overview */}
      <button
        onClick={onOverview}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-all"
        title="流程概览"
      >
        <Grid size={13} />
        概览
      </button>

      <div className="w-px h-5 bg-[var(--border)] mx-0.5" />

      {/* Exit prototype mode */}
      <button
        onClick={onExit}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-all"
        title="退出原型模式"
      >
        <Edit3 size={13} />
        退出
      </button>

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
