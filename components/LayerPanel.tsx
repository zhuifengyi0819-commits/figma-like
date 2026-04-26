'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { useEditor, getEditorEngine } from '@/hooks/useEditor';
import type { SGNode } from '@/lib/scene-graph/types';
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, Star, ImageIcon, Triangle, ArrowRight, Type, Minus, Square, Circle, Component, Layers, Frame, PenTool, ChevronRight, ChevronsDown, ChevronsUp, Search, X, Group } from 'lucide-react';
import { useCallback, useState, useRef, useEffect, useMemo } from 'react';

const typeIconMap: Record<string, React.ReactNode> = {
  rectangle: <Square size={13} />,
  ellipse: <Circle size={13} />,
  text: <Type size={13} />,
  line: <Minus size={13} />,
  arrow: <ArrowRight size={13} />,
  star: <Star size={13} />,
  polygon: <Triangle size={13} />,
  image: <ImageIcon size={13} />,
  component: <Component size={13} />,
  frame: <Frame size={13} />,
  group: <Group size={13} />,
  pen: <PenTool size={13} />,
  page: <Layers size={13} />,
};

interface LayerTreeNode {
  node: SGNode;
  children: LayerTreeNode[];
}

interface LayerItemProps {
  treeNode: LayerTreeNode;
  isSelected: boolean;
  depth: number;
  isDragOver?: boolean;
  onSelect: (id: string, addToSelection: boolean) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent, id: string) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, id: string) => void;
}

function LayerItem({ treeNode, isSelected, depth, isDragOver, onSelect, onDragStart, onDragOver, onDragLeave, onDrop }: LayerItemProps) {
  const { updateShape, deleteShape, saveMaterial, duplicateShapes } = useEditorStore();
  const node = treeNode.node;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [isEditing]);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== node.name) {
      const engine = getEditorEngine();
      if (engine) {
        engine.getSceneGraph().updateNode(node.id, { name: trimmed });
      }
      updateShape(node.id, { name: trimmed });
    }
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
        ${!node.visible ? 'opacity-50' : ''}
        ${isDragOver ? 'border-t-2 border-t-[var(--accent)]' : ''}
      `}
      style={{ paddingLeft: 12 + depth * 16, paddingRight: 12 }}
      onClick={(e) => onSelect(node.id, e.shiftKey)}
      onDoubleClick={(e) => { e.stopPropagation(); setEditName(node.name); setIsEditing(true); }}
      draggable
      onDragStart={(e) => onDragStart?.(e, node.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(e, node.id); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop?.(e, node.id)}
    >
      <span className="w-4 h-4 flex items-center justify-center text-[var(--text-tertiary)] flex-shrink-0">
        {typeIconMap[node.type] || <Layers size={13} />}
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
        <span className={`flex-1 text-xs truncate ${!node.visible ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
          {node.name}
        </span>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={(e) => { e.stopPropagation(); updateShape(node.id, { visible: !node.visible }); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)]" title={node.visible ? '隐藏' : '显示'} aria-label={node.visible ? '隐藏' : '显示'}>
          {node.visible ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); updateShape(node.id, { locked: !node.locked }); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)]" title={node.locked ? '解锁' : '锁定'} aria-label={node.locked ? '解锁' : '锁定'}>
          {node.locked ? <Lock size={11} /> : <Unlock size={11} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); duplicateShapes([node.id]); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)]" title="复制" aria-label="复制">
          <Copy size={11} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); const shape = useEditorStore.getState().shapes.find((s: any) => s.id === node.id); if (shape) saveMaterial(shape, node.name); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--accent)]" title="收藏" aria-label="收藏">
          <Star size={11} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); deleteShape(node.id); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--danger)]" title="删除" aria-label="删除">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function buildTree(sgNodes: SGNode[]): LayerTreeNode[] {
  const nodeMap = new Map<string, LayerTreeNode>();
  const roots: LayerTreeNode[] = [];

  // First pass: create all tree nodes
  for (const node of sgNodes) {
    nodeMap.set(node.id, { node, children: [] });
  }

  // Second pass: build parent-child relationships
  for (const node of sgNodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  return roots;
}

