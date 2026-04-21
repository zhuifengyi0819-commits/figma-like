// lib/editor/EditorEngine.ts
// Central engine that bridges SceneGraph/Selection/Transform/Snap/History/Keyboard
// with the existing Zustand store. Single entry point for all editor operations.

import { nanoid } from 'nanoid';
import type { SceneGraph } from '@/lib/scene-graph';
import { SelectionEngine } from '@/lib/selection/SelectionEngine';
import { TransformEngine, type ResizeHandle, type TransformState } from '@/lib/transform/TransformEngine';
import { SnapEngine, type SnapResult, type SnapConfig, type SnapTarget } from '@/lib/snap/SnapEngine';
import { HistoryManager } from '@/lib/history/HistoryManager';
import type { SGNode, MarqueeRect } from '@/lib/scene-graph/types';
import type { EditorState } from './types';
import { useEditorStore } from '@/stores/useEditorStore';
import { syncShapesToSceneGraph } from './ShapeConverter';

export interface EditorEngineConfig {
  sceneGraph: SceneGraph;
  getState: () => EditorState;
  setState: (patch: Partial<EditorState>) => void;
}

/** Events emitted by the editor engine for UI consumption */
export interface EditorEngineEvents {
  onSelectionChange?: (ids: string[]) => void;
  onToolChange?: (tool: string) => void;
  onViewportChange?: (pan: { x: number; y: number }, zoom: number) => void;
  /** Called when smart guide paths should be rendered */
  onSmartGuides?: (paths: { path: string; color: string }[]) => void;
  /** Called when selection bounds overlay should update */
  onSelectionBounds?: (bounds: { x: number; y: number; width: number; height: number } | null) => void;
  /** Called when shapes have changed (after undo/redo/executeCommand) so UI can re-render */
  onShapesChange?: () => void;
}

export class EditorEngine {
  private sceneGraph: SceneGraph;
  private selection: SelectionEngine;
  private transform: TransformEngine;
  private snap: SnapEngine;
  private history: HistoryManager;
  private getState: () => EditorState;
  private setState: (patch: Partial<EditorState>) => void;
  private events: EditorEngineEvents = {};

  // Active transform state
  private activeTransform: TransformState | null = null;
  private activeSnapResult: SnapResult | null = null;

  constructor(config: EditorEngineConfig) {
    this.sceneGraph = config.sceneGraph;
    this.getState = config.getState;
    this.setState = config.setState;

    // Create engines with scene graph
    this.selection = new SelectionEngine(config.sceneGraph);
    this.transform = new TransformEngine(config.sceneGraph);
    this.snap = new SnapEngine(config.sceneGraph);
    this.history = new HistoryManager(config.sceneGraph);

    // Wire up selection engine callbacks
    this.selection = new SelectionEngine(config.sceneGraph, (ids) => {
      this.setState({ selectedIds: ids });
      this.events.onSelectionChange?.(ids);
      const bounds = this.selection.getSelectionBounds(ids);
      this.events.onSelectionBounds?.(bounds);
    });

    // Wire up keyboard manager to tool changes
    this.events.onToolChange = (tool) => {
      const toolMap: Record<string, any> = {
        'v': 'select', 'r': 'rectangle', 't': 'text', 'f': 'frame',
        'p': 'pen', 'o': 'ellipse', 'l': 'line', 'u': 'arrow',
      };
      const editorTool = toolMap[tool];
      if (editorTool) this.setState({ activeTool: editorTool });
    };
  }

  // ============================================================
  // Setup
  // ============================================================

  setEvents(events: EditorEngineEvents): void {
    this.events = { ...this.events, ...events };
  }

  updateSnapConfig(config: Partial<SnapConfig>): void {
    this.snap.updateConfig(config);
  }

  // ============================================================
  // Selection API (delegates to SelectionEngine)
  // ============================================================

  select(nodeId: string): void {
    const ids = this.selection.select(this.getState().selectedIds, nodeId);
    this.setState({ selectedIds: ids });
  }

  toggleSelect(nodeId: string): void {
    const ids = this.selection.toggle(this.getState().selectedIds, nodeId);
    this.setState({ selectedIds: ids });
  }

  addToSelection(nodeId: string): void {
    const ids = this.selection.addToSelection(this.getState().selectedIds, nodeId);
    this.setState({ selectedIds: ids });
  }

  clearSelection(): void {
    const ids = this.selection.clearSelection(this.getState().selectedIds);
    this.setState({ selectedIds: ids });
    this.events.onSelectionBounds?.(null);
  }

  selectAll(): void {
    const state = this.getState();
    const activePage = state.pages.find(p => p.id === state.activePageId);
    if (!activePage) return;
    // Select all shapes on the current page
    const ids = this.selection.selectAll([], activePage.id);
    this.setState({ selectedIds: ids });
  }

