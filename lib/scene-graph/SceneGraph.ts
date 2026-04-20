// lib/scene-graph/SceneGraph.ts
// Core Scene Graph engine — tree structure with O(1) node lookup
// Replaces flat shapes[] with true hierarchical tree

import { nanoid } from 'nanoid';
import type {
  SGNode,
  SGNodeType,
  PageNode,
  FrameNode,
  GroupNode,
  RectangleNode,
  EllipseNode,
  TextNode,
  LineNode,
  PolygonNode,
  StarNode,
  PenNode,
  ImageNode,
  StickyNode,
  ComponentNode,
  InstanceNode,
  BooleanNode,
  AbsoluteTransform,
  SgDocument,
} from './types';

// ============================================================
// SceneGraph
// ============================================================

export class SceneGraph {
  private _document: SgDocument;
  // NodeMap: id → node (O(1) lookup)
  private nodeMap: Map<string, SGNode> = new Map();
  // Dirty tracking for incremental rendering
  private dirtyNodes: Set<string> = new Set();

  constructor(document?: SgDocument) {
    this._document = document || this.createEmptyDocument();
  }

  // ============================================================
  // Document
  // ============================================================

  get document(): SgDocument {
    return this._document;
  }

  private createEmptyDocument(): SgDocument {
    const pageId = nanoid();
    const page: PageNode = {
      id: pageId,
      type: 'page',
      name: 'Page 1',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      blendMode: 'normal',
      parentId: null,
      children: [],
    };

    const doc: SgDocument = {
      id: nanoid(),
      name: 'Untitled',
      lastModified: new Date().toISOString(),
      schemaVersion: 1,
      pages: [pageId],
    };

    this.nodeMap.set(pageId, page);
    return doc;
  }

  // ============================================================
  // Node Access (O(1))
  // ============================================================

  getNode(id: string): SGNode | null {
    return this.nodeMap.get(id) || null;
  }

  hasNode(id: string): boolean {
    return this.nodeMap.has(id);
  }

  getAllNodes(): SGNode[] {
    return Array.from(this.nodeMap.values());
  }

  // ============================================================
  // Hierarchy Access
  // ============================================================

  getParent(nodeId: string): SGNode | null {
    const node = this.getNode(nodeId);
    if (!node || !node.parentId) return null;
    return this.getNode(node.parentId);
  }

  getChildren(parentId: string): SGNode[] {
    const parent = this.getNode(parentId);
    if (!parent) return [];
    return parent.children
      .map(id => this.getNode(id))
      .filter((n): n is SGNode => n !== null);
  }

  getDescendants(nodeId: string): SGNode[] {
    const result: SGNode[] = [];
    const stack = [...(this.getNode(nodeId)?.children || [])];

    while (stack.length > 0) {
      const id = stack.pop()!;
      const node = this.getNode(id);
      if (!node) continue;
      result.push(node);
      stack.push(...node.children);
    }

    return result;
  }

  getAncestors(nodeId: string): SGNode[] {
    const ancestors: SGNode[] = [];
    let current = this.getParent(nodeId);

    while (current) {
      ancestors.push(current);
      current = this.getParent(current.id);
    }

    return ancestors;
  }

  // ============================================================
  // Page Access
  // ============================================================

  get pages(): PageNode[] {
    return this._document.pages
      .map(id => this.getNode(id))
      .filter((n): n is PageNode => n !== null && n.type === 'page');
  }

  getPage(pageId: string): PageNode | null {
    const node = this.getNode(pageId);
    return node?.type === 'page' ? node : null;
  }

  getCurrentPage(): PageNode | null {
    // For now, return first page
    // TODO: support multiple pages with currentPageId in store
    const pageId = this._document.pages[0];
    return pageId ? this.getPage(pageId) : null;
  }

  // ============================================================
  // Tree Traversal
  // ============================================================

  /**
   * Depth-first traversal, calling callback on each node.
   * If rootId is provided, traverse from that node's children.
   * If rootId is null, traverse from all pages.
   */
  traverse(callback: (node: SGNode) => void, rootId?: string | null): void {
    let stack: SGNode[];

    if (rootId === undefined) {
      // Traverse all pages
      stack = this.pages.slice();
    } else if (rootId === null) {
      // Same as undefined
      stack = this.pages.slice();
    } else {
      const root = this.getNode(rootId);
      stack = root ? [root] : [];
    }

    while (stack.length > 0) {
      // Pop from stack (depth-first)
      const node = stack.pop()!;
      callback(node);
      // Push children in reverse order so first child is processed first
      const children = this.getChildren(node.id).reverse();
      stack.push(...children);
    }
  }

