'use client';

import { useState } from 'react';
import LayerPanel from './LayerPanel';
import ComponentLibrary from './ComponentLibrary';
import { Layers, LayoutGrid } from 'lucide-react';

export default function LeftPanel() {
  const [tab, setTab] = useState<'layers' | 'components'>('layers');

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border)]">
      {/* Tab header */}
      <div className="flex border-b border-[var(--border)]">
        <button
          onClick={() => setTab('layers')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
            tab === 'layers'
              ? 'text-[var(--accent)] border-[var(--accent)]'
              : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
          }`}
        >
          <Layers size={14} />
          图层
        </button>
        <button
          onClick={() => setTab('components')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
            tab === 'components'
              ? 'text-[var(--accent)] border-[var(--accent)]'
              : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
          }`}
        >
          <LayoutGrid size={14} />
          组件库
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'layers' ? <LayerPanel /> : <ComponentLibrary />}
      </div>
    </div>
  );
}
