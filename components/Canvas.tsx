import { fileToDataUrl, getImageDimensions, useImage } from '@/lib/hooks';
import {
  computeAutoLayoutOverlay,
  computeParentPaddingSegments,
  getShapeAABB,
  hitTestShapeAtPoint,
  isLayoutContainer,
  measureGapBetweenAABBs,
} from '@/lib/measurement';
import {
  computeChildLayout,
  computeAutoLayoutChildren,
  getShapeCanvasPosition,
} from '@/lib/layout';
import { BlendMode, CANVAS_HEIGHT, CANVAS_WIDTH, Gradient, PenPoint, Shape, TokenBindings, ComponentStateType, ShapeStateOverrides } from '@/lib/types';
import { interpolateText } from '@/lib/variables';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  buildPenPoint,
  getPathPreviewToCursor,
  isNearFirstPoint,
  pointsToSvgPath,
  relToAbs,
  updateSymmetricHandles,
} from '@/lib/penTool';
import { getClipFunc } from '@/lib/maskUtils';
import { shapesToSvg, downloadSvg } from '@/lib/svgExport';
import Konva from 'konva';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Arrow, Circle, Group, Image as KonvaImage, Layer, Line, Path, Rect, RegularPolygon, Stage, Star, Text, Transformer } from 'react-konva';
import { ArrowLeft } from 'lucide-react';
import { SelectionOverlay } from '@/components/SelectionOverlay';
import { SnapEngine } from '@/lib/snap/SnapEngine';
import { getSceneGraphInstance, getEditorEngine, syncEditorFromStore } from '@/hooks/useEditor';

interface CanvasProps { width: number; height: number; }

function resolveTokenValue(tokenId: string | undefined): string | undefined {
  if (!tokenId) return undefined;
  return useEditorStore.getState().getTokenValue(tokenId);
}

function resolveTokenBindings(shape: Shape): {
  fill: string;
  stroke: string;
  opacity: number;
  cornerRadius: number;
} {
  const bindings = shape.tokenBindings || ({} as TokenBindings);
  return {
    fill: resolveTokenValue(bindings.fill) ?? shape.fill,
    stroke: resolveTokenValue(bindings.stroke) ?? shape.stroke,
    opacity: bindings.opacity ? parseFloat(resolveTokenValue(bindings.opacity) ?? '1') : shape.opacity,
    cornerRadius: bindings.cornerRadius ? parseInt(resolveTokenValue(bindings.cornerRadius) ?? '0') : shape.cornerRadius ?? 0,
  };
}

// Resolve shape properties with component state overrides applied
function resolveWithState(
  shape: Shape,
  currentState: ComponentStateType | undefined,
  stateOverrides: Shape['stateOverrides'],
  baseTokens: { fill: string; stroke: string; opacity: number; cornerRadius: number }
): {
  fill: string;
  stroke: string;
  opacity: number;
  cornerRadius: number;
  scaleX: number;
  scaleY: number;
  text: string;
  fontSize: number;
} {
  // No state or default state or no overrides → return base
  if (!currentState || currentState === 'default' || !stateOverrides) {
    return {
      fill: baseTokens.fill,
      stroke: baseTokens.stroke,
      opacity: baseTokens.opacity,
      cornerRadius: baseTokens.cornerRadius,
      scaleX: shape.scaleX ?? 1,
      scaleY: shape.scaleY ?? 1,
      text: shape.text ?? 'Text',
      fontSize: shape.fontSize ?? 24,
    };
  }

  const overrideKey = currentState as 'hover' | 'active' | 'pressed' | 'focused' | 'disabled';
  const override = stateOverrides[overrideKey];
  if (!override) {
    return {
      fill: baseTokens.fill,
      stroke: baseTokens.stroke,
      opacity: baseTokens.opacity,
      cornerRadius: baseTokens.cornerRadius,
      scaleX: shape.scaleX ?? 1,
      scaleY: shape.scaleY ?? 1,
      text: shape.text ?? 'Text',
      fontSize: shape.fontSize ?? 24,
    };
  }

  return {
    fill: override.fill ?? baseTokens.fill,
    stroke: override.stroke ?? baseTokens.stroke,
    opacity: override.opacity ?? baseTokens.opacity,
    cornerRadius: override.cornerRadius ?? baseTokens.cornerRadius,
    scaleX: override.scaleX ?? shape.scaleX ?? 1,
    scaleY: override.scaleY ?? shape.scaleY ?? 1,
    text: override.text ?? shape.text ?? 'Text',
    fontSize: override.fontSize ?? shape.fontSize ?? 24,
  };
}

function gradientToKonvaFill(g: Gradient, w: number, h: number): Record<string, unknown> {
  if (g.type === 'linear') {
    const angle = ((g.angle || 0) * Math.PI) / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return {
      fillLinearGradientStartPoint: { x: w / 2 - cos * w / 2, y: h / 2 - sin * h / 2 },
      fillLinearGradientEndPoint: { x: w / 2 + cos * w / 2, y: h / 2 + sin * h / 2 },
      fillLinearGradientColorStops: g.stops.flatMap(s => [s.offset, s.color]),
    };
  }
  return {
    fillRadialGradientStartPoint: { x: w / 2, y: h / 2 },
    fillRadialGradientEndPoint: { x: w / 2, y: h / 2 },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: Math.max(w, h) / 2,
    fillRadialGradientColorStops: g.stops.flatMap(s => [s.offset, s.color]),
  };
}

function getShapeBoundsForSnap(s: Shape) {
  const b = getShapeAABB(s);
  const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
  if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') {
    return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, cx: s.x, cy: s.y };
  }
  return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, cx, cy };
}