  /**
   * Breadth-first traversal.
   */
  traverseBreadth(callback: (node: SGNode) => void, rootId?: string | null): void {
    let queue: SGNode[];

    if (rootId === undefined || rootId === null) {
      queue = this.pages.slice();
    } else {
      const root = this.getNode(rootId);
      queue = root ? [root] : [];
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      callback(node);
      queue.push(...this.getChildren(node.id));
    }
  }

  /**
   * Iterate only leaf nodes (nodes without children).
   */
  traverseLeaves(callback: (node: SGNode) => void, rootId?: string | null): void {
    this.traverse(node => {
      if (node.children.length === 0) {
        callback(node);
      }
    }, rootId);
  }

  // ============================================================
  // Absolute Transform (recursive calculation)
  // ============================================================

  /**
   * Compute absolute transform for a node, accounting for all ancestors.
   */
  getAbsoluteTransform(nodeId: string): AbsoluteTransform {
    const node = this.getNode(nodeId);
    if (!node) {
      return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    }

    if (!node.parentId) {
      return {
        x: node.x,
        y: node.y,
        rotation: node.rotation || 0,
        scaleX: 1,
        scaleY: 1,
      };
    }

    const parentAbs = this.getAbsoluteTransform(node.parentId);

    // Simplified rotation composition (doesn't handle nested rotation correctly without full matrix math)
    const rotation = parentAbs.rotation + (node.rotation || 0);

    return {
      x: parentAbs.x + node.x,
      y: parentAbs.y + node.y,
      rotation,
      scaleX: parentAbs.scaleX,
      scaleY: parentAbs.scaleY,
    };
  }

