import type { Shape } from './types';
import { getShapeAABB } from './measurement';

/** Size of a shape in its natural coordinate space */
export interface NaturalSize {
  w: number;
  h: number;
}

/**
 * Returns the natural (unscaled) size of a shape.
 * For circle/star/triangle: derived from radius
 * For text: width + computed height from fontSize
 * For others: width/height properties
 */
export function getShapeNaturalSize(s: Shape): NaturalSize {
  if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') {
    const r = s.radius || 50;
    return { w: r * 2, h: r * 2 };
  }
  if (s.type === 'line' || s.type === 'arrow') {
    const pts = s.points || [0, 0, 100, 0];
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { w: maxX - minX || 1, h: maxY - minY || 1 };
  }
  if (s.type === 'path') {
    const pts = s.pathPoints;
    if (!pts || pts.length === 0) return { w: 1, h: 1 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const add = (x: number, y: number) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    };
    pts.forEach(p => {
      add(p.x, p.y);
      if (p.cp1) add(p.cp1.x, p.cp1.y);
      if (p.cp2) add(p.cp2.x, p.cp2.y);
    });
    if (!Number.isFinite(minX)) return { w: 1, h: 1 };
    return { w: maxX - minX || 1, h: maxY - minY || 1 };
  }
  const w = s.width ?? (s.type === 'text' ? 200 : 100);
  const h = s.height ?? (s.type === 'text' ? Math.max(28, (s.fontSize || 24) * (s.lineHeight ?? 1.2)) : 100);
  return { w, h };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constraints for NON-auto-layout frames
// ─────────────────────────────────────────────────────────────────────────────

export interface ComputedChildLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the final layout (x, y, width, height) of a child shape inside a
 * non-autoLayout frame, applying constraints.
 * Returns coordinates RELATIVE to the frame's top-left corner.
 */
