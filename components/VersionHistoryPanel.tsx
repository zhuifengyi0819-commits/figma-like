'use client';
import { useState } from 'react';
import { History, RotateCcw, Trash2, X, Save } from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';

export default function VersionHistoryPanel({ onClose }: { onClose: () => void }) {
  const { versionHistory, saveVersion, restoreVersion, deleteVersion, clearVersionHistory } = useEditorStore();
  
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionName, setVersionName] = useState('');
  
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', { 
      month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    });
  };
  
  const handleSaveVersion = () => {
    const name = versionName.trim() || undefined;
    saveVersion(name);
    setVersionName('');
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <History size={16} />
          <span className="text-sm font-medium">版本历史</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-elevated)]">
          <X size={16} />
        </button>
      </div>
      
      {/* Save version input */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <input
            value={versionName}
            onChange={e => setVersionName(e.target.value)}
            placeholder="输入版本名称…"
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveVersion();
            }}
          />
          <button
            onClick={handleSaveVersion}
            className="flex items-center gap-1 px-2 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:opacity-90"
          >
            <Save size={12} />
            保存
          </button>
        </div>
      </div>
      
      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {versionHistory.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--text-tertiary)]">
            暂无版本历史
          </div>
        ) : (
          versionHistory.map((version) => (
            <div
              key={version.id}
              className={`px-4 py-3 border-b border-[var(--border)] cursor-pointer transition-colors ${
                selectedVersionId === version.id ? 'bg-[var(--accent)]/5' : 'hover:bg-[var(--bg-elevated)]'
              }`}
              onClick={() => setSelectedVersionId(version.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--text-primary)]">{version.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      restoreVersion(version.id);
                    }}
                    className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                    title="恢复此版本"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteVersion(version.id);
                    }}
                    className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)]">
                {formatTime(version.timestamp)}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {versionHistory.length} 个版本 · 自动保存最近 50 个
        </span>
        {versionHistory.length > 0 && (
          <button
            onClick={() => {
              if (confirm('确定要清空所有版本历史吗？')) {
                clearVersionHistory();
              }
            }}
            className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors"
          >
            清空
          </button>
        )}
      </div>
    </div>
  );
}