export default function LayerPanel() {
  const { selectedIds, setSelectedIds } = useEditorStore();
  const shapes = useEditorStore((s) => s.shapes);
  const engine = getEditorEngine();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const draggedId = useRef<string | null>(null);
  const draggedGroupRef = useRef<string[]>([]);

  // Get SceneGraph tree (source of truth for hierarchy)
  const sceneGraphTree = useMemo((): LayerTreeNode[] => {
    if (!engine) return [];
    const sg = engine.getSceneGraph();
    const page = sg.getCurrentPage();
    if (!page) return [];
    const descendants = sg.getDescendants(page.id);
    return buildTree(descendants);
  }, [shapes, engine]); // shapes is the trigger — when shapes[] changes, tree re-reads

  // Get all node IDs in tree order (for search/filter)
  const allNodeIds = useMemo(() => {
    function collect(node: LayerTreeNode): string[] {
      return [node.node.id, ...node.children.flatMap(collect)];
    }
    return sceneGraphTree.flatMap(collect);
  }, [sceneGraphTree]);

  // Filter tree by search query
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return sceneGraphTree;
    const q = searchQuery.toLowerCase();

    function matchesSearch(node: SGNode): boolean {
      return node.name.toLowerCase().includes(q) || node.type.toLowerCase().includes(q);
    }

    // Find matching node IDs and their ancestors
    const matchingIds = new Set<string>();
    const ancestorIds = new Set<string>();

    for (const node of allNodeIds) {
      const sgNode = engine?.getSceneGraph().getNode(node);
      if (sgNode && matchesSearch(sgNode)) {
        matchingIds.add(node);
        // Collect ancestors
        let cur = sgNode.parentId;
        while (cur) {
          ancestorIds.add(cur);
          const parent = engine?.getSceneGraph().getNode(cur);
          cur = parent?.parentId ?? null;
        }
      }
    }

    if (matchingIds.size === 0) return [];

    // Filter tree to only matching nodes + ancestors
    function filterNode(node: LayerTreeNode): LayerTreeNode | null {
      const include = matchingIds.has(node.node.id) || ancestorIds.has(node.node.id);
      const filteredChildren = node.children.map(filterNode).filter((n): n is LayerTreeNode => n !== null);
      if (include || filteredChildren.length > 0) {
        return { node: node.node, children: filteredChildren };
      }
      return null;
    }

    return sceneGraphTree.map(filterNode).filter((n): n is LayerTreeNode => n !== null);
  }, [sceneGraphTree, searchQuery, allNodeIds, engine]);

  // Drag: collect dragged group (same z-order as in Figma)
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    const sg = engine?.getSceneGraph();
    if (!sg) return;
    const node = sg.getNode(id);
    if (!node) return;

    // Collect siblings: all children of the same parent
    const siblings = node.parentId
      ? sg.getChildren(node.parentId)
      : (sg.getCurrentPage() ? sg.getChildren(sg.getCurrentPage()!.id) : []);

    const sibIdx = siblings.findIndex(s => s.id === id);
    // In Figma: dragging a shape drags it + ALL SHAPES ABOVE IT (later in children array = rendered on top)
    const groupIds = siblings.slice(sibIdx).map(s => s.id);
    draggedId.current = id;
    draggedGroupRef.current = groupIds;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }, [engine]);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const srcId = draggedId.current;
    const draggedGroup = draggedGroupRef.current;
    if (!srcId || srcId === targetId) return;
    if (draggedGroup.length === 0) return;

    const sg = engine?.getSceneGraph();
    if (!sg) return;

    const srcNode = sg.getNode(srcId);
    const targetNode = sg.getNode(targetId);
    if (!srcNode || !targetNode) return;

    const srcParentId = srcNode.parentId;

    // Case A: drop onto a container (frame/group/component) → reparent to container
    if (targetNode.type === 'frame' || targetNode.type === 'group' || targetNode.type === 'component') {
      if (srcParentId !== targetId) {
        draggedGroup.forEach(gid => engine!.reparentNode(gid, targetId));
      } else {
        // Same parent: just reorder to end of container's children
        draggedGroup.forEach((gid, i) => {
          const containerChildren = sg.getChildren(targetId);
          engine!.reorderNode(gid, containerChildren.length + i);
        });
      }
      draggedId.current = null;
      draggedGroupRef.current = [];
      return;
    }

    // Case B: drop onto a leaf shape → reparent to same parent as target, at target's position
    const targetParent = targetNode.parentId;
    const siblings = targetParent ? sg.getChildren(targetParent) : [];
    const targetIdx = siblings.findIndex(s => s.id === targetId);

    if (srcParentId !== targetParent) {
      draggedGroup.forEach(gid => engine!.reparentNode(gid, targetParent ?? null));
    }
    // Reorder: each dragged shape lands at targetIdx + i (relative to where they now live)
    draggedGroup.forEach((gid, i) => {
      engine!.reorderNode(gid, targetIdx + i);
    });

    draggedId.current = null;
    draggedGroupRef.current = [];
  }, [engine]);

  const handleSelect = useCallback((id: string, addToSelection: boolean) => {
    const sg = engine?.getSceneGraph();
    if (!sg) return;
    const node = sg.getNode(id);
    const groupIds = node?.parentId
      ? sg.getChildren(node.parentId).slice(sg.getChildren(node.parentId).findIndex(s => s.id === id)).map(s => s.id)
      : [id];

    if (addToSelection) {
      const allSelected = groupIds.every(gid => selectedIds.includes(gid));
      if (allSelected) setSelectedIds(selectedIds.filter(sid => !groupIds.includes(sid)));
      else setSelectedIds([...new Set([...selectedIds, ...groupIds])]);
    } else {
      setSelectedIds(groupIds);
    }
  }, [engine, selectedIds, setSelectedIds]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const isContainerType = (type: string) =>
    type === 'frame' || type === 'group' || type === 'component';

  const renderNode = (treeNode: LayerTreeNode, depth: number): React.ReactNode => {
    const node = treeNode.node;
    const hasChildren = treeNode.children.length > 0;
    const isCollapsed = collapsed.has(node.id);
    const isContainer = isContainerType(node.type);
    const isEffectivelySelected = selectedIds.includes(node.id);

    if (hasChildren || isContainer) {
      return (
        <div key={node.id}>
          <div
            className={`group flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors ${isEffectivelySelected ? 'bg-[var(--bg-hover)] border-l-2 border-l-[var(--accent)]' : 'border-l-2 border-l-transparent'}`}
            style={{ paddingLeft: 8 + depth * 16, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('button[data-chevron]')) {
                toggle(node.id);
                return;
              }
              handleSelect(node.id, e.shiftKey);
            }}
          >
            {isContainer ? (
              <button
                data-chevron={node.id}
                onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
                className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                aria-label={isCollapsed ? '展开' : '折叠'}
              >
                <ChevronRight size={12} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
              </button>
            ) : (
              <div className="w-4" />
            )}
            <span className="w-4 h-4 flex items-center justify-center text-[var(--text-tertiary)] flex-shrink-0">
              {typeIconMap[node.type] || <Layers size={13} />}
            </span>
            <span className="flex-1 text-xs truncate text-[var(--text-primary)]">{node.name}</span>
            {isContainer && hasChildren && (
              <span className="text-[9px] text-[var(--text-tertiary)] flex-shrink-0">({treeNode.children.length})</span>
            )}
            {isContainer && (node as any).layoutMode && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] flex-shrink-0">
                {(node as any).layoutMode === 'horizontal' ? '→' : (node as any).layoutMode === 'vertical' ? '↓' : ''}
              </span>
            )}
            {isContainer && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); updateShape(node.id, { visible: !node.visible }); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)]" title={node.visible ? '隐藏' : '显示'} aria-label={node.visible ? '隐藏' : '显示'}>
                  {node.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); updateShape(node.id, { locked: !node.locked }); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)]" title={node.locked ? '解锁' : '锁定'} aria-label={node.locked ? '解锁' : '锁定'}>
                  {node.locked ? <Lock size={11} /> : <Unlock size={11} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); duplicateShapes([node.id]); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)]" title="复制" aria-label="复制">
                  <Copy size={11} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteShape(node.id); }} className="p-0.5 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--danger)]" title="删除" aria-label="删除">
                  <Trash2 size={11} />
                </button>
              </div>
            )}
          </div>
          {!isCollapsed && treeNode.children.map(child => renderNode(child, depth + 1))}
        </div>
      );
    }

    return (
      <LayerItem
        key={node.id}
        treeNode={treeNode}
        isSelected={selectedIds.includes(node.id)}
        depth={depth}
        isDragOver={dragOverId === node.id}
        onSelect={handleSelect}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />
    );
  };

  // Count total nodes in filtered tree
  const totalNodes = useMemo(() => {
    function count(node: LayerTreeNode): number {
      return 1 + node.children.reduce((sum, c) => sum + count(c), 0);
    }
    return filteredTree.reduce((sum, n) => sum + count(n), 0);
  }, [filteredTree]);

  // updateShape/deleteShape/duplicateShapes from store
  const { updateShape, deleteShape, duplicateShapes } = useEditorStore.getState();

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
            const allContainerIds: string[] = [];
            function collectContainers(node: LayerTreeNode) {
              if (isContainerType(node.node.type)) allContainerIds.push(node.node.id);
              node.children.forEach(collectContainers);
            }
            filteredTree.forEach(collectContainers);
            setCollapsed(new Set(allContainerIds));
          }}
          className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          title="折叠全部"
          aria-label="折叠全部"
        >
          <ChevronsUp size={13} />
        </button>
        <span className="text-[10px] text-[var(--text-tertiary)] font-mono flex-shrink-0">{totalNodes}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sceneGraphTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 mb-3 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
              <Layers size={20} className="text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">暂无图形</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1 opacity-60">使用工具栏绘制，或让 AI 帮你创作</p>
          </div>
        ) : (
          filteredTree.map(node => renderNode(node, 0))
        )}
      </div>
    </div>
  );
}
