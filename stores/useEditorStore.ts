import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import {
  Shape, Page, ChatMessage, Material, ToolType, AutoLayout, ComponentDef, VariantDef,
  DesignToken, DesignTheme, Interaction, VersionSnapshot,
  DEFAULT_SHAPE_PROPS, DEFAULT_AUTO_LAYOUT, PRESET_TOKENS,
} from '@/lib/types';

const MAX_HISTORY = 50;

interface HistoryEntry { shapes: Shape[]; }
type AlignType = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV' | 'distributeH' | 'distributeV';

interface EditorState {
  pages: Page[];
  activePageId: string;
  shapes: Shape[];
  addPage: (name?: string) => string;
  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  setActivePageId: (id: string) => void;
  duplicatePage: (id: string) => string;

  addShape: (shape: Omit<Shape, 'id'> & { id?: string }) => string;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  deleteShapes: (ids: string[]) => void;
  _setPageShapes: (shapes: Shape[]) => void;

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

  reparentShape: (shapeId: string, newParentId: string | undefined) => void;
  getChildren: (parentId: string) => Shape[];
  applyAutoLayout: (frameId: string) => void;
  applyConstraints: (frameId: string, oldW: number, oldH: number, newW: number, newH: number) => void;

  history: HistoryEntry[];
  historyIndex: number;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  showHelp: boolean;
  setShowHelp: (show: boolean) => void;

  copiedStyle: Partial<Shape> | null;
  copyStyle: () => void;
  pasteStyle: () => void;
  reorderShape: (id: string, targetIndex: number) => void;

  components: ComponentDef[];
  createComponent: (shapeIds: string[], name: string) => string;
  createInstance: (componentId: string, x: number, y: number) => string;
  addVariant: (componentId: string, variantName: string) => void;
  syncInstances: (componentId: string) => void;
  detachInstance: (shapeId: string) => void;

  prototypeMode: boolean;
  setPrototypeMode: (on: boolean) => void;
  addInteraction: (shapeId: string, interaction: Interaction) => void;
  removeInteraction: (shapeId: string, idx: number) => void;
  updateInteraction: (shapeId: string, idx: number, patch: Partial<Interaction>) => void;

  themes: DesignTheme[];
  activeThemeId: string;
  addTheme: (name: string) => string;
  deleteTheme: (id: string) => void;
  setActiveThemeId: (id: string) => void;
  addToken: (themeId: string, token: Omit<DesignToken, 'id'>) => string;
  updateToken: (themeId: string, tokenId: string, patch: Partial<DesignToken>) => void;
  deleteToken: (themeId: string, tokenId: string) => void;
  getTokenValue: (tokenId: string) => string | undefined;
  applyTokenToShape: (shapeId: string, property: string, tokenId: string) => void;

  snapshots: VersionSnapshot[];
  saveSnapshot: (name: string) => string;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  renameSnapshot: (id: string, name: string) => void;
}

// === Helpers ===

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
  if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') { const r = s.radius || 50; return { w: r * 2, h: r * 2 }; }
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
      } else { updates.set(child.id, { x, y }); }
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
    } else { updates.set(child.id, { x, y }); }
    cursor += (isH ? cs.w : cs.h) + al.gap;
  });
  return updates;
}

function computeCrossOffset(al: AutoLayout, crossSpace: number, childSize: number): number {
  if (al.alignItems === 'center') return (crossSpace - childSize) / 2;
  if (al.alignItems === 'end') return crossSpace - childSize;
  return 0;
}

function pageShapes(pages: Page[], activePageId: string): Shape[] {
  const p = pages.find(pg => pg.id === activePageId);
  return p?.shapes || [];
}

function updatePageShapes(pages: Page[], activePageId: string, updater: (shapes: Shape[]) => Shape[]): { pages: Page[]; shapes: Shape[] } {
  let newShapes: Shape[] = [];
  const newPages = pages.map(p => {
    if (p.id !== activePageId) return p;
    newShapes = updater(p.shapes);
    return { ...p, shapes: newShapes };
  });
  return { pages: newPages, shapes: newShapes };
}

