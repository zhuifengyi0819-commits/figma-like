// lib/selection/SelectionEngine.ts
// Handles all selection logic: single, multi, marquee, shift-add, cmd-penetrate, deep-select

import type { SceneGraph } from '@/lib/scene-graph';
import type { SGNode, MarqueeRect } from '@/lib/scene-graph/types';

export class SelectionEngine {
  constructor(
    private sceneGraph: SceneGraph,
    private onSelectionChange?: (ids: string[]) => void
  ) {}

  // ============================================================
  // Core Selection State
  // ============================================================

  /**
   * Check if a node is selected.
   */
  isSelected(selectedIds: string[], nodeId: string): boolean {
    return selectedIds.includes(nodeId);
  }

  /**
   * Check if multiple nodes are all selected.
   */
  areAllSelected(selectedIds: string[], nodeIds: string[]): boolean {
    return nodeIds.every(id => selectedIds.includes(id));
  }

  // ============================================================
  // Single Select
  // ============================================================

  /**
   * Select a single node (replacing current selection).
   */
  select(selectedIds: string[], nodeId: string): string[] {
    // Don't select locked or invisible nodes
    const node = this.sceneGraph.getNode(nodeId);
    if (!node || node.locked || !node.visible) return selectedIds;

    const result = [nodeId];
    this.onSelectionChange?.(result);
    return result;
  }

  /**
   * Toggle a node's selection.
   */
  toggle(selectedIds: string[], nodeId: string): string[] {
    const node = this.sceneGraph.getNode(nodeId);
    if (!node || node.locked || !node.visible) return selectedIds;

    const result = selectedIds.includes(nodeId)
      ? selectedIds.filter(id => id !== nodeId)
      : [...selectedIds, nodeId];

    this.onSelectionChange?.(result);
    return result;
  }

  // ============================================================
  // Multi Select
  // ============================================================

  /**
   * Add a node to selection (Shift+Click).
   */
  addToSelection(selectedIds: string[], nodeId: string): string[] {
    const node = this.sceneGraph.getNode(nodeId);
    if (!node || node.locked || !node.visible) return selectedIds;
    if (selectedIds.includes(nodeId)) return selectedIds;

    const result = [...selectedIds, nodeId];
    this.onSelectionChange?.(result);
    return result;
  }

  /**
   * Remove a node from selection (Shift+Click on already selected).
   */
  removeFromSelection(selectedIds: string[], nodeId: string): string[] {
    const result = selectedIds.filter(id => id !== nodeId);
    if (result.length !== selectedIds.length) {
      this.onSelectionChange?.(result);
    }
    return result;
  }

  /**
   * Select all visible/unlocked nodes under a context (or whole page).
   */
  selectAll(selectedIds: string[], contextId?: string): string[] {
    const context = contextId || this.sceneGraph.getCurrentPage()?.id;
    if (!context) return selectedIds;

    const allNodes: string[] = [];
    this.sceneGraph.traverse(node => {
      if (!node.locked && node.visible && node.id !== context) {
        allNodes.push(node.id);
      }
    }, context);

    this.onSelectionChange?.(allNodes);
    return allNodes;
  }

  /**
   * Clear all selection.
   */
  clearSelection(selectedIds: string[]): string[] {
    if (selectedIds.length === 0) return selectedIds;
    this.onSelectionChange?.([]);
    return [];
  }

  // ============================================================
  // Marquee (drag selection box)
  // ============================================================

  /**
   * Select all nodes intersecting a marquee rectangle.
   * In Figma: "contain" mode (node must be fully inside marquee for small nodes,
   * but intersection counts for large ones). We use intersection mode here.
   */
  selectWithMarquee(
    selectedIds: string[],
    marquee: MarqueeRect,
    contextId?: string,
    additive: boolean = false
  ): string[] {
    if (marquee.width === 0 && marquee.height === 0) {
      return additive ? selectedIds : [];
    }

    const intersected = this.sceneGraph.getNodesInRect(marquee, contextId ?? undefined, 'intersect');
    const newIds = intersected
      .filter(n => !n.locked && n.visible && n.id !== contextId)
      .map(n => n.id);

    const result = additive ? [...new Set([...selectedIds, ...newIds])] : newIds;
    this.onSelectionChange?.(result);
    return result;
  }

  /**
   * Given current selection and a marquee drag that started empty,
   * return the set of nodes that would be newly selected.
   */
  getMarqueeSelections(
    marquee: MarqueeRect,
    contextId?: string
  ): string[] {
    if (marquee.width === 0 && marquee.height === 0) return [];

    const intersected = this.sceneGraph.getNodesInRect(marquee, contextId ?? undefined, 'intersect');
    return intersected
      .filter(n => !n.locked && n.visible && n.id !== contextId)
      .map(n => n.id);
  }

  // ============================================================
  // Deep / Context Selection
  // ============================================================

