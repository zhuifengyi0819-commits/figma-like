import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import { Shape, ChatMessage, Material, ToolType, AutoLayout, DEFAULT_SHAPE_PROPS, DEFAULT_AUTO_LAYOUT } from '@/lib/types';

const MAX_HISTORY = 50;

interface HistoryEntry { shapes: Shape[]; }

type AlignType = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV' | 'distributeH' | 'distributeV';

interface EditorState {
  shapes: Shape[];
  addShape: (shape: Omit<Shape, 'id'> & { id?: string }) => string;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  deleteShapes: (ids: string[]) => void;

  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;

  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  canvasZoom: number;
  canvasPan: { x: number; y: number };
  setCanvasZoom: (zoom: number) => void;
  setCanvasPan: (pan: { x: number; y: number }) => void;

  canvasBg: string;
  setCanvasBg: (bg: string) => void;

  chatHistory: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;

  materials: Material[];
  saveMaterial: (shape: Shape, name: string) => void;
  deleteMaterial: (id: string) => void;

  clearCanvas: () => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  duplicateShapes: (ids: string[]) => string[];
  moveGroupShapes: (groupId: string, leadId: string, newLeadX: number, newLeadY: number) => void;
  alignShapes: (ids: string[], alignment: AlignType) => void;

  // Frame hierarchy
  reparentShape: (shapeId: string, newParentId: string | undefined) => void;
  getChildren: (parentId: string) => Shape[];
  applyAutoLayout: (frameId: string) => void;

  history: HistoryEntry[];
  historyIndex: number;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  showHelp: boolean;
  setShowHelp: (show: boolean) => void;
}

function getShapeBounds(s: Shape) {
  if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') {
    const r = s.radius || 50;
    return { left: s.x - r, top: s.y - r, right: s.x + r, bottom: s.y + r, w: r * 2, h: r * 2, cx: s.x, cy: s.y, isRadial: true };
  }
  if (s.type === 'line' || s.type === 'arrow') {
    const pts = s.points || [0, 0, 100, 100];
    const xs = pts.filter((_, i) => i % 2 === 0); const ys = pts.filter((_, i) => i % 2 === 1);
    const l = Math.min(...xs) + s.x, r = Math.max(...xs) + s.x, t = Math.min(...ys) + s.y, b = Math.max(...ys) + s.y;
    return { left: l, top: t, right: r, bottom: b, w: r - l, h: b - t, cx: (l + r) / 2, cy: (t + b) / 2, isRadial: false };
  }
  const w = s.width || 100, h = s.height || 100;
  return { left: s.x, top: s.y, right: s.x + w, bottom: s.y + h, w, h, cx: s.x + w / 2, cy: s.y + h / 2, isRadial: false };
}

function getChildSize(s: Shape): { w: number; h: number } {
  if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') {
    const r = s.radius || 50;
    return { w: r * 2, h: r * 2 };
  }
  return { w: s.width || 100, h: s.height || 40 };
}

