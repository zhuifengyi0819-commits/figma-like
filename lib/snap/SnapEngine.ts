// lib/snap/SnapEngine.ts
// Smart Guides: real-time alignment, distance, center, and spacing snapping.
// Based on Figma's snap system with 8px threshold.

import type { SceneGraph } from '@/lib/scene-graph';
import type { AbsoluteTransform, SGNode } from '@/lib/scene-graph/types';

export interface SnapResult {
  /** Snap offset applied to the dragged object */
  snapX: number;
  snapY: number;
  /** Active snap lines: each line is { axis, position, sourceId } */
  verticalLines: SnapLine[];
  horizontalLines: SnapLine[];
  /** The distance moved (original delta + snap offset) */
  finalX: number;
  finalY: number;
}

export interface SnapLine {
  axis: 'x' | 'y';
  /** Position in canvas coordinates */
  position: number;
  /** ID of the node this snap line comes from */
  sourceId: string;
  /** Type of snap point */
  type: 'edge' | 'center' | 'spacing';
}

/** What to snap to */
export interface SnapTarget {
  nodeIds: string[];        // nodes to use as snap guides
  excludeIds: string[];    // exclude these (e.g. the node being dragged)
  margin?: number;          // additional margin beyond snap threshold
}

/** Snap configuration */
export interface SnapConfig {
  threshold: number;       // snap distance in pixels (default 8)
  enabled: boolean;         // master toggle
  snapToGrid: boolean;
  snapToNodes: boolean;
  snapToCanvas: boolean;    // snap to canvas center
}

const DEFAULT_CONFIG: SnapConfig = {
  threshold: 8,
  enabled: true,
  snapToGrid: false,
  snapToNodes: true,
  snapToCanvas: true,
};

export class SnapEngine {
  private config: SnapConfig;

