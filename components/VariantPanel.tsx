'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { ComponentDef, VariantDef } from '@/lib/types';
import {
  GitBranch, Plus, Trash2, ChevronRight, ChevronDown,
  Check, X, Edit3, MousePointer2,
} from 'lucide-react';

function OverrideBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
      <span className="text-[var(--text-tertiary)]">{label}:</span>
      <span className="truncate max-w-[60px]">{value}</span>
    </span>
  );
}

function VariantItem({
  variant,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  componentId: string;
  variant: VariantDef;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(variant.name);

  const overrideEntries = Object.entries(variant.overrides || {});
  const fillOverride = overrideEntries.find(([k]) => k === 'fill' || k === '0');
  const strokeOverride = overrideEntries.find(([k]) => k === 'stroke');
  const fontSizeOverride = overrideEntries.find(([k]) => k === 'fontSize');

  const handleRenameCommit = () => {
    if (editName.trim() && editName !== variant.name) {
      onRename(editName.trim());
    }
    setEditing(false);
  };

  return (
    <div className={`group flex items-start gap-1 px-2 py-1 rounded cursor-pointer transition-colors ${isActive ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-elevated)]'}`}
      onClick={onSelect}
    >
      {/* Variant color indicator */}
      <div className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: fillOverride ? (fillOverride[1] as unknown as string) : 'var(--accent)' }} />

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={handleRenameCommit}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameCommit();
                if (e.key === 'Escape') { setEditing(false); setEditName(variant.name); }
              }}
              className="flex-1 min-w-0 bg-[var(--bg-deep)] border border-[var(--accent)] rounded px-1 py-0.5 text-[11px] text-[var(--text-primary)] outline-none"
            />
            <button onClick={handleRenameCommit} className="p-0.5 text-[var(--accent)]" aria-label="确认">
              <Check size={11} />
            </button>
            <button onClick={() => { setEditing(false); setEditName(variant.name); }} className="p-0.5 text-[var(--text-tertiary)]" aria-label="取消">
              <X size={11} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-primary)] truncate">{variant.name}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
                className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                title="重命名"
                aria-label="重命名"
              >
                <Edit3 size={10} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                title="删除变体"
                aria-label="删除变体"
              >
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Override badges */}
        {!editing && overrideEntries.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-0.5">
            {fillOverride && <OverrideBadge label="填充" value={fillOverride[1] as unknown as string} />}
            {strokeOverride && <OverrideBadge label="描边" value={strokeOverride[1] as unknown as string} />}
            {fontSizeOverride && <OverrideBadge label="字号" value={`${fontSizeOverride[1]}px`} />}
            {overrideEntries.length > 3 && (
              <span className="text-[9px] text-[var(--text-tertiary)]">+{overrideEntries.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ComponentVariantGroup({ comp }: { comp: ComponentDef }) {
  const { addVariant, shapes, selectedIds, updateShapes } = useEditorStore();
  const [expanded, setExpanded] = useState(true);
  const [newVariantName, setNewVariantName] = useState('');
  const [, setSelectedVariantId] = useState<string | null>(null);

  const instances = shapes.filter(s => s.masterComponentId === comp.id && !s.isMainComponent);
  const selectedInstance = instances.find(s => selectedIds.includes(s.id));

  const handleAddVariant = () => {
    if (!newVariantName.trim()) return;
    addVariant(comp.id, newVariantName.trim());
    setNewVariantName('');
  };

  const handleApplyVariant = (variant: VariantDef) => {
    if (!selectedInstance) return;
    updateShapes([selectedInstance.id], {
      overrides: { ...variant.overrides },
      variantName: variant.name,
    });
    setSelectedVariantId(variant.id);
  };

  const handleDeleteVariant = (variantId: string) => {
    useEditorStore.getState().deleteVariant(comp.id, variantId);
  };

  const handleRenameVariant = (variantId: string, name: string) => {
    useEditorStore.getState().renameVariant(comp.id, variantId, name);
  };

  return (
    <div className="mb-1">
      {/* Component header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-[var(--bg-elevated)] rounded transition-colors group"
      >
        {expanded ? <ChevronDown size={11} className="text-[var(--text-tertiary)] flex-shrink-0" /> : <ChevronRight size={11} className="text-[var(--text-tertiary)] flex-shrink-0" />}
        <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate flex-1 text-left">{comp.name}</span>
        <span className="text-[9px] text-[var(--text-tertiary)]">{comp.variants.length} 变体</span>
      </button>

      {/* Variants list */}
      {expanded && (
        <div className="ml-3 mt-0.5 space-y-0.5">
          {comp.variants.length === 0 && (
            <p className="text-[10px] text-[var(--text-tertiary)] italic px-2 py-1">暂无变体</p>
          )}
          {comp.variants.map(v => (
            <VariantItem
              key={v.id}
              componentId={comp.id}
              variant={v}
              isActive={selectedInstance?.variantName === v.name}
              onSelect={() => handleApplyVariant(v)}
              onDelete={() => handleDeleteVariant(v.id)}
              onRename={(name) => handleRenameVariant(v.id, name)}
            />
          ))}

          {/* Add variant input */}
          <div className="flex items-center gap-1 px-2 py-1">
            <GitBranch size={10} className="text-[var(--text-tertiary)] flex-shrink-0" />
            <input
              value={newVariantName}
              onChange={e => setNewVariantName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddVariant(); }}
              placeholder="新变体名称..."
              className="flex-1 min-w-0 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={handleAddVariant}
              disabled={!newVariantName.trim()}
              className="p-0.5 text-[var(--accent)] disabled:opacity-30 hover:opacity-80"
              title="添加变体"
              aria-label="添加变体"
            >
              <Plus size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VariantPanel() {
  const { components, selectedIds, shapes } = useEditorStore();

  const selectedInstance = shapes.find(s => selectedIds.includes(s.id) && s.masterComponentId && !s.isMainComponent);

  return (
    <div className="h-full flex flex-col">
      {/* Header hint */}
      <div className="px-3 py-2 border-b border-[var(--border)]">
        {selectedInstance ? (
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
            <MousePointer2 size={11} className="text-[var(--accent)]" />
            <span>已选中实例：点击下方变体以应用覆盖</span>
          </div>
        ) : (
          <p className="text-[10px] text-[var(--text-tertiary)]">选择组件实例后再选择变体来应用覆盖属性</p>
        )}
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-2">
        {components.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <GitBranch size={28} className="text-[var(--text-tertiary)] mb-2 opacity-30" />
            <p className="text-[11px] text-[var(--text-tertiary)]">暂无组件</p>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1 opacity-70">在画布上选中图形，<br/>点击属性面板&quot;创建组件&quot;</p>
          </div>
        ) : (
          <div className="space-y-1">
            {components.map(comp => (
              <ComponentVariantGroup key={comp.id} comp={comp} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[var(--border)]">
        <p className="text-[9px] text-[var(--text-tertiary)]">
          {components.length} 个组件 · {components.reduce((acc, c) => acc + c.variants.length, 0)} 个变体
        </p>
      </div>
    </div>
  );
}
