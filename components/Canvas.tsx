import { Stage, Layer, Rect, Circle, Text, Line, Transformer, Star, Arrow, Image as KonvaImage, RegularPolygon, Group, Path } from 'react-konva';
import { useEditorStore } from '@/stores/useEditorStore';
import { Shape, Gradient, CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/types';
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useImage, fileToDataUrl, getImageDimensions } from '@/lib/hooks';
import Konva from 'konva';

interface CanvasProps { width: number; height: number; }

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
  if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') {
    const r = s.radius || 50;
    return { left: s.x - r, top: s.y - r, right: s.x + r, bottom: s.y + r, cx: s.x, cy: s.y };
  }
  const w = s.width || 100, h = s.height || 100;
  return { left: s.x, top: s.y, right: s.x + w, bottom: s.y + h, cx: s.x + w / 2, cy: s.y + h / 2 };
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
  shape, isSelected, editingTextId, onSelect, onDragEnd, onDragMove, onTransformEnd, onDblClickText,
}: {
  shape: Shape;
  isSelected: boolean;
  editingTextId: string | null;
  onSelect: (id: string, add: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDragMove: (id: string, dx: number, dy: number) => void;
  onTransformEnd: (id: string, node: Konva.Node) => void;
  onDblClickText: (id: string) => void;
}) {
  const shapeRef = useRef<Konva.Shape>(null);
  const initPos = useRef({ x: shape.x, y: shape.y });

  const shadowProps = useMemo(() => {
    const shadows = shape.shadows || (shape.shadow ? [shape.shadow] : []);
    if (shadows.length === 0) return {};
    const s = shadows[0];
    return { shadowColor: s.color, shadowBlur: s.blur, shadowOffsetX: s.offsetX, shadowOffsetY: s.offsetY, shadowOpacity: 1 };
  }, [shape.shadow, shape.shadows]);

  const commonProps: Record<string, unknown> = {
    id: shape.id,
    ref: shapeRef as React.RefObject<never>,
    x: shape.x, y: shape.y,
    rotation: shape.rotation,
    opacity: shape.opacity,
    visible: shape.visible,
    draggable: !shape.locked,
    scaleX: shape.scaleX ?? 1,
    scaleY: shape.scaleY ?? 1,
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onSelect(shape.id, e.evt.shiftKey); },
    onDragStart: () => { initPos.current = { x: shape.x, y: shape.y }; },
    onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
      const dx = e.target.x() - initPos.current.x;
      const dy = e.target.y() - initPos.current.y;
      onDragMove(shape.id, dx, dy);
    },
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(shape.id, e.target.x(), e.target.y()),
    onTransformEnd: () => { if (shapeRef.current) onTransformEnd(shape.id, shapeRef.current); },
    ...shadowProps,
  };

  const selStroke = isSelected ? '#D4A853' : shape.stroke;
  const selStrokeW = isSelected ? Math.max(shape.strokeWidth, 2) : shape.strokeWidth;
  const gradFill = (w: number, h: number) => shape.gradient ? { fill: undefined, ...gradientToKonvaFill(shape.gradient, w, h) } : {};

  switch (shape.type) {
    case 'rect':
    case 'frame': {
      const w = shape.width || 100, h = shape.height || 100;
      return <Rect {...commonProps} width={w} height={h} fill={shape.gradient ? undefined : shape.fill} stroke={selStroke} strokeWidth={selStrokeW} cornerRadius={shape.cornerRadius || 0} dash={shape.strokeDash} {...gradFill(w, h)} />;
    }
    case 'circle': {
      const r = shape.radius || 50;
      return <Circle {...commonProps} radius={r} fill={shape.gradient ? undefined : shape.fill} stroke={selStroke} strokeWidth={selStrokeW} dash={shape.strokeDash} {...(shape.gradient ? gradientToKonvaFill(shape.gradient, r * 2, r * 2) : {})} />;
    }
    case 'text':
      return (
        <Text
          {...commonProps}
          visible={shape.visible && editingTextId !== shape.id}
          text={shape.text || 'Text'}
          fontSize={shape.fontSize || 24}
          fontFamily={shape.fontFamily || 'sans-serif'}
          fontStyle={shape.fontWeight || 'normal'}
          align={shape.textAlign || 'left'}
          width={shape.width}
          fill={shape.fill}
          lineHeight={shape.lineHeight ?? 1.2}
          letterSpacing={shape.letterSpacing ?? 0}
          onDblClick={(e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onDblClickText(shape.id); }}
        />
      );
    case 'line':
      return <Line {...commonProps} points={shape.points || [0, 0, 100, 100]} stroke={isSelected ? '#D4A853' : shape.stroke} strokeWidth={isSelected ? Math.max(shape.strokeWidth, 2) : shape.strokeWidth} lineCap="round" lineJoin="round" dash={shape.strokeDash} fill={undefined} />;
    case 'arrow':
      return <Arrow {...commonProps} points={shape.points || [0, 0, 150, 0]} stroke={isSelected ? '#D4A853' : shape.stroke} strokeWidth={isSelected ? Math.max(shape.strokeWidth || 2, 2) : (shape.strokeWidth || 2)} fill={isSelected ? '#D4A853' : shape.stroke} pointerLength={10} pointerWidth={10} lineCap="round" />;
    case 'star': {
      const r = shape.radius || 50;
      return <Star {...commonProps} numPoints={shape.numPoints || 5} innerRadius={shape.innerRadius || 20} outerRadius={r} fill={shape.gradient ? undefined : shape.fill} stroke={selStroke} strokeWidth={selStrokeW} {...(shape.gradient ? gradientToKonvaFill(shape.gradient, r * 2, r * 2) : {})} />;
    }
    case 'triangle': {
      const r = shape.radius || 50;
      return <RegularPolygon {...commonProps} sides={3} radius={r} fill={shape.gradient ? undefined : shape.fill} stroke={selStroke} strokeWidth={selStrokeW} {...(shape.gradient ? gradientToKonvaFill(shape.gradient, r * 2, r * 2) : {})} />;
    }
    case 'path': {
      const d = pathPointsToSvg(shape);
      if (!d) return null;
      return <Path {...commonProps} data={d} fill={shape.fill === 'transparent' ? undefined : shape.fill} stroke={isSelected ? '#D4A853' : shape.stroke} strokeWidth={isSelected ? Math.max(shape.strokeWidth, 2) : shape.strokeWidth} lineCap="round" lineJoin="round" />;
    }
    case 'image':
    case 'component':
      return <ImageShape shape={shape} commonProps={{ ...commonProps, stroke: isSelected ? '#D4A853' : undefined, strokeWidth: isSelected ? 2 : 0 }} />;
    default:
      return null;
  }
}