  /**
   * Get the bounding box of a node and all its descendants.
   */
  getSubtreeBounds(nodeId: string): { x: number; y: number; width: number; height: number } | null {
    const node = this.getNode(nodeId);
    if (!node) return null;

    const abs = this.getAbsoluteTransform(nodeId);
    const descendants = this.getDescendants(nodeId);

    if (descendants.length === 0) {
      return { x: abs.x, y: abs.y, width: node.width, height: node.height };
    }

    let minX = abs.x;
    let minY = abs.y;
    let maxX = abs.x + node.width;
    let maxY = abs.y + node.height;

    for (const desc of descendants) {
      const descAbs = this.getAbsoluteTransform(desc.id);
      minX = Math.min(minX, descAbs.x);
      minY = Math.min(minY, descAbs.y);
      maxX = Math.max(maxX, descAbs.x + desc.width);
      maxY = Math.max(maxY, descAbs.y + desc.height);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  // ============================================================
  // Tree Operations (CRUD)
  // ============================================================

  /**
   * Add a new node to the graph. ID is auto-generated if not provided.
   */
  addNode<T extends SGNode>(node: T, parentId: string, index?: number): T {
    const parent = this.getNode(parentId);
    if (!parent) {
      throw new Error(`Parent node ${parentId} not found`);
    }

    // Validate node
    if (!node.id) {
      node.id = nanoid();
    }
    node.parentId = parentId;

    // Register node
    this.nodeMap.set(node.id, node);

    // Add to parent's children
    const children = [...parent.children];
    if (index !== undefined) {
      children.splice(index, 0, node.id);
    } else {
      children.push(node.id);
    }
    parent.children = children;

    // Mark parent as dirty
    this.markDirty(parentId);

    return node;
  }

  /**
   * Remove a node and all its descendants.
   */
  removeNode(nodeId: string): void {
    const node = this.getNode(nodeId);
    if (!node) return;

    // Recursively remove all descendants
    for (const childId of node.children) {
      this.removeNode(childId);
    }

    // Remove from parent's children
    if (node.parentId) {
      const parent = this.getNode(node.parentId);
      if (parent) {
        parent.children = parent.children.filter(id => id !== nodeId);
        this.markDirty(parent.id);
      }
    }

    // Remove from nodeMap
    this.nodeMap.delete(nodeId);
    this.markDirty(nodeId);
  }

  /**
   * Move a node to a new parent at optional index.
   */
  moveNode(nodeId: string, newParentId: string, index?: number): void {
    const node = this.getNode(nodeId);
    if (!node) return;

    // Prevent moving a node into its own subtree
    if (this.isDescendant(newParentId, nodeId)) {
      throw new Error(`Cannot move a node into its own subtree`);
    }

    const oldParentId = node.parentId;

    // Remove from old parent
    if (oldParentId) {
      const oldParent = this.getNode(oldParentId);
      if (oldParent) {
        oldParent.children = oldParent.children.filter(id => id !== nodeId);
        this.markDirty(oldParentId);
      }
    }

    // Add to new parent
    const newParent = this.getNode(newParentId);
    if (!newParent) {
      throw new Error(`New parent node ${newParentId} not found`);
    }

    node.parentId = newParentId;
    const children = [...newParent.children];
    if (index !== undefined) {
      children.splice(index, 0, nodeId);
    } else {
      children.push(nodeId);
    }
    newParent.children = children;

    this.markDirty(nodeId);
    this.markDirty(newParentId);
  }

  /**
   * Reorder a node within its current parent (change index).
   */
  reorderNode(nodeId: string, newIndex: number): void {
    const node = this.getNode(nodeId);
    if (!node || !node.parentId) return;

    const parent = this.getNode(node.parentId);
    if (!parent) return;

    const currentIndex = parent.children.indexOf(nodeId);
    if (currentIndex === -1) return;

    const children = [...parent.children];
    children.splice(currentIndex, 1);
    children.splice(newIndex, 0, nodeId);
    parent.children = children;

    this.markDirty(parent.id);
  }

  /**
   * Duplicate a node and all its descendants.
   * Returns the ID of the new root node.
   */
  cloneNode(nodeId: string, newParentId: string, offset = { x: 20, y: 20 }): string {
    const original = this.getNode(nodeId);
    if (!original) throw new Error(`Node ${nodeId} not found`);

    const clone = this.cloneSubtree(original, newParentId, offset);
    return clone.id;
  }

  private cloneSubtree(node: SGNode, parentId: string, offset: { x: number; y: number }): SGNode {
    // Deep clone
    const clone = JSON.parse(JSON.stringify(node)) as SGNode;
    const oldId = clone.id;
    clone.id = nanoid();
    clone.parentId = parentId;
    clone.name = `${clone.name} Copy`;

    // Apply offset to position
    clone.x += offset.x;
    clone.y += offset.y;

    // Register clone
    this.nodeMap.set(clone.id, clone);

    // Recursively clone children
    const childClones: string[] = [];
    for (const childId of node.children) {
      const child = this.getNode(childId);
      if (child) {
        const clonedChild = this.cloneSubtree(child, clone.id, offset);
        childClones.push(clonedChild.id);
      }
    }
    clone.children = childClones;

    return clone;
  }

  /**
   * Check if potentialAncestorId is an ancestor of nodeId.
   */
  isDescendant(nodeId: string, potentialAncestorId: string): boolean {
    const ancestors = this.getAncestors(nodeId);
    return ancestors.some(a => a.id === potentialAncestorId);
  }

  // ============================================================
  // Node Property Updates
  // ============================================================

  updateNode<T extends SGNode>(nodeId: string, updates: Partial<T>): void {
    const node = this.getNode(nodeId);
    if (!node) return;

    Object.assign(node, updates);
    this.markDirty(nodeId);
  }

  setNodePosition(nodeId: string, x: number, y: number): void {
    this.updateNode(nodeId, { x, y });
  }

  setNodeSize(nodeId: string, width: number, height: number): void {
    this.updateNode(nodeId, { width, height });
  }

  setNodeOpacity(nodeId: string, opacity: number): void {
    this.updateNode(nodeId, { opacity: Math.max(0, Math.min(1, opacity)) });
  }

  setNodeVisible(nodeId: string, visible: boolean): void {
    this.updateNode(nodeId, { visible });
  }

  setNodeLocked(nodeId: string, locked: boolean): void {
    this.updateNode(nodeId, { locked });
  }

  setNodeName(nodeId: string, name: string): void {
    this.updateNode(nodeId, { name });
  }

  // ============================================================
  // Dirty Tracking (for incremental rendering)
  // ============================================================

  markDirty(nodeId: string): void {
    this.dirtyNodes.add(nodeId);
  }

  getDirtyNodes(): string[] {
    return Array.from(this.dirtyNodes);
  }

  clearDirty(): void {
    this.dirtyNodes.clear();
  }

  isDirty(nodeId: string): boolean {
    return this.dirtyNodes.has(nodeId);
  }

  // ============================================================
  // Query Methods
  // ============================================================

  /**
   * Find all nodes of a specific type.
   */
  findNodesByType<T extends SGNode>(type: SGNodeType): T[] {
    return this.getAllNodes().filter(
      (n): n is T => n.type === type
    );
  }

  /**
   * Find a node by name (exact match).
   */
  findNodeByName(name: string): SGNode | null {
    for (const node of this.nodeMap.values()) {
      if (node.name === name) return node;
    }
    return null;
  }

  /**
   * Search nodes by name (partial match, case-insensitive).
   */
  searchNodes(query: string): SGNode[] {
    const q = query.toLowerCase();
    return this.getAllNodes().filter(n => n.name.toLowerCase().includes(q));
  }

  /**
   * Get nodes at a specific canvas position (for hit testing).
   * Returns topmost first.
   */
  getNodesAtPoint(x: number, y: number): SGNode[] {
    const result: SGNode[] = [];

    this.traverse(node => {
      if (!node.visible || node.locked) return;

      const abs = this.getAbsoluteTransform(node.id);
      if (
        x >= abs.x &&
        x <= abs.x + node.width &&
        y >= abs.y &&
        y <= abs.y + node.height
      ) {
        result.push(node);
      }
    });

    // Return in render order (last = topmost)
    return result.reverse();
  }

  /**
   * Get nodes within a rectangular area (for marquee selection).
   * mode 'intersect': node intersects the rectangle
   * mode 'contain': node is fully contained within the rectangle
   */
  getNodesInRect(
    rect: { x: number; y: number; width: number; height: number },
    rootId?: string,
    mode: 'intersect' | 'contain' = 'intersect'
  ): SGNode[] {
    const result: SGNode[] = [];

    this.traverse(node => {
      if (!node.visible || node.locked) return;
      if (node.id === rootId) return; // Don't select the container itself

      const abs = this.getAbsoluteTransform(node.id);
      const nodeRect = { x: abs.x, y: abs.y, width: node.width, height: node.height };

      const intersects = !(
        nodeRect.x > rect.x + rect.width ||
        nodeRect.x + nodeRect.width < rect.x ||
        nodeRect.y > rect.y + rect.height ||
        nodeRect.y + nodeRect.height < rect.y
      );

      const contains =
        nodeRect.x >= rect.x &&
        nodeRect.y >= rect.y &&
        nodeRect.x + nodeRect.width <= rect.x + rect.width &&
        nodeRect.y + nodeRect.height <= rect.y + rect.height;

      if (mode === 'intersect' ? intersects : contains) {
        result.push(node);
      }
    }, rootId);

    return result;
  }

  /**
   * Get nodes by their IDs (preserving order).
   */
  getNodesByIds(ids: string[]): SGNode[] {
    return ids.map(id => this.getNode(id)).filter((n): n is SGNode => n !== null);
  }

  /**
   * Get the depth of a node in the tree (root = 0).
   */
  getDepth(nodeId: string): number {
    return this.getAncestors(nodeId).length;
  }

  /**
   * Get the index of a node within its parent's children list.
   */
  getIndexInParent(nodeId: string): number {
    const node = this.getNode(nodeId);
    if (!node || !node.parentId) return -1;
    const parent = this.getNode(node.parentId);
    if (!parent) return -1;
    return parent.children.indexOf(nodeId);
  }

  // ============================================================
  // Serialization
  // ============================================================

  /**
   * Export entire document to JSON.
   */
  toJSON(): SgDocument & { nodes: Record<string, SGNode> } {
    const nodes: Record<string, SGNode> = {};
    for (const [id, node] of this.nodeMap) {
      nodes[id] = JSON.parse(JSON.stringify(node));
    }
    return { ...this._document, nodes };
  }

  /**
   * Load document from JSON.
   */
  static fromJSON(json: SgDocument & { nodes?: Record<string, SGNode> }): SceneGraph {
    const { nodes, ...doc } = json;

    const sg = new SceneGraph(doc as SgDocument);

    if (nodes) {
      sg.nodeMap.clear();
      for (const [id, node] of Object.entries(nodes)) {
        sg.nodeMap.set(id, node as SGNode);
      }
    } else {
      // Fallback: if nodes not included, rebuild from page children
      // (legacy format compatibility)
      sg.rebuildFromLegacy(doc as SgDocument & { pages?: PageNode[] });
    }

    return sg;
  }

  /**
   * Rebuild nodeMap from legacy flat format.
   */
  private rebuildFromLegacy(doc: SgDocument & { pages?: PageNode[] }): void {
    // This handles the old shapes[] format for migration
    // Extract all nodes from page children recursively
    const collectNodes = (node: SGNode): void => {
      this.nodeMap.set(node.id, node);
      if ('children' in node && Array.isArray(node.children)) {
        for (const childId of node.children as string[]) {
          const child = this.getNode(childId);
          if (child) collectNodes(child);
        }
      }
    };

    if ('pages' in doc && Array.isArray(doc.pages)) {
      for (const page of doc.pages as unknown as SGNode[]) {
        collectNodes(page);
      }
    }
  }

  // ============================================================
  // Factory Methods (create nodes easily)
  // ============================================================

  createRectangle(parentId: string, props: Partial<RectangleNode> = {}): RectangleNode {
    const node: RectangleNode = {
      id: nanoid(),
      type: 'rectangle',
      name: 'Rectangle',
      x: props.x ?? 0,
      y: props.y ?? 0,
      width: props.width ?? 100,
      height: props.height ?? 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      blendMode: 'normal',
      parentId,
      children: [],
      fills: [{ type: 'solid', color: (props as unknown as { fill?: string }).fill ?? '#4A4A52' }],
      strokes: [{ type: 'solid', color: (props as unknown as { stroke?: string }).stroke ?? '#3A3A40' }],
      strokeWidth: 1,
      cornerRadius: props.cornerRadius ?? 0,
      ...props,
    } as unknown as RectangleNode;

    // Remove shape-specific props that don't belong on RectangleNode
    delete (node as unknown as Record<string, unknown>)['fill'];
    delete (node as unknown as Record<string, unknown>)['stroke'];

    return this.addNode(node, parentId);
  }

  createFrame(parentId: string, props: Partial<FrameNode> = {}): FrameNode {
    const node: FrameNode = {
      id: nanoid(),
      type: 'frame',
      name: 'Frame',
      x: props.x ?? 0,
      y: props.y ?? 0,
      width: props.width ?? 375,
      height: props.height ?? 812,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      blendMode: 'normal',
      parentId,
      children: [],
      backgroundColor: 'transparent',
      cornerRadius: 0,
      clipsContent: true,
      layoutMode: 'none',
      layoutGap: 0,
      layoutPaddingTop: 0,
      layoutPaddingRight: 0,
      layoutPaddingBottom: 0,
      layoutPaddingLeft: 0,
      layoutAlign: 'min',
      layoutJustify: 'min',
      layoutWrap: false,
      ...props,
    } as FrameNode;

    return this.addNode(node, parentId);
  }

  createText(parentId: string, props: Partial<TextNode> = {}): TextNode {
    const node: TextNode = {
      id: nanoid(),
      type: 'text',
      name: 'Text',
      x: props.x ?? 0,
      y: props.y ?? 0,
      width: props.width ?? 200,
      height: props.height ?? 24,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      blendMode: 'normal',
      parentId,
      children: [],
      text: props.text ?? 'Text',
      fontSize: props.fontSize ?? 16,
      fontFamily: props.fontFamily ?? 'Inter',
      fontWeight: props.fontWeight ?? 400,
      textAlign: 'left',
      lineHeight: 1.5,
      letterSpacing: 0,
      textSizing: 'fixed',
      variableRefs: [],
      fills: [{ type: 'solid', color: (props as unknown as { fill?: string }).fill ?? '#E8E4DF' }],
      ...props,
    } as unknown as TextNode;

    delete (node as unknown as Record<string, unknown>)['fill'];

    return this.addNode(node, parentId);
  }
}
