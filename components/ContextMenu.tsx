'use client';

import { useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { Copy, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Lock, Unlock, Paintbrush, ClipboardPaste } from 'lucide-react';

interface MenuPosition {
  x: number;
  y: number;
}

export default function ContextMenu() {
  const [pos, setPos] = useState<MenuPosition | null>(null);
  const { selectedIds, shapes, duplicateShapes, deleteShapes, bringForward, sendBackward, updateShape, copyStyle, pasteStyle, copiedStyle } = useEditorStore();

  const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));
  const singleShape = selectedShapes.length === 1 ? selectedShapes[0] : null;

  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    const handleContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('canvas') || target.closest('[data-canvas-area]')) {
        e.preventDefault();
        setPos({ x: e.clientX, y: e.clientY });
      }
    };
    const handleClick = () => close();
    const handleScroll = () => close();

    window.addEventListener('contextmenu', handleContext);
    window.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('contextmenu', handleContext);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [close]);

  if (!pos || selectedIds.length === 0) return null;

  const items = [
    {
      label: '复制',
      icon: <Copy size={14} />,
      shortcut: '⌘D',
      action: () => { duplicateShapes(selectedIds); close(); },
    },
    {
      label: '删除',
      icon: <Trash2 size={14} />,
      shortcut: 'Del',
      danger: true,
      action: () => { deleteShapes(selectedIds); close(); },
    },
    { divider: true },
    {
      label: '复制样式',
      icon: <Paintbrush size={14} />,
      shortcut: '⌥⌘C',
      action: () => { copyStyle(); close(); },
      disabled: !singleShape,
    },
    {
      label: '粘贴样式',
      icon: <ClipboardPaste size={14} />,
      shortcut: '⌥⌘V',
      action: () => { pasteStyle(); close(); },
      disabled: !copiedStyle,
    },
    { divider: true },
    {
      label: '上移一层',
      icon: <ArrowUp size={14} />,
      action: () => { if (singleShape) bringForward(singleShape.id); close(); },
      disabled: !singleShape,
    },
    {
      label: '下移一层',
      icon: <ArrowDown size={14} />,
      action: () => { if (singleShape) sendBackward(singleShape.id); close(); },
      disabled: !singleShape,
    },
    { divider: true },
    {
      label: singleShape?.visible === false ? '显示' : '隐藏',
      icon: singleShape?.visible === false ? <Eye size={14} /> : <EyeOff size={14} />,
      action: () => {
        selectedIds.forEach((id) => {
          const s = shapes.find((sh) => sh.id === id);
          if (s) updateShape(id, { visible: !s.visible });
        });
        close();
      },
    },
    {
      label: singleShape?.locked ? '解锁' : '锁定',
      icon: singleShape?.locked ? <Unlock size={14} /> : <Lock size={14} />,
      action: () => {
        selectedIds.forEach((id) => {
          const s = shapes.find((sh) => sh.id === id);
          if (s) updateShape(id, { locked: !s.locked });
        });
        close();
      },
    },
  ];

  return (
    <div
      className="fixed z-50 min-w-[180px] py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/40 animate-scale-in"
      style={{ left: pos.x, top: pos.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => {
        if ('divider' in item && item.divider) {
          return <div key={i} className="my-1 border-t border-[var(--border)]" />;
        }
        const it = item as { label: string; icon: React.ReactNode; shortcut?: string; danger?: boolean; action: () => void; disabled?: boolean };
        return (
          <button
            key={i}
            onClick={it.action}
            disabled={it.disabled}
            className={`
              w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors
              ${it.danger
                ? 'text-[var(--danger)] hover:bg-[var(--danger)]/10'
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
          >
            <span className="text-[var(--text-tertiary)]">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && (
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{it.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
