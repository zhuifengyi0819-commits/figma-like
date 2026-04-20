'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { Shape } from '@/lib/types';
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, Star, ImageIcon, Triangle, ArrowRight, Type, Minus, Square, Circle, Component, Layers, Frame, PenTool, ChevronRight, ChevronsDown, ChevronsUp, Search, X, Group } from 'lucide-react';
import { useCallback, useState, useRef, useEffect, useMemo, DragEvent } from 'react';

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
  group: <Group size={13} />,
  path: <PenTool size={13} />,
};

interface LayerItemProps {
  shape: Shape;
  isSelected: boolean;
  depth: number;
  isDragOver?: boolean;
  onSelect: (id: string, addToSelection: boolean) => void;
  onDragStart?: (e: DragEvent, id: string) => void;
  onDragOver?: (e: DragEvent, id: string) => void;
  onDragLeave?: () => void;
  onDrop?: (e: DragEvent, id: string) => void;
}

function LayerItem({ shape, isSelected, depth, isDragOver, onSelect, onDragStart, onDragOver, onDragLeave, onDrop }: LayerItemProps) {
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
        ${isDragOver ? 'border-t-2 border-t-[var(--accent)]' : ''}
      `}
      style={{ paddingLeft: 12 + depth * 16, paddingRight: 12 }}
      onClick={(e) => onSelect(shape.id, e.shiftKey)}
      onDoubleClick={(e) => { e.stopPropagation(); setEditName(shape.name); setIsEditing(true); }}
      draggable
      onDragStart={(e) => onDragStart?.(e as unknown as DragEvent, shape.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(e as unknown as DragEvent, shape.id); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop?.(e as unknown as DragEvent, shape.id)}
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
            title="重命名图层"
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
  const usedAsGroupMember = new Set<string>();

  for (const node of roots) {
    if (node.shape.groupId) {
      // Only apply groupId grouping for TOP-LEVEL shapes (no parentId).
      // Shapes that already have a parentId are correctly nested via parentId
      // and must NOT be re-parented by groupId logic.
      if (node.shape.parentId) {
        groupedRoots.push(node);
        continue;
      }
      if (usedAsGroupMember.has(node.shape.id)) continue;
      if (seenGroups.has(node.shape.groupId)) continue;
      seenGroups.add(node.shape.groupId);
      const groupMembers = roots.filter(n => n.shape.groupId === node.shape.groupId);
      groupMembers.forEach(m => usedAsGroupMember.add(m.shape.id));
      groupedRoots.push({
        shape: { ...node.shape, name: `⊟ 组`, type: 'component' as Shape['type'] },
        children: groupMembers,
      });
    } else {
      groupedRoots.push(node);
    }
  }

  return groupedRoots;
}

export default function LayerPanel() {
  const { shapes, selectedIds, setSelectedIds } = useEditorStore();
  const store = useEditorStore();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const draggedId = useRef<string | null>(null);
  // Store all ids being dragged together (same parent, same z-order group)
  const draggedGroupRef = useRef<string[]>([]);

  // In Figma: when you drag a shape, all shapes ABOVE it (later in sibling array)
  // move with it, because they visually sit on top of it.
  // e.g. [A(0), B(1), C(2)] -> dragging C drags [C, B, A]
  const handleDragStart = useCallback((e: DragEvent, id: string) => {
    const shape = shapes.find(s => s.id === id);
    if (!shape) return;
    // Collect all shapes above `id` in the same parent (same parentId or both null)
    const parentId = shape.parentId ?? null;
    const siblings = shapes.filter(s => (s.parentId ?? null) === parentId);
    // sibling indices in sibling array: 0=bottom, last=top
    const sibIdx = siblings.findIndex(s => s.id === id);
    // Shapes above `id`: those with sibling index > sibIdx (later in array = rendered on top)
    const groupIds = siblings.slice(sibIdx).map(s => s.id);
    draggedId.current = id;
    draggedGroupRef.current = groupIds;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }, [shapes]);

  const handleDragOver = useCallback((e: DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const srcId = draggedId.current;
    const draggedGroup = draggedGroupRef.current;
    if (!srcId || srcId === targetId) return;
    // draggedGroup must have at least srcId
    if (draggedGroup.length === 0) return;

    const srcShape = shapes.find(s => s.id === srcId);
    const targetShape = shapes.find(s => s.id === targetId);
    if (!srcShape || !targetShape) return;

    const srcParentId = srcShape.parentId ?? undefined;

    // All shapes in the dragged group must share the same parent as src
    const allSameParent = draggedGroup.every(gid => {
      const s = shapes.find(s => s.id === gid);
      return (s?.parentId ?? undefined) === srcParentId;
    });
    if (!allSameParent) {
      draggedId.current = null;
      draggedGroupRef.current = [];
      return;
    }

    // Case A: drop onto a container (frame/group/component) -> group becomes children of target
    if (targetShape.type === 'frame' || targetShape.type === 'group' || targetShape.type === 'component') {
      if (srcParentId !== targetId) {
        // Reparent all shapes in the group to the container
        draggedGroup.forEach(gid => store.reparentShape(gid, targetId));
      }
      // All shapes in draggedGroup sit above srcId; srcId was last in sibling array (bottom of the group)
      // After reparent, they need to be moved to end of container's children.
      // Move each in order (first = lowest z-order in group = goes to container's first child slot, etc.)
      const containerSiblings = shapes.filter(s => s.parentId === targetId);
      draggedGroup.forEach((gid, i) => {
        const targetIndex = containerSiblings.length + i;
        store.reorderShape(gid, targetIndex);
      });
      draggedId.current = null;
      draggedGroupRef.current = [];
      return;
    }

    // Case B: drop onto a leaf shape -> group goes to same parent as target, at target's position
    const targetParent = targetShape.parentId ?? undefined;
    // Compute target indices from the ORIGINAL shapes array before any mutations
    const currentSiblings = shapes.filter(s => (s.parentId ?? undefined) === srcParentId);
    const srcSibIdx = currentSiblings.findIndex(s => s.id === srcId);
    const targetIndices = draggedGroup.map((gid, i) => {
      // Each shape in draggedGroup lands at srcSibIdx + i, relative to targetParent's siblings
      return srcSibIdx + i;
    });
    // Apply reparent first (mutates parentId), then reorder all shapes to computed positions
    if (srcParentId !== targetParent) {
      draggedGroup.forEach(gid => store.reparentShape(gid, targetParent));
    }
    // Reorder using indices computed from original state
    draggedGroup.forEach((gid, i) => {
      store.reorderShape(gid, targetIndices[i]);
    });

    draggedId.current = null;
    draggedGroupRef.current = [];
  }, [shapes, store]);

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

  const filteredShapes = useMemo(() => {
    if (!searchQuery.trim()) return shapes;
    const q = searchQuery.toLowerCase();

    function matchesSearch(shape: Shape): boolean {
      if (shape.name.toLowerCase().includes(q) || shape.type.toLowerCase().includes(q)) return true;
      return false;
    }

    function getAncestorIds(shape: Shape, allShapes: Shape[]): Set<string> {
      const ancestorIds = new Set<string>();
      let current = shape;
      while (current.parentId) {
        ancestorIds.add(current.parentId);
        const parent = allShapes.find(s => s.id === current.parentId);
        if (!parent) break;
        current = parent;
      }
      return ancestorIds;
    }

    // Find all matching shapes and their ancestors
    const matchingShapes = shapes.filter(matchesSearch);
    const extraAncestorIds = new Set<string>();
    matchingShapes.forEach(m => {
      getAncestorIds(m, shapes).forEach(id => extraAncestorIds.add(id));
    });

    return shapes.filter(s =>
      matchesSearch(s) || extraAncestorIds.has(s.id)
    );
  }, [shapes, searchQuery]);

  const tree = useMemo(() => buildTree([...filteredShapes].reverse()), [filteredShapes]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.shape.id);
    const isContainer = node.shape.type === 'frame' || node.shape.type === 'group' || node.shape.type === 'component';

    if (hasChildren || isContainer) {
      return (
        <div key={node.shape.id}>
          <div
            className={`flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors ${selectedIds.includes(node.shape.id) ? 'bg-[var(--bg-hover)] border-l-2 border-l-[var(--accent)]' : 'border-l-2 border-l-transparent'}`}
            style={{ paddingLeft: 8 + depth * 16, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
            onClick={(e) => handleSelect(node.shape.id, e.shiftKey)}
          >
            {isContainer ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggle(node.shape.id); }}
                className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                aria-label={isCollapsed ? '展开' : '折叠'}
              >
                <ChevronRight size={12} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
              </button>
            ) : (
              <div className="w-4" />
            )}
            <span className="w-4 h-4 flex items-center justify-center text-[var(--text-tertiary)] flex-shrink-0">
              {typeIconMap[node.shape.type] || <Layers size={13} />}
            </span>
            <span className="flex-1 text-xs truncate text-[var(--text-primary)]">{node.shape.name}</span>
            {isContainer && hasChildren && (
              <span className="text-[9px] text-[var(--text-tertiary)] flex-shrink-0">({node.children.length})</span>
            )}
            {isContainer && node.shape.autoLayout && (
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
        isDragOver={dragOverId === node.shape.id}
        onSelect={handleSelect}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border)]">
        <div className="flex items-center flex-1 min-w-0 bg-[var(--bg-elevated)] rounded-md border border-[var(--border)] px-2 py-1 gap-1.5">
          <Search size={11} className="text-[var(--text-tertiary)] flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索图层..."
            className="flex-1 bg-transparent text-[10px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] min-w-0"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]" aria-label="清除搜索">
              <X size={10} />
            </button>
          )}
        </div>
        <button
          onClick={() => setCollapsed(new Set())}
          className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          title="展开全部"
          aria-label="展开全部"
        >
          <ChevronsDown size={13} />
        </button>
        <button
          onClick={() => {
            const allContainerIds = tree.filter(n => n.shape.type === 'frame' || n.shape.type === 'group' || n.shape.type === 'component').map(n => n.shape.id);
            setCollapsed(new Set(allContainerIds));
          }}
          className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          title="折叠全部"
          aria-label="折叠全部"
        >
          <ChevronsUp size={13} />
        </button>
        <span className="text-[10px] text-[var(--text-tertiary)] font-mono flex-shrink-0">{filteredShapes.length}</span>
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
