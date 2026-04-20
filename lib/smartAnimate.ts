/**
 * Smart Animate: automatically infer the best transition type
 * based on property changes between two frames.
 */

import { Shape } from '@/lib/types';

export type TransitionType = 'instant' | 'dissolve' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' | 'scale';

export interface PropertyDiff {
  property: keyof Shape;
  from: unknown;
  to: unknown;
}

const ANIMATABLE_PROPERTIES: (keyof Shape)[] = [
  'x', 'y', 'width', 'height', 'opacity', 'rotation', 'fill', 'stroke',
];

/**
 * Compare two shapes and return a list of property differences.
 * Only considers animatable properties: x, y, width, height,
 * opacity, rotation, fill, stroke
 */
export function computePropertyDiff(shapeA: Shape, shapeB: Shape): PropertyDiff[] {
  const diffs: PropertyDiff[] = [];

  for (const prop of ANIMATABLE_PROPERTIES) {
    const valA = shapeA[prop];
    const valB = shapeB[prop];

    // Handle undefined/null vs defined values
    if (valA !== valB) {
      // Skip if both are undefined/null
      if (valA === undefined && valB === undefined) continue;
      // Skip numeric zero vs undefined edge case for dimensions
      if ((prop === 'width' || prop === 'height') && !valA && !valB) continue;
      diffs.push({ property: prop, from: valA, to: valB });
    }
  }

  return diffs;
}

/**
 * Categorize diffs by type of change
 */
function categorizeDiffs(diffs: PropertyDiff[]): {
  positionOnly: boolean;
  sizeOnly: boolean;
  opacityOrColorOnly: boolean;
  multipleTypes: boolean;
  hasPosition: boolean;
  hasSize: boolean;
  hasOpacityOrColor: boolean;
} {
  const hasPosition = diffs.some(d => d.property === 'x' || d.property === 'y');
  const hasSize = diffs.some(d => d.property === 'width' || d.property === 'height');
  const hasOpacityOrColor = diffs.some(d =>
    d.property === 'opacity' || d.property === 'fill' || d.property === 'stroke'
  );

  const positionOnly = hasPosition && !hasSize && !hasOpacityOrColor;
  const sizeOnly = hasSize && !hasPosition && !hasOpacityOrColor;
  const opacityOrColorOnly = hasOpacityOrColor && !hasPosition && !hasSize;
  const multipleTypes = (hasPosition ? 1 : 0) + (hasSize ? 1 : 0) + (hasOpacityOrColor ? 1 : 0) > 1;

  return {
    positionOnly,
    sizeOnly,
    opacityOrColorOnly,
    multipleTypes,
    hasPosition,
    hasSize,
    hasOpacityOrColor,
  };
}

/**
 * Given a list of property diffs, infer the best transition type.
 * - Only position changes → slide (direction inferred from x/y delta)
 * - Only size (width/height) change → scale
 * - Only opacity or fill change → dissolve
 * - Multiple property types → dissolve (Figma default)
 * - No obvious diff → instant
 */
export function inferTransition(diffs: PropertyDiff[]): {
  transition: TransitionType;
  auto: boolean;
} {
  if (diffs.length === 0) {
    return { transition: 'instant', auto: true };
  }

  const cats = categorizeDiffs(diffs);

  if (cats.positionOnly) {
    // Will be handled by inferSlideDirection at runtime
    return { transition: 'dissolve', auto: true };
  }

  if (cats.sizeOnly) {
    return { transition: 'scale', auto: true };
  }

  if (cats.opacityOrColorOnly) {
    return { transition: 'dissolve', auto: true };
  }

  if (cats.multipleTypes) {
    return { transition: 'dissolve', auto: true };
  }

  // Default
  return { transition: 'instant', auto: true };
}

/**
 * Given two shape objects, return the direction of slide transition
 * if only position changed.
 */
export function inferSlideDirection(
  fromShape: Shape,
  toShape: Shape
): 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' {
  const dx = (toShape.x || 0) - (fromShape.x || 0);
  const dy = (toShape.y || 0) - (fromShape.y || 0);

  // Use absolute values to determine dominant direction
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx >= absDy) {
    // Horizontal movement
    return dx > 0 ? 'slideLeft' : 'slideRight';
  } else {
    // Vertical movement
    return dy > 0 ? 'slideUp' : 'slideDown';
  }
}

/**
 * Find a matching shape in the target frame for smart animate comparison.
 * Matches by id first, then by name.
 */
export function findMatchingShape(
  sourceShape: Shape,
  targetFrameShapes: Shape[]
): Shape | null {
  // First try to match by id
  const byId = targetFrameShapes.find(s => s.id === sourceShape.id);
  if (byId) return byId;

  // Fall back to matching by name (case-insensitive)
  const byName = targetFrameShapes.find(
    s => s.name.toLowerCase() === sourceShape.name.toLowerCase()
  );
  return byName || null;
}

/**
 * Get all shapes from a frame including nested children recursively.
 */
export function getFrameShapes(frame: Shape, allShapes: Shape[]): Shape[] {
  const result: Shape[] = [];
  const collectChildren = (parentId: string) => {
    const children = allShapes.filter(s => s.parentId === parentId);
    for (const child of children) {
      result.push(child);
      collectChildren(child.id);
    }
  };
  collectChildren(frame.id);
  return result;
}

/**
 * Main smart animate function: given source shape, source frame, target frame,
 * and all shapes, compute the appropriate transition.
 */
export function computeSmartTransition(
  sourceShape: Shape,
  sourceFrame: Shape,
  targetFrame: Shape,
  allShapes: Shape[]
): {
  transition: TransitionType;
  auto: boolean;
} {
  // Get shapes in target frame
  const targetFrameShapes = getFrameShapes(targetFrame, allShapes);

  // Find matching shape in target frame
  const matchingShape = findMatchingShape(sourceShape, targetFrameShapes);
  if (!matchingShape) {
    // No matching shape found - can't do smart animate
    return { transition: 'instant', auto: true };
  }

  // Compute diffs between source shape and matching shape in target
  const diffs = computePropertyDiff(sourceShape, matchingShape);

  if (diffs.length === 0) {
    return { transition: 'instant', auto: true };
  }

  const cats = categorizeDiffs(diffs);

  // If only position changed, use slide direction based on delta
  if (cats.positionOnly && !cats.sizeOnly && !cats.opacityOrColorOnly) {
    return {
      transition: inferSlideDirection(sourceShape, matchingShape),
      auto: true,
    };
  }

  return inferTransition(diffs);
}
