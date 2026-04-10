import type { Shape } from './types';

export interface AABB {
  left: number;
  top: number;
  right: number;
  bottom: number;
  w: number;
  h: number;
}

/** Axis-aligned bounds in canvas coordinates (same as store: absolute x,y). */
export function getShapeAABB(s: Shape): AABB {
  if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') {
    const r = s.radius || 50;
    return { left: s.x - r, top: s.y - r, right: s.x + r, bottom: s.y + r, w: r * 2, h: r * 2 };
  }
  if (s.type === 'line' || s.type === 'arrow') {
    const pts = s.points || [0, 0, 100, 100];
    const xs = pts.filter((_, i) => i % 2 === 0).map(v => v + s.x);
    const ys = pts.filter((_, i) => i % 2 === 1).map(v => v + s.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { left: minX, top: minY, right: maxX, bottom: maxY, w: maxX - minX, h: maxY - minY };
  }
  if (s.type === 'path') {
    const pts = s.pathPoints;
    if (!pts || pts.length === 0) {
      return { left: s.x, top: s.y, right: s.x + 1, bottom: s.y + 1, w: 1, h: 1 };
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const add = (x: number, y: number) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    };
    pts.forEach(p => {
      add(p.x + s.x, p.y + s.y);
      if (p.cp1) add(p.cp1.x + s.x, p.cp1.y + s.y);
      if (p.cp2) add(p.cp2.x + s.x, p.cp2.y + s.y);
    });
    if (!Number.isFinite(minX)) return { left: s.x, top: s.y, right: s.x + 1, bottom: s.y + 1, w: 1, h: 1 };
    return { left: minX, top: minY, right: maxX, bottom: maxY, w: maxX - minX, h: maxY - minY };
  }
  const w = s.width ?? (s.type === 'text' ? 200 : 100);
  const h = s.height ?? (s.type === 'text' ? Math.max(28, (s.fontSize || 24) * (s.lineHeight ?? 1.2)) : 100);
  return { left: s.x, top: s.y, right: s.x + w, bottom: s.y + h, w, h };
}

export function pointInAABB(px: number, py: number, b: AABB): boolean {
  return px >= b.left && px <= b.right && py >= b.top && py <= b.bottom;
}

/** Topmost shape under point (last in array wins). */
export function hitTestShapeAtPoint(shapes: Shape[], px: number, py: number): Shape | null {
  let hit: Shape | null = null;
  for (const s of shapes) {
    if (!s.visible || s.locked) continue;
    if (pointInAABB(px, py, getShapeAABB(s))) hit = s;
  }
  return hit;
}

export interface MeasureSegment {
  x1: number; y1: number; x2: number; y2: number; dist: number; label?: string;
}

export function measureGapBetweenAABBs(a: AABB, b: AABB): MeasureSegment[] {
  const lines: MeasureSegment[] = [];
  const ax2 = a.left + a.w, ay2 = a.top + a.h;
  const bx2 = b.left + b.w, by2 = b.top + b.h;
  const gapLeft = b.left - ax2;
  const gapRight = a.left - bx2;
  const gapTop = b.top - ay2;
  const gapBottom = a.top - by2;
  const cy = Math.max(a.top, b.top) + (Math.min(ay2, by2) - Math.max(a.top, b.top)) / 2;
  const cx = Math.max(a.left, b.left) + (Math.min(ax2, bx2) - Math.max(a.left, b.left)) / 2;
  if (gapLeft > 0) lines.push({ x1: ax2, y1: cy, x2: b.left, y2: cy, dist: Math.round(gapLeft) });
  else if (gapRight > 0) lines.push({ x1: bx2, y1: cy, x2: a.left, y2: cy, dist: Math.round(gapRight) });
  if (gapTop > 0) lines.push({ x1: cx, y1: ay2, x2: cx, y2: b.top, dist: Math.round(gapTop) });
  else if (gapBottom > 0) lines.push({ x1: cx, y1: by2, x2: cx, y2: a.top, dist: Math.round(gapBottom) });
  return lines;
}

export function isLayoutContainer(s: Shape): boolean {
  return s.type === 'frame' || s.type === 'group';
}