export function computeChildLayout(
  child: Shape,
  frame: Shape,
  _allShapes: Shape[],
): ComputedChildLayout {
  const fw = frame.width || 200;
  const fh = frame.height || 200;
  const cs = getShapeNaturalSize(child);
  const c = child.constraints || { horizontal: 'min', vertical: 'min' };

  let nx = child.x;
  let ny = child.y;
  let nw = cs.w;
  let nh = cs.h;

  // Horizontal
  switch (c.horizontal) {
    case 'min': break;
    case 'max': nx = fw - nw; break;
    case 'center': nx = (fw - nw) / 2; break;
    case 'stretch': nw = fw; nx = 0; break;
  }

  // Vertical
  switch (c.vertical) {
    case 'min': break;
    case 'max': ny = fh - nh; break;
    case 'center': ny = (fh - nh) / 2; break;
    case 'stretch': nh = fh; ny = 0; break;
  }

  // Min / max dimension constraints
  if (child.minWidth !== undefined && nw < child.minWidth) nw = child.minWidth;
  if (child.maxWidth !== undefined && nw > child.maxWidth) nw = child.maxWidth;
  if (child.minHeight !== undefined && nh < child.minHeight) nh = child.minHeight;
  if (child.maxHeight !== undefined && nh > child.maxHeight) nh = child.maxHeight;

  return { x: nx, y: ny, width: nw, height: nh };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto Layout — recursive computation
// ─────────────────────────────────────────────────────────────────────────────

/** Which axis in the primary direction a child stretches */
type AutoLayoutAlign = 'min' | 'center' | 'max' | 'stretch';

/**
 * Resolve the size of an auto-layout frame based on its children.
 * If the frame has explicit width/height (not Hug Contents), returns those.
 * Otherwise computes from children.
/**
 * Resolve the size of an auto-layout frame based on its children.
 * Since the AutoLayout interface has no explicit width/height,
 * all frames are effectively "Hug Contents".
 */
export function resolveAutoLayoutSize(
  frame: Shape,
  children: Shape[],
  allShapes: Shape[],
): { width: number; height: number } {
  const al = frame.autoLayout!;
  const paddingW = al.paddingLeft + al.paddingRight;
  const paddingH = al.paddingTop + al.paddingBottom;

  const sorted = [...children].sort((a, b) => children.indexOf(a) - children.indexOf(b));

  if (al.direction === 'horizontal') {
    let cursorX = 0;
    let maxH = 0;
    for (let i = 0; i < sorted.length; i++) {
      const child = sorted[i];
      const sz = getChildAutoLayoutSize(child, allShapes);
      cursorX += sz.w;
      maxH = Math.max(maxH, sz.h);
      if (i < sorted.length - 1) cursorX += al.gap;
    }
    return { width: cursorX + paddingW, height: maxH + paddingH };
  } else {
    let cursorY = 0;
    let maxW = 0;
    for (let i = 0; i < sorted.length; i++) {
      const child = sorted[i];
      const sz = getChildAutoLayoutSize(child, allShapes);
      cursorY += sz.h;
      maxW = Math.max(maxW, sz.w);
      if (i < sorted.length - 1) cursorY += al.gap;
    }
    return { width: maxW + paddingW, height: cursorY + paddingH };
  }
}

/** Get the size a child contributes to an auto-layout parent. */
function getChildAutoLayoutSize(child: Shape, allShapes: Shape[]): NaturalSize {
  if (child.autoLayout) {
    const grandKids = allShapes.filter((s: Shape) => s.parentId === child.id);
    const sz = resolveAutoLayoutSize(child, grandKids, allShapes);
    return { w: sz.width, h: sz.height };
  }
  return getShapeNaturalSize(child);
}

/**
 * Compute the final layout for all children of an auto-layout frame.
 * Returns Map of childId → ComputedChildLayout (relative to frame's top-left).
 */
export function computeAutoLayoutChildren(
  frame: Shape,
  children: Shape[],
  allShapes: Shape[],
): Map<string, ComputedChildLayout> {
  const al = frame.autoLayout!;
  const results = new Map<string, ComputedChildLayout>();

  if (children.length === 0) return results;

  const fw = frame.width || 200;
  const fh = frame.height || 200;
  const paddingLeft = al.paddingLeft;
  const paddingTop = al.paddingTop;
  const paddingRight = al.paddingRight;
  const paddingBottom = al.paddingBottom;
  const gap = al.gap;

  // Sort by z-order (children array order)
  const sorted = [...children].sort((a, b) => children.indexOf(a) - children.indexOf(b));

  if (al.direction === 'horizontal') {
    const childSizes = sorted.map(c => getChildAutoLayoutSize(c, allShapes));
    const maxChildH = Math.max(...childSizes.map(s => s.h));

    // Total content width without trailing gap
    const contentW = childSizes.reduce((sum, s, i) => sum + s.w + (i < sorted.length - 1 ? gap : 0), 0);
    const contentAreaW = fw - paddingLeft - paddingRight;
    const remainingW = contentAreaW - contentW;

    // In Figma, remaining space in horizontal AL is distributed by justifyContent.
    // 'stretch' items get extra space; 'start'/'center'/'end' don't stretch.
    const justify = al.justifyContent ?? 'start';

    // Items that can stretch (only effective when justifyContent='start' with stretch children)
    const stretchCount = (justify === 'start' || justify === 'space-between')
      ? sorted.filter(c => (c as Shape).autoLayout?.alignItems === 'stretch').length
      : 0;
    const stretchW = stretchCount > 0 ? Math.max(0, remainingW) / stretchCount : 0;

    let cursorX = paddingLeft;

    for (let i = 0; i < sorted.length; i++) {
      const child = sorted[i];
      const sz = childSizes[i];
      const isStretch = stretchCount > 0 && (child as Shape).autoLayout?.alignItems === 'stretch';
      const actualW = isStretch ? sz.w + stretchW : sz.w;

      // Counter-axis alignment (alignItems)
      const align = al.alignItems ?? 'start';
      let cy = paddingTop;
      if (align === 'center') cy = paddingTop + (maxChildH - sz.h) / 2;
      else if (align === 'end') cy = paddingTop + (fh - paddingTop - paddingBottom) - sz.h;
      else if (align === 'stretch') cy = paddingTop; // counter-axis stretch = full height

      results.set(child.id, {
        x: cursorX,
        y: cy,
        width: actualW,
        height: align === 'stretch' ? fh - paddingTop - paddingBottom : sz.h,
      });

      cursorX += actualW + gap;
    }

    // Apply justifyContent (main axis alignment) — shift all children as a block
    const totalOccupied = cursorX - gap + paddingRight;
    const extraSpace = fw - totalOccupied;
    if (justify === 'center' && extraSpace > 0) {
      for (const [id, layout] of results) {
        results.set(id, { ...layout, x: layout.x + extraSpace / 2 });
      }
    } else if (justify === 'end' && extraSpace > 0) {
      for (const [id, layout] of results) {
        results.set(id, { ...layout, x: layout.x + extraSpace });
      }
    } else if (justify === 'space-between' && sorted.length > 1 && extraSpace > 0) {
      const spaceBetween = extraSpace / (sorted.length - 1);
      let shift = gap;
      for (let i = 1; i < sorted.length; i++) {
        const prevId = sorted[i - 1].id;
        const prevLayout = results.get(prevId)!;
        const prevRight = prevLayout.x + prevLayout.width + shift;
        const curLayout = results.get(sorted[i].id)!;
        results.set(sorted[i].id, { ...curLayout, x: prevRight + spaceBetween });
        shift = gap;
      }
    }
  } else {
    // Vertical layout
    const childSizes = sorted.map(c => getChildAutoLayoutSize(c, allShapes));
    const maxChildW = Math.max(...childSizes.map(s => s.w));

    const contentH = childSizes.reduce((sum, s, i) => sum + s.h + (i < sorted.length - 1 ? gap : 0), 0);
    const contentAreaH = fh - paddingTop - paddingBottom;
    const remainingH = contentAreaH - contentH;

    const justify = al.justifyContent ?? 'start';
    const stretchCount = (justify === 'start' || justify === 'space-between')
      ? sorted.filter(c => (c as Shape).autoLayout?.alignItems === 'stretch').length
      : 0;
    const stretchH = stretchCount > 0 ? Math.max(0, remainingH) / stretchCount : 0;

    let cursorY = paddingTop;

    for (let i = 0; i < sorted.length; i++) {
      const child = sorted[i];
      const sz = childSizes[i];
      const isStretch = stretchCount > 0 && (child as Shape).autoLayout?.alignItems === 'stretch';
      const actualH = isStretch ? sz.h + stretchH : sz.h;

      // Counter-axis alignment
      const align = al.alignItems ?? 'start';
      let cx = paddingLeft;
      if (align === 'center') cx = paddingLeft + (maxChildW - sz.w) / 2;
      else if (align === 'end') cx = paddingLeft + (fw - paddingLeft - paddingRight) - sz.w;
      else if (align === 'stretch') cx = paddingLeft; // counter-axis stretch = full width

      results.set(child.id, {
        x: cx,
        y: cursorY,
        width: align === 'stretch' ? fw - paddingLeft - paddingRight : sz.w,
        height: actualH,
      });

      cursorY += actualH + gap;
    }

    // Apply justifyContent
    const totalOccupied = cursorY - gap + paddingBottom;
    const extraSpace = fh - totalOccupied;
    if (justify === 'center' && extraSpace > 0) {
      for (const [id, layout] of results) {
        results.set(id, { ...layout, y: layout.y + extraSpace / 2 });
      }
    } else if (justify === 'end' && extraSpace > 0) {
      for (const [id, layout] of results) {
        results.set(id, { ...layout, y: layout.y + extraSpace });
      }
    } else if (justify === 'space-between' && sorted.length > 1 && extraSpace > 0) {
      const spaceBetween = extraSpace / (sorted.length - 1);
      for (let i = 1; i < sorted.length; i++) {
        const prevId = sorted[i - 1].id;
        const prevLayout = results.get(prevId)!;
        const prevBottom = prevLayout.y + prevLayout.height;
        const curLayout = results.get(sorted[i].id)!;
        results.set(sorted[i].id, { ...curLayout, y: prevBottom + spaceBetween });
      }
    }
  }

  return results;
}

/**
 * Compute the canvas-space position of a shape's top-left corner,
 * accounting for parent frame/group offsets (for text editing overlay).
 */
export function getShapeCanvasPosition(shape: Shape, allShapes: Shape[]): { x: number; y: number } {
  let x = shape.x;
  let y = shape.y;
  let current = shape;
  while (current.parentId) {
    const parent = allShapes.find(s => s.id === current.parentId);
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    current = parent;
  }
  return { x, y };
}
