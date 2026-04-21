/**
 * Mask utilities for Figma-style masking.
 * A shape designated as "mask source" clips all shapes that come after it
 * in the layer panel (siblings).
 */
import type { Shape } from './types';

/**
 * Find the mask source shape by its id.
 */
export function getMaskSource(shape: Shape, allShapes: Shape[]): Shape | null {
  if (!shape.maskSourceId) return null;
  return allShapes.find(s => s.id === shape.maskSourceId) || null;
}

/**
 * Get all shapes that should be masked by a given mask source.
 * These are all siblings that come AFTER the mask source in the sibling list.
 */
export function getMaskedShapes(maskSource: Shape, siblingShapes: Shape[]): Shape[] {
  const maskIdx = siblingShapes.findIndex(s => s.id === maskSource.id);
  if (maskIdx === -1) return [];
  // All shapes after the mask source in the array
  return siblingShapes.slice(maskIdx + 1);
}

/**
 * Check if applying a mask would create a circular reference.
 * A circular reference occurs if shape A is set to mask shape B,
 * but shape B already masks shape A.
 */
export function wouldCreateCircularMask(maskSourceId: string, targetShapeId: string, allShapes: Shape[]): boolean {
  const visited = new Set<string>();
  let currentId: string | undefined = maskSourceId;

  while (currentId) {
    if (visited.has(currentId)) return true; // Circular detected
    if (currentId === targetShapeId) return true; // targetShapeId is in the mask chain of maskSourceId
    visited.add(currentId);
    const shape = allShapes.find(s => s.id === currentId);
    currentId = shape?.maskSourceId;
  }

  return false;
}

/**
 * Return a clipFunc that draws the mask source shape's geometry.
 * This is used with Konva's clipFunc property.
 */
export function getClipFunc(maskSource: Shape): (ctx: CanvasRenderingContext2D) => void {
  return (ctx: CanvasRenderingContext2D) => {
    ctx.save();

    switch (maskSource.type) {
      case 'rect':
      case 'frame': {
        const x = maskSource.x;
        const y = maskSource.y;
        const w = maskSource.width || 100;
        const h = maskSource.height || 100;
        const r = maskSource.cornerRadius || 0;
        const radius = typeof r === 'number' ? r : r[0];
        if (radius > 0) {
          // Rounded rectangle
          const rad = Math.min(radius, Math.min(w, h) / 2);
          ctx.beginPath();
          ctx.moveTo(x + rad, y);
          ctx.lineTo(x + w - rad, y);
          ctx.arcTo(x + w, y, x + w, y + rad, rad);
          ctx.lineTo(x + w, y + h - rad);
          ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
          ctx.lineTo(x + rad, y + h);
          ctx.arcTo(x, y + h, x, y + h - rad, rad);
          ctx.lineTo(x, y + rad);
          ctx.arcTo(x, y, x + rad, y, rad);
          ctx.closePath();
        } else {
          ctx.rect(x, y, w, h);
        }
        break;
      }
      case 'circle': {
        const cx = maskSource.x;
        const cy = maskSource.y;
        const r = maskSource.radius || 50;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2);
        ctx.closePath();
        break;
      }
      case 'star': {
        const cx = maskSource.x;
        const cy = maskSource.y;
        const outerR = maskSource.radius || 50;
        const innerR = maskSource.innerRadius || outerR * 0.4;
        const numPoints = maskSource.numPoints || 5;
        ctx.beginPath();
        for (let i = 0; i < numPoints * 2; i++) {
          const angle = (i * Math.PI) / numPoints - Math.PI / 2;
          const radius = i % 2 === 0 ? outerR : innerR;
          const px = cx + radius * Math.cos(angle);
          const py = cy + radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'triangle': {
        const cx = maskSource.x;
        const cy = maskSource.y;
        const r = maskSource.radius || 50;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2;
          const px = cx + r * Math.cos(angle);
          const py = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'path': {
        if (maskSource.pathData) {
          const path2d = new Path2D(maskSource.pathData);
          ctx.fill(path2d);
        } else if (maskSource.pathPoints && maskSource.pathPoints.length > 0) {
          const pts = maskSource.pathPoints;
          ctx.beginPath();
          ctx.moveTo(pts[0].x + maskSource.x, pts[0].y + maskSource.y);
          for (let i = 1; i < pts.length; i++) {
            const prev = pts[i - 1];
            const pt = pts[i];
            if (prev.cp2 || pt.cp1) {
              const c1x = (prev.cp2?.x ?? prev.x) + maskSource.x;
              const c1y = (prev.cp2?.y ?? prev.y) + maskSource.y;
              const c2x = (pt.cp1?.x ?? pt.x) + maskSource.x;
              const c2y = (pt.cp1?.y ?? pt.y) + maskSource.y;
              ctx.bezierCurveTo(c1x, c1y, c2x, c2y, pt.x + maskSource.x, pt.y + maskSource.y);
            } else {
              ctx.lineTo(pt.x + maskSource.x, pt.y + maskSource.y);
            }
          }
          if (maskSource.closePath) ctx.closePath();
        }
        break;
      }
      default: {
        // Fallback: use bounding box
        const x = maskSource.x;
        const y = maskSource.y;
        const w = maskSource.width || (maskSource.radius ? (maskSource.radius as number) * 2 : 100);
        const h = maskSource.height || (maskSource.radius ? (maskSource.radius as number) * 2 : 100);
        ctx.rect(x, y, w, h);
        break;
      }
    }

    ctx.restore();
  };
}

/**
 * Check if a shape can be used as a mask source.
 * Some shape types don't support masking (e.g., text without a fill, lines).
 */
export function canBeMaskSource(shape: Shape): boolean {
  // Only closed shapes with area can be masks
  switch (shape.type) {
    case 'rect':
    case 'frame':
    case 'circle':
    case 'star':
    case 'triangle':
    case 'path':
    case 'component':
    case 'group':
      return true;
    default:
      return false;
  }
}
