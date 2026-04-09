'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { DesignToken } from '@/lib/types';
import { Plus, Trash2, Palette, Type, RulerIcon, Circle, Layers } from 'lucide-react';
import { useState } from 'react';

const categoryConfig: Record<DesignToken['category'], { label: string; icon: React.ReactNode; suffix: string }> = {
  color: { label: '颜色', icon: <Palette size={12} />, suffix: '' },
  fontSize: { label: '字号', icon: <Type size={12} />, suffix: 'px' },
  spacing: { label: '间距', icon: <RulerIcon size={12} />, suffix: 'px' },
  borderRadius: { label: '圆角', icon: <Circle size={12} />, suffix: 'px' },
  fontFamily: { label: '字体', icon: <Type size={12} />, suffix: '' },
  shadow: { label: '阴影', icon: <Layers size={12} />, suffix: '' },
};

export default function DesignTokenPanel() {
  const { themes, activeThemeId, addToken, updateToken, deleteToken, addTheme, deleteTheme, setActiveThemeId } = useEditorStore();
  const [newCategory, setNewCategory] = useState<DesignToken['category']>('color');
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [filter, setFilter] = useState<DesignToken['category'] | 'all'>('all');

  const activeTheme = themes.find(t => t.id === activeThemeId);
  if (!activeTheme) return null;

  const filteredTokens = filter === 'all' ? activeTheme.tokens : activeTheme.tokens.filter(t => t.category === filter);
  const grouped = Object.entries(
    filteredTokens.reduce<Record<string, DesignToken[]>>((acc, tok) => {
      (acc[tok.category] = acc[tok.category] || []).push(tok);
      return acc;
    }, {})
  );

  const handleAdd = () => {
    if (!newName.trim() || !newValue.trim()) return;
    addToken(activeThemeId, { name: newName.trim(), category: newCategory, value: newValue.trim() });
    setNewName(''); setNewValue('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Theme selector */}
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <select
            value={activeThemeId}
            onChange={e => setActiveThemeId(e.target.value)}
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
            title="选择主题"
          >
            {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button
            onClick={() => { const name = prompt('主题名称'); if (name) addTheme(name); }}
            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            title="新建主题" aria-label="新建主题"
          >
            <Plus size={14} />
          </button>
          {themes.length > 1 && (
            <button
              onClick={() => deleteTheme(activeThemeId)}
              className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)]"
              title="删除主题" aria-label="删除主题"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="px-3 py-1.5 flex items-center gap-1 overflow-x-auto border-b border-[var(--border)]">
        {(['all', 'color', 'fontSize', 'spacing', 'borderRadius'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors ${
              filter === cat ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {cat === 'all' ? '全部' : categoryConfig[cat].label}
          </button>
        ))}
      </div>

      {/* Token list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {grouped.map(([category, tokens]) => (
          <div key={category}>
            <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
              {categoryConfig[category as DesignToken['category']]?.icon}
              {categoryConfig[category as DesignToken['category']]?.label}
              <span className="ml-auto text-[9px] opacity-50">{tokens.length}</span>
            </div>
            <div className="space-y-1">
              {tokens.map(token => (
                <div key={token.id} className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--bg-elevated)] transition-colors">
                  {token.category === 'color' ? (
                    <input
                      type="color"
                      value={token.value}
                      onChange={e => updateToken(activeThemeId, token.id, { value: e.target.value })}
                      className="w-5 h-5 rounded border border-[var(--border)] cursor-pointer bg-transparent"
                      title="修改颜色"
                    />
                  ) : (
                    <span className="w-5 h-5 flex items-center justify-center rounded bg-[var(--bg-deep)] text-[8px] text-[var(--text-tertiary)] font-mono">
                      {token.value.slice(0, 3)}
                    </span>
                  )}
                  <input
                    value={token.name}
                    onChange={e => updateToken(activeThemeId, token.id, { name: e.target.value })}
                    className="flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none min-w-0"
                    title="Token 名称"
                  />
                  <input
                    value={token.value}
                    onChange={e => updateToken(activeThemeId, token.id, { value: e.target.value })}
                    className="w-16 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] font-mono text-right outline-none"
                    title="Token 值"
                  />
                  <button
                    onClick={() => deleteToken(activeThemeId, token.id)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-all"
                    title="删除" aria-label="删除"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add token */}
      <div className="px-3 py-2 border-t border-[var(--border)] space-y-1.5">
        <div className="flex items-center gap-1.5">
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value as DesignToken['category'])}
            className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-secondary)]"
            title="Token 类别"
          >
            {Object.entries(categoryConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="名称"
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] min-w-0"
          />
          <input
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder="值"
            className="w-16 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] font-mono outline-none placeholder:text-[var(--text-tertiary)]"
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim() || !newValue.trim()}
            className="p-1 rounded bg-[var(--accent)] text-white disabled:opacity-30 hover:opacity-90 transition-opacity"
            title="添加 Token"
            aria-label="添加 Token"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
