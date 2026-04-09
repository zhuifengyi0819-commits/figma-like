'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { Plus, X, Copy } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function PageTabs() {
  const { pages, activePageId, addPage, deletePage, renamePage, setActivePageId, duplicatePage } = useEditorStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editingId]);

  const commitRename = () => {
    if (editingId && editName.trim()) {
      renamePage(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex items-center gap-0.5 h-8 px-2 bg-[var(--bg-deep)] border-b border-[var(--border)] overflow-x-auto">
      {pages.map(page => (
        <div
          key={page.id}
          className={`group flex items-center gap-1 px-3 py-1 rounded-t text-[11px] cursor-pointer transition-colors select-none min-w-0 ${
            page.id === activePageId
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-t border-x border-[var(--border)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
          }`}
          onClick={() => setActivePageId(page.id)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingId(page.id);
            setEditName(page.name);
          }}
        >
          {editingId === page.id ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingId(null);
                e.stopPropagation();
              }}
              onClick={e => e.stopPropagation()}
              className="w-16 bg-transparent border-b border-[var(--accent)] outline-none text-[11px] text-[var(--text-primary)]"
            />
          ) : (
            <span className="truncate max-w-[80px]">{page.name}</span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); duplicatePage(page.id); }}
              className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]"
              title="复制页面"
              aria-label="复制页面"
            >
              <Copy size={10} />
            </button>
            {pages.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); deletePage(page.id); }}
                className="p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                title="删除页面"
                aria-label="删除页面"
              >
                <X size={10} />
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        onClick={() => addPage()}
        className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors flex-shrink-0"
        title="新建页面"
        aria-label="新建页面"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