  constructor(
    private sceneGraph: SceneGraph,
    config: Partial<SnapConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(config: Partial<SnapConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================
  // Snap Point Extraction
  // ============================================================

  /**
   * Get all snap points from a node (edges + center).
   */
  getSnapPoints(
    node: SGNode,
    abs: AbsoluteTransform
  ): { x: number; y: number; type: SnapLine['type'] }[] {
    const { x, y } = abs;
    const w = node.width;
    const h = node.height;

    return [
      { x: x,           y: y,           type: 'edge' },
      { x: x + w,       y: y,           type: 'edge' },
      { x: x,           y: y + h,       type: 'edge' },
      { x: x + w,       y: y + h,       type: 'edge' },
      { x: x + w / 2,   y: y + h / 2,   type: 'center' },
    ];
  }

  // ============================================================
  // Main Snap Calculation
  // ============================================================

  /**
   * Calculate snap for a moving object.
   * Returns the snapped offset and active snap lines.
   */
  snap(
    /** Current position of the dragged object */
    currentX: number,
    currentY: number,
    target: SnapTarget,
    draggingWidth: number,
    draggingHeight: number,
    /** Direction of drag (for spacing snap) */
    direction: 'horizontal' | 'vertical' | 'both' = 'both'
  ): SnapResult {
    if (!this.config.enabled) {
      return {
        snapX: 0, snapY: 0,
        verticalLines: [], horizontalLines: [],
        finalX: currentX, finalY: currentY,
      };
    }

    const { threshold } = this.config;
    const verticalLines: SnapLine[] = [];
    const horizontalLines: SnapLine[] = [];

    let bestSnapX = 0;
    let bestSnapY = 0;
    let bestDistX = Infinity;
    let bestDistY = Infinity;

    // Canvas center snap
    if (this.config.snapToCanvas) {
      const page = this.sceneGraph.getCurrentPage();
      if (page) {
        const canvasW = page.width ?? 1920;
        const canvasH = page.height ?? 1080;
        const canvasCenterX = canvasW / 2;
        const canvasCenterY = canvasH / 2;

        // Dragging object's center and edges
        const objCenterX = currentX + draggingWidth / 2;
        const objRightX = currentX + draggingWidth;
        const objCenterY = currentY + draggingHeight / 2;
        const objBottomY = currentY + draggingHeight;

        // Check canvas center X
        this.checkSnap(
          canvasCenterX, 'center', 'x',
          [currentX, objCenterX, objRightX],
          threshold, verticalLines, v => bestDistX = v, v => bestSnapX = v
        );
        // Check canvas center Y
        this.checkSnap(
          canvasCenterY, 'center', 'y',
          [currentY, objCenterY, objBottomY],
          threshold, horizontalLines, v => bestDistY = v, v => bestSnapY = v
        );
      }
    }

    // Node-based snapping
    if (this.config.snapToNodes) {
      const { nodeIds, excludeIds } = target;
      const excludeSet = new Set(excludeIds);

      for (const nodeId of nodeIds) {
        if (excludeSet.has(nodeId)) continue;

        const node = this.sceneGraph.getNode(nodeId);
        if (!node || !node.visible) continue;

        const abs = this.sceneGraph.getAbsoluteTransform(nodeId);
        const points = this.getSnapPoints(node, abs);

        for (const pt of points) {
          // Vertical snap (X axis)
          if (direction === 'both' || direction === 'horizontal') {
            this.checkSnap(
              pt.x, pt.type, 'x',
              [currentX, currentX + draggingWidth / 2, currentX + draggingWidth],
              threshold, verticalLines,
              _ => { /* dist tracked inline */ },
              snap => { bestSnapX = snap; bestDistX = Math.abs(snap); }
            );
          }

          // Horizontal snap (Y axis)
          if (direction === 'both' || direction === 'vertical') {
            this.checkSnap(
              pt.y, pt.type, 'y',
              [currentY, currentY + draggingHeight / 2, currentY + draggingHeight],
              threshold, horizontalLines,
              _ => { /* dist tracked inline */ },
              snap => { bestSnapY = snap; bestDistY = Math.abs(snap); }
            );
          }
        }
      }
    }

    return {
      snapX: bestSnapX,
      snapY: bestSnapY,
      verticalLines,
      horizontalLines,
      finalX: currentX + bestSnapX,
      finalY: currentY + bestSnapY,
    };
  }

  private checkSnap(
    targetPos: number,
    type: SnapLine['type'],
    axis: 'x' | 'y',
    dragPositions: number[],
    threshold: number,
    lines: SnapLine[],
    updateBestDist: (dist: number) => void,
    updateBestSnap: (snap: number) => void
  ): void {
    for (const dragPos of dragPositions) {
      const dist = Math.abs(targetPos - dragPos);
      if (dist <= threshold && dist < Math.abs(updateBestDist as any)) {
        lines.push({ axis, position: targetPos, sourceId: '', type });
        updateBestSnap(targetPos - dragPos);
      }
    }
  }

  // ============================================================
  // Spacing Snap
  // ============================================================

  /**
   * Find equal spacing between siblings.
   * Returns the snap offset to equalize spacing.
   */
  findSpacingSnap(
    draggingNodeId: string,
    siblingIds: string[],
    direction: 'horizontal' | 'vertical'
  ): number {
    if (siblingIds.length < 2) return 0;

    const draggingNode = this.sceneGraph.getNode(draggingNodeId);
    if (!draggingNode) return 0;

    const siblings = siblingIds
      .filter(id => id !== draggingNodeId)
      .map(id => this.sceneGraph.getNode(id))
      .filter((n): n is SGNode => n !== null && n.visible);

    if (siblings.length === 0) return 0;

    // Sort by position
    const sorted = [...siblings].sort((a, b) =>
      direction === 'horizontal' ? a.x - b.x : a.y - b.y
    );

    // Find the spacing between adjacent siblings
    let lastPos: number;
    let lastSize: number;
    if (direction === 'horizontal') {
      lastPos = sorted[0].x;
      lastSize = sorted[0].width;
    } else {
      lastPos = sorted[0].y;
      lastSize = sorted[0].height;
    }

    let equalSpacing: number | null = null;
    for (let i = 1; i < sorted.length; i++) {
      const s = sorted[i];
      const pos = direction === 'horizontal' ? s.x : s.y;
      const size = direction === 'horizontal' ? s.width : s.height;
      const gap = pos - (lastPos + lastSize);

      if (equalSpacing === null) {
        equalSpacing = gap;
      } else if (Math.abs(gap - equalSpacing) > 2) {
        return 0; // not equal spacing
      }

      lastPos = pos;
      lastSize = size;
    }

    return equalSpacing ?? 0;
  }

  // ============================================================
  // Smart Guides Rendering Data
  // ============================================================

  /**
   * Get all active snap lines as SVG path data.
   * Returns paths for rendering smart guides overlay.
   */
  getGuidePaths(
    verticalLines: SnapLine[],
    horizontalLines: SnapLine[],
    viewportBounds: { x: number; y: number; width: number; height: number }
  ): { path: string; color: string }[] {
    const paths: { path: string; color: string }[] = [];
    const gap = 4; // extend lines slightly beyond viewport

    for (const line of verticalLines) {
      const x = Math.round(line.position) + 0.5;
      paths.push({
        path: `M ${x} ${viewportBounds.y - gap} L ${x} ${viewportBounds.y + viewportBounds.height + gap}`,
        color: '#0D8AFF', // Figma blue
      });
    }

    for (const line of horizontalLines) {
      const y = Math.round(line.position) + 0.5;
      paths.push({
        path: `M ${viewportBounds.x - gap} ${y} L ${viewportBounds.x + viewportBounds.width + gap} ${y}`,
        color: '#0D8AFF',
      });
    }

    return paths;
  }
}
