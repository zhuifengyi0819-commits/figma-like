'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { TextStyle } from '@/lib/types';
import { Plus, Trash2, Copy, Type, Check } from 'lucide-react';
import { useState, useRef } from 'react';

const FONT_FAMILIES = [
  'sans-serif', 'serif', 'monospace', 'Inter', 'Arial', 'Helvetica',
  'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'SF Pro Display',
  'Roboto', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans',
];

const FONT_WEIGHTS = [
  { value: '100', label: 'Thin' },
  { value: '200', label: 'ExtraLight' },
  { value: '300', label: 'Light' },
  { value: 'normal', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'SemiBold' },
  { value: 'bold', label: 'Bold' },
  { value: '800', label: 'ExtraBold' },
  { value: '900', label: 'Black' },
];

function StylePreview({ style }: { style: TextStyle }) {
  return (
    <div
      className="px-2 py-1 rounded text-xs truncate"
        style={{
          fontFamily: style.fontFamily,
          fontSize: Math.min(style.fontSize, 14),
          fontWeight: style.fontWeight,
          color: style.fill,
          lineHeight: style.lineHeight ?? 1.2,
          letterSpacing: style.letterSpacing ?? 0,
        }}
    >
      Aa
    </div>
  );
}

function StyleItem({
  style,
  isActive,
  onSelect,
  onEdit,
  onApply,
}: {
  style: TextStyle;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onApply: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(true);
  };

  return (
    <div
      className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
        isActive ? 'bg-[var(--accent)]/20 border border-[var(--accent)]/30' : 'hover:bg-[var(--bg-elevated)] border border-transparent'
      }`}
      onClick={onSelect}
      onDoubleClick={onEdit}
      onContextMenu={handleContextMenu}
    >
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: style.fill }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[var(--text-primary)] truncate">{style.name}</div>
        <div className="text-[9px] text-[var(--text-tertiary)]">
          {style.fontSize}px · {style.fontWeight}
        </div>
      </div>
      <StylePreview style={style} />
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded shadow-lg z-50 py-1 min-w-[120px]"
          onBlur={(e) => { if (!menuRef.current?.contains(e.relatedTarget as Node)) setShowMenu(false); }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); setShowMenu(false); }}
          >
            ✏️ 重命名
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onApply(); setShowMenu(false); }}
          >
            <Copy size={10} className="inline mr-1" />应用到选中
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--danger)] hover:bg-red-500/10"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); useEditorStore.getState().removeTextStyle(style.id); setShowMenu(false); }}
          >
            <Trash2 size={10} className="inline mr-1" />删除
          </button>
        </div>
      )}
    </div>
  );
}

function StyleEditor({
  style,
  onSave,
  onCancel,
}: {
  style: TextStyle | null;
  onSave: (s: Omit<TextStyle, 'id'>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(style?.name || '');
  const [fontFamily, setFontFamily] = useState(style?.fontFamily || 'sans-serif');
  const [fontSize, setFontSize] = useState(style?.fontSize || 16);
  const [fontWeight, setFontWeight] = useState(style?.fontWeight || 'normal');
  const [lineHeight, setLineHeight] = useState(style?.lineHeight ?? 1.2);
  const [letterSpacing, setLetterSpacing] = useState(style?.letterSpacing ?? 0);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>(style?.textAlign || 'left');
  const [fill, setFill] = useState(style?.fill || '#E8E4DF');

  const previewStyle: TextStyle = {
    id: 'preview',
    name,
    fontFamily,
    fontSize: Math.min(fontSize, 24),
    fontWeight,
    fill,
    lineHeight,
    letterSpacing,
    textAlign,
  };

  return (
    <div className="space-y-3 p-3 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--text-primary)]">
          {style ? '编辑文本样式' : '新建文本样式'}
        </span>
        <button onClick={onCancel} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">✕</button>
      </div>

      {/* Preview */}
      <div className="bg-[var(--bg-surface)] rounded p-3">
        <div
          className="text-center"
          style={{
            fontFamily: previewStyle.fontFamily,
            fontSize: previewStyle.fontSize,
            fontWeight: previewStyle.fontWeight,
            color: previewStyle.fill,
            lineHeight: previewStyle.lineHeight,
            letterSpacing: previewStyle.letterSpacing,
          }}
        >
          {name || '样式预览'}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">名称</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="样式名称"
          className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Font Family */}
      <div>
        <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">字体</label>
        <select
          value={fontFamily}
          onChange={e => setFontFamily(e.target.value)}
          className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        >
          {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Font Size & Weight */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">字号</label>
          <input
            type="number"
            value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            min={8} max={200}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">字重</label>
          <select
            value={fontWeight}
            onChange={e => setFontWeight(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          >
            {FONT_WEIGHTS.map(w => <option key={w.value} value={w.value}>{w.label} ({w.value})</option>)}
          </select>
        </div>
      </div>

      {/* Line Height & Letter Spacing */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">行高</label>
          <input
            type="number"
            value={lineHeight}
            onChange={e => setLineHeight(Number(e.target.value))}
            min={0.5} max={5} step={0.1}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">字间距</label>
          <input
            type="number"
            value={letterSpacing}
            onChange={e => setLetterSpacing(Number(e.target.value))}
            min={-10} max={50} step={0.5}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
          />
        </div>
      </div>

      {/* Text Align */}
      <div>
        <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">对齐</label>
        <div className="grid grid-cols-4 gap-1">
          {(['left', 'center', 'right', 'justify'] as const).map(a => (
            <button
              key={a}
              onClick={() => setTextAlign(a)}
              className={`py-1 text-[10px] rounded transition-colors ${
                textAlign === a ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {a === 'left' ? '左' : a === 'center' ? '中' : a === 'right' ? '右' : '齐'}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block mb-1">颜色</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={fill}
            onChange={e => setFill(e.target.value)}
            className="w-8 h-8 rounded border border-[var(--border)] cursor-pointer bg-transparent"
          />
          <input
            type="text"
            value={fill}
            onChange={e => setFill(e.target.value)}
            className="flex-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono uppercase"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 text-[11px] rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] transition-colors"
        >
          取消
        </button>
        <button
          onClick={() => {
            if (!name.trim()) return;
            onSave({
              name: name.trim(),
              fontFamily,
              fontSize,
              fontWeight,
              fill,
              lineHeight,
              letterSpacing,
              textAlign,
            });
          }}
          disabled={!name.trim()}
          className="flex-1 py-1.5 text-[11px] rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-30 transition-colors"
        >
          {style ? '保存' : '创建'}
        </button>
      </div>
    </div>
  );
}

