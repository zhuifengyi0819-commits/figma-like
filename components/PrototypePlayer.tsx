'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { useEditorStore } from '@/stores/useEditorStore';
import { Shape, Interaction, TriggerType, ActiveOverlay, OverlayConfig, ComponentStateType, Condition } from '@/lib/types';
import { isLayoutContainer, containerClipOverflow } from '@/lib/measurement';
import { computeSmartTransition } from '@/lib/smartAnimate';
import { getEasingCss } from '@/lib/easing';
import OverlayPortal from './prototype/OverlayPortal';
import { X, ArrowLeft, Maximize2 } from 'lucide-react';

/** Evaluate whether all conditions pass given current variable values */
function evaluateConditions(
  conditions: Condition[],
  variables: { id: string; name: string; defaultValue?: string | number | boolean }[],
  variableValues: { variableId: string; value: string | number | boolean }[]
): boolean {
  for (const cond of conditions) {
    const vDef = variables.find(v => v.id === cond.variableId);
    const vVal = variableValues.find(vv => vv.variableId === cond.variableId);
    const current = vVal?.value ?? vDef?.defaultValue;
    switch (cond.operator) {
      case 'isTrue': if (!current) return false; break;
      case 'isFalse': if (current) return false; break;
      case '==': if (current !== cond.value) return false; break;
      case '!=': if (current === cond.value) return false; break;
      case '>': if ((current as number) <= (cond.value as number)) return false; break;
      case '<': if ((current as number) >= (cond.value as number)) return false; break;
      case '>=': if ((current as number) < (cond.value as number)) return false; break;
      case '<=': if ((current as number) > (cond.value as number)) return false; break;
    }
  }
  return true;
}