function computeAutoLayout(frame: Shape, children: Shape[]): Map<string, { x: number; y: number }> {
  const al = frame.autoLayout || DEFAULT_AUTO_LAYOUT;
  const updates = new Map<string, { x: number; y: number }>();
  if (children.length === 0) return updates;

  const fw = frame.width || 200, fh = frame.height || 200;
  const innerW = fw - al.paddingLeft - al.paddingRight;
  const innerH = fh - al.paddingTop - al.paddingBottom;
  const isH = al.direction === 'horizontal';

  const sizes = children.map(c => getChildSize(c));
  const totalMain = sizes.reduce((sum, s) => sum + (isH ? s.w : s.h), 0);
  const totalGap = al.gap * (children.length - 1);

  let mainOffset = 0;
  if (al.justifyContent === 'center') mainOffset = ((isH ? innerW : innerH) - totalMain - totalGap) / 2;
  else if (al.justifyContent === 'end') mainOffset = (isH ? innerW : innerH) - totalMain - totalGap;
  else if (al.justifyContent === 'space-between' && children.length > 1) {
    const space = ((isH ? innerW : innerH) - totalMain) / (children.length - 1);
    let cursor = 0;
    children.forEach((child, i) => {
      const cs = sizes[i];
      const cross = computeCrossOffset(al, isH ? innerH : innerW, isH ? cs.h : cs.w);
      const x = frame.x + al.paddingLeft + (isH ? cursor : cross);
      const y = frame.y + al.paddingTop + (isH ? cross : cursor);
      if (child.type === 'circle' || child.type === 'star' || child.type === 'triangle') {
        updates.set(child.id, { x: x + cs.w / 2, y: y + cs.h / 2 });
      } else {
        updates.set(child.id, { x, y });
      }
      cursor += (isH ? cs.w : cs.h) + space;
    });
    return updates;
  }

  let cursor = mainOffset;
  children.forEach((child, i) => {
    const cs = sizes[i];
    const cross = computeCrossOffset(al, isH ? innerH : innerW, isH ? cs.h : cs.w);
    const x = frame.x + al.paddingLeft + (isH ? cursor : cross);
    const y = frame.y + al.paddingTop + (isH ? cross : cursor);
    if (child.type === 'circle' || child.type === 'star' || child.type === 'triangle') {
      updates.set(child.id, { x: x + cs.w / 2, y: y + cs.h / 2 });
    } else {
      updates.set(child.id, { x, y });
    }
    cursor += (isH ? cs.w : cs.h) + al.gap;
  });

  return updates;
}