// Recursive frame renderer: render frame background + children clipped inside
function FrameRenderer({
  frame, allShapes, selectedIds, editingTextId, onSelect, onDragEnd, onDragMove, onTransformEnd, onDblClickText,
}: {
  frame: Shape;
  allShapes: Shape[];
  selectedIds: string[];
  editingTextId: string | null;
  onSelect: (id: string, add: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDragMove: (id: string, dx: number, dy: number) => void;
  onTransformEnd: (id: string, node: Konva.Node) => void;
  onDblClickText: (id: string) => void;
}) {
  const children = allShapes.filter(s => s.parentId === frame.id);
  const fw = frame.width || 200, fh = frame.height || 200;
  const isSelected = selectedIds.includes(frame.id);

  return (
    <Group
      id={frame.id}
      x={frame.x}
      y={frame.y}
      rotation={frame.rotation}
      opacity={frame.opacity}
      visible={frame.visible}
      draggable={!frame.locked}
      scaleX={frame.scaleX ?? 1}
      scaleY={frame.scaleY ?? 1}
      clipFunc={frame.clipContent !== false ? (ctx: Konva.Context) => {
        ctx.rect(0, 0, fw, fh);
      } : undefined}
      onClick={(e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onSelect(frame.id, e.evt.shiftKey); }}
      onDragEnd={(e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(frame.id, e.target.x(), e.target.y())}
      onTransformEnd={() => {
        const node = (e: unknown) => e;
        void node;
      }}
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
      {children.map(child => {
        if (child.type === 'frame') {
          return (
            <FrameRenderer
              key={child.id}
              frame={{ ...child, x: child.x - frame.x, y: child.y - frame.y }}
              allShapes={allShapes}
              selectedIds={selectedIds}
              editingTextId={editingTextId}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
              onDragMove={onDragMove}
              onTransformEnd={onTransformEnd}
              onDblClickText={onDblClickText}
            />
          );
        }
        return (
          <ShapeRenderer
            key={child.id}
            shape={{ ...child, x: child.x - frame.x, y: child.y - frame.y }}
            isSelected={selectedIds.includes(child.id)}
            editingTextId={editingTextId}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
            onDragMove={onDragMove}
            onTransformEnd={onTransformEnd}
            onDblClickText={onDblClickText}
          />
        );
      })}
    </Group>
  );
}

export default function Canvas({ width, height }: CanvasProps) {
  const store = useEditorStore();
  const { shapes, selectedIds, activeTool, canvasZoom, canvasPan, canvasBg, setSelectedIds, clearSelection, updateShape, addShape, deleteShapes, duplicateShapes, setCanvasZoom, setCanvasPan, setActiveTool, undo, redo, setShowHelp, pushHistory, moveGroupShapes } = store;

  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const spacePressed = useRef(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [rubberBand, setRubberBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const rubberBandStart = useRef<{ x: number; y: number } | null>(null);
  const rubberBandUsed = useRef(false);

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }[]>([]);

  // Pen tool state
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[]>([]);
  const [penPreview, setPenPreview] = useState<{ x: number; y: number } | null>(null);

  // Top-level shapes (no parentId) — frames and loose shapes
  const topLevelShapes = useMemo(() => shapes.filter(s => !s.parentId), [shapes]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.code === 'Space' && !e.repeat && !isInput) {
        e.preventDefault(); spacePressed.current = true;
        if (stageRef.current) stageRef.current.container().style.cursor = 'grab';
        return;
      }
      if (isInput) return;
      const mod = e.metaKey || e.ctrlKey;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) { e.preventDefault(); deleteShapes(selectedIds); }
      else if (e.key === 'Escape') {
        if (penPoints.length > 0) { setPenPoints([]); setPenPreview(null); }
        else { clearSelection(); setActiveTool('select'); setEditingTextId(null); }
      }
      else if (mod && e.key === 'a') { e.preventDefault(); setSelectedIds(shapes.filter(s => s.visible && !s.locked).map(s => s.id)); }
      else if (mod && e.key === 'd') { e.preventDefault(); if (selectedIds.length > 0) duplicateShapes(selectedIds); }
      else if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((mod && e.key === 'z' && e.shiftKey) || (mod && e.key === 'y')) { e.preventDefault(); redo(); }
      else if (mod && e.key === '0') { e.preventDefault(); setCanvasZoom(1); setCanvasPan({ x: 0, y: 0 }); }
      else if (mod && e.key === '1') { e.preventDefault(); const sx = (width / 2 - CANVAS_WIDTH / 2); const sy = (height / 2 - CANVAS_HEIGHT / 2); setCanvasZoom(1); setCanvasPan({ x: sx, y: sy }); }
      else if (e.key === '/' || e.key === '?') { if (mod || e.shiftKey) { e.preventDefault(); setShowHelp(true); } }
      else if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      else if (e.key === 'r' || e.key === 'R') setActiveTool('rect');
      else if (e.key === 'o' || e.key === 'O') setActiveTool('circle');
      else if (e.key === 't' || e.key === 'T') setActiveTool('text');
      else if (e.key === 'l' || e.key === 'L') setActiveTool('line');
      else if (e.key === 'h' || e.key === 'H') setActiveTool('hand');
      else if (e.key === 'f' || e.key === 'F') setActiveTool('frame');
      else if (e.key === 'p' || e.key === 'P') setActiveTool('pen');
      else if (e.key === 'Enter' && penPoints.length >= 2) {
        finishPenPath(false);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spacePressed.current = false; if (stageRef.current && !isPanning.current) stageRef.current.container().style.cursor = 'default'; }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [selectedIds, shapes, deleteShapes, clearSelection, setSelectedIds, duplicateShapes, undo, redo, setCanvasZoom, setCanvasPan, setActiveTool, setShowHelp, width, height, penPoints]);

  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    const nodes = selectedIds.map(id => stage.findOne(`#${id}`)).filter(Boolean) as Konva.Node[];
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, shapes]);

  const handleSelect = useCallback((id: string, add: boolean) => {
    if (activeTool !== 'select') return;
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

    if (shape.groupId) {
      const stage = stageRef.current; if (!stage) return;
      currentShapes.filter(s => s.groupId === shape.groupId && s.id !== id).forEach(s => {
        const node = stage.findOne(`#${s.id}`);
        if (node) { node.x(s.x + dx); node.y(s.y + dy); }
      });
    }

    // Move children of frames
    if (shape.type === 'frame') {
      const stage = stageRef.current; if (!stage) return;
      currentShapes.filter(s => s.parentId === shape.id).forEach(s => {
        const node = stage.findOne(`#${s.id}`);
        if (node) { node.x(s.x + dx); node.y(s.y + dy); }
      });
    }

    const SNAP_THRESHOLD = 6;
    const draggedBounds = getShapeBoundsForSnap({ ...shape, x: shape.x + dx, y: shape.y + dy });
    const guides: { x?: number; y?: number }[] = [];
    const others = currentShapes.filter(s => s.id !== id && (!shape.groupId || s.groupId !== shape.groupId) && s.parentId !== shape.id);

    for (const other of others) {
      const ob = getShapeBoundsForSnap(other);
      if (Math.abs(draggedBounds.left - ob.left) < SNAP_THRESHOLD) guides.push({ x: ob.left });
      if (Math.abs(draggedBounds.right - ob.right) < SNAP_THRESHOLD) guides.push({ x: ob.right });
      if (Math.abs(draggedBounds.cx - ob.cx) < SNAP_THRESHOLD) guides.push({ x: ob.cx });
      if (Math.abs(draggedBounds.left - ob.right) < SNAP_THRESHOLD) guides.push({ x: ob.right });
      if (Math.abs(draggedBounds.right - ob.left) < SNAP_THRESHOLD) guides.push({ x: ob.left });
      if (Math.abs(draggedBounds.top - ob.top) < SNAP_THRESHOLD) guides.push({ y: ob.top });
      if (Math.abs(draggedBounds.bottom - ob.bottom) < SNAP_THRESHOLD) guides.push({ y: ob.bottom });
      if (Math.abs(draggedBounds.cy - ob.cy) < SNAP_THRESHOLD) guides.push({ y: ob.cy });
      if (Math.abs(draggedBounds.top - ob.bottom) < SNAP_THRESHOLD) guides.push({ y: ob.bottom });
      if (Math.abs(draggedBounds.bottom - ob.top) < SNAP_THRESHOLD) guides.push({ y: ob.top });
    }
    setSnapLines(guides.slice(0, 6));
  }, []);

  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    setSnapLines([]);
    const currentShapes = useEditorStore.getState().shapes;
    const shape = currentShapes.find(s => s.id === id);
    pushHistory();
    if (shape?.groupId) {
      moveGroupShapes(shape.groupId, id, x, y);
    } else if (shape?.type === 'frame') {
      // Move frame and all its children
      const dx = x - shape.x, dy = y - shape.y;
      const childIds = currentShapes.filter(s => s.parentId === id).map(s => s.id);
      const updates = new Map<string, Partial<Shape>>();
      updates.set(id, { x, y });
      childIds.forEach(cid => {
        const child = currentShapes.find(s => s.id === cid);
        if (child) updates.set(cid, { x: child.x + dx, y: child.y + dy });
      });
      updates.forEach((u, sid) => updateShape(sid, u));
    } else {
      updateShape(id, { x, y });
    }
  }, [updateShape, pushHistory, moveGroupShapes]);

  const handleTransformEnd = useCallback((id: string, node: Konva.Node) => {
    pushHistory();
    const scaleX = node.scaleX(), scaleY = node.scaleY();
    const shape = useEditorStore.getState().shapes.find(s => s.id === id);
    if (!shape) return;
    const prevFlipX = (shape.scaleX ?? 1) < 0 ? -1 : 1;
    const prevFlipY = (shape.scaleY ?? 1) < 0 ? -1 : 1;
    const absX = Math.abs(scaleX), absY = Math.abs(scaleY);
    const newFlipX = (scaleX < 0 ? -1 : 1) * prevFlipX;
    const newFlipY = (scaleY < 0 ? -1 : 1) * prevFlipY;
    node.scaleX(newFlipX); node.scaleY(newFlipY);
    const u: Partial<Shape> = { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: newFlipX, scaleY: newFlipY };
    if (shape.type === 'rect' || shape.type === 'image' || shape.type === 'component' || shape.type === 'frame') {
      u.width = Math.max(10, (shape.width || 100) * absX);
      u.height = Math.max(10, (shape.height || 100) * absY);
    }
    else if (shape.type === 'circle' || shape.type === 'star' || shape.type === 'triangle') { u.radius = Math.max(5, (shape.radius || 50) * Math.max(absX, absY)); if (shape.innerRadius) u.innerRadius = Math.max(5, shape.innerRadius * Math.max(absX, absY)); }
    else if (shape.type === 'text') { u.fontSize = Math.max(8, (shape.fontSize || 24) * absY); u.width = (shape.width || 200) * absX; }
    updateShape(id, u);
  }, [updateShape, pushHistory]);

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

  // Pen tool: finish path
  const finishPenPath = useCallback((close: boolean) => {
    if (penPoints.length < 2) { setPenPoints([]); setPenPreview(null); return; }
    const pathPts = penPoints.map(p => ({ x: p.x, y: p.y }));
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
    setActiveTool('select');
  }, [penPoints, addShape, setSelectedIds, setActiveTool]);

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
    if (e.evt.button === 1 || (e.evt.button === 0 && (spacePressed.current || activeTool === 'hand'))) {
      isPanning.current = true; lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      if (stageRef.current) stageRef.current.container().style.cursor = 'grabbing'; return;
    }
    if (e.evt.button !== 0) return;
    const isStage = e.target === e.target.getStage();

    // Pen tool click
    if (activeTool === 'pen') {
      const pt = getCanvasPoint();
      // Double-click = close path
      if (penPoints.length >= 2) {
        const first = penPoints[0];
        if (Math.abs(pt.x - first.x) < 10 && Math.abs(pt.y - first.y) < 10) {
          finishPenPath(true);
          return;
        }
      }
      setPenPoints(prev => [...prev, pt]);
      return;
    }

    if (activeTool === 'select' && isStage) {
      const pt = getCanvasPoint();
      rubberBandStart.current = pt;
      rubberBandUsed.current = false;
      setRubberBand({ x: pt.x, y: pt.y, w: 0, h: 0 });
      return;
    }

    const drawTools = ['rect', 'circle', 'line', 'text', 'star', 'triangle', 'frame'];
    if (drawTools.includes(activeTool) && isStage) {
      const pt = getCanvasPoint();
      setIsDrawing(true); setDrawStart(pt); setDrawPreview({ x: pt.x, y: pt.y, w: 0, h: 0 });
    }
  }, [activeTool, getCanvasPoint, penPoints, finishPenPath]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current; if (!stage) return;
    if (isPanning.current) {
      const dx = e.evt.clientX - lastPanPos.current.x, dy = e.evt.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      setCanvasPan({ x: canvasPan.x + dx, y: canvasPan.y + dy }); return;
    }
    // Pen tool preview
    if (activeTool === 'pen' && penPoints.length > 0) {
      const pt = getCanvasPoint();
      setPenPreview(pt);
      return;
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
    if (activeTool === 'hand' || spacePressed.current) stage.container().style.cursor = 'grab';
    else if (activeTool !== 'select') stage.container().style.cursor = 'crosshair';
    else stage.container().style.cursor = e.target !== stage ? 'move' : 'default';
  }, [canvasPan, setCanvasPan, isDrawing, drawStart, getCanvasPoint, activeTool, penPoints]);

  const handleMouseUp = useCallback(() => {
    if (isPanning.current) {
      isPanning.current = false;
      if (stageRef.current) stageRef.current.container().style.cursor = spacePressed.current ? 'grab' : 'default';
      return;
    }

    if (rubberBandStart.current) {
      if (rubberBand && (rubberBand.w > 5 || rubberBand.h > 5)) {
        const { x, y, w, h } = rubberBand;
        const currentShapes = useEditorStore.getState().shapes;
        const found = currentShapes.filter(s => {
          if (!s.visible || s.locked) return false;
          let sx = s.x, sy = s.y, sw = s.width || 100, sh = s.height || 100;
          if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') {
            const r = s.radius || 50; sx = s.x - r; sy = s.y - r; sw = r * 2; sh = r * 2;
          }
          return sx < x + w && sx + sw > x && sy < y + h && sy + sh > y;
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
      let id: string | null = null;
      const base = { fill: '#4A4A52', stroke: '#3A3A40', strokeWidth: 1, opacity: 1, rotation: 0, visible: true, locked: false, name: '' };
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
  }, [isDrawing, drawStart, drawPreview, activeTool, addShape, setSelectedIds, setActiveTool, rubberBand]);

  const handleDblClickText = useCallback((id: string) => {
    const shape = shapes.find(s => s.id === id);
    if (!shape || shape.type !== 'text') return;
    setEditingTextId(id);
    setEditingText(shape.text || '');
    setSelectedIds([id]);
    setTimeout(() => editTextareaRef.current?.focus(), 10);
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

  const cursor = activeTool === 'hand' || spacePressed.current ? 'grab' : activeTool === 'pen' ? 'crosshair' : activeTool !== 'select' ? 'crosshair' : 'default';

  const editingShape = editingTextId ? shapes.find(s => s.id === editingTextId) : null;
  const textareaStyle = editingShape ? {
    left: editingShape.x * canvasZoom + canvasPan.x,
    top: editingShape.y * canvasZoom + canvasPan.y,
    width: Math.max(100, (editingShape.width || 200)) * canvasZoom,
    fontSize: (editingShape.fontSize || 24) * canvasZoom,
    fontFamily: editingShape.fontFamily || 'sans-serif',
    color: editingShape.fill,
    minHeight: (editingShape.fontSize || 24) * 1.4 * canvasZoom,
    transform: `rotate(${editingShape.rotation}deg)`,
    transformOrigin: 'top left',
  } : null;

  // Build pen preview SVG path
  const penPreviewPoints = penPoints.length > 0 ? (() => {
    const pts = [...penPoints, ...(penPreview ? [penPreview] : [])];
    const arr: number[] = [];
    pts.forEach(p => { arr.push(p.x, p.y); });
    return arr;
  })() : null;

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
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor }}
      >
        <Layer listening={false}>
          {gridDots}
          <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill={canvasBg} stroke="#2A2A30" strokeWidth={1} listening={false} />
        </Layer>
        <Layer>
          {topLevelShapes.map(shape => {
            if (shape.type === 'frame') {
              return (
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
                />
              );
            }
            return (
              <ShapeRenderer
                key={shape.id}
                shape={shape}
                isSelected={selectedIds.includes(shape.id)}
                editingTextId={editingTextId}
                onSelect={handleSelect}
                onDragEnd={handleDragEnd}
                onDragMove={handleDragMove}
                onTransformEnd={handleTransformEnd}
                onDblClickText={handleDblClickText}
              />
            );
          })}
          {/* Draw previews */}
          {isDrawing && drawPreview && (activeTool === 'rect' || activeTool === 'frame') && <Rect x={drawPreview.x} y={drawPreview.y} width={drawPreview.w} height={drawPreview.h} fill={activeTool === 'frame' ? 'rgba(255,255,255,0.03)' : 'rgba(74,74,82,0.3)'} stroke={activeTool === 'frame' ? '#6495ED' : '#D4A853'} strokeWidth={1} dash={[6, 3]} listening={false} />}
          {isDrawing && drawPreview && activeTool === 'circle' && <Circle x={drawPreview.x + drawPreview.w / 2} y={drawPreview.y + drawPreview.h / 2} radius={Math.max(drawPreview.w, drawPreview.h) / 2} fill="rgba(74,74,82,0.3)" stroke="#D4A853" strokeWidth={1} dash={[6, 3]} listening={false} />}
          {isDrawing && drawPreview && (activeTool === 'star' || activeTool === 'triangle') && <Circle x={drawPreview.x + drawPreview.w / 2} y={drawPreview.y + drawPreview.h / 2} radius={Math.max(drawPreview.w, drawPreview.h) / 2} fill="rgba(212,168,83,0.1)" stroke="#D4A853" strokeWidth={1} dash={[6, 3]} listening={false} />}
          {isDrawing && drawStart && drawPreview && activeTool === 'line' && <Line points={[drawStart.x, drawStart.y, drawStart.x + drawPreview.w * (drawPreview.x >= drawStart.x ? 1 : -1), drawStart.y + drawPreview.h * (drawPreview.y >= drawStart.y ? 1 : -1)]} stroke="#D4A853" strokeWidth={2} dash={[6, 3]} listening={false} />}
          {isDrawing && drawPreview && activeTool === 'text' && <Rect x={drawPreview.x} y={drawPreview.y} width={Math.max(100, drawPreview.w)} height={Math.max(30, drawPreview.h)} fill="rgba(232,228,223,0.05)" stroke="#D4A853" strokeWidth={1} dash={[4, 2]} listening={false} />}
          {/* Pen tool preview */}
          {penPreviewPoints && penPreviewPoints.length >= 4 && (
            <Line points={penPreviewPoints} stroke="#D4A853" strokeWidth={2} dash={[4, 4]} listening={false} lineCap="round" lineJoin="round" />
          )}
          {penPoints.map((pt, i) => (
            <Circle key={`pen-pt-${i}`} x={pt.x} y={pt.y} radius={4} fill={i === 0 ? '#6495ED' : '#D4A853'} stroke="#fff" strokeWidth={1} listening={false} />
          ))}
          {/* Smart guide lines */}
          {snapLines.map((guide, i) =>
            guide.x !== undefined ? (
              <Line key={`gx-${i}`} points={[guide.x, -5000, guide.x, 10000]} stroke="#FF6B6B" strokeWidth={0.5} dash={[4, 4]} listening={false} />
            ) : guide.y !== undefined ? (
              <Line key={`gy-${i}`} points={[-5000, guide.y, 10000, guide.y]} stroke="#FF6B6B" strokeWidth={0.5} dash={[4, 4]} listening={false} />
            ) : null
          )}
          {rubberBand && (rubberBand.w > 2 || rubberBand.h > 2) && (
            <Rect x={rubberBand.x} y={rubberBand.y} width={rubberBand.w} height={rubberBand.h} fill="rgba(100,150,255,0.08)" stroke="#6495ED" strokeWidth={1} dash={[4, 2]} listening={false} />
          )}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(o, n) => (n.width < 10 || n.height < 10 ? o : n)}
            borderStroke="#D4A853" borderStrokeWidth={1}
            anchorStroke="#D4A853" anchorFill="#1C1C21" anchorSize={8} anchorCornerRadius={2}
            rotateEnabled={true}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
          />
        </Layer>
      </Stage>

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
          点击添加锚点 · 点击起点闭合 · Enter 完成 · Esc 取消
        </div>
      )}

      <div className="absolute bottom-3 right-3 px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-[var(--text-secondary)] font-mono select-none">{Math.round(canvasZoom * 100)}%</div>
    </div>
  );
}
