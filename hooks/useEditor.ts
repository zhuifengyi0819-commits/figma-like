// hooks/useEditor.ts
// Hook that creates and manages the EditorEngine singleton,
// bridging it with the Zustand store.

import { useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { SceneGraph } from '@/lib/scene-graph';
import { EditorEngine } from '@/lib/editor/EditorEngine';
import { syncShapesToSceneGraph } from '@/lib/editor/ShapeConverter';

let engineInstance: EditorEngine | null = null;
let sceneGraphInstance: SceneGraph | null = null;

export function useEditor() {
  const store = useEditorStore();
  const shapesRef = useRef(store.shapes);
  const initialized = useRef(false);

  // Singleton engine (created once)
  if (!engineInstance) {
    sceneGraphInstance = new SceneGraph();
    engineInstance = new EditorEngine({
      sceneGraph: sceneGraphInstance,
      getState: () => ({
        pages: store.pages,
        activePageId: store.activePageId,
        selectedIds: store.selectedIds,
        activeTool: store.activeTool,
        canvasZoom: store.canvasZoom,
        canvasPan: store.canvasPan,
        viewportWidth: store.viewportWidth,
        viewportHeight: store.viewportHeight,
      }),
      setState: (patch) => {
        if (patch.selectedIds !== undefined) store.setSelectedIds(patch.selectedIds);
        if (patch.activeTool !== undefined) store.setActiveTool(patch.activeTool);
        if (patch.canvasPan !== undefined) store.setCanvasPan(patch.canvasPan);
        if (patch.canvasZoom !== undefined) store.setCanvasZoom(patch.canvasZoom);
      },
    });
  }

  // Initial sync from store shapes to SceneGraph (on mount / first render)
  if (!initialized.current && sceneGraphInstance) {
    syncShapesToSceneGraph(store.shapes, sceneGraphInstance);
    initialized.current = true;
  }

  return engineInstance;
}

/**
 * Force-sync the SceneGraph from current store shapes.
 * Call this after addShape/updateShape/deleteShape operations.
 */
export function syncEditorFromStore(): void {
  if (sceneGraphInstance) {
    syncShapesToSceneGraph(useEditorStore.getState().shapes, sceneGraphInstance);
  }
}
