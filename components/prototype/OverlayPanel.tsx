'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Shape, OverlayConfig } from '@/lib/types';
import { X } from 'lucide-react';
import Backdrop from './Backdrop';
import { getEasingCss } from '@/lib/easing';

interface OverlayPanelProps {
  targetFrame: Shape;
  allShapes: Shape[];
  config: OverlayConfig;
  triggerRect: DOMRect | null;
  visible: boolean;
  onClose: () => void;
}

type AnimState = 'closed' | 'opening' | 'open' | 'closing';

// Anchor-based positioning: map anchor to CSS position
const ANCHOR_CSS: Record<OverlayConfig['anchor'], { top?: string | number; bottom?: string | number; left?: string | number; right?: string | number; transform?: string }> = {
  TOP_LEFT: { top: 0, left: 0 },
  TOP_CENTER: { top: 0, left: '50%', transform: 'translateX(-50%)' },
  TOP_RIGHT: { top: 0, right: 0 },
  CENTER_LEFT: { top: '50%', left: 0, transform: 'translateY(-50%)' },
  CENTER: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  CENTER_RIGHT: { top: '50%', right: 0, transform: 'translateY(-50%)' },
  BOTTOM_LEFT: { bottom: 0, left: 0 },
  BOTTOM_CENTER: { bottom: 0, left: '50%', transform: 'translateX(-50%)' },
  BOTTOM_RIGHT: { bottom: 0, right: 0 },
};

export default function OverlayPanel({
  targetFrame,
  allShapes,
  config,
  triggerRect,
  visible,
  onClose,
}: OverlayPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [animState, setAnimState] = useState<AnimState>('closed');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (visible) {
      setAnimState('opening');
      const t = setTimeout(() => setAnimState('open'), 20);
      return () => clearTimeout(t);
    } else {
      setAnimState('closing');
      const t = setTimeout(() => setAnimState('closed'), 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const handleClose = useCallback(() => { onClose(); }, [onClose]);

  const handleBackdropClick = useCallback(() => {
    if (config.modal !== false) { handleClose(); }
  }, [config.modal, handleClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { handleClose(); }
  }, [handleClose]);

  if (!mounted || animState === 'closed') return null;

  const frameWidth = targetFrame.width || 400;
  const frameHeight = targetFrame.height || 300;
  const childShapes = allShapes.filter(s => s.parentId === targetFrame.id);
  const anchor = config.anchor || 'CENTER';
  const anchorStyle = ANCHOR_CSS[anchor];

  const getPosition = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 1000,
      width: frameWidth,
      height: frameHeight,
      opacity: animState === 'opening' ? 0 : 1,
      transition: `transform 300ms ${getEasingCss('easeOut')}, opacity 300ms ${getEasingCss('easeOut')}`,
    };

    // Apply anchor position
    if (anchorStyle.top !== undefined) base.top = anchorStyle.top;
    if (anchorStyle.bottom !== undefined) base.bottom = anchorStyle.bottom;
    if (anchorStyle.left !== undefined) base.left = anchorStyle.left;
    if (anchorStyle.right !== undefined) base.right = anchorStyle.right;
    if (anchorStyle.transform !== undefined) {
      base.transform = (animState === 'opening' && triggerRect)
        ? `${anchorStyle.transform} scale(0.8)`
        : anchorStyle.transform;
    }

    // FLIP: expand from trigger origin on first open
    if (triggerRect && animState === 'opening') {
      const cx = triggerRect.x + triggerRect.width / 2;
      const cy = triggerRect.y + triggerRect.height / 2;
      const anchorCx = (() => {
        if (anchorStyle.left === '50%') return window.innerWidth / 2;
        if (anchorStyle.right !== undefined) return window.innerWidth - (typeof anchorStyle.right === 'number' ? anchorStyle.right : 0);
        return typeof anchorStyle.left === 'number' ? anchorStyle.left + frameWidth / 2 : frameWidth / 2;
      })();
      const anchorCy = (() => {
        if (anchorStyle.top === '50%') return window.innerHeight / 2;
        if (anchorStyle.bottom !== undefined) return window.innerHeight - (typeof anchorStyle.bottom === 'number' ? anchorStyle.bottom : 0);
        return typeof anchorStyle.top === 'number' ? anchorStyle.top + frameHeight / 2 : frameHeight / 2;
      })();
      const scaleX = Math.min(triggerRect.width / frameWidth, 1);
      const scaleY = Math.min(triggerRect.height / frameHeight, 1);
      base.transform = `translate(${cx - anchorCx}px, ${cy - anchorCy}px) scale(${scaleX}, ${scaleY})`;
      base.transformOrigin = 'center center';
    }

    return base;
  };

  const resolveShapeStyle = (shape: Shape): React.CSSProperties => {
    const s: React.CSSProperties = {
      position: 'absolute',
      left: shape.x,
      top: shape.y,
      opacity: shape.opacity,
    };
    if (shape.rotation) s.transform = `rotate(${shape.rotation}deg)`;
    if (shape.type === 'rect' || shape.type === 'frame' || shape.type === 'group') {
      s.width = shape.width || 100;
      s.height = shape.height || 100;
      s.backgroundColor = shape.fill;
      if (shape.cornerRadius) s.borderRadius = shape.cornerRadius;
      if (shape.clipContent) s.overflow = 'hidden';
    } else if (shape.type === 'circle') {
      const d = (shape.radius || 50) * 2;
      s.width = d; s.height = d; s.borderRadius = '50%'; s.backgroundColor = shape.fill;
    } else if (shape.type === 'text') {
      s.color = shape.fill;
      s.fontSize = shape.fontSize || 24;
      s.fontFamily = shape.fontFamily || 'sans-serif';
      s.fontWeight = shape.fontWeight || 'normal';
      if (shape.width) s.width = shape.width;
    } else if (shape.type === 'image') {
      s.width = shape.width; s.height = shape.height;
    }
    if (shape.stroke && shape.stroke !== 'transparent' && shape.strokeWidth > 0) {
      s.border = `${shape.strokeWidth}px solid ${shape.stroke}`;
    }
    return s;
  };

  const overlayContent = (
    <>
      <Backdrop
        visible={visible}
        color={config.backdropColor}
        onClick={handleBackdropClick}
        onKeyDown={handleKeyDown}
      />
      <div
        ref={panelRef}
        style={{
          ...getPosition(),
          backgroundColor: targetFrame.fill || '#1A1A1D',
          borderRadius: targetFrame.cornerRadius || 0,
          overflow: targetFrame.clipContent ? 'hidden' : undefined,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
        className="flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#333]">
          <span className="text-xs text-[#ccc]">{targetFrame.name}</span>
          <button
            onClick={handleClose}
            className="p-1 rounded text-[#999] hover:text-white hover:bg-[#333] transition-colors"
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 relative overflow-hidden">
          {childShapes.map(shape => (
            <div key={shape.id} style={resolveShapeStyle(shape)}>
              {shape.type === 'text' && shape.text}
              {shape.type === 'image' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shape.src} alt={shape.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {allShapes.filter(s => s.parentId === shape.id).map(child => (
                <div key={child.id} style={resolveShapeStyle({ ...child, x: child.x - shape.x, y: child.y - shape.y })}>
                  {child.type === 'text' && child.text}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlayContent, document.body);
}
