'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';

export default function BatchRenameModal({ 
  selectedIds, 
  onClose 
}: { 
  selectedIds: string[]; 
  onClose: () => void; 
}) {
  const [pattern, setPattern] = useState('Layer-{##}');
  const { updateShape } = useEditorStore();
  
  const handleRename = () => {
    const regex = /\{#+\}/g;
    const match = pattern.match(regex);
    if (!match) return;
    
    const padLength = match[0].length - 2; // length of {#...} minus '{' and '}'
    
    selectedIds.forEach((id, index) => {
      const num = (index + 1).toString().padStart(padLength, '0');
      const newName = pattern.replace(regex, num);
      updateShape(id, { name: newName });
    });
    
    onClose();
  };
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-96 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold">批量重命名</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-elevated)]">
            <X size={16} />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-2">命名模式</label>
            <input
              type="text"
              value={pattern}
              onChange={e => setPattern(e.target.value)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
              placeholder="Card-{##}"
            />
            <p className="mt-1.5 text-[10px] text-[var(--text-tertiary)]">
              使用 {'{##}'} 表示序号，如 Card-01, Card-02<br/>
              {'{###}'} = 001, 002, ...
            </p>
          </div>
          
          <div className="text-xs text-[var(--text-secondary)]">
            将重命名 <span className="text-[var(--accent)]">{selectedIds.length}</span> 个图层
          </div>
        </div>
        
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            取消
          </button>
          <button
            onClick={handleRename}
            className="px-4 py-2 text-xs bg-[var(--accent)] text-white rounded-lg hover:opacity-90"
          >
            重命名
          </button>
        </div>
      </div>
    </div>
  );
}