function pathPointsToSvg(shape: Shape): string {
  if (shape.pathData) return shape.pathData;
  const pts = shape.pathPoints;
  if (!pts || pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const pt = pts[i];
    if (prev.cp2 || pt.cp1) {
      const c1 = prev.cp2 || prev;
      const c2 = pt.cp1 || pt;
      d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${pt.x} ${pt.y}`;
    } else {
      d += ` L ${pt.x} ${pt.y}`;
    }
  }
  if (shape.closePath) d += ' Z';
  return d;
}

const BLEND_MODE_MAP: Record<BlendMode, GlobalCompositeOperation> = {
  'normal': 'source-over', 'multiply': 'multiply', 'screen': 'screen',
  'overlay': 'overlay', 'darken': 'darken', 'lighten': 'lighten',
  'color-dodge': 'color-dodge', 'color-burn': 'color-burn',
  'hard-light': 'hard-light', 'soft-light': 'soft-light',
  'difference': 'difference', 'exclusion': 'exclusion',
};

function applyEffects(props: Record<string, unknown>, shape: Shape) {
  if (shape.blendMode && shape.blendMode !== 'normal') {
    props.globalCompositeOperation = BLEND_MODE_MAP[shape.blendMode] || 'source-over';
  }
  // Konva has no true backdrop blur; both modes use Gaussian blur on the cached layer.
  if (shape.blur && shape.blur.radius > 0) {
    const existing = (props.filters as unknown[]) || [];
    props.filters = [...existing, Konva.Filters.Blur];
    props.blurRadius = shape.blur.radius;
  }
}

 
function useKonvaBlurCache(nodeRef: React.RefObject<Konva.Node | null>, blurRadius: number, ...cacheDeps: unknown[]) {
  useLayoutEffect(() => {
    const n = nodeRef.current;
    if (!n) return;
    if (blurRadius > 0) {
      const pad = Math.ceil(blurRadius * 2);
      n.cache({ offset: pad });
      n.getLayer()?.batchDraw();
    } else {
      n.clearCache();
    }
    return () => { n.clearCache(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blurRadius, nodeRef, ...cacheDeps]);
}

function ImageShape({ shape, commonProps }: { shape: Shape; commonProps: Record<string, unknown> }) {
  const [image] = useImage(shape.src);
  if (!image) return null;
  return (
    <KonvaImage
      {...commonProps}
      image={image}
      width={shape.width || image.naturalWidth}
      height={shape.height || image.naturalHeight}
      cornerRadius={shape.cornerRadius || 0}
    />
  );
}

function ShapeRenderer({
  shape, isSelected, editingTextId, isEditingPath, onSelect, onDragEnd, onDragMove, onTransformEnd, onDblClickText, onDblClickPath, engineRef, draggingShapeIdRef,
}: {
  shape: Shape;
  isSelected: boolean;
  editingTextId: string | null;
  isEditingPath?: boolean;
  onSelect: (id: string, add: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDragMove: (id: string, dx: number, dy: number) => void;
  onTransformEnd: (id: string, node: Konva.Node) => void;
  onDblClickText: (id: string) => void;
  onDblClickPath?: () => void;
  engineRef?: React.MutableRefObject<ReturnType<typeof import('@/hooks/useEditor').getEditorEngine> | null>;
  draggingShapeIdRef?: React.MutableRefObject<string | null>;
}) {
  const shapeRef = useRef<Konva.Shape>(null);
  const initPos = useRef({ x: shape.x, y: shape.y });

  const shadowProps = useMemo(() => {
    const shadows = shape.shadows || (shape.shadow ? [shape.shadow] : []);
    if (shadows.length === 0) return {};
    const s = shadows[0];
    return { shadowColor: s.color, shadowBlur: s.blur, shadowOffsetX: s.offsetX, shadowOffsetY: s.offsetY, shadowOpacity: 1 };
  }, [shape.shadow, shape.shadows]);

  const effectProps: Record<string, unknown> = {};
  applyEffects(effectProps, shape);

  const resolvedTokens = useMemo(() => resolveTokenBindings(shape), [shape]);

  // Get active state from store and resolve with state overrides
  const activeState = useEditorStore(s => s.activeStates[shape.id]);
  const resolvedWithState = useMemo(
    () => resolveWithState(shape, activeState, shape.stateOverrides, resolvedTokens),
    [shape, activeState, shape.stateOverrides, resolvedTokens]
  );

  const commonProps: Record<string, unknown> = {
    ...effectProps,
    id: shape.id,
    ref: shapeRef as React.RefObject<never>,
    x: shape.x, y: shape.y,
    rotation: shape.rotation,
    opacity: resolvedWithState.opacity,
    visible: shape.visible,
    draggable: !shape.locked,
    scaleX: resolvedWithState.scaleX,
    scaleY: resolvedWithState.scaleY,
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onSelect(shape.id, e.evt.shiftKey); },
    onMouseEnter: () => {
      const { setShapeState } = useEditorStore.getState();
      if (shape.stateOverrides?.hover) setShapeState(shape.id, 'hover');
    },
    onMouseLeave: () => {
      const { setShapeState } = useEditorStore.getState();
      if (shape.stateOverrides?.hover) setShapeState(shape.id, 'default');
    },
    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
      initPos.current = { x: shape.x, y: shape.y };
      // Alt+Drag duplicate: create a copy via engine and drag that instead
      if (e.evt.altKey && !shape.locked) {
        const store = useEditorStore.getState();
        // Use engine.duplicateNode when available, fallback to store.addShape
        let newId: string | null = null;
        if (engineRef?.current) {
          newId = engineRef.current.duplicateNode(shape.id, shape.x, shape.y);
        }
        if (!newId) {
          // Fallback when engine is not yet initialized
          newId = store.addShape({ ...shape, id: undefined, x: shape.x, y: shape.y });
        }
        // Use RAF to allow React to render the new shape node before we redirect drag
        requestAnimationFrame(() => {
          const stage = e.target.getStage();
          if (stage) {
            const newNode = stage.findOne(`#${newId}`);
            if (newNode) {
              // Stop dragging original, start dragging duplicate
              e.target.stopDrag();
              newNode.position({ x: e.target.x(), y: e.target.y() });
              newNode.startDrag();
              // Update selection + track that THIS shape is what's being dragged
              store.setSelectedIds([newId!]);
              if (draggingShapeIdRef) draggingShapeIdRef.current = newId!;
            }
          }
        });
      }
    },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      const dx = e.target.x() - initPos.current.x;
      const dy = e.target.y() - initPos.current.y;
      onDragMove(shape.id, dx, dy);
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      // Use draggingShapeIdRef if set (Alt+Drag duplicate case), otherwise use shape.id
      const actualId = draggingShapeIdRef?.current ?? shape.id;
      onDragEnd(actualId, e.target.x(), e.target.y());
      if (draggingShapeIdRef) draggingShapeIdRef.current = null; // Reset after drag ends
    },
    onTransformEnd: () => { if (shapeRef.current) onTransformEnd(shape.id, shapeRef.current); },
    ...shadowProps,
  };

  const blurR = shape.blur?.radius ?? 0;
  useKonvaBlurCache(shapeRef as React.RefObject<Konva.Node | null>, blurR, shape.id, shape.width, shape.height, shape.radius, shape.type, (shape.points || []).length, (shape.pathPoints || []).length);

  const selStroke = isSelected ? '#D4A853' : resolvedWithState.stroke;
  const selStrokeW = isSelected ? Math.max(shape.strokeWidth, 2) : shape.strokeWidth;
  const gradFill = (w: number, h: number) => shape.gradient ? { fill: undefined, ...gradientToKonvaFill(shape.gradient, w, h) } : {};

  switch (shape.type) {
    case 'rect':
    case 'frame': {
      const w = shape.width || 100, h = shape.height || 100;
      return <Rect {...commonProps} width={w} height={h} fill={shape.gradient ? undefined : resolvedWithState.fill} stroke={selStroke} strokeWidth={selStrokeW} cornerRadius={resolvedWithState.cornerRadius} dash={shape.strokeDash} {...gradFill(w, h)} />;
    }
    case 'circle': {
      const r = shape.radius || 50;
      return <Circle {...commonProps} radius={r} fill={shape.gradient ? undefined : resolvedWithState.fill} stroke={selStroke} strokeWidth={selStrokeW} dash={shape.strokeDash} {...(shape.gradient ? gradientToKonvaFill(shape.gradient, r * 2, r * 2) : {})} />;
    }
    case 'text': {
      // Merge text style with shape properties (shape overrides style)
      const textStyle = (shape.textStyleId && useEditorStore.getState().textStyles.find(s => s.id === shape.textStyleId)) || null;
      const { variables, variableValues } = useEditorStore.getState();
      const effectiveFontSize = resolvedWithState.fontSize;
      const effectiveFontFamily = shape.fontFamily ?? textStyle?.fontFamily ?? 'sans-serif';
      const effectiveFontWeight = shape.fontWeight ?? textStyle?.fontWeight ?? 'normal';
      const effectiveTextAlign = shape.textAlign ?? textStyle?.textAlign ?? 'left';
      const effectiveFill = resolvedWithState.fill ?? textStyle?.fill ?? '#E8E4DF';
      // Interpolate {{variableName}} tokens in text
      const interpolatedText = interpolateText(resolvedWithState.text, variables, variableValues);
      const effectiveLineHeight = shape.lineHeight ?? textStyle?.lineHeight ?? 1.2;
      const effectiveLetterSpacing = shape.letterSpacing ?? textStyle?.letterSpacing ?? 0;

      const sizing = shape.textSizing || 'fixed';
      let textWidth: number | undefined = shape.width;
      let textHeight: number | undefined = shape.height;
      let ellipsis = false;
      if (sizing === 'autoWidth') {
        textWidth = undefined;
        textHeight = shape.height;
      } else if (sizing === 'autoHeight') {
        textWidth = shape.width;
        textHeight = undefined;
      } else {
        ellipsis = true;
      }
      return (
        <Text
          {...commonProps}
          visible={shape.visible && editingTextId !== shape.id}
          text={interpolatedText}
          fontSize={effectiveFontSize}
          fontFamily={effectiveFontFamily}
          fontStyle={effectiveFontWeight as string}
          align={effectiveTextAlign as 'left' | 'center' | 'right' | 'justify'}
          width={textWidth}
          height={textHeight}
          fill={effectiveFill}
          lineHeight={effectiveLineHeight}
          letterSpacing={effectiveLetterSpacing}
          ellipsis={ellipsis}
          onDblClick={(e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onDblClickText(shape.id); }}
        />
      );
    }
    case 'line':
      return <Line {...commonProps} points={shape.points || [0, 0, 100, 100]} stroke={isSelected ? '#D4A853' : resolvedWithState.stroke} strokeWidth={isSelected ? Math.max(shape.strokeWidth, 2) : shape.strokeWidth} lineCap="round" lineJoin="round" dash={shape.strokeDash} fill={undefined} />;
    case 'arrow':
      return <Arrow {...commonProps} points={shape.points || [0, 0, 150, 0]} stroke={isSelected ? '#D4A853' : resolvedWithState.stroke} strokeWidth={isSelected ? Math.max(shape.strokeWidth || 2, 2) : (shape.strokeWidth || 2)} fill={isSelected ? '#D4A853' : resolvedWithState.stroke} pointerLength={10} pointerWidth={10} lineCap="round" />;
    case 'star': {
      const r = shape.radius || 50;
      return <Star {...commonProps} numPoints={shape.numPoints || 5} innerRadius={shape.innerRadius || 20} outerRadius={r} fill={shape.gradient ? undefined : resolvedWithState.fill} stroke={selStroke} strokeWidth={selStrokeW} {...(shape.gradient ? gradientToKonvaFill(shape.gradient, r * 2, r * 2) : {})} />;
    }
    case 'triangle': {
      const r = shape.radius || 50;
      return <RegularPolygon {...commonProps} sides={3} radius={r} fill={shape.gradient ? undefined : resolvedWithState.fill} stroke={selStroke} strokeWidth={selStrokeW} {...(shape.gradient ? gradientToKonvaFill(shape.gradient, r * 2, r * 2) : {})} />;
    }
    case 'path': {
      // pathData is set by boolean operations; pathPointsToSvg is for manually drawn paths
      const d = shape.pathData || pathPointsToSvg(shape);
      if (!d) return null;
      return (
        <Path
          {...commonProps}
          data={d}
          fill={shape.fill === 'transparent' ? undefined : shape.fill}
          stroke={isSelected && !isEditingPath ? '#D4A853' : shape.stroke}
          strokeWidth={isSelected && !isEditingPath ? Math.max(shape.strokeWidth, 2) : shape.strokeWidth}
          lineCap="round"
          lineJoin="round"
          onDblClick={(e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onDblClickPath?.(); }}
        />
      );
    }
    case 'image':
    case 'component':
      return <ImageShape shape={shape} commonProps={{ ...commonProps, stroke: isSelected ? '#D4A853' : undefined, strokeWidth: isSelected ? 2 : 0 }} />;
    case 'group':
      return null;
    default:
      return null;
  }
}

