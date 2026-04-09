'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { Shape } from '@/lib/types';
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, Star, ImageIcon, Triangle, ArrowRight, Type, Minus, Square, Circle, Component, Layers, Frame, PenTool, ChevronRight } from 'lucide-react';
import { useCallback, useState, useRef, useEffect, useMemo } from 'react';

const typeIconMap: Record<string, React.ReactNode> = {
  rect: <Square size={13} />,
  circle: <Circle size={13} />,
  text: <Type size={13} />,
  line: <Minus size={13} />,
  arrow: <ArrowRight size={13} />,
  star: <Star size={13} />,
  triangle: <Triangle size={13} />,
  image: <ImageIcon size={13} />,
  component: <Component size={13} />,
  frame: <Frame size={13} />,
  path: <PenTool size={13} />,
};

interface LayerItemProps {
  shape: Shape;
  isSelected: boolean;
  depth: number;
  onSelect: (id: string, addToSelection: boolean) => void;
}

function LayerItem({ shape, isSelected, depth, onSelect }: LayerItemProps) {
  const { updateShape, deleteShape, saveMaterial, duplicateShapes } = useEditorStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(shape.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [isEditing]);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== shape.name) updateShape(shape.id, { name: trimmed });
    setIsEditing(false);
  };

  return (
    <div
      className={`
        group flex items-center gap-1.5 py-1.5 cursor-pointer border-l-2 transition-all duration-150
        ${isSelected
          ? 'border-l-[var(--accent)] bg-[var(--bg-hover)]'
          : 'border-l-transparent hover:bg-[var(--bg-elevated)]'
        }
        ${!shape.visible ? 'opacity-50' : ''}
      `}
      style={{ paddingLeft: 12 + depth * 16, paddingRight: 12 }}
      onClick={(e) => onSelect(shape.id, e.shiftKey)}
      onDoubleClick={(e) => { e.stopPropagation(); setEditName(shape.name); setIsEditing(true); }}
    >
      <span className="w-4 h-4 flex items-center justify-center text-[var(--text-tertiary)] flex-shrink-0">
        {typeIconMap[shape.type] || <Layers size={13} />}
      </span>

      {isEditing ? (
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setIsEditing(false);
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-xs bg-[var(--bg-elevated)] border border-[var(--accent)] rounded px-1 py-0.5 text-[var(--text-primary)] outline-none min-w-0"
        />
      ) : (
        <span className={`flex-1 text-xs truncate ${!shape.visible ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
          {shape.name}
        </span>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={(e) => { e.stopPropagation(); updateShape(shape.id, { visible: !shape.visible }); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)]" title={shape.visible ? '隐藏' : '显示'} aria-label={shape.visible ? '隐藏' : '显示'}>
          {shape.visible ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); updateShape(shape.id, { locked: !shape.locked }); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)]" title={shape.locked ? '解锁' : '锁定'} aria-label={shape.locked ? '解锁' : '锁定'}>
          {shape.locked ? <Lock size={11} /> : <Unlock size={11} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); duplicateShapes([shape.id]); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)]" title="复制" aria-label="复制">
          <Copy size={11} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); saveMaterial(shape, shape.name); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--accent)]" title="收藏" aria-label="收藏">
          <Star size={11} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); deleteShape(shape.id); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--danger)]" title="删除" aria-label="删除">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

interface TreeNode {
  shape: Shape;
  children: TreeNode[];
}

function buildTree(shapes: Shape[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const s of shapes) {
    map.set(s.id, { shape: s, children: [] });
  }

  for (const s of shapes) {
    const node = map.get(s.id)!;
    if (s.parentId && map.has(s.parentId)) {
      map.get(s.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Also handle groupId-based grouping for non-frame groups
  const groupedRoots: TreeNode[] = [];
  const seenGroups = new Set<string>();
  for (const node of roots) {
    if (node.shape.groupId) {
      if (seenGroups.has(node.shape.groupId)) continue;
      seenGroups.add(node.shape.groupId);
      const groupMembers = roots.filter(n => n.shape.groupId === node.shape.groupId);
      groupedRoots.push({ shape: { ...node.shape, name: `⊟ 组`, type: 'component' as Shape['type'] }, children: groupMembers.map(m => ({ ...m, children: m.children })) });
    } else {
      groupedRoots.push(node);
    }
  }

  return groupedRoots;
}

export default function LayerPanel() {
  const { shapes, selectedIds, setSelectedIds } = useEditorStore();

  const handleSelect = useCallback((id: string, addToSelection: boolean) => {
    const shape = shapes.find(s => s.id === id);
    const groupIds = shape?.groupId ? shapes.filter(s => s.groupId === shape.groupId).map(s => s.id) : [id];
    if (addToSelection) {
      const allSelected = groupIds.every(gid => selectedIds.includes(gid));
      if (allSelected) setSelectedIds(selectedIds.filter(sid => !groupIds.includes(sid)));
      else setSelectedIds([...new Set([...selectedIds, ...groupIds])]);
    } else {
      setSelectedIds(groupIds);
    }
  }, [shapes, selectedIds, setSelectedIds]);

  const tree = useMemo(() => buildTree([...shapes].reverse()), [shapes]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.shape.id);
    const isFrame = node.shape.type === 'frame';

    if (hasChildren || isFrame) {
      return (
        <div key={node.shape.id}>
          <div
            className={`flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors ${selectedIds.includes(node.shape.id) ? 'bg-[var(--bg-hover)] border-l-2 border-l-[var(--accent)]' : 'border-l-2 border-l-transparent'}`}
            style={{ paddingLeft: 8 + depth * 16, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
            onClick={(e) => handleSelect(node.shape.id, e.shiftKey)}
          >
            {hasChildren && (
              <button
                onClick={(e) => { e.stopPropagation(); toggle(node.shape.id); }}
                className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                aria-label={isCollapsed ? '展开' : '折叠'}
              >
                <ChevronRight size={12} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
              </button>
            )}
            {!hasChildren && <div className="w-4" />}
            <span className="w-4 h-4 flex items-center justify-center text-[var(--text-tertiary)] flex-shrink-0">
              {typeIconMap[node.shape.type] || <Layers size={13} />}
            </span>
            <span className="flex-1 text-xs truncate text-[var(--text-primary)]">{node.shape.name}</span>
            {isFrame && node.shape.autoLayout && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] flex-shrink-0">
                {node.shape.autoLayout.direction === 'horizontal' ? '→' : '↓'}
              </span>
            )}
          </div>
          {!isCollapsed && node.children.map(child => renderNode(child, depth + 1))}
        </div>
      );
    }

    return (
      <LayerItem
        key={node.shape.id}
        shape={node.shape}
        isSelected={selectedIds.includes(node.shape.id)}
        depth={depth}
        onSelect={handleSelect}
      />
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <span className="text-xs text-[var(--text-tertiary)] font-mono">{shapes.length} 个图形</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {shapes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 mb-3 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
              <Layers size={20} className="text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">暂无图形</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1 opacity-60">使用工具栏绘制，或让 AI 帮你创作</p>
          </div>
        ) : (
          tree.map(node => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}
