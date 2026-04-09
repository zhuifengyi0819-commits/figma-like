'use client';

import { useState } from 'react';
import LayerPanel from './LayerPanel';
import ComponentLibrary from './ComponentLibrary';
import DesignTokenPanel from './DesignTokenPanel';
import { Layers, LayoutGrid, Palette } from 'lucide-react';

type LeftTab = 'layers' | 'components' | 'tokens';

export default function LeftPanel() {
  const [tab, setTab] = useState<LeftTab>('layers');

  const tabs: { id: LeftTab; label: string; icon: React.ReactNode }[] = [
    { id: 'layers', label: '图层', icon: <Layers size={14} /> },
    { id: 'components', label: '组件库', icon: <LayoutGrid size={14} /> },
    { id: 'tokens', label: '变量', icon: <Palette size={14} /> },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border)]">
      <div className="flex border-b border-[var(--border)]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              tab === t.id
                ? 'text-[var(--accent)] border-[var(--accent)]'
                : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'layers' && <LayerPanel />}
        {tab === 'components' && <ComponentLibrary />}
        {tab === 'tokens' && <DesignTokenPanel />}
      </div>
    </div>
  );
}