function resolveShapeStyle(shape: Shape): React.CSSProperties {
  const s: React.CSSProperties = {
    position: 'absolute',
    left: shape.x,
    top: shape.y,
    opacity: shape.opacity,
  };
  if (shape.rotation) s.transform = `rotate(${shape.rotation}deg)`;

  if (shape.type === 'rect' || isLayoutContainer(shape)) {
    s.width = shape.width || 100;
    s.height = shape.height || 100;
    s.backgroundColor = shape.fill;
    const cr = shape.cornerRadius;
    if (cr) s.borderRadius = typeof cr === 'number' ? cr : cr[0];
    if (isLayoutContainer(shape) && containerClipOverflow(shape)) s.overflow = 'hidden';
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

/**
 * Apply component overrides to a shape if it's an instance.
 */
function applyOverrides(shape: Shape): Shape {
  if (!shape.overrides || Object.keys(shape.overrides).length === 0) return shape;
  const overrides = shape.overrides;
  const result = { ...shape };
  for (const [key, value] of Object.entries(overrides)) {
    if (key in result) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

interface TriggerHandlerProps {
  shape: Shape;
  allShapes: Shape[];
  shapeRef: React.RefObject<HTMLElement | null>;
  onNavigate: (frameId: string, transition?: string, duration?: number, easing?: string, sourceShapeId?: string) => void;
  onOverlay: (targetFrameId: string, config: OverlayConfig, triggerElementId: string, triggerRect: DOMRect | null) => void;
}

function useTriggerHandlers({ shape, allShapes, shapeRef, onNavigate, onOverlay }: TriggerHandlerProps) {
  const interactions = shape.interactions || [];

  const fireInteraction = useCallback((trigger: TriggerType) => {
    const ints = interactions.filter(i => i.trigger === trigger);
    if (!ints || ints.length === 0) return;

    const { variables, variableValues } = useEditorStore.getState();

    for (const int of ints) {
      // Evaluate all conditions (if any) — ALL must pass
      if (int.conditions && int.conditions.length > 0) {
        if (!evaluateConditions(int.conditions, variables, variableValues)) continue;
      }

      if (int.action === 'navigateTo' && int.targetFrameId) {
        onNavigate(int.targetFrameId, int.transition, int.duration, int.easing, shape.id);
      } else if (int.action === 'openUrl' && int.url) {
        window.open(int.url, '_blank');
      } else if (int.action === 'back') {
        // handled at player level
      } else if (int.action === 'setOverlay' && int.targetFrameId && int.overlay) {
        const rect = shapeRef.current?.getBoundingClientRect() ?? null;
        onOverlay(int.targetFrameId, int.overlay, shape.id, rect);
      } else if (int.action === 'setVariable' && int.variableId && int.variableValue !== undefined) {
        const store = useEditorStore.getState();
        store.setVariableValue(int.variableId, int.variableValue);
        if (int.targetFrameId) {
          onNavigate(int.targetFrameId, int.transition, int.duration, int.easing, shape.id);
        }
      } else if (int.action === 'stateChange' && int.targetState) {
        const store = useEditorStore.getState();
        store.setShapeState(shape.id, int.targetState as ComponentStateType);
        if (int.targetFrameId) {
          onNavigate(int.targetFrameId, int.transition, int.duration, int.easing, shape.id);
        }
      }
    }
  }, [interactions, onNavigate, onOverlay, shape.id, shapeRef]);

  return { fireInteraction, interactions };
}

interface PrototypeShapeProps {
  shape: Shape;
  allShapes: Shape[];
  shapeRef?: React.RefObject<HTMLElement | null>;
  onNavigate: (frameId: string, transition?: string, duration?: number, easing?: string, sourceShapeId?: string) => void;
  onOverlay: (targetFrameId: string, config: OverlayConfig, triggerElementId: string, triggerRect: DOMRect | null) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  onDrag?: (x: number, y: number) => void;       // whileDragging: during drag
  onDragEnd?: (x: number, y: number) => void;    // drag: after drag ends
}

function PrototypeShape({
  shape,
  allShapes,
  shapeRef,
  onNavigate,
  onOverlay,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  onDrag,
  onDragEnd,
}: PrototypeShapeProps) {
  const innerRef = useRef<HTMLElement | null>(null);
  const resolvedRef = shapeRef ?? innerRef;
  const { fireInteraction, interactions } = useTriggerHandlers({ shape, allShapes, shapeRef: resolvedRef, onNavigate, onOverlay });

  const hasClick = interactions.some(i => i.trigger === 'click');
  const hasHover = interactions.some(i => i.trigger === 'hover');
  const hasMouseDown = interactions.some(i => i.trigger === 'mouseDown');
  const hasMouseUp = interactions.some(i => i.trigger === 'mouseUp');
  const hasMouseEnter = interactions.some(i => i.trigger === 'mouseEnter');
  const hasMouseLeave = interactions.some(i => i.trigger === 'mouseLeave');
  const hasWhileDown = interactions.some(i => i.trigger === 'whileDown');
  const hasWhileDragging = interactions.some(i => i.trigger === 'whileDragging');
  const hasDrag = interactions.some(i => i.trigger === 'drag');

  const [whileDownActive, setWhileDownActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const style = resolveShapeStyle(applyOverrides(shape));
  const children = allShapes.filter(s => s.parentId === shape.id);

  const handleMouseEnter = useCallback(() => {
    if (hasMouseEnter || hasHover) fireInteraction('mouseEnter');
    onMouseEnter?.();
  }, [hasMouseEnter, hasHover, fireInteraction, onMouseEnter]);

  const handleMouseLeave = useCallback(() => {
    if (hasMouseLeave || hasHover) fireInteraction('mouseLeave');
    setWhileDownActive(false);
    onMouseLeave?.();
  }, [hasMouseLeave, hasHover, fireInteraction, onMouseLeave]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasMouseDown) fireInteraction('mouseDown');
    if (hasWhileDown) setWhileDownActive(true);
    onMouseDown?.();
  }, [hasMouseDown, hasWhileDown, fireInteraction, onMouseDown]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasMouseUp) fireInteraction('mouseUp');
    if (hasWhileDown) setWhileDownActive(false);
    onMouseUp?.();
  }, [hasMouseUp, hasWhileDown, fireInteraction, onMouseUp]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    fireInteraction('click');
  }, [fireInteraction]);

  const handleMouseMove = useCallback(() => {
    if (whileDownActive && hasWhileDown) {
      fireInteraction('whileDown');
    }
  }, [whileDownActive, hasWhileDown, fireInteraction]);

  // whileDragging + drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!hasWhileDragging && !hasDrag) return;
    e.preventDefault();
    e.stopPropagation();
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  }, [hasWhileDragging, hasDrag]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const x = e.clientX - (dragStartPos.current?.x ?? e.clientX) + (shape.x || 0);
    const y = e.clientY - (dragStartPos.current?.y ?? e.clientY) + (shape.y || 0);
    if (hasWhileDragging) {
      fireInteraction('whileDragging');
    }
    onDrag?.(x, y);
  }, [isDragging, hasWhileDragging, fireInteraction, onDrag, shape.x, shape.y]);

  const handleDragEnd = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const x = e.clientX - (dragStartPos.current?.x ?? e.clientX) + (shape.x || 0);
    const y = e.clientY - (dragStartPos.current?.y ?? e.clientY) + (shape.y || 0);
    setIsDragging(false);
    dragStartPos.current = null;
    if (hasDrag) {
      fireInteraction('drag');
    }
    onDragEnd?.(x, y);
  }, [isDragging, hasDrag, fireInteraction, onDragEnd, shape.x, shape.y]);

  const handleInteraction = (trigger: TriggerType) => fireInteraction(trigger);

  const setRef = useCallback((el: HTMLElement | null) => {
    (resolvedRef as React.MutableRefObject<HTMLElement | null>).current = el;
  }, [resolvedRef]);

  if (shape.type === 'text') {
    return (
      <span
        ref={setRef}
        style={style}
        onClick={hasClick ? handleClick : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={(e) => { handleMouseDown(e); handleDragStart(e); }}
        onMouseUp={(e) => { handleMouseUp(e); handleDragEnd(e); }}
        onMouseMove={(e) => { handleMouseMove(); handleDragMove(e); }}
        className={hasClick || hasWhileDragging ? 'cursor-pointer' : ''}
      >
        {shape.text}
      </span>
    );
  }

  if (shape.type === 'image') {
    return (
      <Image
        ref={setRef as unknown as React.Ref<HTMLImageElement>}
        src={shape.src ?? ''}
        alt={shape.name}
        style={{ ...style, objectFit: 'cover' } as React.CSSProperties}
        onClick={hasClick ? handleClick : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={(e) => { handleMouseDown(e); handleDragStart(e); }}
        onMouseUp={(e) => { handleMouseUp(e); handleDragEnd(e); }}
        onMouseMove={(e) => { handleMouseMove(); handleDragMove(e); }}
        className={hasClick || hasWhileDragging ? 'cursor-pointer' : ''}
      />
    );
  }

  return (
    <div
      ref={setRef}
      style={style}
      onClick={hasClick ? handleClick : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={(e) => { handleMouseDown(e); handleDragStart(e); }}
      onMouseUp={(e) => { handleMouseUp(e); handleDragEnd(e); }}
      onMouseMove={(e) => { handleMouseMove(); handleDragMove(e); }}
      className={hasClick || hasWhileDragging ? 'cursor-pointer' : ''}
    >
      {children.map(child => (
        <PrototypeShape
          key={child.id}
          shape={{ ...child, x: child.x - shape.x, y: child.y - shape.y }}
          allShapes={allShapes}
          onNavigate={onNavigate}
          onOverlay={onOverlay}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
}

export default function PrototypePlayer() {
  const { shapes, setPrototypeMode, pages } = useEditorStore();
  const allShapes = shapes;

  // Find all top-level frames
  const frames = allShapes.filter(s => isLayoutContainer(s) && !s.parentId);
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(() => frames[0]?.id || null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionClass, setTransitionClass] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<ActiveOverlay[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const historyStack = useRef<string[]>([]);

  // Handle afterDelay triggers
  const delayTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Register keydown handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close topmost overlay
        if (activeOverlays.length > 0) {
          closeOverlay(activeOverlays[activeOverlays.length - 1].id);
        } else if (canGoBack) {
          goBack();
        } else {
          setPrototypeMode('EDIT');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOverlays, canGoBack, setPrototypeMode]);

  // Load onLoad triggers when frame first appears
  useEffect(() => {
    if (!currentFrameId) return;
    const frame = allShapes.find(s => s.id === currentFrameId);
    if (!frame) return;

    const loadInts = frame.interactions?.filter(i => i.trigger === 'onLoad') || [];
    for (const int of loadInts) {
      if (int.action === 'navigateTo' && int.targetFrameId) {
        const dur = int.duration || 300;
        const timer = setTimeout(() => navigate(int.targetFrameId!, int.transition, dur, int.easing, frame.id), int.delay || 0);
        delayTimeouts.current.set(`load-${int.targetFrameId}`, timer);
      }
    }

    return () => {
      delayTimeouts.current.forEach(timer => clearTimeout(timer));
      delayTimeouts.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFrameId]);

  const closeOverlay = useCallback((overlayId: string) => {
    setActiveOverlays(prev => prev.filter(o => o.id !== overlayId));
  }, []);

  const navigate = useCallback((frameId: string, transition?: string, duration?: number, easing?: string, sourceShapeId?: string) => {
    if (currentFrameId) {
      historyStack.current.push(currentFrameId);
      setCanGoBack(true);
    }

    const dur = duration || 300;
    const eas = easing;

    // Resolve 'auto' or undefined transition using smart animate
    let resolvedTransition = transition || 'instant';
    if (transition === 'auto' || transition === undefined) {
      if (currentFrameId && sourceShapeId) {
        const srcFrame = allShapes.find(s => s.id === currentFrameId);
        const dstFrame = allShapes.find(s => s.id === frameId);
        const srcShape = allShapes.find(s => s.id === sourceShapeId);
        if (srcFrame && dstFrame && srcShape) {
          const smart = computeSmartTransition(srcShape, srcFrame, dstFrame, allShapes);
          resolvedTransition = smart.transition;
        } else {
          resolvedTransition = 'instant';
        }
      } else {
        resolvedTransition = 'instant';
      }
    }

    if (resolvedTransition && resolvedTransition !== 'instant') {
      setTransitioning(true);
      const classMap: Record<string, string> = {
        dissolve: 'animate-fade-in',
        slideLeft: 'animate-slide-left',
        slideRight: 'animate-slide-right',
        slideUp: 'animate-slide-up',
        slideDown: 'animate-slide-down',
        scale: 'animate-scale',
        slideLeftRight: 'animate-slide-left-right',
        slideUpDown: 'animate-slide-up-down',
      };
      const cls = classMap[resolvedTransition] || '';
      setTransitionClass(cls);
      setCurrentFrameId(frameId);

      // Apply custom easing to the animation
      if (eas && panelRef.current) {
        panelRef.current.style.transition = `opacity ${dur}ms ${getEasingCss(eas as Parameters<typeof getEasingCss>[0])}`;
      }

      setTimeout(() => {
        setTransitioning(false);
        setTransitionClass('');
      }, dur);
    } else {
      setCurrentFrameId(frameId);
    }
  }, [currentFrameId, allShapes]);

  const goBack = useCallback(() => {
    const prev = historyStack.current.pop();
    if (prev) setCurrentFrameId(prev);
    setCanGoBack(historyStack.current.length > 0);
  }, []);

  const handleOverlay = useCallback((targetFrameId: string, config: OverlayConfig, triggerElementId: string, triggerRect: DOMRect | null) => {
    const newOverlay: ActiveOverlay = {
      id: `overlay-${Date.now()}`,
      targetFrameId,
      triggerElementId,
      triggerRect: triggerRect ?? { x: 0, y: 0, width: 0, height: 0 },
      config,
    };
    setActiveOverlays(prev => [...prev, newOverlay]);
  }, []);

  const panelRef = useRef<HTMLDivElement>(null);
  const currentFrame = allShapes.find(s => s.id === currentFrameId);
  const visibleShapes = currentFrame
    ? allShapes.filter(s => s.parentId === currentFrameId && s.visible)
    : allShapes.filter(s => !s.parentId && s.visible);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Toolbar */}
      <div className="h-10 flex items-center justify-between px-4 bg-[#111] border-b border-[#333]">
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="p-1.5 rounded text-[#999] hover:text-white disabled:opacity-30 transition-colors"
            title="返回"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="text-xs text-[#999]">{currentFrame?.name || '预览'}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={currentFrameId || ''}
            onChange={e => setCurrentFrameId(e.target.value)}
            className="bg-[#222] border border-[#444] rounded px-2 py-1 text-xs text-[#ccc]"
          >
            {frames.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button
            onClick={() => setPrototypeMode('EDIT')}
            className="p-1.5 rounded text-[#999] hover:text-white transition-colors"
            title="退出预览"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-auto bg-[#0a0a0a]">
        <div
          ref={panelRef}
          className={`relative ${transitionClass}`}
          style={{
            width: currentFrame?.width || 1920,
            height: currentFrame?.height || 1080,
            backgroundColor: currentFrame?.fill || '#1A1A1D',
            borderRadius: (() => {
              const cr = currentFrame?.cornerRadius;
              return cr ? (typeof cr === 'number' ? cr : cr[0]) : 0;
            })(),
            overflow: currentFrame && containerClipOverflow(currentFrame) ? 'hidden' : undefined,
            transition: transitioning ? `opacity 0.3s ${getEasingCss('easeOut')}` : undefined,
          }}
        >
          {visibleShapes.map(shape => (
            <PrototypeShape
              key={shape.id}
              shape={currentFrame ? { ...shape, x: shape.x - currentFrame.x, y: shape.y - currentFrame.y } : shape}
              allShapes={allShapes}
              onNavigate={navigate}
              onOverlay={handleOverlay}
            />
          ))}
        </div>
      </div>

      {/* Overlay Layer */}
      <OverlayPortal
        overlays={activeOverlays}
        allShapes={allShapes}
        onClose={closeOverlay}
      />

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