  /**
   * Enter a container (frame/group) — used for double-click to enter.
   * Returns the container ID that is now the selection context.
   */
  enterContext(selectedIds: string[], nodeId: string): string | null {
    const node = this.sceneGraph.getNode(nodeId);
    if (!node) return null;

    // Only containers can be entered
    if (!this.isContainer(node)) return null;

    // Selection context is set to this node
    // Child nodes become the new selectable set
    return nodeId;
  }

  /**
   * Check if a node is a container (can have children).
   */
  isContainer(node: SGNode): boolean {
    return ['page', 'frame', 'group', 'component', 'instance', 'boolean'].includes(node.type);
  }

  /**
   * Find the deepest selectable node at a point (for click selection).
   * Returns topmost (highest z-index = last in render order).
   */
  getNodeAtPoint(
    x: number,
    y: number,
    contextId?: string
  ): SGNode | null {
    const nodes = this.sceneGraph.getNodesAtPoint(x, y);

    // Filter to context
    let candidates = nodes;
    if (contextId) {
      const contextNode = this.sceneGraph.getNode(contextId);
      const contextChildren = this.sceneGraph.getDescendants(contextId);
      const contextIds = new Set([contextId, ...contextChildren.map(n => n.id)]);
      candidates = nodes.filter(n => contextIds.has(n.id));
    }

    // Return first unlocked/visible
    return candidates.find(n => !n.locked && n.visible) || null;
  }

  /**
   * Get the next sibling up/down for keyboard navigation.
   */
  getNextNode(
    selectedIds: string[],
    direction: 'up' | 'down' | 'left' | 'right',
    contextId?: string
  ): string | null {
    if (selectedIds.length === 0) return null;

    const currentId = selectedIds[selectedIds.length - 1];
    const current = this.sceneGraph.getNode(currentId);
    if (!current) return null;

    // Get siblings (children of parent, or root nodes if no parent)
    const parentId = current.parentId || contextId;
    const siblings = parentId
      ? this.sceneGraph.getChildren(parentId).filter(n => !n.locked && n.visible)
      : (contextId ? this.sceneGraph.getDescendants(contextId).filter(n => !n.locked && n.visible) : []);

    const idx = siblings.findIndex(n => n.id === currentId);
    if (idx === -1) return null;

    switch (direction) {
      case 'up':
      case 'left':
        return siblings[Math.max(0, idx - 1)]?.id || null;
      case 'down':
      case 'right':
        return siblings[Math.min(siblings.length - 1, idx + 1)]?.id || null;
    }
  }

  // ============================================================
  // Selection Bounds
  // ============================================================

  /**
   * Compute the bounding box of selected nodes (in canvas coordinates).
   */
  getSelectionBounds(selectedIds: string[]): { x: number; y: number; width: number; height: number } | null {
    if (selectedIds.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const id of selectedIds) {
      const node = this.sceneGraph.getNode(id);
      if (!node) continue;

      const abs = this.sceneGraph.getAbsoluteTransform(id);
      minX = Math.min(minX, abs.x);
      minY = Math.min(minY, abs.y);
      maxX = Math.max(maxX, abs.x + node.width);
      maxY = Math.max(maxY, abs.y + node.height);
    }

    if (!isFinite(minX)) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Get the center point of selection.
   */
  getSelectionCenter(selectedIds: string[]): { x: number; y: number } | null {
    const bounds = this.getSelectionBounds(selectedIds);
    if (!bounds) return null;
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }

  // ============================================================
  // Layer Order
  // ============================================================

  /**
   * Get nodes sorted by z-index (render order: first = bottom, last = top).
   */
  getNodesByZOrder(selectedIds: string[]): SGNode[] {
    return this.sceneGraph.getNodesByIds(selectedIds);
  }

  /**
   * Bring selected nodes to front.
   */
  bringToFront(selectedIds: string[]): void {
    for (const id of selectedIds) {
      const parentId = this.sceneGraph.getNode(id)?.parentId;
      if (!parentId) continue;

      const siblings = this.sceneGraph.getChildren(parentId);
      const maxIndex = siblings.length - 1;
      this.sceneGraph.reorderNode(id, maxIndex);
    }
  }

  /**
   * Send selected nodes to back.
   */
  sendToBack(selectedIds: string[]): void {
    for (const id of [...selectedIds].reverse()) {
      const parentId = this.sceneGraph.getNode(id)?.parentId;
      if (!parentId) continue;
      this.sceneGraph.reorderNode(id, 0);
    }
  }

  /**
   * Bring selected nodes forward by one position.
   */
  bringForward(selectedIds: string[]): void {
    for (const id of [...selectedIds].reverse()) {
      const idx = this.sceneGraph.getIndexInParent(id);
      if (idx < 0) continue;
      this.sceneGraph.reorderNode(id, idx + 1);
    }
  }

  /**
   * Send selected nodes backward by one position.
   */
  sendBackward(selectedIds: string[]): void {
    for (const id of selectedIds) {
      const idx = this.sceneGraph.getIndexInParent(id);
      if (idx <= 0) continue;
      this.sceneGraph.reorderNode(id, idx - 1);
    }
  }
}