const defaultPageId = 'page-1';
const defaultThemeId = 'theme-default';

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      pages: [{ id: defaultPageId, name: 'Page 1', shapes: [] }],
      activePageId: defaultPageId,
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
      components: [],
      prototypeMode: false,
      themes: [{ id: defaultThemeId, name: 'Default', tokens: [...PRESET_TOKENS] }],
      activeThemeId: defaultThemeId,

      _setPageShapes: (shapes) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, () => shapes);
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      addPage: (name) => {
        const id = uuid();
        set(state => ({
          pages: [...state.pages, { id, name: name || `Page ${state.pages.length + 1}`, shapes: [] }],
          activePageId: id,
          selectedIds: [],
          shapes: [],
        }));
        return id;
      },
      deletePage: (id) => {
        const { pages, activePageId } = get();
        if (pages.length <= 1) return;
        const remaining = pages.filter(p => p.id !== id);
        const newActiveId = activePageId === id ? remaining[0].id : activePageId;
        set({ pages: remaining, activePageId: newActiveId, selectedIds: [], shapes: pageShapes(remaining, newActiveId) });
      },
      renamePage: (id, name) => set(state => ({ pages: state.pages.map(p => p.id === id ? { ...p, name } : p) })),
      setActivePageId: (id) => set(state => ({
        activePageId: id, selectedIds: [], history: [], historyIndex: -1,
        shapes: pageShapes(state.pages, id),
      })),
      duplicatePage: (id) => {
        const { pages } = get();
        const source = pages.find(p => p.id === id);
        if (!source) return id;
        const newId = uuid();
        const newShapes: Shape[] = JSON.parse(JSON.stringify(source.shapes));
        set(state => ({
          pages: [...state.pages, { id: newId, name: `${source.name} 副本`, shapes: newShapes }],
          activePageId: newId, selectedIds: [], shapes: newShapes,
        }));
        return newId;
      },

      setShowHelp: (show) => set({ showHelp: show }),
      copiedStyle: null,

      copyStyle: () => {
        const { selectedIds, shapes } = get();
        if (selectedIds.length !== 1) return;
        const shape = shapes.find(s => s.id === selectedIds[0]);
        if (!shape) return;
        const style: Partial<Shape> = {
          fill: shape.fill, stroke: shape.stroke, strokeWidth: shape.strokeWidth,
          opacity: shape.opacity, cornerRadius: shape.cornerRadius,
          gradient: shape.gradient, fills: shape.fills, shadows: shape.shadows, shadow: shape.shadow,
          strokeDash: shape.strokeDash,
        };
        if (shape.type === 'text') {
          style.fontSize = shape.fontSize;
          style.fontFamily = shape.fontFamily;
          style.fontWeight = shape.fontWeight;
          style.textAlign = shape.textAlign;
          style.lineHeight = shape.lineHeight;
          style.letterSpacing = shape.letterSpacing;
        }
        set({ copiedStyle: style });
      },

      pasteStyle: () => {
        const { selectedIds, copiedStyle } = get();
        if (!copiedStyle || selectedIds.length === 0) return;
        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss =>
            ss.map(s => selectedIds.includes(s.id) ? { ...s, ...copiedStyle } : s)
          );
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      reorderShape: (id, targetIndex) => {
        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => {
            const idx = ss.findIndex(s => s.id === id);
            if (idx === -1 || targetIndex < 0 || targetIndex >= ss.length) return ss;
            const arr = [...ss];
            const [item] = arr.splice(idx, 1);
            arr.splice(targetIndex, 0, item);
            return arr;
          });
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },
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
        const restored: Shape[] = JSON.parse(JSON.stringify(h[historyIndex].shapes));
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, () => restored);
          return { ...ps, historyIndex: historyIndex - 1, history: h, selectedIds: [] };
        });
      },

      redo: () => {
        const { historyIndex, history } = get();
        if (historyIndex + 2 >= history.length) return;
        const next = history[historyIndex + 2];
        const restored: Shape[] = JSON.parse(JSON.stringify(next.shapes));
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, () => restored);
          return { ...ps, historyIndex: historyIndex + 1, selectedIds: [] };
        });
      },

      addShape: (shape) => {
        get().pushHistory();
        const id = shape.id || uuid();
        const newShape: Shape = { ...DEFAULT_SHAPE_PROPS, ...shape, id, name: shape.name || `${shape.type}-${id.slice(-4)}` };
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => [...ss, newShape]);
          return { pages: ps.pages, shapes: ps.shapes };
        });
        return id;
      },

      updateShape: (id, updates) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s => s.id === id ? { ...s, ...updates } : s));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      deleteShape: (id) => {
        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.filter(s => s.id !== id));
          return { pages: ps.pages, shapes: ps.shapes, selectedIds: state.selectedIds.filter(sid => sid !== id) };
        });
      },

      deleteShapes: (ids) => {
        if (ids.length === 0) return;
        const { shapes } = get();
        const groupIds = new Set(ids.map(id => shapes.find(s => s.id === id)?.groupId).filter(Boolean) as string[]);
        const allIds = new Set(ids);
        groupIds.forEach(gid => { shapes.filter(s => s.groupId === gid).forEach(s => allIds.add(s.id)); });
        const collectChildren = (parentId: string) => {
          shapes.filter(s => s.parentId === parentId).forEach(child => {
            allIds.add(child.id);
            if (child.type === 'frame') collectChildren(child.id);
          });
        };
        ids.forEach(id => { const s = shapes.find(sh => sh.id === id); if (s?.type === 'frame') collectChildren(id); });
        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.filter(s => !allIds.has(s.id)));
          return { pages: ps.pages, shapes: ps.shapes, selectedIds: state.selectedIds.filter(sid => !allIds.has(sid)) };
        });
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
      deleteMaterial: (id) => set(state => ({ materials: state.materials.filter(m => m.id !== id) })),

      clearCanvas: () => {
        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, () => []);
          return { pages: ps.pages, shapes: ps.shapes, selectedIds: [] };
        });
      },

      bringForward: (id) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => {
            const idx = ss.findIndex(s => s.id === id);
            if (idx === -1 || idx === ss.length - 1) return ss;
            const arr = [...ss]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; return arr;
          });
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      sendBackward: (id) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => {
            const idx = ss.findIndex(s => s.id === id);
            if (idx <= 0) return ss;
            const arr = [...ss]; [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]; return arr;
          });
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      duplicateShapes: (ids) => {
        const { shapes } = get();
        const groupIds = new Set(ids.map(id => shapes.find(s => s.id === id)?.groupId).filter(Boolean) as string[]);
        const allIds = new Set(ids);
        groupIds.forEach(gid => shapes.filter(s => s.groupId === gid).forEach(s => allIds.add(s.id)));
        const toDupe = shapes.filter(s => allIds.has(s.id));
        if (toDupe.length === 0) return [];
        get().pushHistory();
        const groupIdMap = new Map<string, string>();
        groupIds.forEach(gid => groupIdMap.set(gid, uuid()));
        const idMap = new Map<string, string>();
        const newIds: string[] = [];
        const copies = toDupe.map(s => {
          const newId = uuid(); newIds.push(newId); idMap.set(s.id, newId);
          return {
            ...s, id: newId, x: s.x + 20, y: s.y + 20, name: `${s.name}-copy`,
            groupId: s.groupId ? groupIdMap.get(s.groupId) : undefined,
            parentId: s.parentId && idMap.has(s.parentId) ? idMap.get(s.parentId) : s.parentId,
          };
        });
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => [...ss, ...copies]);
          return { pages: ps.pages, shapes: ps.shapes, selectedIds: newIds };
        });
        return newIds;
      },

      moveGroupShapes: (groupId, leadId, newLeadX, newLeadY) => {
        set(state => {
          const shapes = state.shapes;
          const lead = shapes.find(s => s.id === leadId);
          if (!lead) return state;
          const dx = newLeadX - lead.x, dy = newLeadY - lead.y;
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s => s.groupId === groupId ? { ...s, x: s.x + dx, y: s.y + dy } : s));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      reparentShape: (shapeId, newParentId) => {
        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s => s.id === shapeId ? { ...s, parentId: newParentId } : s));
          return { pages: ps.pages, shapes: ps.shapes };
        });
        if (newParentId) {
          const shapes = get().shapes;
          const frame = shapes.find(s => s.id === newParentId);
          if (frame?.autoLayout) get().applyAutoLayout(newParentId);
        }
      },

      getChildren: (parentId) => get().shapes.filter(s => s.parentId === parentId),

      applyAutoLayout: (frameId) => {
        const { shapes } = get();
        const frame = shapes.find(s => s.id === frameId);
        if (!frame || !frame.autoLayout) return;
        const children = shapes.filter(s => s.parentId === frameId);
        const updates = computeAutoLayout(frame, children);
        if (updates.size === 0) return;
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s => {
            const u = updates.get(s.id);
            return u ? { ...s, ...u } : s;
          }));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      applyConstraints: (frameId, oldW, oldH, newW, newH) => {
        const { shapes } = get();
        const frame = shapes.find(s => s.id === frameId);
        if (!frame) return;
        const children = shapes.filter(s => s.parentId === frameId);
        if (children.length === 0) return;
        const dw = newW - oldW, dh = newH - oldH;
        if (dw === 0 && dh === 0) return;
        const updates = new Map<string, Partial<Shape>>();
        for (const child of children) {
          const c = child.constraints || { horizontal: 'left', vertical: 'top' };
          const cs = getChildSize(child);
          const relX = child.x - frame.x, relY = child.y - frame.y;
          let nx = child.x, ny = child.y, nw = cs.w, nh = cs.h;
          switch (c.horizontal) {
            case 'left': break;
            case 'right': nx = child.x + dw; break;
            case 'center': nx = child.x + dw / 2; break;
            case 'leftRight': nw = cs.w + dw; break;
            case 'scale': { const ratio = newW / oldW; nx = frame.x + relX * ratio; nw = cs.w * ratio; break; }
          }
          switch (c.vertical) {
            case 'top': break;
            case 'bottom': ny = child.y + dh; break;
            case 'center': ny = child.y + dh / 2; break;
            case 'topBottom': nh = cs.h + dh; break;
            case 'scale': { const ratio = newH / oldH; ny = frame.y + relY * ratio; nh = cs.h * ratio; break; }
          }
          const patch: Partial<Shape> = {};
          if (nx !== child.x) patch.x = nx;
          if (ny !== child.y) patch.y = ny;
          if (child.type === 'circle' || child.type === 'star' || child.type === 'triangle') {
            if (nw !== cs.w || nh !== cs.h) patch.radius = Math.max(5, Math.max(nw, nh) / 2);
          } else {
            if (nw !== cs.w) patch.width = Math.max(10, nw);
            if (nh !== cs.h) patch.height = Math.max(10, nh);
          }
          if (Object.keys(patch).length > 0) updates.set(child.id, patch);
        }
        if (updates.size === 0) return;
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s => {
            const u = updates.get(s.id);
            return u ? { ...s, ...u } : s;
          }));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      alignShapes: (ids, alignment) => {
        set(state => {
          const shapes = state.shapes;
          const selected = shapes.filter(s => ids.includes(s.id));
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
            else if (alignment === 'centerH') { const cx = (minL + maxR) / 2; updates.set(id, { x: b.isRadial ? cx : cx - b.w / 2 }); }
            else if (alignment === 'centerV') { const cy = (minT + maxB) / 2; updates.set(id, { y: b.isRadial ? cy : cy - b.h / 2 }); }
          }
          if (alignment === 'distributeH' && bounds.length >= 3) {
            const sorted = [...bounds].sort((a, b) => a.b.cx - b.b.cx);
            const step = (sorted[sorted.length - 1].b.cx - sorted[0].b.cx) / (sorted.length - 1);
            sorted.forEach((item, i) => { const dx = sorted[0].b.cx + i * step - item.b.cx; updates.set(item.id, { x: item.s.x + dx }); });
          }
          if (alignment === 'distributeV' && bounds.length >= 3) {
            const sorted = [...bounds].sort((a, b) => a.b.cy - b.b.cy);
            const step = (sorted[sorted.length - 1].b.cy - sorted[0].b.cy) / (sorted.length - 1);
            sorted.forEach((item, i) => { const dy = sorted[0].b.cy + i * step - item.b.cy; updates.set(item.id, { y: item.s.y + dy }); });
          }
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s => { const u = updates.get(s.id); return u ? { ...s, ...u } : s; }));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      // === Component system ===
      createComponent: (shapeIds, name) => {
        const { shapes } = get();
        const selected = shapes.filter(s => shapeIds.includes(s.id));
        if (selected.length === 0) return '';
        const compId = uuid();
        const masterShapes = JSON.parse(JSON.stringify(selected)) as Shape[];
        const comp: ComponentDef = { id: compId, name, shapes: masterShapes, variants: [], createdAt: Date.now() };
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s =>
            shapeIds.includes(s.id) ? { ...s, isMainComponent: true, masterComponentId: compId } : s
          ));
          return { components: [...state.components, comp], pages: ps.pages, shapes: ps.shapes };
        });
        return compId;
      },

      createInstance: (componentId, x, y) => {
        const comp = get().components.find(c => c.id === componentId);
        if (!comp) return '';
        const instanceId = uuid();
        const offsetX = comp.shapes[0]?.x || 0;
        const offsetY = comp.shapes[0]?.y || 0;
        const instanceShapes: Shape[] = comp.shapes.map(s => ({
          ...s, id: uuid(), x: s.x - offsetX + x, y: s.y - offsetY + y,
          masterComponentId: componentId, isMainComponent: false, groupId: instanceId,
        }));
        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => [...ss, ...instanceShapes]);
          return { pages: ps.pages, shapes: ps.shapes, selectedIds: instanceShapes.map(s => s.id) };
        });
        return instanceId;
      },

      addVariant: (componentId, variantName) => {
        set(state => ({
          components: state.components.map(c =>
            c.id === componentId ? { ...c, variants: [...c.variants, { id: uuid(), name: variantName, overrides: {} } as VariantDef] } : c
          ),
        }));
      },

      syncInstances: (componentId) => {
        const comp = get().components.find(c => c.id === componentId);
        if (!comp) return;
        set(state => ({
          pages: state.pages.map(page => ({
            ...page,
            shapes: page.shapes.map(s => {
              if (s.masterComponentId !== componentId || s.isMainComponent) return s;
              const masterShape = comp.shapes.find(ms => ms.type === s.type);
              if (!masterShape) return s;
              return { ...s, fill: masterShape.fill, stroke: masterShape.stroke, strokeWidth: masterShape.strokeWidth, fontSize: masterShape.fontSize, ...(s.overrides as Partial<Shape> || {}) };
            }),
          })),
          shapes: (() => {
            const page = state.pages.find(p => p.id === state.activePageId);
            if (!page) return state.shapes;
            return page.shapes.map(s => {
              if (s.masterComponentId !== componentId || s.isMainComponent) return s;
              const masterShape = comp.shapes.find(ms => ms.type === s.type);
              if (!masterShape) return s;
              return { ...s, fill: masterShape.fill, stroke: masterShape.stroke, strokeWidth: masterShape.strokeWidth, fontSize: masterShape.fontSize, ...(s.overrides as Partial<Shape> || {}) };
            });
          })(),
        }));
      },

      detachInstance: (shapeId) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s =>
            s.id === shapeId ? { ...s, masterComponentId: undefined, isMainComponent: undefined, overrides: undefined } : s
          ));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      // === Prototype ===
      setPrototypeMode: (on) => set({ prototypeMode: on, selectedIds: [] }),

      addInteraction: (shapeId, interaction) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s =>
            s.id === shapeId ? { ...s, interactions: [...(s.interactions || []), interaction] } : s
          ));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      removeInteraction: (shapeId, idx) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s => {
            if (s.id !== shapeId || !s.interactions) return s;
            const ints = [...s.interactions]; ints.splice(idx, 1);
            return { ...s, interactions: ints };
          }));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      updateInteraction: (shapeId, idx, patch) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s => {
            if (s.id !== shapeId || !s.interactions?.[idx]) return s;
            const ints = [...s.interactions]; ints[idx] = { ...ints[idx], ...patch };
            return { ...s, interactions: ints };
          }));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      // === Design Tokens ===
      addTheme: (name) => {
        const id = uuid();
        set(state => ({ themes: [...state.themes, { id, name, tokens: [...PRESET_TOKENS] }] }));
        return id;
      },
      deleteTheme: (id) => {
        const { themes, activeThemeId } = get();
        if (themes.length <= 1) return;
        const remaining = themes.filter(t => t.id !== id);
        set({ themes: remaining, activeThemeId: activeThemeId === id ? remaining[0].id : activeThemeId });
      },
      setActiveThemeId: (id) => set({ activeThemeId: id }),
      addToken: (themeId, token) => {
        const id = uuid();
        set(state => ({
          themes: state.themes.map(t => t.id === themeId ? { ...t, tokens: [...t.tokens, { ...token, id }] } : t),
        }));
        return id;
      },
      updateToken: (themeId, tokenId, patch) => {
        set(state => ({
          themes: state.themes.map(t => t.id === themeId
            ? { ...t, tokens: t.tokens.map(tok => tok.id === tokenId ? { ...tok, ...patch } : tok) }
            : t
          ),
        }));
      },
      deleteToken: (themeId, tokenId) => {
        set(state => ({
          themes: state.themes.map(t => t.id === themeId ? { ...t, tokens: t.tokens.filter(tok => tok.id !== tokenId) } : t),
        }));
      },
      getTokenValue: (tokenId) => {
        const { themes, activeThemeId } = get();
        const theme = themes.find(t => t.id === activeThemeId);
        return theme?.tokens.find(t => t.id === tokenId)?.value;
      },
      applyTokenToShape: (shapeId, property, tokenId) => {
        const value = get().getTokenValue(tokenId);
        if (!value) return;
        const propUpdate: Partial<Shape> = {};
        if (property === 'fill') propUpdate.fill = value;
        else if (property === 'stroke') propUpdate.stroke = value;
        else if (property === 'fontSize') propUpdate.fontSize = parseInt(value);
        else if (property === 'cornerRadius') propUpdate.cornerRadius = parseInt(value);
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s =>
            s.id === shapeId ? { ...s, ...propUpdate, tokenRefs: { ...(s.tokenRefs || {}), [property]: tokenId } } : s
          ));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      snapshots: [],
      saveSnapshot: (name) => {
        const id = uuid();
        set(state => ({
          snapshots: [...state.snapshots, { id, name, timestamp: Date.now(), shapes: JSON.parse(JSON.stringify(state.shapes)) }],
        }));
        return id;
      },
      restoreSnapshot: (id) => {
        const snap = get().snapshots.find(s => s.id === id);
        if (!snap) return;
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, () => JSON.parse(JSON.stringify(snap.shapes)));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },
      deleteSnapshot: (id) => set(state => ({ snapshots: state.snapshots.filter(s => s.id !== id) })),
      renameSnapshot: (id, name) => set(state => ({
        snapshots: state.snapshots.map(s => s.id === id ? { ...s, name } : s),
      })),
    }),
    {
      name: 'ai-canvas-editor',
      partialize: (state) => ({
        pages: state.pages,
        activePageId: state.activePageId,
        materials: state.materials,
        chatHistory: state.chatHistory.slice(-20),
        canvasBg: state.canvasBg,
        components: state.components,
        themes: state.themes,
        activeThemeId: state.activeThemeId,
        snapshots: state.snapshots,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const shapes = pageShapes(state.pages, state.activePageId);
          useEditorStore.setState({ shapes });
        }
      },
    }
  )
);
