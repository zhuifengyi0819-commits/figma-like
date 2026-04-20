'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { Type, Trash2, Edit3, Check, X } from 'lucide-react';

export default function TextStylesPanel() {
  const { textStyles, removeTextStyle, renameTextStyle, applyTextStyle, selectedIds, shapes } = useEditorStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const selectedText = selectedIds.length === 1 ? shapes.find(s => selectedIds[0] === s.id && s.type === 'text') : null;

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
    setContextMenu(null);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) renameTextStyle(id, editingName.trim());
    setEditingId(null);
  };

  const handleApply = (styleId: string) => {
    if (selectedText) {
      applyTextStyle([selectedText.id], styleId);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">文本样式</span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{textStyles.length} 个</span>
      </div>

      {/* Style list */}
      <div className="flex-1 overflow-y-auto py-1">
        {textStyles.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <Type size={24} className="mx-auto text-[var(--text-tertiary)] mb-2 opacity-40" />
            <p className="text-[11px] text-[var(--text-tertiary)]">暂无文本样式</p>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">选中文字后在属性面板保存</p>
          </div>
        ) : (
          textStyles.map(style => (
            <div key={style.id} className="group relative">
              {editingId === style.id ? (
                <div className="flex items-center gap-1 px-3 py-1.5">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveRename(style.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-0.5 text-[11px] text-[var(--text-primary)] outline-none"
                  />
                  <button onClick={() => handleSaveRename(style.id)} className="p-0.5 text-[var(--accent)]"><Check size={12} /></button>
                  <button onClick={() => setEditingId(null)} className="p-0.5 text-[var(--text-tertiary)]"><X size={12} /></button>
                </div>
              ) : (
                <button
                  onClick={() => handleApply(style.id)}
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ id: style.id, x: e.clientX, y: e.clientY }); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left"
                  disabled={!selectedText}
                  title={!selectedText ? '请先选中一个文本图形' : `应用到: ${selectedText.name}`}
                >
                  <div className="w-8 h-8 rounded bg-[var(--bg-elevated)] flex items-center justify-center flex-shrink-0">
                    <Type size={14} className="text-[var(--text-secondary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[var(--text-primary)] truncate">{style.name}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                      {style.fontFamily} · {style.fontSize}px · {style.fontWeight}
                    </div>
                  </div>
                  <div
                    className="w-4 h-4 rounded flex-shrink-0"
                    style={{ backgroundColor: style.fill }}
                  />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-xl py-1 w-32 animate-scale-in"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => handleStartRename(contextMenu.id, textStyles.find(s => s.id === contextMenu.id)?.name || '')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              <Edit3 size={12} /> 重命名
            </button>
            <button
              onClick={() => { removeTextStyle(contextMenu.id); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-[var(--bg-elevated)]"
            >
              <Trash2 size={12} /> 删除
            </button>
          </div>
        </>
      )}

      {/* Apply hint */}
      {selectedText && textStyles.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--border)]">
          <p className="text-[10px] text-[var(--text-tertiary)]">💡 点击样式应用到「{selectedText.name}」</p>
        </div>
      )}
    </div>
  );
}
