/**
 * Pen Tool utilities for drawing bezier paths.
 * Handles point/handle math and SVG path generation.
 */

export interface PenPoint {
  x: number;
  y: number;
  /** Incoming handle (relative to point) — set on the previous point for the current segment */
  handleIn?: { x: number; y: number };
  /** Outgoing handle (relative to point) — set on this point for the next segment */
  handleOut?: { x: number; y: number };
}

/** Convert absolute handle coords to relative (from point origin) */
export function absToRel(abs: { x: number; y: number }, origin: PenPoint): { x: number; y: number } {
  return { x: abs.x - origin.x, y: abs.y - origin.y };
}

/** Convert relative handle coords to absolute */
export function relToAbs(rel: { x: number; y: number }, origin: PenPoint): { x: number; y: number } {
  return { x: rel.x + origin.x, y: rel.y + origin.y };
}

/**
 * Build a new PenPoint at (x, y) with optional handles.
 */
export function buildPenPoint(
  x: number,
  y: number,
  handleIn?: { x: number; y: number },
  handleOut?: { x: number; y: number },
): PenPoint {
  return { x, y, handleIn, handleOut };
}

/**
 * Convert an array of PenPoints to an SVG path data string.
 * Uses M (moveto), L (lineto), and C (cubic bezier) commands.
 */
export function pointsToSvgPath(pts: PenPoint[], closed: boolean): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];

    // A segment has a curve if prev has handleOut or curr has handleIn
    if (prev.handleOut || curr.handleIn) {
      // Cubic bezier: C cp1x cp1y cp2x cp2y x y
      // cp1 = prev's handleOut (absolute), or prev point if not set
      // cp2 = curr's handleIn (absolute), or curr point if not set
      const cp1 = prev.handleOut
        ? relToAbs(prev.handleOut, prev)
        : { x: prev.x, y: prev.y };
      const cp2 = curr.handleIn
        ? relToAbs(curr.handleIn, curr)
        : { x: curr.x, y: curr.y };
      d += ` C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)} ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
    } else {
      // Straight line
      d += ` L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
    }
  }

  if (closed) {
    // Close path: curve from last point back to first if handles exist
    const last = pts[pts.length - 1];
    const first = pts[0];
    if (last.handleOut || first.handleIn) {
      const cp1 = last.handleOut
        ? relToAbs(last.handleOut, last)
        : { x: last.x, y: last.y };
      const cp2 = first.handleIn
        ? relToAbs(first.handleIn, first)
        : { x: first.x, y: first.y };
      d += ` C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)} ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
    }
    d += ' Z';
  }

  return d;
}

/**
 * Get SVG path for the preview line from the last point to the cursor position.
 * Includes the actual curve if the last point has a handleOut.
 */
export function getPathPreviewToCursor(
  pts: PenPoint[],
  cursorX: number,
  cursorY: number,
): string {
  if (pts.length === 0) return '';
  const last = pts[pts.length - 1];

  if (last.handleOut) {
    const cp1 = relToAbs(last.handleOut, last);
    const cp2 = { x: cursorX, y: cursorY };
    return `M ${last.x.toFixed(2)} ${last.y.toFixed(2)} C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)} ${cursorX.toFixed(2)} ${cursorY.toFixed(2)}`;
  }

  // Straight line preview
  return `M ${last.x.toFixed(2)} ${last.y.toFixed(2)} L ${cursorX.toFixed(2)} ${cursorY.toFixed(2)}`;
}

/**
 * Update handleOut of a point and set the symmetric handleIn of the next point.
 * If altKey is held, breaks symmetry (independent handles).
 * If the next point doesn't exist yet (i.e., we're dragging the most recently added point),
 * the mirrored handle is stored as handleIn on the current point to be used when closing the path.
 */
export function updateSymmetricHandles(
  pts: PenPoint[],
  pointIndex: number,
  newHandleOutAbs: { x: number; y: number },
  breakSymmetry: boolean,
): PenPoint[] {
  const newPts = [...pts];
  const pt = { ...newPts[pointIndex] };
  pt.handleOut = absToRel(newHandleOutAbs, pt);
  newPts[pointIndex] = pt;

  // Mirror the handle to the next point's handleIn (symmetric)
  if (pointIndex + 1 < newPts.length && !breakSymmetry) {
    const next = { ...newPts[pointIndex + 1] };
    // Mirror: vector from point to handleOut, negated
    const dx = newHandleOutAbs.x - pt.x;
    const dy = newHandleOutAbs.y - pt.y;
    next.handleIn = { x: -dx, y: -dy };
    newPts[pointIndex + 1] = next;
  } else if (pointIndex + 1 >= newPts.length && !breakSymmetry) {
    // Next point doesn't exist yet - store the mirrored handle as handleIn on this point
    // so it can be used when closing the path back to this point
    const mirrored = mirrorHandle(pt, newHandleOutAbs);
    const updated = { ...newPts[pointIndex] };
    updated.handleIn = absToRel(mirrored, updated);
    newPts[pointIndex] = updated;
  }

  return newPts;
}

/**
 * Check if a point is near the first point (for path closing).
 */
export function isNearFirstPoint(
  pts: PenPoint[],
  cursorX: number,
  cursorY: number,
  threshold: number = 10,
): boolean {
  if (pts.length < 2) return false;
  const first = pts[0];
  const dx = cursorX - first.x;
  const dy = cursorY - first.y;
  return Math.sqrt(dx * dx + dy * dy) < threshold;
}

/**
 * Mirror a handle around a point (for Alt+drag to break symmetry).
 * Returns the mirrored absolute position.
 */
export function mirrorHandle(
  pt: PenPoint,
  handlePt: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: 2 * pt.x - handlePt.x,
    y: 2 * pt.y - handlePt.y,
  };
}
