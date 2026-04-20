/**
 * Boolean operations for shapes (union, subtract, intersect, exclude).
 * Uses the polygon-clipping library.
 */
import polygonClipping from 'polygon-clipping';
import type { Shape } from './types';
import { getShapeAABB } from './measurement';

type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

/** Convert a Shape to polygon-clipping format: [ [[x,y], [x,y], ...], ... ] (one ring) */
function shapeToPolygon(s: Shape): number[][][] {
  if (s.type === 'rect') {
    const x = s.x, y = s.y, w = s.width || 100, h = s.height || 100;
    return [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
  }
  if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') {
    const cx = s.x, cy = s.y;
    const r = s.radius || 50;
    const N = 64;
    const ring: number[][] = [];
    for (let i = 0; i < N; i++) {
      const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
      ring.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    ring.push([ring[0][0], ring[0][1]]); // close
    return [ring];
  }
  if (s.type === 'path' && s.pathPoints && s.pathPoints.length > 0) {
    const pts = s.pathPoints;
    const ring: number[][] = pts.map(p => [p.x + s.x, p.y + s.y]);
    if (s.closePath !== false && ring.length > 1) {
      ring.push([ring[0][0], ring[0][1]]);
    }
    return [ring];
  }
  // fallback: use AABB
  const b = getShapeAABB(s);
  return [[[b.left, b.top], [b.right, b.top], [b.right, b.bottom], [b.left, b.bottom], [b.left, b.top]]];
}

/** Convert polygon-clipping result to SVG path data string */
function polygonToSvgPath(result: number[][][]): string {
  if (!result || result.length === 0) return '';
  const parts: string[] = [];
  for (const ring of result) {
    if (!ring || ring.length < 2) continue;
    const [start, ...rest] = ring;
    parts.push(`M ${start[0].toFixed(2)} ${start[1].toFixed(2)}`);
    for (const [x, y] of rest) {
      parts.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    parts.push('Z');
  }
  return parts.join(' ');
}

/**
 * Compute boolean operation on two shapes.
 * Returns SVG path data string or empty string on failure.
 */
export function computeBooleanPath(shapeA: Shape, shapeB: Shape, op: BooleanOp): string {
  try {
    const polyA = shapeToPolygon(shapeA);
    const polyB = shapeToPolygon(shapeB);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (op) {
      case 'union':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = (polygonClipping.union as any)([polyA, polyB]);
        break;
      case 'subtract':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = (polygonClipping.difference as any)([polyA], [polyB]);
        break;
      case 'intersect':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = (polygonClipping.intersection as any)([polyA], [polyB]);
        break;
      case 'exclude':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = (polygonClipping.xor as any)([polyA], [polyB]);
        break;
    }

    return polygonToSvgPath(result);
  } catch (e) {
    console.error('Boolean operation failed:', e);
    return '';
  }
}

/** Check if a shape type supports boolean operations */
export function canDoBoolean(s: Shape): boolean {
  return s.type === 'rect' || s.type === 'circle' || s.type === 'star' || s.type === 'triangle' || s.type === 'path';
}
