// lib/transform/TransformEngine.ts
// Handles move, resize, rotate with all modifier key combinations.
// Based on Figma's transform system: 8 handles, corner-ratio scaling,
// rotation with Shift snapping, Alt center scaling, and Smart Guides.

import type { SceneGraph } from '@/lib/scene-graph';

export type ResizeHandle =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface TransformState {
  nodeId: string;
  startX: number;          // pointer start canvas x
  startY: number;          // pointer start canvas y
  startBounds: { x: number; y: number; width: number; height: number };
  handle: ResizeHandle | 'move' | 'rotate';
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export interface MoveResult {
  dx: number;              // total delta x
  dy: number;              // total delta y
  finalX: number;
  finalY: number;
}

export interface ResizeResult {
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  handle: ResizeHandle;
}

export interface RotateResult {
  x: number; y: number;
  width: number; height: number;
  rotation: number;        // degrees
}

export class TransformEngine {
  constructor(private sceneGraph: SceneGraph) {}

  // ============================================================
  // Move (Drag)
  // ============================================================

  /**
   * Compute new position from drag.
   */
  move(
    state: TransformState,
    currentX: number,
    currentY: number
  ): MoveResult {
    let dx = currentX - state.startX;
    let dy = currentY - state.startY;

    // Constrain to axis if Shift held
    if (state.shift) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }

    const node = this.sceneGraph.getNode(state.nodeId);
    if (!node) return { dx, dy, finalX: state.startX, finalY: state.startY };

    const abs = this.sceneGraph.getAbsoluteTransform(state.nodeId);

    return {
      dx, dy,
      finalX: abs.x + dx,
      finalY: abs.y + dy,
    };
  }

  /**
   * Update node position in scene graph after move.
   */
  commitMove(nodeId: string, dx: number, dy: number): void {
    const node = this.sceneGraph.getNode(nodeId);
    if (!node) return;

    // If node has a parent with rotation, we need to account for it
    const parentId = node.parentId;
    if (parentId) {
      const parent = this.sceneGraph.getNode(parentId);
      if (parent && parent.rotation !== 0) {
        // Rotate the delta by parent's inverse rotation
        const rad = (parent.rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rdx = dx * cos - dy * sin;
        const rdy = dx * sin + dy * cos;
        this.sceneGraph.updateNode(nodeId, {
          x: node.x + rdx,
          y: node.y + rdy,
        });
        return;
      }
    }

    this.sceneGraph.updateNode(nodeId, {
      x: node.x + dx,
      y: node.y + dy,
    });
  }

  // ============================================================
  // Resize
  // ============================================================

  private handleRatio: Record<ResizeHandle, { rx: number; ry: number; sx: number; sy: number }> = {
    'top-left':     { rx: 1, ry: 1, sx: -1, sy: -1 },
    'top-center':   { rx: 0, ry: 1, sx:  0, sy: -1 },
    'top-right':    { rx: 0, ry: 1, sx:  1, sy: -1 },
    'middle-left':  { rx: 1, ry: 0, sx: -1, sy:  0 },
    'middle-right': { rx: 0, ry: 0, sx:  1, sy:  0 },
    'bottom-left':  { rx: 1, ry: 0, sx: -1, sy:  1 },
    'bottom-center':{ rx: 0, ry: 0, sx:  0, sy:  1 },
    'bottom-right': { rx: 0, ry: 0, sx:  1, sy:  1 },
  };

  resize(
    state: TransformState,
    currentX: number,
    currentY: number
  ): ResizeResult {
    const { startX, startY, startBounds, handle } = state;
    let dx = currentX - startX;
    let dy = currentY - startY;

    // Flip signs based on handle
    const ratio = this.handleRatio[handle as ResizeHandle];
    if (ratio.rx) dx *= ratio.rx;
    if (ratio.ry) dy *= ratio.ry;

    let newX = startBounds.x;
    let newY = startBounds.y;
    let newW = startBounds.width;
    let newH = startBounds.height;

    // Apply deltas
    newW += dx * ratio.sx;
    newH += dy * ratio.sy;

    // Shift = maintain aspect ratio
    if (state.shift) {
      const aspect = startBounds.width / startBounds.height;
      if (Math.abs(dx * ratio.sx) > Math.abs(dy * ratio.sy)) {
        newH = newW / aspect;
      } else {
        newW = newH * aspect;
      }
    }

    // Enforce minimum size
    const minW = 1, minH = 1;
    if (newW < minW) { newW = minW; if (ratio.sx < 0) newX = startBounds.x + startBounds.width - minW; }
    if (newH < minH) { newH = minH; if (ratio.sy < 0) newY = startBounds.y + startBounds.height - minH; }

    // Alt = resize from center
    if (state.alt) {
      const dw = newW - startBounds.width;
      const dh = newH - startBounds.height;
      newX = startBounds.x - dw / 2;
      newY = startBounds.y - dh / 2;
      newW = newW;
      newH = newH;
    }

    const node = this.sceneGraph.getNode(state.nodeId);
    return {
      x: newX, y: newY,
      width: Math.round(newW),
      height: Math.round(newH),
      rotation: node?.rotation ?? 0,
      handle: handle as ResizeHandle,
    };
  }

  /**
   * Commit a resize to the scene graph.
   */
  commitResize(
    nodeId: string,
    result: ResizeResult,
    preserveChildren: boolean = true
  ): void {
    const node = this.sceneGraph.getNode(nodeId);
    if (!node) return;

    if (preserveChildren) {
      // Scale children proportionally
      const scaleX = result.width / node.width;
      const scaleY = result.height / node.height;
      const children = this.sceneGraph.getChildren(nodeId);
      for (const child of children) {
        this.sceneGraph.updateNode(child.id, {
          x: child.x * scaleX,
          y: child.y * scaleY,
          width: child.width * scaleX,
          height: child.height * scaleY,
        });
      }
    }

    this.sceneGraph.updateNode(nodeId, {
      x: result.x,
      y: result.y,
      width: result.width,
      height: result.height,
    });
  }

  // ============================================================
  // Rotate
  // ============================================================

  /**
   * Compute rotation from a drag starting at handle.
   * Returns angle in degrees.
   */
  rotate(
    state: TransformState,
    currentX: number,
    currentY: number
  ): number {
    const { startBounds } = state;
    const cx = startBounds.x + startBounds.width / 2;
    const cy = startBounds.y + startBounds.height / 2;

    const startAngle = Math.atan2(state.startY - cy, state.startX - cx);
    const currentAngle = Math.atan2(currentY - cy, currentX - cx);
    let delta = ((currentAngle - startAngle) * 180) / Math.PI;

    // Shift = snap to 15° increments
    if (state.shift) {
      delta = Math.round(delta / 15) * 15;
    }

    const node = this.sceneGraph.getNode(state.nodeId);
    const baseRotation = node?.rotation ?? 0;
    return baseRotation + delta;
  }

  /**
   * Commit rotation to the scene graph.
   */
  commitRotate(nodeId: string, rotation: number): void {
    this.sceneGraph.updateNode(nodeId, { rotation: rotation % 360 });
  }

  // ============================================================
  // Multi-Select Move/Resize
  // ============================================================

  /**
   * Move multiple nodes together.
   */
  moveMultiple(
    nodeIds: string[],
    dx: number,
    dy: number
  ): void {
    for (const id of nodeIds) {
      this.commitMove(id, dx, dy);
    }
  }

  /**
   * Get combined bounding box of multiple nodes.
   */
  getCombinedBounds(nodeIds: string[]): {
    x: number; y: number; width: number; height: number;
  } | null {
    if (nodeIds.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const id of nodeIds) {
      const node = this.sceneGraph.getNode(id);
      if (!node) continue;
      const abs = this.sceneGraph.getAbsoluteTransform(id);
      minX = Math.min(minX, abs.x);
      minY = Math.min(minY, abs.y);
      maxX = Math.max(maxX, abs.x + node.width);
      maxY = Math.max(maxY, abs.y + node.height);
    }

    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
}