export default function TextStylePanel() {
  const { textStyles, selectedIds, shapes, applyTextStyle, addTextStyle, updateTextStyle, activeTextStyleId, setActiveTextStyleId } = useEditorStore();
  const [editingStyle, setEditingStyle] = useState<TextStyle | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const selectedTextShapes = shapes.filter(s => selectedIds.includes(s.id) && s.type === 'text');

  const handleApplyToSelection = () => {
    if (selectedTextShapes.length === 0) return;
    const textStyleId = editingStyle?.id || activeTextStyleId;
    if (!textStyleId) return;
    applyTextStyle(selectedTextShapes.map(s => s.id), textStyleId);
  };

  const handleSaveNewStyle = (style: Omit<TextStyle, 'id'>) => {
    addTextStyle(style);
    setShowEditor(false);
    setEditingStyle(null);
  };

  const handleUpdateStyle = (style: Omit<TextStyle, 'id'>) => {
    if (editingStyle) {
      updateTextStyle(editingStyle.id, style);
      setEditingStyle(null);
    }
  };

  const handleEdit = (style: TextStyle) => {
    setEditingStyle(style);
    setActiveTextStyleId(style.id);
    setShowEditor(true);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <h2 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
          <Type size={14} className="text-[var(--accent)]" />
          文本样式
        </h2>
        <button
          onClick={() => { setEditingStyle(null); setShowEditor(true); }}
          className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
          title="新建文本样式"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Apply to selection button */}
        {selectedTextShapes.length > 0 && textStyles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--text-tertiary)]">
                选中 {selectedTextShapes.length} 个文本
              </span>
            </div>
            <select
              value={activeTextStyleId || ''}
              onChange={e => setActiveTextStyleId(e.target.value || null)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            >
              <option value="">选择样式...</option>
              {textStyles.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              onClick={handleApplyToSelection}
              disabled={!activeTextStyleId}
              className="w-full py-1.5 text-[11px] rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-30 transition-colors flex items-center justify-center gap-1"
            >
              <Check size={11} />
              应用到选中文本
            </button>
          </div>
        )}

        {/* Style editor */}
        {showEditor && (
          <StyleEditor
            style={editingStyle}
            onSave={editingStyle ? handleUpdateStyle : handleSaveNewStyle}
            onCancel={() => { setShowEditor(false); setEditingStyle(null); }}
          />
        )}

        {/* Style list */}
        {textStyles.length > 0 ? (
          <div className="space-y-1">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">样式列表</span>
            {textStyles.map(style => (
              <div key={style.id} className="relative">
                <StyleItem
                  style={style}
                  isActive={activeTextStyleId === style.id}
                  onSelect={() => setActiveTextStyleId(style.id)}
                  onEdit={() => handleEdit(style)}
                  onApply={() => {
                    if (selectedTextShapes.length > 0) {
                      applyTextStyle(selectedTextShapes.map(s => s.id), style.id);
                    }
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          !showEditor && (
            <div className="text-center py-8">
              <Type size={24} className="mx-auto text-[var(--text-tertiary)] mb-2 opacity-50" />
              <p className="text-[11px] text-[var(--text-tertiary)]">暂无文本样式</p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">点击 + 创建第一个样式</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