// Recursive frame renderer: render frame background + children clipped inside
function FrameRenderer({
  frame, allShapes, selectedIds, editingTextId, isEditingPath, onSelect, onDragEnd, onDragMove, onTransformEnd, onDblClickText, onDblClickPath, engineRef,
}: {
  frame: Shape;
  allShapes: Shape[];
  selectedIds: string[];
  editingTextId: string | null;
  isEditingPath?: boolean;
  onSelect: (id: string, add: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDragMove: (id: string, dx: number, dy: number) => void;
  onTransformEnd: (id: string, node: Konva.Node) => void;
  onDblClickText: (id: string) => void;
  onDblClickPath?: (id: string) => void;
  engineRef?: React.MutableRefObject<ReturnType<typeof import('@/hooks/useEditor').getEditorEngine> | null>;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const children = allShapes.filter(s => s.parentId === frame.id);
  const fw = frame.width || 200, fh = frame.height || 200;
  const isSelected = selectedIds.includes(frame.id);

  const frameShadowProps = useMemo(() => {
    const shadows = frame.shadows || (frame.shadow ? [frame.shadow] : []);
    if (shadows.length === 0) return {};
    const s = shadows[0];
    return { shadowColor: s.color, shadowBlur: s.blur, shadowOffsetX: s.offsetX, shadowOffsetY: s.offsetY, shadowOpacity: 1 };
  }, [frame.shadow, frame.shadows]);

  const groupEffects: Record<string, unknown> = {};
  applyEffects(groupEffects, frame);
  const blurR = frame.blur?.radius ?? 0;
  useKonvaBlurCache(groupRef as React.RefObject<Konva.Node | null>, blurR, frame.id, fw, fh, frame.blendMode);

  // Pre-compute layout for all children (constraints or auto-layout)
  const childLayouts = useMemo(() => {
    if (frame.autoLayout) {
      return computeAutoLayoutChildren(frame, children, allShapes);
    }
    const m = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const child of children) {
      m.set(child.id, computeChildLayout(child, frame, allShapes));
    }
    return m;
  }, [frame, children, allShapes]);

  // Helper: get the render props for a child, applying computed layout
  const getChildRenderProps = (child: Shape) => {
    const l = childLayouts.get(child.id);
    if (l) return { x: l.x, y: l.y, width: l.width, height: l.height };
    return { x: child.x - frame.x, y: child.y - frame.y };
  };

  return (
    <Group
      ref={groupRef}
      id={frame.id}
      x={frame.x}
      y={frame.y}
      rotation={frame.rotation}
      opacity={frame.opacity}
      visible={frame.visible}
      draggable={!frame.locked}
      scaleX={frame.scaleX ?? 1}
      scaleY={frame.scaleY ?? 1}
      clipFunc={(frame.type === 'group' ? frame.clipContent === true : frame.clipContent !== false) ? (ctx: Konva.Context) => {
        ctx.rect(0, 0, fw, fh);
      } : undefined}
      onClick={(e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onSelect(frame.id, e.evt.shiftKey); }}
      onDragStart={(e: Konva.KonvaEventObject<DragEvent>) => {
        // Alt+Drag duplicate for frames/groups
        if (e.evt.altKey && !frame.locked) {
          const store = useEditorStore.getState();
          // Use engine.duplicateNode when available, fallback to store.addShape
          let newId: string | null = null;
          if (engineRef?.current) {
            newId = engineRef.current.duplicateNode(frame.id, frame.x, frame.y);
          }
          if (!newId) {
            newId = store.addShape({ ...frame, id: undefined, x: frame.x, y: frame.y });
          }
          requestAnimationFrame(() => {
            const stage = e.target.getStage();
            if (stage) {
              const newNode = stage.findOne(`#${newId}`);
              if (newNode) {
                e.target.stopDrag();
                newNode.position({ x: e.target.x(), y: e.target.y() });
                newNode.startDrag();
                store.setSelectedIds([newId]);
              }
            }
          });
        }
      }}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(frame.id, e.target.x(), e.target.y())}
      onTransformEnd={(e: Konva.KonvaEventObject<Event>) => {
        e.cancelBubble = true;
        onTransformEnd(frame.id, e.target);
      }}
      {...groupEffects}
    >
      {/* Frame background */}
      <Rect
        width={fw}
        height={fh}
        fill={frame.fill}
        stroke={isSelected ? '#D4A853' : frame.stroke}
        strokeWidth={isSelected ? 2 : frame.strokeWidth}
        cornerRadius={frame.cornerRadius || 0}
        dash={frame.strokeDash}
        listening={false}
        {...frameShadowProps}
      />
      {/* Frame label */}
      {isSelected && (
        <Text
          x={0}
          y={-16}
          text={frame.name}
          fontSize={10}
          fill="#D4A853"
          listening={false}
        />
      )}
      {/* Children — positions relative to frame */}
      {(() => {
        const result: React.ReactNode[] = [];
        let i = 0;
        while (i < children.length) {
          const child = children[i];

          // Check if this child is itself a mask source
          // In Figma: a shape that has other shapes referencing it via maskSourceId
          // clips ALL shapes that come after it (until another mask source appears)
          const hasMaskTargets = allShapes.some(s => s.maskSourceId === child.id);

          if (hasMaskTargets) {
            // This shape is a mask source — collect ALL shapes after it until another mask source
            const maskedChildren: Shape[] = [];
            let j = i + 1;
            while (j < children.length) {
              const nextChild = children[j];
              // Stop if we hit another mask source
              if (allShapes.some(s => s.maskSourceId === nextChild.id)) {
                break;
              }
              maskedChildren.push(nextChild);
              j++;
            }

            // Render the mask source shape first
            if (child.type === 'frame' || child.type === 'group' || child.type === 'component') {
              result.push(
                <FrameRenderer
                  key={child.id}
                  frame={{ ...child, ...getChildRenderProps(child) }}
                  allShapes={allShapes}
                  selectedIds={selectedIds}
                  editingTextId={editingTextId}
                  onSelect={onSelect}
                  onDragEnd={onDragEnd}
                  onDragMove={onDragMove}
                  onTransformEnd={onTransformEnd}
                  onDblClickText={onDblClickText}
                  engineRef={engineRef}
                />
              );
            } else {
              result.push(
                <ShapeRenderer
                  key={child.id}
                  shape={{ ...child, ...getChildRenderProps(child) }}
                  isSelected={selectedIds.includes(child.id)}
                  editingTextId={editingTextId}
                  isEditingPath={isEditingPath && child.type === 'path'}
                  onSelect={onSelect}
                  onDragEnd={onDragEnd}
                  onDragMove={onDragMove}
                  onTransformEnd={onTransformEnd}
                  onDblClickText={onDblClickText}
                  onDblClickPath={onDblClickPath ? (() => onDblClickPath(child.id)) : undefined}
                  engineRef={engineRef}
                />
              );
            }

            // Now render all masked children wrapped in a clipped group
            if (maskedChildren.length > 0) {
              const clipFn = getClipFunc(child);
              result.push(
                <Group key={`mask-group-${child.id}`} clipFunc={clipFn as unknown as (ctx: Konva.Context) => void}>
                  {maskedChildren.map(sh => {
                    if (sh.type === 'frame' || sh.type === 'group' || sh.type === 'component') {
                      return (
                        <FrameRenderer
                          key={sh.id}
                          frame={{ ...sh, x: sh.x - frame.x, y: sh.y - frame.y }}
                          allShapes={allShapes}
                          selectedIds={selectedIds}
                          editingTextId={editingTextId}
                          onSelect={onSelect}
                          onDragEnd={onDragEnd}
                          onDragMove={onDragMove}
                          onTransformEnd={onTransformEnd}
                          onDblClickText={onDblClickText}
                          engineRef={engineRef}
                        />
                      );
                    }
                    return (
                      <ShapeRenderer
                        key={sh.id}
                        shape={{ ...sh, x: sh.x - frame.x, y: sh.y - frame.y }}
                        isSelected={selectedIds.includes(sh.id)}
                        editingTextId={editingTextId}
                        isEditingPath={isEditingPath && sh.type === 'path'}
                        onSelect={onSelect}
                        onDragEnd={onDragEnd}
                        onDragMove={onDragMove}
                        onTransformEnd={onTransformEnd}
                        onDblClickText={onDblClickText}
                        onDblClickPath={onDblClickPath ? (() => onDblClickPath(sh.id)) : undefined}
                      />
                    );
                  })}
                </Group>
              );
            }
            // Skip past all the masked children
            i += 1 + maskedChildren.length;
            continue;
          }

          // Regular child (no mask)
          if (child.type === 'frame' || child.type === 'group' || child.type === 'component') {
            result.push(
              <FrameRenderer
                key={child.id}
                frame={{ ...child, ...getChildRenderProps(child) }}
                allShapes={allShapes}
                selectedIds={selectedIds}
                editingTextId={editingTextId}
                onSelect={onSelect}
                onDragEnd={onDragEnd}
                onDragMove={onDragMove}
                onTransformEnd={onTransformEnd}
                onDblClickText={onDblClickText}
                engineRef={engineRef}
              />
            );
          } else {
            result.push(
              <ShapeRenderer
                key={child.id}
                shape={{ ...child, ...getChildRenderProps(child) }}
                isSelected={selectedIds.includes(child.id)}
                editingTextId={editingTextId}
                isEditingPath={isEditingPath && child.type === 'path'}
                onSelect={onSelect}
                onDragEnd={onDragEnd}
                onDragMove={onDragMove}
                onTransformEnd={onTransformEnd}
                onDblClickText={onDblClickText}
                onDblClickPath={onDblClickPath ? (() => onDblClickPath(child.id)) : undefined}
              />
            );
          }
          i++;
        }
        return result;
      })()}
      {/* Layout Grid overlay — flat list so Konva/React children stay valid */}
      {isSelected && frame.layoutGrids?.filter(g => g.visible).flatMap((g, gi) => {
        const rects: React.ReactNode[] = [];
        if (g.type === 'columns' || g.type === 'grid') {
          const totalGutter = (g.count - 1) * g.gutterSize;
          const colW = (fw - g.margin * 2 - totalGutter) / g.count;
          for (let c = 0; c < g.count; c++) {
            rects.push(
              <Rect key={`gc-${gi}-${c}`} x={g.margin + c * (colW + g.gutterSize)} y={0} width={colW} height={fh} fill={g.color} listening={false} />
            );
          }
        }
        if (g.type === 'rows' || g.type === 'grid') {
          const totalGutter = (g.count - 1) * g.gutterSize;
          const rowH = (fh - g.margin * 2 - totalGutter) / g.count;
          for (let r = 0; r < g.count; r++) {
            rects.push(
              <Rect key={`gr-${gi}-${r}`} x={0} y={g.margin + r * (rowH + g.gutterSize)} width={fw} height={rowH} fill={g.color} listening={false} />
            );
          }
        }
        return rects;
      })}
    </Group>
  );
}

