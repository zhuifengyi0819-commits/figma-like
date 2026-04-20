'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Shape } from '@/lib/types';
import { OverlayConfig } from '@/lib/types';
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

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback(() => {
    if (config.closeOnClick !== false) {
      handleClose();
    }
  }, [config.closeOnClick, handleClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && config.closeOnEsc !== false) {
      handleClose();
    }
  }, [config.closeOnEsc, handleClose]);

  if (!mounted || animState === 'closed') return null;

  const frameWidth = targetFrame.width || 400;
  const frameHeight = targetFrame.height || 300;

  // Get child shapes of the target frame
  const childShapes = allShapes.filter(s => s.parentId === targetFrame.id);

  // Compute position based on config.positioning
  const getPosition = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 1000,
      width: frameWidth,
      height: frameHeight,
      transition: `transform 300ms ${getEasingCss('easeOut')}, opacity 300ms ${getEasingCss('easeOut')}`,
    };

    const positioning = config.positioning || 'center';

    if (triggerRect && animState === 'opening') {
      // FLIP animation: start from trigger element's rect
      const startX = triggerRect.x + triggerRect.width / 2 - frameWidth / 2;
      const startY = triggerRect.y + triggerRect.height / 2 - frameHeight / 2;
      base.transform = `translate(${startX - (window.innerWidth / 2 - frameWidth / 2)}px, ${startY - (window.innerHeight / 2 - frameHeight / 2)}px) scale(0.8)`;
      base.opacity = 0;
    }

    switch (positioning) {
      case 'center':
        return {
          ...base,
          top: '50%',
          left: '50%',
          transform: animState === 'opening'
            ? `${base.transform || ''} translate(-50%, -50%)`.trim()
            : 'translate(-50%, -50%)',
          opacity: animState === 'opening' ? 0 : 1,
        };
      case 'top':
        return {
          ...base,
          top: 0,
          left: '50%',
          transform: animState === 'opening'
            ? `${base.transform || ''} translateX(-50%)`.trim()
            : 'translateX(-50%)',
          opacity: animState === 'opening' ? 0 : 1,
        };
      case 'bottom':
        return {
          ...base,
          bottom: 0,
          left: '50%',
          transform: animState === 'opening'
            ? `${base.transform || ''} translateX(-50%)`.trim()
            : 'translateX(-50%)',
          opacity: animState === 'opening' ? 0 : 1,
        };
      case 'left':
        return {
          ...base,
          left: 0,
          top: '50%',
          transform: animState === 'opening'
            ? `${base.transform || ''} translateY(-50%)`.trim()
            : 'translateY(-50%)',
          opacity: animState === 'opening' ? 0 : 1,
        };
      case 'right':
        return {
          ...base,
          right: 0,
          top: '50%',
          transform: animState === 'opening'
            ? `${base.transform || ''} translateY(-50%)`.trim()
            : 'translateY(-50%)',
          opacity: animState === 'opening' ? 0 : 1,
        };
      case 'custom':
        return {
          ...base,
          top: config.offsetY ?? '50%',
          left: config.offsetX ?? '50%',
          transform: 'translate(-50%, -50%)',
          opacity: animState === 'opening' ? 0 : 1,
        };
      default:
        return {
          ...base,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 1,
        };
    }
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
        color={config.backgroundColor}
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
              {/* Nested children */}
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
