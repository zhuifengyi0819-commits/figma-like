// lib/editor/types.ts
// Minimal EditorState interface mirroring Zustand store for EditorEngine consumption.

import type { Shape, Page, ToolType } from '@/lib/types';

export interface EditorState {
  pages: Page[];
  activePageId: string;
  selectedIds: string[];
  activeTool: ToolType;
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
}