function computeCrossOffset(al: AutoLayout, crossSpace: number, childSize: number): number {
  if (al.alignItems === 'center') return (crossSpace - childSize) / 2;
  if (al.alignItems === 'end') return crossSpace - childSize;
  return 0;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      shapes: [],
      selectedIds: [],
      activeTool: 'select',
      canvasZoom: 1,
      canvasPan: { x: 0, y: 0 },
      canvasBg: '#1A1A1D',
      chatHistory: [],
      materials: [],
      history: [],
      historyIndex: -1,
      showHelp: false,

      setShowHelp: (show) => set({ showHelp: show }),
      setCanvasBg: (bg) => set({ canvasBg: bg }),

      pushHistory: () => {
        const { shapes, history, historyIndex } = get();
        const trimmed = history.slice(0, historyIndex + 1);
        trimmed.push({ shapes: JSON.parse(JSON.stringify(shapes)) });
        if (trimmed.length > MAX_HISTORY) trimmed.shift();
        set({ history: trimmed, historyIndex: trimmed.length - 1 });
      },

      undo: () => {
        const { historyIndex, history, shapes } = get();
        if (historyIndex < 0) return;
        let h = history;
        if (historyIndex === h.length - 1) {
          h = [...h, { shapes: JSON.parse(JSON.stringify(shapes)) }];
        }
        set({
          shapes: JSON.parse(JSON.stringify(h[historyIndex].shapes)),
          historyIndex: historyIndex - 1,
          history: h,
          selectedIds: [],
        });
      },

      redo: () => {
        const { historyIndex, history } = get();
        if (historyIndex + 2 >= history.length) return;
        const next = history[historyIndex + 2];
        set({ shapes: JSON.parse(JSON.stringify(next.shapes)), historyIndex: historyIndex + 1, selectedIds: [] });
      },

      addShape: (shape) => {
        get().pushHistory();
        const id = shape.id || uuid();
        const newShape: Shape = { ...DEFAULT_SHAPE_PROPS, ...shape, id, name: shape.name || `${shape.type}-${id.slice(-4)}` };
        set((state) => ({ shapes: [...state.shapes, newShape] }));
        return id;
      },

      updateShape: (id, updates) => {
        set((state) => ({ shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)) }));
      },

      deleteShape: (id) => {
        get().pushHistory();
        set((state) => ({ shapes: state.shapes.filter((s) => s.id !== id), selectedIds: state.selectedIds.filter((sid) => sid !== id) }));
      },

      deleteShapes: (ids) => {
        if (ids.length === 0) return;
        const { shapes } = get();
        const groupIds = new Set(ids.map(id => shapes.find(s => s.id === id)?.groupId).filter(Boolean) as string[]);
        const allIds = new Set(ids);
        groupIds.forEach(gid => { shapes.filter(s => s.groupId === gid).forEach(s => allIds.add(s.id)); });
        // Also delete children of frames being deleted
        const collectChildren = (parentId: string) => {
          shapes.filter(s => s.parentId === parentId).forEach(child => {
            allIds.add(child.id);
            if (child.type === 'frame') collectChildren(child.id);
          });
        };
        ids.forEach(id => {
          const s = shapes.find(sh => sh.id === id);
          if (s?.type === 'frame') collectChildren(id);
        });
        get().pushHistory();
        set((state) => ({
          shapes: state.shapes.filter((s) => !allIds.has(s.id)),
          selectedIds: state.selectedIds.filter((sid) => !allIds.has(sid)),
        }));
      },

      setSelectedIds: (ids) => set({ selectedIds: ids }),
      clearSelection: () => set({ selectedIds: [] }),
      setActiveTool: (tool) => set({ activeTool: tool }),
      setCanvasZoom: (zoom) => set({ canvasZoom: Math.max(0.1, Math.min(5, zoom)) }),
      setCanvasPan: (pan) => set({ canvasPan: pan }),

      addChatMessage: (message) => {
        const newMessage: ChatMessage = { ...message, id: uuid(), timestamp: Date.now() };
        set((state) => ({ chatHistory: [...state.chatHistory.slice(-49), newMessage] }));
      },
      clearChat: () => set({ chatHistory: [] }),

      saveMaterial: (shape, name) => {
        const { id: _id, x: _x, y: _y, name: _n, ...rest } = shape;
        set((state) => ({ materials: [...state.materials, { id: uuid(), name, shape: rest as Omit<Shape, 'id' | 'x' | 'y' | 'name'>, createdAt: Date.now() }] }));
      },
      deleteMaterial: (id) => { set((state) => ({ materials: state.materials.filter((m) => m.id !== id) })); },

      clearCanvas: () => { get().pushHistory(); set({ shapes: [], selectedIds: [] }); },

      bringForward: (id) => {
        set((state) => {
          const idx = state.shapes.findIndex((s) => s.id === id);
          if (idx === -1 || idx === state.shapes.length - 1) return state;
          const s = [...state.shapes]; [s[idx], s[idx + 1]] = [s[idx + 1], s[idx]]; return { shapes: s };
        });
      },

      sendBackward: (id) => {
        set((state) => {
          const idx = state.shapes.findIndex((s) => s.id === id);
          if (idx <= 0) return state;
          const s = [...state.shapes]; [s[idx], s[idx - 1]] = [s[idx - 1], s[idx]]; return { shapes: s };
        });
      },

      duplicateShapes: (ids) => {
        const { shapes, pushHistory } = get();
        const groupIds = new Set(ids.map(id => shapes.find(s => s.id === id)?.groupId).filter(Boolean) as string[]);
        const allIds = new Set(ids);
        groupIds.forEach(gid => shapes.filter(s => s.groupId === gid).forEach(s => allIds.add(s.id)));
        const toDupe = shapes.filter(s => allIds.has(s.id));
        if (toDupe.length === 0) return [];
        pushHistory();
        const groupIdMap = new Map<string, string>();
        groupIds.forEach(gid => groupIdMap.set(gid, uuid()));
        const idMap = new Map<string, string>();
        const newIds: string[] = [];
        const copies = toDupe.map((s) => {
          const newId = uuid(); newIds.push(newId);
          idMap.set(s.id, newId);
          return {
            ...s, id: newId, x: s.x + 20, y: s.y + 20, name: `${s.name}-copy`,
            groupId: s.groupId ? groupIdMap.get(s.groupId) : undefined,
            parentId: s.parentId && idMap.has(s.parentId) ? idMap.get(s.parentId) : s.parentId,
          };
        });
        set((state) => ({ shapes: [...state.shapes, ...copies], selectedIds: newIds }));
        return newIds;
      },

      moveGroupShapes: (groupId, leadId, newLeadX, newLeadY) => {
        set((state) => {
          const lead = state.shapes.find(s => s.id === leadId);
          if (!lead) return state;
          const dx = newLeadX - lead.x, dy = newLeadY - lead.y;
          return { shapes: state.shapes.map(s => s.groupId === groupId ? { ...s, x: s.x + dx, y: s.y + dy } : s) };
        });
      },

      // Frame hierarchy
      reparentShape: (shapeId, newParentId) => {
        get().pushHistory();
        set((state) => ({
          shapes: state.shapes.map(s => s.id === shapeId ? { ...s, parentId: newParentId } : s),
        }));
        if (newParentId) {
          const frame = get().shapes.find(s => s.id === newParentId);
          if (frame?.autoLayout) get().applyAutoLayout(newParentId);
        }
      },

      getChildren: (parentId) => {
        return get().shapes.filter(s => s.parentId === parentId);
      },

      applyAutoLayout: (frameId) => {
        const { shapes } = get();
        const frame = shapes.find(s => s.id === frameId);
        if (!frame || !frame.autoLayout) return;
        const children = shapes.filter(s => s.parentId === frameId);
        const updates = computeAutoLayout(frame, children);
        if (updates.size === 0) return;
        set((state) => ({
          shapes: state.shapes.map(s => {
            const u = updates.get(s.id);
            return u ? { ...s, ...u } : s;
          }),
        }));
      },

      alignShapes: (ids, alignment) => {
        set((state) => {
          const selected = state.shapes.filter(s => ids.includes(s.id));
          if (selected.length < 2 && alignment !== 'centerH' && alignment !== 'centerV') return state;
          const bounds = selected.map(s => ({ id: s.id, b: getShapeBounds(s), s }));
          const minL = Math.min(...bounds.map(b => b.b.left));
          const maxR = Math.max(...bounds.map(b => b.b.right));
          const minT = Math.min(...bounds.map(b => b.b.top));
          const maxB = Math.max(...bounds.map(b => b.b.bottom));
          const updates = new Map<string, { x?: number; y?: number }>();

          for (const { id, b } of bounds) {
            if (alignment === 'left') updates.set(id, { x: b.isRadial ? minL + b.w / 2 : minL });
            else if (alignment === 'right') updates.set(id, { x: b.isRadial ? maxR - b.w / 2 : maxR - b.w });
            else if (alignment === 'top') updates.set(id, { y: b.isRadial ? minT + b.h / 2 : minT });
            else if (alignment === 'bottom') updates.set(id, { y: b.isRadial ? maxB - b.h / 2 : maxB - b.h });
            else if (alignment === 'centerH') {
              const cx = (minL + maxR) / 2;
              updates.set(id, { x: b.isRadial ? cx : cx - b.w / 2 });
            } else if (alignment === 'centerV') {
              const cy = (minT + maxB) / 2;
              updates.set(id, { y: b.isRadial ? cy : cy - b.h / 2 });
            }
          }

          if (alignment === 'distributeH' && bounds.length >= 3) {
            const sorted = [...bounds].sort((a, b) => a.b.cx - b.b.cx);
            const step = (sorted[sorted.length - 1].b.cx - sorted[0].b.cx) / (sorted.length - 1);
            sorted.forEach((item, i) => {
              const targetCx = sorted[0].b.cx + i * step;
              const dx = targetCx - item.b.cx;
              updates.set(item.id, { x: item.s.x + dx });
            });
          }
          if (alignment === 'distributeV' && bounds.length >= 3) {
            const sorted = [...bounds].sort((a, b) => a.b.cy - b.b.cy);
            const step = (sorted[sorted.length - 1].b.cy - sorted[0].b.cy) / (sorted.length - 1);
            sorted.forEach((item, i) => {
              const targetCy = sorted[0].b.cy + i * step;
              const dy = targetCy - item.b.cy;
              updates.set(item.id, { y: item.s.y + dy });
            });
          }

          return { shapes: state.shapes.map(s => { const u = updates.get(s.id); return u ? { ...s, ...u } : s; }) };
        });
      },
    }),
    {
      name: 'ai-canvas-editor',
      partialize: (state) => ({
        shapes: state.shapes,
        materials: state.materials,
        chatHistory: state.chatHistory.slice(-20),
        canvasBg: state.canvasBg,
      }),
    }
  )
);
