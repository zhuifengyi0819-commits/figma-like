// hooks/useEditor.ts
// Hook that creates and manages the EditorEngine singleton,
// bridging it with the Zustand store.

import { useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { SceneGraph } from '@/lib/scene-graph';
import { EditorEngine } from '@/lib/editor/EditorEngine';

let engineInstance: EditorEngine | null = null;

export function useEditor() {
  const store = useEditorStore();

  // Singleton engine (created once)
  if (!engineInstance) {
    const sceneGraph = new SceneGraph();

    engineInstance = new EditorEngine({
      sceneGraph,
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

  return engineInstance;
}
