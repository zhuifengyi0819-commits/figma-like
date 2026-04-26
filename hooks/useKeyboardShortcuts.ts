// hooks/useKeyboardShortcuts.ts
// Wires KeyboardManager to the Zustand editor store.
// Registers all key action listeners that call store methods.

import { useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { KeyboardManager } from '@/lib/keyboard/KeyboardManager';
import { getEditorEngine } from '@/hooks/useEditor';

let keyboardManager: KeyboardManager | null = null;

function getKeyboardManager(): KeyboardManager {
  if (!keyboardManager) {
    keyboardManager = new KeyboardManager();
  }
  return keyboardManager;
}

export function useKeyboardShortcuts() {
  const store = useEditorStore();

  useEffect(() => {
    const km = getKeyboardManager();

    // Tool shortcuts → setActiveTool
    const toolMap: Record<string, string> = {
      move: 'select', rect: 'rectangle', frame: 'frame', text: 'text',
      pen: 'pen', ellipse: 'ellipse', line: 'line', polygon: 'polygon',
      star: 'star', sticky: 'sticky', image: 'image',
    };
    for (const [action, tool] of Object.entries(toolMap)) {
      km.on(action as any, () => store.setActiveTool(tool as any));
    }

    // Edit shortcuts — use HistoryManager via engine (Command Pattern)
    km.on('undo', () => { const engine = getEditorEngine(); engine?.undo(); });
    km.on('redo', () => { const engine = getEditorEngine(); engine?.redo(); });
    km.on('duplicate', () => {
      if (store.selectedIds.length > 0) {
        const engine = getEditorEngine();
        if (engine) {
          // Use engine.duplicateNode as the single creation point (undoable via HistoryManager)
          const newIds: string[] = [];
          for (const id of store.selectedIds) {
            const shape = store.shapes.find(s => s.id === id);
            if (!shape) continue;
            // engine.duplicateNode handles addShape + SceneGraph sync + HistoryManager recording
            const newId = engine.duplicateNode(id, shape.x + 10, shape.y + 10);
            if (newId) newIds.push(newId);
          }
          if (newIds.length > 0) store.setSelectedIds(newIds);
        } else {
          store.duplicateShapes(store.selectedIds);
        }
      }
    });
    km.on('delete', () => { if (store.selectedIds.length > 0) store.deleteShapes(store.selectedIds); });
    km.on('copy', () => store.copyStyle());
    km.on('paste', () => store.pasteStyle());
    km.on('cut', () => { store.copyStyle(); if (store.selectedIds.length > 0) store.deleteShapes(store.selectedIds); });

    // Selection shortcuts
    km.on('selectAll', () => {
      const page = store.pages.find(p => p.id === store.activePageId);
      if (page) {
        const ids = page.shapes.filter(s => !s.locked && s.visible).map(s => s.id);
        store.setSelectedIds(ids);
      }
    });
    km.on('deselect', () => store.clearSelection());

    // Organization
    km.on('group', () => store.groupSelection());
    km.on('ungroup', () => store.ungroupSelection());

    // Layer ordering
    km.on('bringFront', () => {
      const engine = getEditorEngine();
      if (engine) engine.bringToFront();
    });
    km.on('sendBack', () => {
      const engine = getEditorEngine();
      if (engine) engine.sendToBack();
    });
    km.on('bringForward', () => {
      const engine = getEditorEngine();
      if (engine) engine.bringForward();
    });
    km.on('sendBackward', () => {
      const engine = getEditorEngine();
      if (engine) engine.sendBackward();
    });

    // View shortcuts
    km.on('zoomIn', () => {
      const newZoom = Math.min(5, store.canvasZoom * 1.2);
      store.setCanvasZoom(newZoom);
    });
    km.on('zoomOut', () => {
      const newZoom = Math.max(0.1, store.canvasZoom / 1.2);
      store.setCanvasZoom(newZoom);
    });
    km.on('zoomFit', () => {
      // Fit to viewport — set pan to origin, zoom to fit
      store.setCanvasPan({ x: 0, y: 0 });
      store.setCanvasZoom(1);
    });
    km.on('zoom100', () => {
      store.setCanvasZoom(1);
      store.setCanvasPan({ x: 0, y: 0 });
    });

    return () => {
      // Detach only on final unmount (singleton), here we just remove listeners
    };
  }, [store]);
}
