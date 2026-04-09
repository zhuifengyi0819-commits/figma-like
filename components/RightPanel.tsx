'use client';

import { useState } from 'react';
import ChatPanel from './ChatPanel';
import PropertiesPanel from './PropertiesPanel';
import CodeInspector from './CodeInspector';
import { Sparkles, Settings2, Code } from 'lucide-react';

type RightTab = 'chat' | 'properties' | 'code';

export default function RightPanel() {
  const [tab, setTab] = useState<RightTab>('chat');

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border)]">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            tab === 'chat'
              ? 'text-[var(--accent)] border-[var(--accent)]'
              : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
          }`}
        >
          <Sparkles size={13} />
          AI
        </button>
        <button
          onClick={() => setTab('properties')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            tab === 'properties'
              ? 'text-[var(--accent)] border-[var(--accent)]'
              : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
          }`}
        >
          <Settings2 size={13} />
          属性
        </button>
        <button
          onClick={() => setTab('code')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            tab === 'code'
              ? 'text-[var(--accent)] border-[var(--accent)]'
              : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
          }`}
        >
          <Code size={13} />
          代码
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={tab === 'chat' ? 'h-full' : 'hidden'}>
          <ChatPanel />
        </div>
        <div className={tab === 'properties' ? 'h-full' : 'hidden'}>
          <PropertiesPanel />
        </div>
        <div className={tab === 'code' ? 'h-full' : 'hidden'}>
          <CodeInspector />
        </div>
      </div>
    </div>
  );
}