  selectWithMarquee(marquee: MarqueeRect, additive: boolean = false): void {
    const state = this.getState();
    const activePage = state.pages.find(p => p.id === state.activePageId);
    const ids = this.selection.selectWithMarquee(
      additive ? state.selectedIds : [],
      marquee,
      activePage?.id,
      additive
    );
    this.setState({ selectedIds: ids });
    const bounds = this.selection.getSelectionBounds(ids);
    this.events.onSelectionBounds?.(bounds);
  }

  getSelectionBounds() {
    return this.selection.getSelectionBounds(this.getState().selectedIds);
  }

  getSelectionCenter() {
    return this.selection.getSelectionCenter(this.getState().selectedIds);
  }

  isSelected(nodeId: string): boolean {
    return this.getState().selectedIds.includes(nodeId);
  }

  // ============================================================
  // Transform API (delegates to TransformEngine + SnapEngine)
  // ============================================================

  /**
   * Start a move drag. Call on pointerdown.
   */
  startMove(
    nodeId: string,
    pointerX: number,
    pointerY: number,
    shift: boolean = false,
    meta: boolean = false
  ): void {
    const node = this.sceneGraph.getNode(nodeId);
    if (!node) return;

    const abs = this.sceneGraph.getAbsoluteTransform(nodeId);
    this.activeTransform = {
      nodeId,
      startX: pointerX,
      startY: pointerY,
      startBounds: { x: abs.x, y: abs.y, width: node.width, height: node.height },
      handle: 'move',
      shift,
      alt: false,
      meta,
    };
    this.activeSnapResult = null;
  }

  /**
   * Start a resize drag. Call on pointerdown on a resize handle.
   */
  startResize(
    nodeId: string,
    handle: ResizeHandle,
    pointerX: number,
    pointerY: number,
    shift: boolean = false,
    alt: boolean = false
  ): void {
    const node = this.sceneGraph.getNode(nodeId);
    if (!node) return;

    const abs = this.sceneGraph.getAbsoluteTransform(nodeId);
    this.activeTransform = {
      nodeId,
      startX: pointerX,
      startY: pointerY,
      startBounds: { x: abs.x, y: abs.y, width: node.width, height: node.height },
      handle,
      shift,
      alt,
      meta: false,
    };
    this.activeSnapResult = null;
  }

  /**
   * Start a rotation drag. Call on pointerdown on rotation handle.
   */
  startRotate(
    nodeId: string,
    pointerX: number,
    pointerY: number,
    shift: boolean = false
  ): void {
    const node = this.sceneGraph.getNode(nodeId);
    if (!node) return;

    const abs = this.sceneGraph.getAbsoluteTransform(nodeId);
    this.activeTransform = {
      nodeId,
      startX: pointerX,
      startY: pointerY,
      startBounds: { x: abs.x, y: abs.y, width: node.width, height: node.height },
      handle: 'rotate',
      shift,
      alt: false,
      meta: false,
    };
  }

  /**
   * Update drag/resize/rotate in progress. Returns snap-adjusted position.
   */
  updateTransform(
    currentX: number,
    currentY: number
  ): { snapX: number; snapY: number; bounds: { x: number; y: number; width: number; height: number } } | null {
    if (!this.activeTransform) return null;

    const state = this.getState();
    const activePage = state.pages.find(p => p.id === state.activePageId);

    if (this.activeTransform.handle === 'move') {
      const moveResult = this.transform.move(this.activeTransform, currentX, currentY);

      // Compute snap
      if (state.selectedIds.length > 0) {
        const node = this.sceneGraph.getNode(this.activeTransform.nodeId);
        if (node) {
          const target: SnapTarget = {
            nodeIds: activePage ? this.sceneGraph.getDescendants(activePage.id).map(n => n.id) : [],
            excludeIds: state.selectedIds,
          };

          const snapResult = this.snap.snap(
            moveResult.finalX,
            moveResult.finalY,
            target,
            node.width,
            node.height,
            'both'
          );

          this.activeSnapResult = snapResult;

          // Store smart guides for SelectionOverlay retrieval via _getSmartGuides()
          const guideLines: { x?: number; y?: number }[] = [];
          for (const line of snapResult.verticalLines) guideLines.push({ x: line.position });
          for (const line of snapResult.horizontalLines) guideLines.push({ y: line.position });
          this._activeSmartGuides = guideLines;

          if (snapResult.verticalLines.length > 0 || snapResult.horizontalLines.length > 0) {
            this.events.onSmartGuides?.(
              this.snap.getGuidePaths(
                snapResult.verticalLines,
                snapResult.horizontalLines,
                { x: 0, y: 0, width: state.viewportWidth, height: state.viewportHeight }
              )
            );
          }

          return {
            snapX: snapResult.finalX,
            snapY: snapResult.finalY,
            bounds: { x: snapResult.finalX, y: snapResult.finalY, width: node.width, height: node.height },
          };
        }
      }

      // No snap targets or no node — clear smart guides
      this._activeSmartGuides = [];
      return {
        snapX: moveResult.finalX,
        snapY: moveResult.finalY,
        bounds: { x: moveResult.finalX, y: moveResult.finalY, width: this.activeTransform.startBounds.width, height: this.activeTransform.startBounds.height },
      };
    }

    if (this.activeTransform.handle === 'rotate') {
      const rotation = this.transform.rotate(this.activeTransform, currentX, currentY);
      return {
        snapX: 0, snapY: 0,
        bounds: { ...this.activeTransform.startBounds, rotation },
      } as { snapX: number; snapY: number; bounds: { x: number; y: number; width: number; height: number; rotation?: number } };
    }

    // Resize
    const resizeResult = this.transform.resize(this.activeTransform, currentX, currentY);
    return {
      snapX: 0, snapY: 0,
      bounds: { x: resizeResult.x, y: resizeResult.y, width: resizeResult.width, height: resizeResult.height },
    };
  }