export default function Canvas({ width, height }: CanvasProps) {
  const store = useEditorStore();
  const { shapes, selectedIds, activeTool, canvasZoom, canvasPan, canvasBg, setSelectedIds, clearSelection, updateShape, addShape, deleteShapes, duplicateShapes, setCanvasZoom, setCanvasPan, setViewportSize, setActiveTool, undo, redo, setShowHelp, pushHistory, applyConstraints, copyStyle, pasteStyle, showContextMenu, bringForward, sendBackward, bringToFront, sendToBack, alignShapes, setShowExportModal, panToShapeIds, editingComponentId, exitComponentEditing, enterComponentEditing } = store;

  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const shiftRotationSnapRef = useRef(false);
  // Tracks the actual shape ID being dragged (updated on Alt+Drag to the duplicate's ID)
  const draggingShapeIdRef = useRef<string | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);

  // EditorEngine instance (singleton via getEditorEngine)
  const engineRef = useRef(getEditorEngine());
  // Stable reference to the engine's history manager (avoids repeated getEditorEngine() calls)
  const historyManagerRef = useRef(engineRef.current?.getHistoryManager() ?? null);

  // SnapEngine instance (initialized once)
  const snapEngineRef = useRef<SnapEngine | null>(null);
  useLayoutEffect(() => {
    if (!snapEngineRef.current) {
      const sg = getSceneGraphInstance();
      if (sg) {
        snapEngineRef.current = new SnapEngine(sg, { threshold: 6, enabled: true, snapToNodes: true, snapToCanvas: true, snapToGrid: false });
      }
    }
  }, []);

  const editingComponent = editingComponentId ? shapes.find(s => s.id === editingComponentId) : null;

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [rubberBand, setRubberBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const rubberBandStart = useRef<{ x: number; y: number } | null>(null);
  const rubberBandUsed = useRef(false);

  // Path node editing state
  const [editingPathId, setEditingPathId] = useState<string | null>(null);
  const [selectedAnchorIdx, setSelectedAnchorIdx] = useState<number | null>(null);
  const draggingAnchorRef = useRef<{ idx: number; type: 'anchor' | 'cp1' | 'cp2' } | null>(null);

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [textEditPosition, setTextEditPosition] = useState<{ x: number; y: number } | null>(null);
  const [textEditRotation, setTextEditRotation] = useState(0);

  // Update textarea position when editing starts or shape moves
  useEffect(() => {
    if (!editingTextId || !stageRef.current) {
      setTextEditPosition(null);
      setTextEditRotation(0);
      return;
    }
    // Find the Konva node to get its true absolute position (accounts for parent transforms)
    const node = stageRef.current.findOne('#' + editingTextId);
    if (node) {
      setTextEditPosition(node.getAbsolutePosition());
      setTextEditRotation(node.getAbsoluteRotation());
    } else {
      // Fallback: compute canvas-space position by traversing parent chain
      const shape = shapes.find(s => s.id === editingTextId);
      if (shape) {
        const pos = getShapeCanvasPosition(shape, shapes);
        setTextEditPosition({
          x: pos.x * canvasZoom + canvasPan.x,
          y: pos.y * canvasZoom + canvasPan.y,
        });
        setTextEditRotation(shape.rotation || 0);
      }
    }
  }, [editingTextId, canvasZoom, canvasPan, shapes]);

  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }[]>([]);

  // Pen tool state
  const [penPoints, setPenPoints] = useState<PenPoint[]>([]);
  const [penPreview, setPenPreview] = useState<{ x: number; y: number } | null>(null);
  const [penDragging, setPenDragging] = useState(false);
  const penDragStart = useRef<{ x: number; y: number } | null>(null);
  const penAltRef = useRef(false);

  // Measure: Alt+hover or 测量工具 + 单选作为参考
  const [measureLines, setMeasureLines] = useState<{ x1: number; y1: number; x2: number; y2: number; dist: number; label?: string }[]>([]);
  const measurePointerRef = useRef({ x: 0, y: 0 });
  const pointerModsRef = useRef({ altKey: false });
  const measureRafScheduled = useRef(false);

  // 找到 pointer 位置最上层的那个 frame/group（用于创建图形时设置 parentId）
  const findParentFrame = useCallback((px: number, py: number): string | undefined => {
    // 从后往前（zIndex 从高到低）找包含 px,py 的 frame/group/component
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if ((s.type === 'frame' || s.type === 'group' || s.type === 'component') && s.width && s.height) {
        if (px >= s.x && px <= s.x + s.width && py >= s.y && py <= s.y + s.height) {
          return s.id;
        }
      }
    }
    return undefined;
  }, [shapes]);

  // Top-level shapes — in component editing mode, show only component's direct children
  const topLevelShapes = useMemo(() => {
    if (editingComponentId) {
      return shapes.filter(s => s.parentId === editingComponentId);
    }
    return shapes.filter(s => !s.parentId);
  }, [shapes, editingComponentId]);

  const parentPaddingSegs = useMemo(() => {
    if (selectedIds.length !== 1) return [] as ReturnType<typeof computeParentPaddingSegments>;
    const sel = shapes.find(s => s.id === selectedIds[0]);
    if (!sel?.parentId) return [];
    const parent = shapes.find(s => s.id === sel.parentId);
    if (!parent || !isLayoutContainer(parent)) return [];
    return computeParentPaddingSegments(sel, parent);
  }, [shapes, selectedIds]);

  const autoLayoutGuide = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const sel = shapes.find(s => s.id === selectedIds[0]);
    if (!sel || !isLayoutContainer(sel) || !sel.autoLayout) return null;
    const ch = shapes.filter(s => s.parentId === sel.id);
    return computeAutoLayoutOverlay(sel, ch);
  }, [shapes, selectedIds]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    const stage = stageRef.current; if (!stage) return;
    const pos = stage.getPointerPosition();
    const offsetX = pos ? (pos.x - canvasPan.x) / canvasZoom : 400;
    const offsetY = pos ? (pos.y - canvasPan.y) / canvasZoom : 300;
    for (let i = 0; i < files.length; i++) {
      const dataUrl = await fileToDataUrl(files[i]);
      const dims = await getImageDimensions(dataUrl);
      let w = dims.width, h = dims.height;
      if (w > 600) { h = h * (600 / w); w = 600; }
      if (h > 400) { w = w * (400 / h); h = 400; }
      addShape({ type: 'image', x: offsetX + i * 20, y: offsetY + i * 20, width: w, height: h, src: dataUrl, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, opacity: 1, rotation: 0, visible: true, locked: false, name: files[i].name });
    }
  }, [addShape, canvasPan, canvasZoom]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items; if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile(); if (!file) continue;
          const dataUrl = await fileToDataUrl(file);
          const dims = await getImageDimensions(dataUrl);
          let w = dims.width, h = dims.height;
          if (w > 600) { h = h * (600 / w); w = 600; }
          if (h > 400) { w = w * (400 / h); h = 400; }
          addShape({ type: 'image', x: 200, y: 200, width: w, height: h, src: dataUrl, fill: 'transparent', stroke: 'transparent', strokeWidth: 0, opacity: 1, rotation: 0, visible: true, locked: false, name: 'pasted-image' });
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addShape]);

  const finishPenPath = useCallback((close: boolean) => {
    if (penPoints.length < 2) { setPenPoints([]); setPenPreview(null); return; }
    // Convert PenPoint[] to PathPoint[] for the shape
    const pathPts = penPoints.map(p => ({
      x: p.x, y: p.y,
      ...(p.handleIn ? { cp1: relToAbs(p.handleIn, p) } : {}),
      ...(p.handleOut ? { cp2: relToAbs(p.handleOut, p) } : {}),
    }));
    const id = addShape({
      type: 'path',
      x: 0, y: 0,
      pathPoints: pathPts,
      closePath: close,
      fill: close ? '#4A4A52' : 'transparent',
      stroke: '#D4A853',
      strokeWidth: 2,
      opacity: 1, rotation: 0, visible: true, locked: false,
      name: '',
    });
    setSelectedIds([id]);
    setPenPoints([]);
    setPenPreview(null);
    setPenDragging(false);
    penDragStart.current = null;
    setActiveTool('select');
  }, [penPoints, addShape, setSelectedIds, setActiveTool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.code === 'Space' && !e.repeat && !isInput) {
        e.preventDefault(); setSpacePressed(true);
        if (stageRef.current) stageRef.current.container().style.cursor = 'grab';
        return;
      }
      if (isInput) return;
      const mod = e.metaKey || e.ctrlKey;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        if (editingPathId) {
          // Delete selected anchor point from path
          const editingShape = shapes.find(s => s.id === editingPathId);
          if (editingShape && selectedAnchorIdx !== null && (editingShape.pathPoints?.length ?? 0) > 1) {
            e.preventDefault();
            const newPts = editingShape.pathPoints!.filter((_, i) => i !== selectedAnchorIdx);
            updateShape(editingPathId, { pathPoints: newPts });
            setSelectedAnchorIdx(null);
          }
        } else {
          e.preventDefault(); deleteShapes(selectedIds);
        }
      }
      else if (e.key === 'Escape') {
        if (penPoints.length >= 2) { finishPenPath(false); }
        else if (penPoints.length > 0) { setPenPoints([]); setPenPreview(null); setPenDragging(false); penDragStart.current = null; }
        else if (editingPathId) {
          // Exit path edit mode — if anchor selected, deselect it; otherwise exit edit
          if (selectedAnchorIdx !== null) { setSelectedAnchorIdx(null); }
          else {
            setEditingPathId(null);
            setSelectedAnchorIdx(null);
            draggingAnchorRef.current = null;
          }
        }
        else { clearSelection(); setActiveTool('select'); setEditingTextId(null); store.exitGroupEditing(); }
      }
      else if (e.key === 'Enter' && editingPathId) {
        // Finish path editing
        setEditingPathId(null);
        setSelectedAnchorIdx(null);
        draggingAnchorRef.current = null;
      }
      else if (e.key === 'c' && editingPathId && !mod) {
        // Toggle closePath
        const editingShape = shapes.find(s => s.id === editingPathId);
        if (editingShape) {
          updateShape(editingPathId, { closePath: !editingShape.closePath });
        }
      }
      else if (mod && e.key === 'a') { e.preventDefault(); setSelectedIds(shapes.filter(s => s.visible && !s.locked).map(s => s.id)); }
      else if (mod && e.key === 'd' && !e.altKey) { e.preventDefault(); if (selectedIds.length > 0) duplicateShapes(selectedIds); }
      else if (mod && e.altKey && e.key === 'c') { e.preventDefault(); copyStyle(); }
      else if (mod && e.altKey && e.key === 'v') { e.preventDefault(); pasteStyle(); }
      else if (mod && e.key === 'g' && e.shiftKey) { e.preventDefault(); useEditorStore.getState().ungroupSelection(); }
      else if (mod && e.key === 'g' && !e.shiftKey) { e.preventDefault(); useEditorStore.getState().groupSelection(); }
      else if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((mod && e.key === 'z' && e.shiftKey) || (mod && e.key === 'y')) { e.preventDefault(); redo(); }
      else if (mod && e.key === '0') { e.preventDefault(); setCanvasZoom(1); setCanvasPan({ x: 0, y: 0 }); }
      else if (mod && e.key === '1') { e.preventDefault(); const sx = (width / 2 - CANVAS_WIDTH / 2); const sy = (height / 2 - CANVAS_HEIGHT / 2); setCanvasZoom(1); setCanvasPan({ x: sx, y: sy }); }
      // Figma: Cmd+Shift+E — Open export modal
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); setShowExportModal(true); }
      // Figma: Cmd+Shift+C — Copy as SVG
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (selectedIds.length > 0) {
          const svg = shapesToSvg(shapes, { selectedIds });
          navigator.clipboard.writeText(svg).catch(() => {});
          downloadSvg(svg, 'selection.svg');
        }
      }
      // Figma: Cmd+Shift+V — Paste properties
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteStyle(); }
      // Figma: Cmd+[ — Send backward
      else if (mod && e.key === '[' && !e.shiftKey) {
        e.preventDefault();
        if (selectedIds.length === 1) sendBackward(selectedIds[0]);
      }
      // Figma: Cmd+] — Bring forward
      else if (mod && e.key === ']' && !e.shiftKey) {
        e.preventDefault();
        if (selectedIds.length === 1) bringForward(selectedIds[0]);
      }
      // Figma: Cmd+Shift+[ — Send to back
      else if (mod && e.key === '[' && e.shiftKey) {
        e.preventDefault();
        if (selectedIds.length === 1) sendToBack(selectedIds[0]);
      }
      // Figma: Cmd+Shift+] — Bring to front
      else if (mod && e.key === ']' && e.shiftKey) {
        e.preventDefault();
        if (selectedIds.length === 1) bringToFront(selectedIds[0]);
      }
      // Figma: Cmd+Shift+L — Align left
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); if (selectedIds.length > 0) alignShapes(selectedIds, 'left'); }
      // Figma: Cmd+Shift+T — Align center
      else if (mod && e.shiftKey && e.key.toLowerCase() === 't') { e.preventDefault(); if (selectedIds.length > 0) alignShapes(selectedIds, 'centerH'); }
      // Figma: Cmd+Shift+R — Align right (Cmd+R is zoom 100% which is Cmd+1, not a conflict)
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); if (selectedIds.length > 0) alignShapes(selectedIds, 'right'); }
      // Figma: Cmd+2 — Zoom to selection
      else if (mod && !e.shiftKey && e.key === '2') { e.preventDefault(); if (selectedIds.length > 0) panToShapeIds(selectedIds, width, height); }
      // Figma: Tab — Cycle through selection (next)
      else if (e.key === 'Tab' && !e.shiftKey && !isInput) {
        e.preventDefault();
        const visible = shapes.filter(s => s.visible && !s.locked);
        if (visible.length === 0) return;
        if (selectedIds.length === 0) { setSelectedIds([visible[0].id]); return; }
        const currentIdx = visible.findIndex(s => s.id === selectedIds[0]);
        const nextIdx = (currentIdx + 1) % visible.length;
        setSelectedIds([visible[nextIdx].id]);
      }
      // Figma: Shift+Tab — Cycle through selection (previous)
      else if (e.key === 'Tab' && e.shiftKey && !isInput) {
        e.preventDefault();
        const visible = shapes.filter(s => s.visible && !s.locked);
        if (visible.length === 0) return;
        if (selectedIds.length === 0) { setSelectedIds([visible[visible.length - 1].id]); return; }
        const currentIdx = visible.findIndex(s => s.id === selectedIds[0]);
        const prevIdx = (currentIdx - 1 + visible.length) % visible.length;
        setSelectedIds([visible[prevIdx].id]);
      }
      else if (e.key === '/' || e.key === '?') { if (mod || e.shiftKey) { e.preventDefault(); setShowHelp(true); } }
      else if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      else if (e.key === 'r' || e.key === 'R') setActiveTool('rect');
      else if (e.key === 'o' || e.key === 'O') setActiveTool('circle');
      else if (e.key === 't' || e.key === 'T') setActiveTool('text');
      else if (e.key === 'l' || e.key === 'L') setActiveTool('line');
      else if (e.key === 'h' || e.key === 'H') setActiveTool('hand');
      else if (e.key === 'f' || e.key === 'F') setActiveTool('frame');
      else if (e.key === 'p' || e.key === 'P') setActiveTool('pen');
      else if (e.key === 'm' || e.key === 'M') setActiveTool('measure');
      else if (e.key === 'i' || e.key === 'I') setActiveTool('eyedropper');
      else if (e.key === 'Enter' && penPoints.length >= 2) {
        finishPenPath(false);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { setSpacePressed(false); if (stageRef.current && !isPanning.current) stageRef.current.container().style.cursor = 'default'; }
      if (e.key === 'Alt') setMeasureLines([]);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [selectedIds, shapes, deleteShapes, clearSelection, setSelectedIds, duplicateShapes, undo, redo, setCanvasZoom, setCanvasPan, setActiveTool, setShowHelp, width, height, penPoints, copyStyle, pasteStyle, finishPenPath, editingPathId, selectedAnchorIdx, updateShape, bringForward, sendBackward, bringToFront, sendToBack, alignShapes, setShowExportModal, panToShapeIds]);

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    if (activeTool === 'measure') {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
      return;
    }
    const nodes = selectedIds.map(id => stage.findOne(`#${id}`)).filter(Boolean) as Konva.Node[];
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, shapes, activeTool]);

  // 同步视口尺寸到 store（供 panToShapeIds 使用）
  useEffect(() => {
    setViewportSize(width, height);
  }, [width, height, setViewportSize]);

  const handleSelect = useCallback((id: string, add: boolean) => {
    if (activeTool !== 'select' && activeTool !== 'measure') return;
    const shape = shapes.find(s => s.id === id);
    const groupIds = shape?.groupId
      ? shapes.filter(s => s.groupId === shape.groupId).map(s => s.id)
      : [id];

    if (add) {
      const allSelected = groupIds.every(gid => selectedIds.includes(gid));
      if (allSelected) { setSelectedIds(selectedIds.filter(sid => !groupIds.includes(sid))); }
      else { setSelectedIds([...new Set([...selectedIds, ...groupIds])]); }
    } else {
      setSelectedIds(groupIds);
    }
  }, [shapes, selectedIds, setSelectedIds, activeTool]);

  const handleDragMove = useCallback((id: string, dx: number, dy: number) => {
    const currentShapes = useEditorStore.getState().shapes;
    const shape = currentShapes.find(s => s.id === id);
    if (!shape) return;
    const stage = stageRef.current;

    if (shape.groupId) {
      if (!stage) return;
      currentShapes.filter(s => s.groupId === shape.groupId && s.id !== id).forEach(s => {
        const node = stage.findOne(`#${s.id}`);
        if (node) { node.x(s.x + dx); node.y(s.y + dy); }
      });
    }

    // Move children of frames + shapes above in z-order
    if (shape.type === 'frame' || shape.type === 'group') {
      if (!stage) return;
      // Move children
      currentShapes.filter(s => s.parentId === shape.id).forEach(s => {
        const node = stage.findOne(`#${s.id}`);
        if (node) { node.x(s.x + dx); node.y(s.y + dy); }
      });
      // Move shapes above in z-order (same parent, later in sibling array)
      const parentId = shape.parentId ?? undefined;
      const siblings = currentShapes.filter(s => (s.parentId ?? undefined) === parentId);
      const sibIdx = siblings.findIndex(s => s.id === id);
      const shapesAbove = siblings.slice(sibIdx + 1);
      shapesAbove.forEach(above => {
        const node = stage.findOne(`#${above.id}`);
        if (node) { node.x(above.x + dx); node.y(above.y + dy); }
      });
    }

    // Z-order group: move all shapes ABOVE `id` in sibling order (they visually sit on top)
    if (!shape.groupId && shape.type !== 'frame' && shape.type !== 'group') {
      if (stage) {
        const parentId = shape.parentId ?? undefined;
        const siblings = currentShapes.filter(s => (s.parentId ?? undefined) === parentId);
        const sibIdx = siblings.findIndex(s => s.id === id);
        // shapes above = later in siblings array = visually on top = move together with id
        const shapesAbove = siblings.slice(sibIdx + 1);
        shapesAbove.forEach(above => {
          const node = stage.findOne(`#${above.id}`);
          if (node) { node.x(above.x + dx); node.y(above.y + dy); }
        });
      }
    }

    // Compute snap using SnapEngine
    const guides: { x?: number; y?: number }[] = [];
    // Exclude shapes that will move with the dragged shape (groupId, frame children, z-order above)
    const parentId = shape.parentId ?? undefined;
    const siblings = currentShapes.filter(s => (s.parentId ?? undefined) === parentId);
    const sibIdx = siblings.findIndex(s => s.id === id);
    const shapesAbove = siblings.slice(sibIdx + 1).map(s => s.id);
    const movingIds = new Set([id, ...shapesAbove, ...(shape.groupId ? currentShapes.filter(s => s.groupId === shape.groupId).map(s => s.id) : []), ...(shape.type === 'frame' || shape.type === 'group' ? currentShapes.filter(s => s.parentId === id).map(s => s.id) : [])]);
    const otherIds = currentShapes.filter(s => !movingIds.has(s.id)).map(s => s.id);

    if (snapEngineRef.current) {
      // Sync scene graph from current store shapes before snapping
      syncEditorFromStore();
      const snapped = snapEngineRef.current.snap(
        shape.x + dx, shape.y + dy,
        { nodeIds: otherIds, excludeIds: [id] },
        shape.width || 100, shape.height || 100, 'both'
      );
      // Convert SnapEngine output (verticalLines/horizontalLines) to {x?, y?}[] for setSnapLines
      for (const line of snapped.verticalLines) guides.push({ x: line.position });
      for (const line of snapped.horizontalLines) guides.push({ y: line.position });
    }
    setSnapLines(guides.slice(0, 6));
  }, []);

  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    setSnapLines([]);
    const currentShapes = useEditorStore.getState().shapes;
    const shape = currentShapes.find(s => s.id === id);
    if (!shape) return;

    // Collect all shapes that will move: z-order group + groupId + frame children
    const parentId = shape.parentId ?? undefined;
    const siblings = currentShapes.filter(s => (s.parentId ?? undefined) === parentId);
    const sibIdx = siblings.findIndex(s => s.id === id);
    const shapesAbove = siblings.slice(sibIdx + 1).map(s => s.id);
    const groupMemberIds = shape.groupId ? currentShapes.filter(s => s.groupId === shape.groupId).map(s => s.id) : [];
    const childIds = (shape.type === 'frame' || shape.type === 'group')
      ? currentShapes.filter(s => s.parentId === id).map(s => s.id) : [];
    const allMovingIds = [id, ...shapesAbove, ...groupMemberIds, ...childIds];

    const dx = x - shape.x, dy = y - shape.y;
    if (dx === 0 && dy === 0) return;

    // Use HistoryManager via engine's executeCommand (Command Pattern)
    if (historyManagerRef.current && engineRef.current) {
      const cmd = historyManagerRef.current.moveCommand(allMovingIds, dx, dy);
      engineRef.current.executeCommand(cmd);
    } else {
      // Fallback: direct store update (engine not yet initialized)
      allMovingIds.forEach(sid => {
        const s = currentShapes.find(s => s.id === sid);
        if (s) updateShape(sid, { x: s.x + dx, y: s.y + dy });
      });
    }
  }, [updateShape]);

  const handleTransformEnd = useCallback((id: string, node: Konva.Node) => {
    const scaleX = node.scaleX(), scaleY = node.scaleY();
    const currentShapes = useEditorStore.getState().shapes;
    const shape = currentShapes.find(s => s.id === id);
    if (!shape) return;

    // Capture before state for Command Pattern
    const beforeState = { x: shape.x, y: shape.y, width: shape.width || 100, height: shape.height || 100, rotation: shape.rotation || 0 };

    const prevFlipX = (shape.scaleX ?? 1) < 0 ? -1 : 1;
    const prevFlipY = (shape.scaleY ?? 1) < 0 ? -1 : 1;
    const absX = Math.abs(scaleX), absY = Math.abs(scaleY);
    const newFlipX = (scaleX < 0 ? -1 : 1) * prevFlipX;
    const newFlipY = (scaleY < 0 ? -1 : 1) * prevFlipY;
    node.scaleX(newFlipX); node.scaleY(newFlipY);
    const u: Partial<Shape> = { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: newFlipX, scaleY: newFlipY };
    if (shape.type === 'rect' || shape.type === 'image' || shape.type === 'component' || shape.type === 'frame' || shape.type === 'group') {
      u.width = Math.max(10, (shape.width || 100) * absX);
      u.height = Math.max(10, (shape.height || 100) * absY);
    }
    else if (shape.type === 'circle' || shape.type === 'star' || shape.type === 'triangle') { u.radius = Math.max(5, (shape.radius || 50) * Math.max(absX, absY)); if (shape.innerRadius) u.innerRadius = Math.max(5, shape.innerRadius * Math.max(absX, absY)); }
    else if (shape.type === 'text') { u.fontSize = Math.max(8, (shape.fontSize || 24) * absY); u.width = (shape.width || 200) * absX; }
    // Snap resize using SnapEngine
    if (snapEngineRef.current) {
      syncEditorFromStore();
      const snapped = snapEngineRef.current.snap(
        node.x(), node.y(),
        { nodeIds: useEditorStore.getState().shapes.filter(s => s.id !== id).map(s => s.id), excludeIds: [id] },
        u.width || shape.width || 100, u.height || shape.height || 100, 'both'
      );
      node.x(snapped.finalX);
      node.y(snapped.finalY);
      u.x = snapped.finalX;
      u.y = snapped.finalY;
      const snapGuides: { x?: number; y?: number }[] = [];
      for (const line of snapped.verticalLines) snapGuides.push({ x: line.position });
      for (const line of snapped.horizontalLines) snapGuides.push({ y: line.position });
      setSnapLines(snapGuides.slice(0, 6));
    }

    // Build after state (Konva node's final dimensions after flip adjustment)
    const finalWidth = u.width ?? shape.width ?? 100;
    const finalHeight = u.height ?? shape.height ?? 100;

    // Use engine.commitTransformFromKonva — records full Konva node state
    // (x, y, width, height, rotation, scaleX, scaleY) in history for undo/redo.
    if (engineRef.current) {
      engineRef.current.commitTransformFromKonva(
        id,
        node.x(),            // x (may have been adjusted by snap)
        node.y(),            // y (may have been adjusted by snap)
        finalWidth,          // final width after scale+flip
        finalHeight,         // final height after scale+flip
        node.rotation(),    // rotation
        newFlipX,            // final scaleX (includes flip)
        newFlipY             // final scaleY (includes flip)
      );
    } else {
      // Fallback: direct store update (engine not yet initialized)
      updateShape(id, u);
    }
    setSnapLines([]);
    // Apply constraints for frame/group children
    if (shape.type === 'frame' || shape.type === 'group') {
      const oldW = shape.width || 100, oldH = shape.height || 100;
      const newW = u.width || oldW, newH = u.height || oldH;
      if (newW !== oldW || newH !== oldH) {
        setTimeout(() => applyConstraints(id, oldW, oldH, newW, newH), 0);
      }
    }
  }, [updateShape, applyConstraints]);

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target !== e.target.getStage()) return;
    if (rubberBandUsed.current) { rubberBandUsed.current = false; return; }
    clearSelection();
  }, [clearSelection]);

  const getCanvasPoint = useCallback(() => {
    const stage = stageRef.current; if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition(); if (!pos) return { x: 0, y: 0 };
    return { x: (pos.x - canvasPan.x) / canvasZoom, y: (pos.y - canvasPan.y) / canvasZoom };
  }, [canvasZoom, canvasPan]);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current; if (!stage) return;
    const pointer = stage.getPointerPosition(); if (!pointer) return;
    const old = canvasZoom;
    const mp = { x: (pointer.x - canvasPan.x) / old, y: (pointer.y - canvasPan.y) / old };
    const dir = e.evt.deltaY > 0 ? -1 : 1;
    const ns = Math.max(0.1, Math.min(5, dir > 0 ? old * 1.1 : old / 1.1));
    setCanvasZoom(ns);
    setCanvasPan({ x: pointer.x - mp.x * ns, y: pointer.y - mp.y * ns });
  }, [canvasZoom, canvasPan, setCanvasZoom, setCanvasPan]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || (e.evt.button === 0 && (spacePressed || activeTool === 'hand'))) {
      isPanning.current = true; lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      if (stageRef.current) stageRef.current.container().style.cursor = 'grabbing'; return;
    }
    if (e.evt.button !== 0) return;
    const isStage = e.target === e.target.getStage();

    // Pen tool click — start adding a point; drag to create Bezier handles
    if (activeTool === 'pen') {
      const pt = getCanvasPoint();
      penAltRef.current = e.evt.altKey;

      // Check if clicking near the first point to close
      if (penPoints.length >= 2) {
        if (isNearFirstPoint(penPoints, pt.x, pt.y)) {
          finishPenPath(true);
          return;
        }
      }

      // Add new point
      setPenDragging(true);
      penDragStart.current = pt;
      const newPt = buildPenPoint(pt.x, pt.y);
      setPenPoints(prev => [...prev, newPt]);
      return;
    }

    // Eyedropper tool — sample color from canvas at click position
    if (activeTool === 'eyedropper') {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      // Get the canvas pixel data
      const data = stage.toDataURL();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image(1, 1);
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const scaleX = img.width / stage.width();
        const scaleY = img.height / stage.height();
        const px = Math.floor(pos.x * scaleX);
        const py = Math.floor(pos.y * scaleY);
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
        // Apply to selected shape's fill (or stroke with Alt)
        if (selectedIds.length > 0) {
          const target = e.evt.altKey ? 'stroke' : 'fill';
          pushHistory();
          selectedIds.forEach(id => updateShape(id, { [target]: hex }));
        }
      };
      img.src = data;
      return;
    }

    if (activeTool === 'select' && isStage) {
      const pt = getCanvasPoint();
      rubberBandStart.current = pt;
      rubberBandUsed.current = false;
      setRubberBand({ x: pt.x, y: pt.y, w: 0, h: 0 });
      return;
    }

    // Path edit mode: clicking on a path segment inserts a new anchor point
    if (editingPathId && activeTool === 'select') {
      const editingShape = shapes.find(s => s.id === editingPathId);
      if (editingShape?.pathPoints && editingShape.pathPoints.length >= 2) {
        const pt = getCanvasPoint();
        const pts = editingShape.pathPoints;
        const THRESHOLD = 12; // canvas units
        let bestDist = Infinity;
        let bestSegIdx = -1;
        // Check each line segment
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          // Project point onto line segment
          const dx = b.x - a.x, dy = b.y - a.y;
          const lenSq = dx * dx + dy * dy;
          const t = lenSq > 0 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq)) : 0;
          const projX = a.x + t * dx, projY = a.y + t * dy;
          const dist = Math.sqrt((pt.x - projX) ** 2 + (pt.y - projY) ** 2);
          if (dist < bestDist) { bestDist = dist; bestSegIdx = i; }
        }
        if (bestSegIdx >= 0 && bestDist < THRESHOLD) {
          // Insert new point at the closest position on the segment
          const a = pts[bestSegIdx], b = pts[bestSegIdx + 1];
          const dx = b.x - a.x, dy = b.y - a.y;
          const lenSq = dx * dx + dy * dy;
          const t = lenSq > 0 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq)) : 0;
          const newX = a.x + t * dx, newY = a.y + t * dy;
          const newPts = [
            ...pts.slice(0, bestSegIdx + 1),
            { x: newX, y: newY },
            ...pts.slice(bestSegIdx + 1),
          ];
          updateShape(editingPathId, { pathPoints: newPts });
          setSelectedAnchorIdx(bestSegIdx + 1);
          return;
        }
      }
    }

    const drawTools = ['rect', 'circle', 'line', 'text', 'star', 'triangle', 'frame'];
    if (drawTools.includes(activeTool) && isStage) {
      const pt = getCanvasPoint();
      setIsDrawing(true); setDrawStart(pt); setDrawPreview({ x: pt.x, y: pt.y, w: 0, h: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, getCanvasPoint, penPoints, finishPenPath, spacePressed, editingPathId, shapes, updateShape]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current; if (!stage) return;
    if (isPanning.current) {
      const dx = e.evt.clientX - lastPanPos.current.x, dy = e.evt.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      setCanvasPan({ x: canvasPan.x + dx, y: canvasPan.y + dy }); return;
    }
    // Pen tool: drag to create Bezier handles on last point
    // Pen tool: track Alt key state and drag to create Bezier handles on last point
    if (activeTool === 'pen') {
      penAltRef.current = e.evt.altKey;

      if (penDragging && penDragStart.current && penPoints.length > 0) {
        const pt = getCanvasPoint();
        const origin = penDragStart.current;
        const dx = pt.x - origin.x;
        const dy = pt.y - origin.y;

        // Only create handles if dragged far enough
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          const handleOutAbs = { x: origin.x + dx, y: origin.y + dy };
          const breakSymmetry = penAltRef.current;

          setPenPoints(prev => {
            const newPts = [...prev];
            const lastIdx = newPts.length - 1;

            // Set handleOut on the current (newly added) point
            const updated = updateSymmetricHandles(newPts, lastIdx, handleOutAbs, breakSymmetry);
            return updated;
          });
        }
        setPenPreview(pt);
        return;
      }

      // Pen tool preview (no drag, just show cursor position)
      if (penPoints.length > 0) {
        const pt = getCanvasPoint();
        setPenPreview(pt);
        return;
      }
    }
    if (rubberBandStart.current) {
      const pt = getCanvasPoint();
      const rb = {
        x: Math.min(pt.x, rubberBandStart.current.x), y: Math.min(pt.y, rubberBandStart.current.y),
        w: Math.abs(pt.x - rubberBandStart.current.x), h: Math.abs(pt.y - rubberBandStart.current.y),
      };
      setRubberBand(rb);
      return;
    }
    if (isDrawing && drawStart) {
      const pt = getCanvasPoint();
      setDrawPreview({ x: Math.min(drawStart.x, pt.x), y: Math.min(drawStart.y, pt.y), w: Math.abs(pt.x - drawStart.x), h: Math.abs(pt.y - drawStart.y) });
      return;
    }
    if (activeTool === 'hand' || spacePressed) stage.container().style.cursor = 'grab';
    else if (activeTool === 'measure' || activeTool === 'eyedropper') stage.container().style.cursor = 'crosshair';
    else if (activeTool !== 'select') stage.container().style.cursor = 'crosshair';
    else stage.container().style.cursor = e.target !== stage ? 'move' : 'default';

    pointerModsRef.current = { altKey: e.evt.altKey };
    measurePointerRef.current = getCanvasPoint();
    const altOn = e.evt.altKey;
    const wantGapMeasure = selectedIds.length === 1 && (altOn || activeTool === 'measure');
    if (wantGapMeasure) {
      if (!measureRafScheduled.current) {
        measureRafScheduled.current = true;
        requestAnimationFrame(() => {
          measureRafScheduled.current = false;
          const pt = measurePointerRef.current;
          const st = useEditorStore.getState();
          const refId = st.selectedIds[0];
          const tool = st.activeTool;
          const useGap = st.selectedIds.length === 1 && (pointerModsRef.current.altKey || tool === 'measure');
          if (!useGap || !refId) {
            setMeasureLines([]);
            return;
          }
          const refShape = st.shapes.find(s => s.id === refId);
          if (!refShape) {
            setMeasureLines([]);
            return;
          }
          const hover = hitTestShapeAtPoint(
            st.shapes.filter(s => s.id !== refId && s.visible && !s.locked),
            pt.x,
            pt.y,
          );
          if (!hover) {
            setMeasureLines([]);
            return;
          }
          const segs = measureGapBetweenAABBs(getShapeAABB(refShape), getShapeAABB(hover));
          setMeasureLines(segs.map(s => ({ ...s, label: String(s.dist) })));
        });
      }
    } else {
      setMeasureLines([]);
    }
  }, [canvasPan, setCanvasPan, isDrawing, drawStart, getCanvasPoint, activeTool, penPoints, penDragging, selectedIds, spacePressed]);

  const handleMouseUp = useCallback(() => {
    if (penDragging) {
      setPenDragging(false);
      penDragStart.current = null;
    }

    if (isPanning.current) {
      isPanning.current = false;
      if (stageRef.current) stageRef.current.container().style.cursor = spacePressed ? 'grab' : 'default';
      return;
    }

    if (rubberBandStart.current) {
      if (rubberBand && (rubberBand.w > 5 || rubberBand.h > 5)) {
        const { x, y, w, h } = rubberBand;
        const currentShapes = useEditorStore.getState().shapes;
        const found = currentShapes.filter(s => {
          if (!s.visible || s.locked) return false;
          const b = getShapeAABB(s);
          return b.left < x + w && b.right > x && b.top < y + h && b.bottom > y;
        });
        if (found.length > 0) { setSelectedIds(found.map(s => s.id)); rubberBandUsed.current = true; }
      }
      rubberBandStart.current = null;
      setRubberBand(null);
      return;
    }

    if (isDrawing && drawStart && drawPreview) {
      const { x, y, w, h } = drawPreview;
      const min = 10;
      // 图形中心点，判断应该进入哪个 parent frame
      const cx = x + w / 2, cy = y + h / 2;
      const parentId = findParentFrame(cx, cy);
      let id: string | null = null;
      const base = { fill: '#4A4A52', stroke: '#3A3A40', strokeWidth: 1, opacity: 1, rotation: 0, visible: true, locked: false, name: '', parentId };
      if (activeTool === 'frame' && w >= min && h >= min) {
        id = addShape({ ...base, type: 'frame', x, y, width: w, height: h, fill: '#FFFFFF08', stroke: '#555560', cornerRadius: 0, clipContent: true });
      }
      else if (activeTool === 'rect' && w >= min && h >= min) { id = addShape({ ...base, type: 'rect', x, y, width: w, height: h, cornerRadius: 0 }); }
      else if (activeTool === 'circle') { const r = Math.max(min / 2, Math.max(w, h) / 2); id = addShape({ ...base, type: 'circle', x: x + w / 2, y: y + h / 2, radius: r }); }
      else if (activeTool === 'star') { const r = Math.max(min, Math.max(w, h) / 2); id = addShape({ ...base, type: 'star', x: x + w / 2, y: y + h / 2, radius: r, innerRadius: r * 0.4, numPoints: 5, fill: '#D4A853' }); }
      else if (activeTool === 'triangle') { const r = Math.max(min, Math.max(w, h) / 2); id = addShape({ ...base, type: 'triangle', x: x + w / 2, y: y + h / 2, radius: r }); }
      else if (activeTool === 'line' && (w >= min || h >= min)) {
        id = addShape({ ...base, type: 'line', x: 0, y: 0, fill: 'transparent', stroke: '#D4A853', strokeWidth: 2, points: [drawStart.x, drawStart.y, drawStart.x + w * (drawPreview.x >= drawStart.x ? 1 : -1), drawStart.y + h * (drawPreview.y >= drawStart.y ? 1 : -1)] });
      }
      else if (activeTool === 'text') { id = addShape({ ...base, type: 'text', x, y, text: '双击编辑', fontSize: 24, width: Math.max(100, w), fill: '#E8E4DF', stroke: 'transparent', strokeWidth: 0 }); }
      if (id) { setSelectedIds([id]); setActiveTool('select'); }
    }
    setIsDrawing(false); setDrawStart(null); setDrawPreview(null);
  }, [isDrawing, drawStart, drawPreview, activeTool, addShape, setSelectedIds, setActiveTool, rubberBand, penDragging, findParentFrame, spacePressed]);

  const handleDblClickText = useCallback((id: string) => {
    const shape = shapes.find(s => s.id === id);
    if (!shape || shape.type !== 'text') return;
    setEditingTextId(id);
    setEditingText(shape.text || '');
    setSelectedIds([id]);
    setTimeout(() => editTextareaRef.current?.focus(), 10);
  }, [shapes, setSelectedIds]);

  const handleDblClickPath = useCallback((id: string) => {
    const shape = shapes.find(s => s.id === id);
    if (!shape || shape.type !== 'path') return;
    setEditingPathId(id);
    setSelectedIds([id]);
  }, [shapes, setSelectedIds]);

  const commitTextEdit = useCallback(() => {
    if (!editingTextId) return;
    pushHistory();
    updateShape(editingTextId, { text: editingText });
    setEditingTextId(null);
  }, [editingTextId, editingText, updateShape, pushHistory]);

  const gridDots = useMemo(() => {
    const dots = []; const gs = 40;
    for (let i = 0; i <= Math.ceil(CANVAS_WIDTH / gs); i++)
      for (let j = 0; j <= Math.ceil(CANVAS_HEIGHT / gs); j++)
        dots.push(<Rect key={`d-${i}-${j}`} x={i * gs} y={j * gs} width={2} height={2} fill="#252525" listening={false} />);
    return dots;
  }, []);

  const cursor = activeTool === 'hand' || spacePressed ? 'grab' : activeTool === 'pen' || activeTool === 'measure' || activeTool === 'eyedropper' ? 'crosshair' : activeTool !== 'select' ? 'crosshair' : 'default';

  const editingShape = editingTextId ? shapes.find(s => s.id === editingTextId) : null;
  const textareaStyle = editingShape && textEditPosition ? {
    left: textEditPosition.x,
    top: textEditPosition.y,
    width: Math.max(100, (editingShape.width || 200)) * canvasZoom,
    fontSize: (editingShape.fontSize || 24) * canvasZoom,
    fontFamily: editingShape.fontFamily || 'sans-serif',
    color: editingShape.fill,
    minHeight: (editingShape.fontSize || 24) * 1.4 * canvasZoom,
    transform: `rotate(${textEditRotation}deg)`,
    transformOrigin: 'top left',
  } : null;

  // Build pen preview SVG path (bezier curve from last point to cursor)
  const penPreviewPath = (penPoints.length > 0 && penPreview)
    ? getPathPreviewToCursor(penPoints, penPreview.x, penPreview.y)
    : '';

  // Build the completed path segments for display
  const penPathData = penPoints.length > 0 ? pointsToSvgPath(penPoints, false) : '';

  return (
    <div
      ref={containerRef}
      className="relative bg-[var(--canvas-bg)] overflow-hidden w-full h-full"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={width} height={height}
        scaleX={canvasZoom} scaleY={canvasZoom}
        x={canvasPan.x} y={canvasPan.y}
        onClick={handleStageClick}
        onDblClick={(e) => {
          const clickedShape = e.target;
          if (clickedShape === stageRef.current) return;
          const shapeId = clickedShape.id();
          if (!shapeId) return;
          const shape = shapes.find(s => s.id === shapeId);
          if (!shape) return;
          // Double-click on frame/component → enter component editing
          if (shape.type === 'component' || shape.type === 'frame') {
            if (shape.masterComponentId) {
              enterComponentEditing(shape.masterComponentId);
            } else if (shape.isMainComponent) {
              enterComponentEditing(shape.id);
            }
          }
          // Double-click on group → enter group editing context
          if (shape.type === 'group') {
            store.enterGroupEditing(shape.id);
          }
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          e.evt.stopPropagation();
          const stage = stageRef.current;
          if (!stage) return;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;
          // Convert to canvas coordinates
          const canvasX = (pointer.x - canvasPan.x) / canvasZoom;
          const canvasY = (pointer.y - canvasPan.y) / canvasZoom;
          // Find topmost shape under cursor
          const topShape = shapes.slice().reverse().find(s => {
            if (!s.visible || s.locked) return false;
            const aabb = getShapeAABB(s);
            return canvasX >= aabb.left && canvasX <= aabb.right && canvasY >= aabb.top && canvasY <= aabb.bottom;
          });
          const targetIds = topShape
            ? selectedIds.includes(topShape.id) ? selectedIds : [topShape.id]
            : selectedIds.length > 0 ? selectedIds : [];
          // Show context menu even on empty canvas (for create shape options)
          showContextMenu({ x: e.evt.clientX, y: e.evt.clientY, targetIds });
        }}
        style={{ cursor }}
      >
        <Layer listening={false}>
          {gridDots}
          <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={canvasBg} stroke="#2A2A30" strokeWidth={1} listening={false} />
        </Layer>
        <Layer>
          {(() => {
            // Identify shapes that are used as mask sources (some other shape has maskSourceId pointing to them)
            const maskSourceIds = new Set(
              shapes.filter(s => shapes.some(sh => sh.maskSourceId === s.id)).map(s => s.id)
            );

            // Collect top-level shapes that have maskSourceId (masked by another shape)
            const maskedTopLevelShapes = topLevelShapes.filter(s => s.maskSourceId);

            // Collect top-level shapes that are mask sources (skip them at top level, they'll be handled via clip)
            const regularTopLevelShapes = topLevelShapes.filter(s => !maskSourceIds.has(s.id));

            const result: React.ReactNode[] = [];

            // Render regular (non-masked, non-mask-source) top-level shapes
            for (const shape of regularTopLevelShapes) {
              if (shape.type === 'frame' || shape.type === 'group') {
                result.push(
                  <FrameRenderer
                    key={shape.id}
                    frame={shape}
                    allShapes={shapes}
                    selectedIds={selectedIds}
                    editingTextId={editingTextId}
                    onSelect={handleSelect}
                    onDragEnd={handleDragEnd}
                    onDragMove={handleDragMove}
                    onTransformEnd={handleTransformEnd}
                    onDblClickText={handleDblClickText}
                    isEditingPath={editingPathId !== null}
                    onDblClickPath={handleDblClickPath}
                    engineRef={engineRef}
                  />
                );
              } else {
                result.push(
                  <ShapeRenderer
                    key={shape.id}
                    shape={shape}
                    isSelected={selectedIds.includes(shape.id)}
                    editingTextId={editingTextId}
                    isEditingPath={editingPathId === shape.id}
                    onSelect={handleSelect}
                    onDragEnd={handleDragEnd}
                    onDragMove={handleDragMove}
                    onTransformEnd={handleTransformEnd}
                    onDblClickText={handleDblClickText}
                    onDblClickPath={() => handleDblClickPath(shape.id)}
                    engineRef={engineRef}
                    draggingShapeIdRef={draggingShapeIdRef}
                  />
                );
              }
            }

            // Render top-level shapes that are masked — wrap each in a Group with clipFunc
            for (const shape of maskedTopLevelShapes) {
              // Find the mask source shape
              const maskSource = shapes.find(s => s.id === shape.maskSourceId);
              if (!maskSource) continue; // Mask source doesn't exist

              const clipFn = getClipFunc(maskSource);
              result.push(
                <Group key={shape.id} clipFunc={clipFn as unknown as (ctx: Konva.Context) => void}>
                  <ShapeRenderer
                    shape={shape}
                    isSelected={selectedIds.includes(shape.id)}
                    editingTextId={editingTextId}
                    isEditingPath={editingPathId === shape.id}
                    onSelect={handleSelect}
                    onDragEnd={handleDragEnd}
                    onDragMove={handleDragMove}
                    onTransformEnd={handleTransformEnd}
                    onDblClickText={handleDblClickText}
                    onDblClickPath={() => handleDblClickPath(shape.id)}
                    engineRef={engineRef}
                    draggingShapeIdRef={draggingShapeIdRef}
                  />
                </Group>
              );
            }

            return result;
          })()}
          {/* Draw previews */}
          {isDrawing && drawPreview && (activeTool === 'rect' || activeTool === 'frame') && <Rect x={drawPreview.x} y={drawPreview.y} width={drawPreview.w} height={drawPreview.h} fill={activeTool === 'frame' ? 'rgba(255,255,255,0.03)' : 'rgba(74,74,82,0.3)'} stroke={activeTool === 'frame' ? '#6495ED' : '#D4A853'} strokeWidth={1} dash={[6, 3]} listening={false} />}
          {isDrawing && drawPreview && activeTool === 'circle' && <Circle x={drawPreview.x + drawPreview.w / 2} y={drawPreview.y + drawPreview.h / 2} radius={Math.max(drawPreview.w, drawPreview.h) / 2} fill="rgba(74,74,82,0.3)" stroke="#D4A853" strokeWidth={1} dash={[6, 3]} listening={false} />}
          {isDrawing && drawPreview && (activeTool === 'star' || activeTool === 'triangle') && <Circle x={drawPreview.x + drawPreview.w / 2} y={drawPreview.y + drawPreview.h / 2} radius={Math.max(drawPreview.w, drawPreview.h) / 2} fill="rgba(212,168,83,0.1)" stroke="#D4A853" strokeWidth={1} dash={[6, 3]} listening={false} />}
          {isDrawing && drawStart && drawPreview && activeTool === 'line' && <Line points={[drawStart.x, drawStart.y, drawStart.x + drawPreview.w * (drawPreview.x >= drawStart.x ? 1 : -1), drawStart.y + drawPreview.h * (drawPreview.y >= drawStart.y ? 1 : -1)]} stroke="#D4A853" strokeWidth={2} dash={[6, 3]} listening={false} />}
          {isDrawing && drawPreview && activeTool === 'text' && <Rect x={drawPreview.x} y={drawPreview.y} width={Math.max(100, drawPreview.w)} height={Math.max(30, drawPreview.h)} fill="rgba(232,228,223,0.05)" stroke="#D4A853" strokeWidth={1} dash={[4, 2]} listening={false} />}
          {/* Pen tool: completed path so far */}
          {penPathData && (
            <Path data={penPathData} stroke="#D4A853" strokeWidth={2} fill="transparent" listening={false} lineCap="round" lineJoin="round" />
          )}
          {/* Pen tool preview line (bezier curve to cursor) */}
          {penPreviewPath && (
            <Path data={penPreviewPath} stroke="#D4A853" strokeWidth={2} fill="transparent" dash={[4, 4]} listening={false} lineCap="round" lineJoin="round" />
          )}
          {/* Pen anchor points */}
          {penPoints.map((pt, i) => (
            <Circle key={`pen-pt-${i}`} x={pt.x} y={pt.y} radius={4} fill={i === 0 ? '#6495ED' : '#D4A853'} stroke="#fff" strokeWidth={1} listening={false} />
          ))}
          {/* Bezier control point handles */}
          {penPoints.map((pt, i) => {
            const handles: React.ReactNode[] = [];
            // handleOut = cp2 (outgoing from pt)
            if (pt.handleOut) {
              const cp2Abs = relToAbs(pt.handleOut, pt);
              handles.push(
                <Line key={`bh-line-${i}`} points={[pt.x, pt.y, cp2Abs.x, cp2Abs.y]} stroke="#6495ED" strokeWidth={1} dash={[2, 2]} listening={false} />,
                <Circle key={`bh-${i}`} x={cp2Abs.x} y={cp2Abs.y} radius={3} fill="#6495ED" stroke="#fff" strokeWidth={1} listening={false} />
              );
            }
            // handleIn = cp1 (incoming to pt)
            if (pt.handleIn) {
              const cp1Abs = relToAbs(pt.handleIn, pt);
              handles.push(
                <Line key={`bh-line-in-${i}`} points={[pt.x, pt.y, cp1Abs.x, cp1Abs.y]} stroke="#6495ED" strokeWidth={1} dash={[2, 2]} listening={false} />,
                <Circle key={`bh-in-${i}`} x={cp1Abs.x} y={cp1Abs.y} radius={3} fill="#6495ED" stroke="#fff" strokeWidth={1} listening={false} />
              );
            }
            return handles;
          })}
          {/* Smart guide lines rendered via SelectionOverlay (outside Stage) */}
          {/* 相对父容器四边距离（padding 感） */}
          {parentPaddingSegs.map((m, i) => (
            <Group key={`pp-${i}`} listening={false}>
              <Line points={[m.x1, m.y1, m.x2, m.y2]} stroke="#2DD4BF" strokeWidth={1} listening={false} />
              <Line points={[m.x1, m.y1 - 3, m.x1, m.y1 + 3]} stroke="#2DD4BF" strokeWidth={1} listening={false} />
              <Line points={[m.x2, m.y2 - 3, m.x2, m.y2 + 3]} stroke="#2DD4BF" strokeWidth={1} listening={false} />
              <Text x={(m.x1 + m.x2) / 2 - 14} y={(m.y1 + m.y2) / 2 - 12} text={m.label || String(m.dist)} fontSize={9} fill="#2DD4BF" listening={false} />
            </Group>
          ))}
          {/* Auto Layout 内边距框 + 子项 gap */}
          {autoLayoutGuide && (
            <>
              <Rect
                x={autoLayoutGuide.paddingRect.x}
                y={autoLayoutGuide.paddingRect.y}
                width={autoLayoutGuide.paddingRect.w}
                height={autoLayoutGuide.paddingRect.h}
                stroke="#A78BFA"
                strokeWidth={1}
                dash={[4, 4]}
                fill="transparent"
                listening={false}
              />
              {autoLayoutGuide.gaps.map((m, i) => (
                <Group key={`alg-${i}`} listening={false}>
                  <Line points={[m.x1, m.y1, m.x2, m.y2]} stroke="#FBBF24" strokeWidth={1} listening={false} />
                  <Text x={(m.x1 + m.x2) / 2 - 18} y={(m.y1 + m.y2) / 2 - 12} text={m.label || String(m.dist)} fontSize={9} fill="#FBBF24" listening={false} />
                </Group>
              ))}
            </>
          )}
          {/* 对象间距：Alt 悬停 或 测量工具 */}
          {measureLines.map((m, i) => (
            <Group key={`meas-${i}`} listening={false}>
              <Line points={[m.x1, m.y1, m.x2, m.y2]} stroke="#FF6B6B" strokeWidth={1} listening={false} />
              <Line points={[m.x1, m.y1 - 4, m.x1, m.y1 + 4]} stroke="#FF6B6B" strokeWidth={1} listening={false} />
              <Line points={[m.x2, m.y2 - 4, m.x2, m.y2 + 4]} stroke="#FF6B6B" strokeWidth={1} listening={false} />
              <Text x={(m.x1 + m.x2) / 2 - 10} y={(m.y1 + m.y2) / 2 - 12} text={m.label ?? `${m.dist}`} fontSize={10} fill="#FF6B6B" listening={false} padding={2} />
            </Group>
          ))}
          {/* Path node editing overlay */}
          {editingPathId && (() => {
            const pathShape = shapes.find(s => s.id === editingPathId);
            if (!pathShape || !pathShape.pathPoints || pathShape.pathPoints.length === 0) return null;
            const pts = pathShape.pathPoints;
            const editing = selectedAnchorIdx;
            return (
              <>
                {pts.map((pt, i) => {
                  const isAnchSel = editing === i;
                  return (
                    <Group key={`pa-${i}`}>
                      <Circle
                        x={pt.x} y={pt.y} radius={isAnchSel ? 6 : 5}
                        fill={isAnchSel ? '#D4A853' : '#1C1C21'}
                        stroke={isAnchSel ? '#fff' : '#D4A853'}
                        strokeWidth={1.5}
                        draggable
                        onDragMove={(e) => {
                          const node = e.target;
                          const newPts = [...pts];
                          newPts[i] = { ...newPts[i], x: node.x(), y: node.y() };
                          updateShape(editingPathId, { pathPoints: newPts });
                          setSelectedAnchorIdx(i);
                        }}
                        onMouseEnter={(e) => { (e.target as Konva.Circle).getStage()!.container().style.cursor = 'move'; }}
                        onMouseLeave={(e) => { (e.target as Konva.Circle).getStage()!.container().style.cursor = 'default'; }}
                      />
                      {pt.cp1 && (
                        <>
                          <Line points={[pt.x, pt.y, pt.cp1.x, pt.cp1.y]} stroke="#6495ED" strokeWidth={1} dash={[2, 2]} listening={false} />
                          <Circle x={pt.cp1.x} y={pt.cp1.y} radius={3} fill="#6495ED" stroke="#fff" strokeWidth={1}
                            draggable
                            onDragMove={(e) => {
                              const node = e.target;
                              const newPts = [...pts];
                              newPts[i] = { ...newPts[i], cp1: { x: node.x(), y: node.y() } };
                              updateShape(editingPathId, { pathPoints: newPts });
                            }}
                          />
                        </>
                      )}
                      {pt.cp2 && (
                        <>
                          <Line points={[pt.x, pt.y, pt.cp2.x, pt.cp2.y]} stroke="#6495ED" strokeWidth={1} dash={[2, 2]} listening={false} />
                          <Circle x={pt.cp2.x} y={pt.cp2.y} radius={3} fill="#6495ED" stroke="#fff" strokeWidth={1}
                            draggable
                            onDragMove={(e) => {
                              const node = e.target;
                              const newPts = [...pts];
                              newPts[i] = { ...newPts[i], cp2: { x: node.x(), y: node.y() } };
                              updateShape(editingPathId, { pathPoints: newPts });
                            }}
                          />
                        </>
                      )}
                    </Group>
                  );
                })}
                {pts.map((pt, i) => i > 0 ? (
                  <Line key={`pc-${i}`}
                    points={[pts[i - 1].x, pts[i - 1].y, pt.x, pt.y]}
                    stroke="#D4A853" strokeWidth={1} opacity={0.4} listening={false}
                  />
                ) : null)}
              </>
            );
          })()}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(o, n) => (n.width < 10 || n.height < 10 ? o : n)}
            borderStroke="#D4A853" borderStrokeWidth={1} borderDash={[4, 4]}
            anchorStroke="#D4A853" anchorFill="#FFFFFF" anchorSize={8} anchorCornerRadius={4}
            rotateEnabled={true}
            rotateAnchorOffset={28}
            rotateAnchorStroke="#D4A853" rotateAnchorFill="#FFFFFF" rotateAnchorSize={10}
            onTransformStart={() => {
              shiftRotationSnapRef.current = true;
              if (!engineRef.current || selectedIds.length !== 1) return;
              const stage = stageRef.current; if (!stage) return;
              const pointer = stage.getPointerPosition(); if (!pointer) return;
              const canvasX = (pointer.x - canvasPan.x) / canvasZoom;
              const canvasY = (pointer.y - canvasPan.y) / canvasZoom;
              const node = transformerRef.current?.getNode();
              if (!node) return;
              // Detect rotation: node.rotation() changes from 0 during rotate handle drag
              const isRotating = Math.abs(node.rotation()) > 0.5;
              if (isRotating) {
                engineRef.current.startRotate(selectedIds[0], canvasX, canvasY);
              } else {
                // Resize or move — use startMove (handles both)
                engineRef.current.startMove(selectedIds[0], canvasX, canvasY);
              }
            }}
            onTransform={(e) => {
              const node = e.target;
              if (shiftRotationSnapRef.current && (e.evt as unknown as MouseEvent).shiftKey) {
                const rotation = node.rotation();
                const snapped = Math.round(rotation / 15) * 15;
                node.rotation(snapped);
              }
              // Feed Konva node's current position into engine for snap guide computation
              if (engineRef.current && selectedIds.length === 1) {
                const stage = stageRef.current;
                if (!stage) return;
                const pointer = stage.getPointerPosition();
                if (!pointer) return;
                const canvasX = (pointer.x - canvasPan.x) / canvasZoom;
                const canvasY = (pointer.y - canvasPan.y) / canvasZoom;
                const result = engineRef.current.updateTransform(canvasX, canvasY);
                if (result) {
                  // Update Konva node position from engine's snap-adjusted result
                  node.x(result.bounds.x);
                  node.y(result.bounds.y);
                  // Also feed snap guides to SelectionOverlay via engine's stored state
                  const guides = engineRef.current._getSmartGuides();
                  setSnapLines(guides.slice(0, 6));
                }
              }
            }}
            onTransformEnd={(e) => {
              shiftRotationSnapRef.current = false;
              // Commit transform to engine using Konva node's FULL final state.
              // This ensures resize (width/height) and rotation are captured correctly.
              if (selectedIds.length === 1 && engineRef.current) {
                const node = e.target;
                engineRef.current.commitTransformFromKonva(
                  selectedIds[0],
                  node.x(),
                  node.y(),
                  node.width(),
                  node.height(),
                  node.rotation(),
                  node.scaleX(),
                  node.scaleY()
                );
              }
              // Clear snap guides
              setSnapLines([]);
            }}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
          />
        </Layer>
      </Stage>

      {/* SelectionOverlay: rubberBand marquee + smart guide lines (SVG, pointer-events: none) */}
      <SelectionOverlay
        marquee={
          rubberBand && (rubberBand.w > 2 || rubberBand.h > 2)
            ? {
                x: rubberBand.x * canvasZoom + canvasPan.x,
                y: rubberBand.y * canvasZoom + canvasPan.y,
                width: rubberBand.w * canvasZoom,
                height: rubberBand.h * canvasZoom,
              }
            : null
        }
        snapGuides={snapLines.map(g => ({
          path: g.x !== undefined
            ? `M ${g.x * canvasZoom + canvasPan.x} ${-5000 * canvasZoom} L ${g.x * canvasZoom + canvasPan.x} ${10000 * canvasZoom}`
            : g.y !== undefined
            ? `M ${-5000 * canvasZoom} ${g.y * canvasZoom + canvasPan.y} L ${10000 * canvasZoom} ${g.y * canvasZoom + canvasPan.y}`
            : '',
          color: '#FF6B6B',
        }))}
        pan={canvasPan}
        zoom={canvasZoom}
      />

      {editingShape && textareaStyle && (
        <textarea
          ref={editTextareaRef}
          value={editingText}
          onChange={e => setEditingText(e.target.value)}
          style={{
            position: 'absolute',
            ...textareaStyle,
            background: 'transparent',
            border: '1px solid #D4A853',
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            lineHeight: 1.2,
            padding: 0,
            zIndex: 100,
            boxShadow: '0 0 0 1px rgba(212, 168, 83, 0.3)',
          }}
          onBlur={commitTextEdit}
          onKeyDown={e => {
            if (e.key === 'Escape') { setEditingTextId(null); }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextEdit(); }
            e.stopPropagation();
          }}
        />
      )}

      {/* Pen tool hint */}
      {activeTool === 'pen' && penPoints.length > 0 && (
        <div className="absolute top-4 right-4 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)] z-10">
          点击添加锚点 · 拖拽创建曲线手柄 · Alt+拖拽打破对称 · 点击起点闭合 · Enter 完成 · Esc 完成开放路径
        </div>
      )}
      {activeTool === 'measure' && (
        <div className="absolute top-4 right-4 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-secondary)] z-10 max-w-xs">
          先选中一个对象作为参考，移动鼠标到另一对象上查看间距。也可在选择工具下按住 Alt 悬停。子对象选中时显示相对父 Frame/组的四边距离；带 Auto Layout 的容器显示内边距与 gap。
        </div>
      )}

      <div className="absolute bottom-3 right-3 px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-[var(--text-secondary)] font-mono select-none">{Math.round(canvasZoom * 100)}%</div>

      {/* Component Editing Overlay */}
      {editingComponent && (
        <div className="absolute top-0 left-0 right-0 z-20 h-9 flex items-center gap-3 px-4 bg-[#1a1a1a]/95 backdrop-blur border-b border-[#333]">
          <button
            onClick={() => exitComponentEditing()}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--text-secondary)] hover:text-white hover:bg-[#333] transition-colors"
          >
            <ArrowLeft size={13} />
            返回
          </button>
          <span className="text-xs text-[var(--text-primary)] font-medium">{editingComponent.name}</span>
          <span className="text-[10px] text-[var(--accent)]">Editing component...</span>
        </div>
      )}
    </div>
  );
}