/** Frame defaults to clip children; group clips only when clipContent is explicitly true (matches Canvas). */
export function containerClipOverflow(s: Shape): boolean {
  if (s.type === 'group') return s.clipContent === true;
  return s.clipContent !== false;
}

/** Inner rect of frame/group in canvas space (ignores corner radius). */
export function parentInnerRect(parent: Shape): AABB | null {
  if (!isLayoutContainer(parent)) return null;
  const fw = parent.width || 200, fh = parent.height || 200;
  return { left: parent.x, top: parent.y, right: parent.x + fw, bottom: parent.y + fh, w: fw, h: fh };
}

/** Segments from child AABB edges to parent inner edges (padding-like). */
export function computeParentPaddingSegments(child: Shape, parent: Shape): MeasureSegment[] {
  const inner = parentInnerRect(parent);
  if (!inner) return [];
  const c = getShapeAABB(child);
  const midX = (c.left + c.right) / 2;
  const midY = (c.top + c.bottom) / 2;
  const segs: MeasureSegment[] = [];
  const top = c.top - inner.top;
  segs.push({
    x1: midX, y1: inner.top, x2: midX, y2: c.top,
    dist: Math.round(top),
    label: String(Math.round(top)),
  });
  const bottom = inner.bottom - c.bottom;
  segs.push({
    x1: midX, y1: c.bottom, x2: midX, y2: inner.bottom,
    dist: Math.round(bottom),
    label: String(Math.round(bottom)),
  });
  const left = c.left - inner.left;
  segs.push({
    x1: inner.left, y1: midY, x2: c.left, y2: midY,
    dist: Math.round(left),
    label: String(Math.round(left)),
  });
  const right = inner.right - c.right;
  segs.push({
    x1: c.right, y1: midY, x2: inner.right, y2: midY,
    dist: Math.round(right),
    label: String(Math.round(right)),
  });
  return segs;
}

export interface AutoLayoutOverlay {
  paddingRect: { x: number; y: number; w: number; h: number };
  gaps: MeasureSegment[];
}

export function computeAutoLayoutOverlay(frame: Shape, children: Shape[]): AutoLayoutOverlay | null {
  const al = frame.autoLayout;
  if (!al) return null;
  const fw = frame.width || 200, fh = frame.height || 200;
  const fx = frame.x, fy = frame.y;
  const paddingRect = {
    x: fx + al.paddingLeft,
    y: fy + al.paddingTop,
    w: fw - al.paddingLeft - al.paddingRight,
    h: fh - al.paddingTop - al.paddingBottom,
  };
  const ordered = [...children].sort((a, b) => {
    const ia = children.indexOf(a);
    const ib = children.indexOf(b);
    return ia - ib;
  });
  const gaps: MeasureSegment[] = [];
  const isH = al.direction === 'horizontal';
  for (let i = 1; i < ordered.length; i++) {
    const prev = getShapeAABB(ordered[i - 1]);
    const cur = getShapeAABB(ordered[i]);
    if (isH) {
      const g = cur.left - prev.right;
      if (g >= 0) {
        const cy = (Math.max(prev.top, cur.top) + Math.min(prev.bottom, cur.bottom)) / 2;
        gaps.push({ x1: prev.right, y1: cy, x2: cur.left, y2: cy, dist: Math.round(g), label: `${Math.round(g)} gap` });
      }
    } else {
      const g = cur.top - prev.bottom;
      if (g >= 0) {
        const cx = (Math.max(prev.left, cur.left) + Math.min(prev.right, cur.right)) / 2;
        gaps.push({ x1: cx, y1: prev.bottom, x2: cx, y2: cur.top, dist: Math.round(g), label: `${Math.round(g)} gap` });
      }
    }
  }
  return { paddingRect, gaps };
}

/** Union AABB of shapes (canvas space). */
export function unionAABBs(shapes: Shape[]): AABB | null {
  if (shapes.length === 0) return null;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const s of shapes) {
    const box = getShapeAABB(s);
    l = Math.min(l, box.left); t = Math.min(t, box.top);
    r = Math.max(r, box.right); b = Math.max(b, box.bottom);
  }
  return { left: l, top: t, right: r, bottom: b, w: r - l, h: b - t };
}