  /**
   * Commit a transform for a Konva-based transform (Transformer handles visual update).
   * Konva has already applied scaleX→1, width/height→final, so we just record the
   * final bounds directly without recomputing from pointer position.
   */
  commitTransformFromKonva(
    nodeId: string,
    finalX: number,
    finalY: number,
    finalWidth: number,
    finalHeight: number,
    finalRotation: number,
    finalScaleX: number,
    finalScaleY: number
  ): void {
    if (!this.activeTransform) return;

    const { nodeId: activeNodeId } = this.activeTransform;
    const node = this.sceneGraph.getNode(activeNodeId);
    if (!node) return;

    // Before state: snapshot of node BEFORE this transform (from sceneGraph)
    const before = {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation ?? 0,
      scaleX: (node as any).scaleX ?? 1,
      scaleY: (node as any).scaleY ?? 1,
    };

    // After state: what Konva visually shows now (from handleTransformEnd)
    const after = {
      x: finalX,
      y: finalY,
      width: finalWidth,
      height: finalHeight,
      rotation: finalRotation,
      scaleX: finalScaleX,
      scaleY: finalScaleY,
    };

    // Record in history for undo/redo (execute applies the command which is already done,
    // but Command Pattern requires execute to be called so undo() works)
    const cmd = this.history.transformCommand(activeNodeId, before, after, 'Transform');
    this.history.execute(cmd);

    this.activeTransform = null;
    this.activeSnapResult = null;
    this._activeSmartGuides = [];
    this.events.onSmartGuides?.([]);
    this.events.onShapesChange?.();
  }

  /**
   * Commit the current transform to history and scene graph.
   * For pointer-driven transforms (drag/resize/rotate in progress).
   */
  commitTransform(finalX: number, finalY: number): void {
    if (!this.activeTransform) return;

    const { nodeId, handle } = this.activeTransform;
    const state = this.getState();

    if (handle === 'move') {
      const dx = finalX - this.activeTransform.startBounds.x;
      const dy = finalY - this.activeTransform.startBounds.y;

      if (dx !== 0 || dy !== 0) {
        const cmd = this.history.moveCommand([nodeId], dx, dy);
        this.history.execute(cmd);
      }
    } else if (handle === 'rotate') {
      const rotation = this.transform.rotate(this.activeTransform, finalX, finalY);
      const cmd = this.history.transformCommand(
        nodeId,
        { ...this.activeTransform.startBounds, rotation: this.sceneGraph.getNode(nodeId)?.rotation ?? 0 },
        { ...this.activeTransform.startBounds, rotation },
        'Rotate'
      );
      this.history.execute(cmd);
      // Note: transformCommand.execute() already calls sceneGraph.updateNode,
      // so we do NOT call transform.commitRotate() here to avoid double-write
    } else {
      // Resize
      const resizeResult = this.transform.resize(this.activeTransform, finalX, finalY);
      const beforeNode = this.sceneGraph.getNode(nodeId);
      if (beforeNode) {
        const cmd = this.history.transformCommand(
          nodeId,
          { ...this.activeTransform.startBounds, rotation: beforeNode.rotation ?? 0 },
          { ...resizeResult, rotation: beforeNode.rotation ?? 0 },
          'Resize'
        );
        this.history.execute(cmd);
        // Note: transformCommand.execute() already calls sceneGraph.updateNode,
        // so we do NOT call transform.commitResize() here to avoid double-write
      }
    }

    this.activeTransform = null;
    this.activeSnapResult = null;
    this._activeSmartGuides = [];
    this.events.onSmartGuides?.([]);
    this.events.onShapesChange?.(); // Sync SceneGraph → store after transform
  }

