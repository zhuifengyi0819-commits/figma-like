'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { Shape, Interaction } from '@/lib/types';
import { X, ArrowLeft, Maximize2 } from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';

function resolveShapeStyle(shape: Shape): React.CSSProperties {
  const s: React.CSSProperties = {
    position: 'absolute',
    left: shape.x,
    top: shape.y,
    opacity: shape.opacity,
  };
  if (shape.rotation) s.transform = `rotate(${shape.rotation}deg)`;

  if (shape.type === 'rect' || shape.type === 'frame') {
    s.width = shape.width || 100;
    s.height = shape.height || 100;
    s.backgroundColor = shape.fill;
    if (shape.cornerRadius) s.borderRadius = shape.cornerRadius;
    if (shape.type === 'frame' && shape.clipContent !== false) s.overflow = 'hidden';
    if (shape.type === 'frame' && shape.autoLayout) {
      s.display = 'flex';
      s.flexDirection = shape.autoLayout.direction === 'horizontal' ? 'row' : 'column';
      s.gap = shape.autoLayout.gap;
      s.padding = `${shape.autoLayout.paddingTop}px ${shape.autoLayout.paddingRight}px ${shape.autoLayout.paddingBottom}px ${shape.autoLayout.paddingLeft}px`;
    }
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

  const shadows = shape.shadows || (shape.shadow ? [shape.shadow] : []);
  if (shadows.length > 0) {
    s.boxShadow = shadows.map(sh => `${sh.offsetX}px ${sh.offsetY}px ${sh.blur}px ${sh.color}`).join(', ');
  }

  return s;
}

function PrototypeShape({ shape, allShapes, onNavigate }: { shape: Shape; allShapes: Shape[]; onNavigate: (frameId: string, transition?: string, duration?: number) => void }) {
  const handleInteraction = useCallback((trigger: Interaction['trigger']) => {
    const ints = shape.interactions?.filter(i => i.trigger === trigger);
    if (!ints || ints.length === 0) return;
    for (const int of ints) {
      if (int.action === 'navigateTo' && int.targetFrameId) {
        onNavigate(int.targetFrameId, int.transition, int.duration);
      } else if (int.action === 'openUrl' && int.url) {
        window.open(int.url, '_blank');
      }
    }
  }, [shape.interactions, onNavigate]);

  const hasClick = shape.interactions?.some(i => i.trigger === 'click');
  const style = resolveShapeStyle(shape);
  const children = allShapes.filter(s => s.parentId === shape.id);

  if (shape.type === 'text') {
    return (
      <span
        style={style}
        onClick={hasClick ? (e) => { e.stopPropagation(); handleInteraction('click'); } : undefined}
        onMouseEnter={() => handleInteraction('hover')}
        className={hasClick ? 'cursor-pointer hover:opacity-80' : ''}
      >
        {shape.text}
      </span>
    );
  }

  if (shape.type === 'image') {
    return (
      <img
        src={shape.src} alt={shape.name}
        style={{ ...style, objectFit: 'cover' } as React.CSSProperties}
        onClick={hasClick ? (e) => { e.stopPropagation(); handleInteraction('click'); } : undefined}
        onMouseEnter={() => handleInteraction('hover')}
        className={hasClick ? 'cursor-pointer' : ''}
      />
    );
  }

  return (
    <div
      style={style}
      onClick={hasClick ? (e) => { e.stopPropagation(); handleInteraction('click'); } : undefined}
      onMouseEnter={() => handleInteraction('hover')}
      className={hasClick ? 'cursor-pointer' : ''}
    >
      {children.map(child => (
        <PrototypeShape key={child.id} shape={{ ...child, x: child.x - shape.x, y: child.y - shape.y }} allShapes={allShapes} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export default function PrototypePlayer() {
  const { shapes, setPrototypeMode, pages } = useEditorStore();
  const allShapes = shapes;

  // Find all top-level frames
  const frames = allShapes.filter(s => s.type === 'frame' && !s.parentId);
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(frames[0]?.id || null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionClass, setTransitionClass] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const historyStack = useRef<string[]>([]);

  useEffect(() => {
    if (frames.length > 0 && !currentFrameId) setCurrentFrameId(frames[0].id);
  }, [frames, currentFrameId]);

  const navigate = useCallback((frameId: string, transition?: string, duration?: number) => {
    if (currentFrameId) historyStack.current.push(currentFrameId);
    const dur = duration || 300;
    if (transition && transition !== 'instant') {
      setTransitioning(true);
      const classMap: Record<string, string> = {
        dissolve: 'animate-fade-in',
        slideLeft: 'animate-slide-left',
        slideRight: 'animate-slide-right',
        slideUp: 'animate-slide-up',
        slideDown: 'animate-slide-down',
      };
      setTransitionClass(classMap[transition] || '');
      setCurrentFrameId(frameId);
      setTimeout(() => { setTransitioning(false); setTransitionClass(''); }, dur);
    } else {
      setCurrentFrameId(frameId);
    }
  }, [currentFrameId]);

  const goBack = useCallback(() => {
    const prev = historyStack.current.pop();
    if (prev) setCurrentFrameId(prev);
  }, []);

  const currentFrame = allShapes.find(s => s.id === currentFrameId);
  const visibleShapes = currentFrame ? allShapes.filter(s => s.parentId === currentFrameId && s.visible) : allShapes.filter(s => !s.parentId && s.visible);

  // Also collect all pages' shapes with interactions
  const allPagesFrames = pages.flatMap(p => p.shapes.filter(s => s.type === 'frame' && !s.parentId));

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Toolbar */}
      <div className="h-10 flex items-center justify-between px-4 bg-[#111] border-b border-[#333]">
        <div className="flex items-center gap-2">
          <button onClick={goBack} disabled={historyStack.current.length === 0} className="p-1.5 rounded text-[#999] hover:text-white disabled:opacity-30 transition-colors" title="返回" aria-label="返回">
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs text-[#999]">{currentFrame?.name || '预览'}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Frame selector */}
          <select
            value={currentFrameId || ''}
            onChange={e => setCurrentFrameId(e.target.value)}
            className="bg-[#222] border border-[#444] rounded px-2 py-1 text-xs text-[#ccc]"
            title="选择画框"
          >
            {allPagesFrames.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button onClick={() => setPrototypeMode(false)} className="p-1.5 rounded text-[#999] hover:text-white transition-colors" title="退出预览" aria-label="退出预览">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-auto bg-[#0a0a0a]">
        <div
          className={`relative ${transitionClass}`}
          style={{
            width: currentFrame?.width || 1920,
            height: currentFrame?.height || 1080,
            backgroundColor: currentFrame?.fill || '#1A1A1D',
            borderRadius: currentFrame?.cornerRadius || 0,
            overflow: currentFrame?.clipContent !== false ? 'hidden' : undefined,
            transition: transitioning ? 'opacity 0.3s' : undefined,
          }}
        >
          {visibleShapes.map(shape => (
            <PrototypeShape
              key={shape.id}
              shape={currentFrame ? { ...shape, x: shape.x - currentFrame.x, y: shape.y - currentFrame.y } : shape}
              allShapes={allShapes}
              onNavigate={navigate}
            />
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="h-7 flex items-center justify-center px-4 bg-[#111] border-t border-[#333]">
        <div className="flex items-center gap-4 text-[10px] text-[#666]">
          <span><Maximize2 size={10} className="inline mr-1" />{currentFrame?.width || 1920}×{currentFrame?.height || 1080}</span>
          <span>{frames.length} 个画框</span>
          <span>ESC 退出</span>
        </div>
      </div>
    </div>
  );
}
