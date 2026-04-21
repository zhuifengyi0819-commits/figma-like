'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { Copy, Trash2, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Lock, Unlock, ClipboardPaste, Grid3X3, LayoutGrid, Square, Circle, Type, Minus, Frame, AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignJustify, Edit3, Plus, Minus as MinusIcon } from 'lucide-react';
import BatchRenameModal from './BatchRenameModal';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  action: () => void;
}

interface MenuGroup {
  items: MenuItem[];
}

export default function ContextMenu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showBatchRename, setShowBatchRename] = useState(false);
  const {
    contextMenu,
    hideContextMenu,
    deleteShapes,
    duplicateShapes,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    shapes,
    updateShape,
    copyStyle,
    pasteStyle,
    copiedStyle,
    setArrayModalOpen,
    createComponent,
    addShape,
    addGuide,
    canvasZoom,
    canvasPan,
    alignShapes,
  } = useEditorStore();

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => hideContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu, hideContextMenu]);

  // Close on Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideContextMenu();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [contextMenu, hideContextMenu]);

  if (!contextMenu) return null;

  const { x, y, targetIds } = contextMenu;
  const targetShapes = shapes.filter(s => targetIds.includes(s.id));
  const isLocked = targetShapes.some(s => s.locked);

  const handleDelete = () => { deleteShapes(targetIds); hideContextMenu(); };
  const handleDuplicate = () => {
    const newIds = duplicateShapes(targetIds);
    useEditorStore.getState().setSelectedIds(newIds);
    hideContextMenu();
  };
  const handleBringForward = () => {
    targetIds.forEach(id => bringForward(id));
    hideContextMenu();
  };
  const handleSendBackward = () => {
    [...targetIds].reverse().forEach(id => sendBackward(id));
    hideContextMenu();
  };
  const handleBringToFront = () => {
    [...targetIds].reverse().forEach(id => bringToFront(id));
    hideContextMenu();
  };
  const handleSendToBack = () => {
    targetIds.forEach(id => sendToBack(id));
    hideContextMenu();
  };
  const handleToggleLock = () => {
    targetIds.forEach(id => updateShape(id, { locked: !isLocked }));
    hideContextMenu();
  };
  const handleCopyStyle = () => { copyStyle(); hideContextMenu(); };
  const handlePasteStyle = () => { pasteStyle(); hideContextMenu(); };
  const handleArrayCopy = () => { setArrayModalOpen(true); hideContextMenu(); };
  const handleConvertToComponent = () => {
    const frameShape = shapes.find(s => targetIds.includes(s.id) && s.type === 'frame');
    if (!frameShape) { hideContextMenu(); return; }
    createComponent([frameShape.id], frameShape.name || '组件');
    hideContextMenu();
  };
  const handleBatchRename = () => {
    setShowBatchRename(true);
    hideContextMenu();
  };

  // Alignment helpers (only work with 2+ selected)
  const hasMultiSelect = targetIds.length >= 2;
  const handleAlign = (type: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV' | 'distributeH' | 'distributeV') => {
    if (!hasMultiSelect) return;
    alignShapes(targetIds, type);
    hideContextMenu();
  };
  const canConvert = targetIds.length === 1 && shapes.find(s => targetIds.includes(s.id) && s.type === 'frame' && !s.masterComponentId);

  // Check if right-click was on empty canvas
  const isEmptyCanvas = targetIds.length === 0;

  // Canvas position from screen coordinates
  const canvasX = (x - (canvasPan?.x || 0)) / (canvasZoom || 1);
  const canvasY = (y - (canvasPan?.y || 0)) / (canvasZoom || 1);

  const shapeTypes = [
    { type: 'rect', label: '矩形', icon: <Square size={13} />, w: 100, h: 80 },
    { type: 'circle', label: '圆形', icon: <Circle size={13} />, w: 80, h: 80 },
    { type: 'text', label: '文字', icon: <Type size={13} />, w: 120, h: 32 },
    { type: 'line', label: '线条', icon: <Minus size={13} />, w: 100, h: 2 },
    { type: 'frame', label: 'Frame', icon: <Frame size={13} />, w: 200, h: 150 },
  ] as const;

  const handleCreateShape = (type: typeof shapeTypes[number]['type']) => {
    const def = shapeTypes.find(s => s.type === type);
    if (!def) return;
    const id = addShape({
      type,
      name: def.label,
      x: canvasX - def.w / 2,
      y: canvasY - def.h / 2,
      width: def.w,
      height: def.h,
      fill: type === 'text' ? 'transparent' : '#3D3D45',
      stroke: '#5C5A56',
      strokeWidth: 1,
      opacity: 1,
      rotation: 0,
      visible: true,
      locked: false,
    });
    useEditorStore.getState().setSelectedIds([id]);
    hideContextMenu();
  };

  const handleSelectAll = () => {
    const allIds = shapes.filter(s => s.visible && !s.locked).map(s => s.id);
    useEditorStore.getState().setSelectedIds(allIds);
    hideContextMenu();
  };

  const handleAddVerticalGuide = () => {
    addGuide(canvasX, 'x');
    hideContextMenu();
  };

  const handleAddHorizontalGuide = () => {
    addGuide(canvasY, 'y');
    hideContextMenu();
  };

  // Empty canvas: show create shape options
  // Has selection: show shape manipulation options
  const groups: MenuGroup[] = isEmptyCanvas
    ? [
        {
          items: shapeTypes.map(({ type, label, icon }) => ({
            label,
            icon,
            action: () => handleCreateShape(type),
          })),
        },
        {
          items: [
            { label: '全选', icon: <Copy size={13} />, shortcut: '⌘A', action: handleSelectAll },
          ],
        },
        {
          items: [
            { label: '添加垂直参考线', icon: <Plus size={13} />, action: handleAddVerticalGuide },
            { label: '添加水平参考线', icon: <Plus size={13} />, action: handleAddHorizontalGuide },
          ],
        },
      ]
    : [
        {
          items: [
            { label: '复制', icon: <Copy size={13} />, shortcut: '⌘D', action: handleDuplicate },
            { label: '阵列复制', icon: <Grid3X3 size={13} />, action: handleArrayCopy },
            { label: '转换为组件', icon: <LayoutGrid size={13} />, disabled: !canConvert, action: handleConvertToComponent },
            { label: '删除', icon: <Trash2 size={13} />, shortcut: '⌫', danger: true, action: handleDelete },
          ],
        },
        {
          items: [
            { label: '置顶', icon: <ChevronsUp size={13} />, action: handleBringToFront },
            { label: '上移一层', icon: <ArrowUp size={13} />, action: handleBringForward },
            { label: '下移一层', icon: <ArrowDown size={13} />, action: handleSendBackward },
            { label: '置底', icon: <ChevronsDown size={13} />, action: handleSendToBack },
          ],
        },
        {
          items: [
            { label: isLocked ? '解锁' : '锁定', icon: isLocked ? <Unlock size={13} /> : <Lock size={13} />, action: handleToggleLock },
            { label: '复制样式', icon: <Copy size={13} />, action: handleCopyStyle },
            { label: '粘贴样式', icon: <ClipboardPaste size={13} />, disabled: !copiedStyle, action: handlePasteStyle },
          ],
        },
        // Batch rename — only shown when 2+ shapes selected
        hasMultiSelect && {
          items: [
            { label: '批量重命名', icon: <Edit3 size={13} />, shortcut: '⌘⇧R', action: handleBatchRename },
          ],
        },
        // Alignment — only shown when 2+ shapes selected
        hasMultiSelect && {
          items: [
            { label: '左对齐', icon: <AlignHorizontalJustifyStart size={13} />, action: () => handleAlign('left') },
            { label: '水平居中', icon: <AlignHorizontalJustifyCenter size={13} />, action: () => handleAlign('centerH') },
            { label: '右对齐', icon: <AlignHorizontalJustifyEnd size={13} />, action: () => handleAlign('right') },
            { label: '顶对齐', icon: <AlignVerticalJustifyStart size={13} />, action: () => handleAlign('top') },
            { label: '垂直居中', icon: <AlignVerticalJustifyCenter size={13} />, action: () => handleAlign('centerV') },
            { label: '底对齐', icon: <AlignVerticalJustifyEnd size={13} />, action: () => handleAlign('bottom') },
          ],
        },
        hasMultiSelect && {
          items: [
            { label: '水平分布', icon: <AlignJustify size={13} />, action: () => handleAlign('distributeH') },
            { label: '垂直分布', icon: <AlignJustify size={13} />, action: () => handleAlign('distributeV') },
          ],
        },
      ].filter(Boolean) as MenuGroup[];

  // Adjust position to keep menu in viewport
  const menuWidth = 200;
  const menuHeight = groups.length * 44 + 8;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[150]"
        onContextMenu={e => e.preventDefault()}
      />
      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-[160] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl py-1.5 min-w-[180px] animate-scale-in"
        style={{ left: adjustedX, top: adjustedY }}
        onClick={e => e.stopPropagation()}
        onContextMenu={e => e.preventDefault()}
      >
        {groups.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div className="h-px bg-[var(--border)] my-1.5 mx-2" />
            )}
            {group.items.map((item, ii) => (
              <button
                key={ii}
                onClick={item.disabled ? undefined : item.action}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 text-sm
                  ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--bg-hover)] cursor-pointer'}
                  ${item.danger ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'}
                  transition-colors
                `}
              >
                <span className="flex-shrink-0 text-[var(--text-secondary)]">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{item.shortcut}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
      {/* Batch Rename Modal */}
      {showBatchRename && (
        <BatchRenameModal
          selectedIds={targetIds}
          onClose={() => setShowBatchRename(false)}
        />
      )}
    </>
  );
}