  cancelTransform(): void {
    this.activeTransform = null;
    this.activeSnapResult = null;
    this.events.onSmartGuides?.([]);
  }

  /** Expose active smart guides for the SelectionOverlay */
  _getSmartGuides() {
    return this._activeSmartGuides || [];
  }

  private _activeSmartGuides: { x?: number; y?: number }[] = [];

// ============================================================
// History API (delegates to HistoryManager)
// ============================================================

  /** Execute a command and sync SceneGraph changes back to store */
  executeCommand(cmd: import('@/lib/history/HistoryManager').Command): void {
    this.history.execute(cmd);
    // Notify that shapes may have changed (for UI refresh)
    this.events.onShapesChange?.();
  }

  undo(): void {
    const cmd = this.history.undo();
    if (cmd) {
      this.events.onSelectionChange?.(this.getState().selectedIds);
      this.events.onShapesChange?.();
    }
  }

  redo(): void {
    const cmd = this.history.redo();
    if (cmd) {
      this.events.onSelectionChange?.(this.getState().selectedIds);
      this.events.onShapesChange?.();
    }
  }

  canUndo(): boolean { return this.history.canUndo(); }
  canRedo(): boolean { return this.history.canRedo(); }

  /** Expose the history manager for direct command creation */
  getHistoryManager(): HistoryManager {
    return this.history;
  }

  // ============================================================
  // Layer Order
  // ============================================================

  bringToFront(): void {
    const ids = this.getState().selectedIds;
    this.selection.bringToFront(ids);
  }

  sendToBack(): void {
    const ids = this.getState().selectedIds;
    this.selection.sendToBack(ids);
  }

  bringForward(): void {
    const ids = this.getState().selectedIds;
    this.selection.bringForward(ids);
  }

  sendBackward(): void {
    const ids = this.getState().selectedIds;
    this.selection.sendBackward(ids);
  }

  // ============================================================
  // Node Hit Testing (for canvas click detection)
  // ============================================================

  getNodeAtPoint(canvasX: number, canvasY: number): SGNode | null {
    return this.selection.getNodeAtPoint(canvasX, canvasY);
  }

  // ============================================================
  // Delete / Group (delegates to store for now, engines can enhance)
  // ============================================================

  deleteSelection(): void {
    const ids = this.getState().selectedIds;
    if (ids.length === 0) return;
    const cmd = this.history.deleteCommand(ids);
    this.history.execute(cmd);
    this.clearSelection();
  }

  /**
   * Create a duplicate of a node at the same position.
   * Uses store.addShape (which handles ID generation + defaults) and syncs to SceneGraph.
   * The duplicate action is recorded in HistoryManager so it can be undone/redone.
   * Returns the new node ID.
   */
  duplicateNode(sourceId: string, x: number, y: number): string | null {
    const { shapes } = useEditorStore.getState();
    const source = shapes.find(s => s.id === sourceId);
    if (!source) return null;

    // Use store.addShape which handles ID generation and defaults
    const newId = useEditorStore.getState().addShape({
      ...source,
      id: undefined,
      x,
      y,
    });

    // Sync the new node to SceneGraph so engines see it immediately
    // Note: duplicateCommand.undo() handles removing from SceneGraph
    const newShape = useEditorStore.getState().shapes.find(s => s.id === newId);
    if (newShape) {
      syncShapesToSceneGraph([newShape], this.sceneGraph);
    }

    // Record in history so this duplication can be undone/redone
    // Use duplicateCommand with idempotent execute (hasNode check in execute)
    const newIdMap = new Map([[sourceId, newId]]);
    const cmd = this.history.duplicateCommand(
      [sourceId],
      newIdMap,
      source.parentId ?? 'canvas'
    );
    this.history.execute(cmd);

    this.events.onShapesChange?.();
    return newId;
  }

  // ============================================================
  // Snapshot for store hydration
  // ============================================================

  /** Hydrate SceneGraph from store's current shapes[] */
  hydrateFromStore(shapes: any[]): void {
    // Clear existing
    const page = this.sceneGraph.getCurrentPage();
    if (page) {
      for (const child of this.sceneGraph.getChildren(page.id)) {
        this.sceneGraph.removeNode(child.id);
      }
    }

    // Add shapes
    for (const shape of shapes) {
      if (page) this.sceneGraph.addNode({ ...shape, type: shape.type }, page.id);
    }
  }

  /** Export SceneGraph as shapes[] for store persistence */
  exportToStore(): any[] {
    const page = this.sceneGraph.getCurrentPage();
    if (!page) return [];
    return this.sceneGraph.getDescendants(page.id).map(n => ({ ...n }));
  }
}
