import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import {
  Shape, Page, ChatMessage, Material, ToolType, AutoLayout, ComponentDef, VariantDef,
  DesignToken, DesignTheme, Interaction, VersionSnapshot, TextStyle, TokenBindings,
  DEFAULT_SHAPE_PROPS, DEFAULT_AUTO_LAYOUT, PRESET_TOKENS,
  Variable, VariableValue, ComponentStateType,
} from '@/lib/types';
import { unionAABBs } from '@/lib/measurement';
import { computeBooleanPath, canDoBoolean } from '@/lib/boolean';

const MAX_HISTORY = 50;

interface HistoryEntry { shapes: Shape[]; }
type AlignType = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV' | 'distributeH' | 'distributeV';

interface ContextMenuState {
  x: number;
  y: number;
  targetIds: string[];
}

interface EditorState {
  pages: Page[];
  activePageId: string;
  shapes: Shape[];
  addPage: (name?: string) => string;
  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  setActivePageId: (id: string) => void;
  duplicatePage: (id: string) => string;
  reorderPages: (fromId: string, toId: string) => void;

  addShape: (shape: Omit<Shape, 'id'> & { id?: string }) => string;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  updateShapes: (ids: string[], updates: Partial<Shape>) => void;
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
  viewportWidth: number;
  viewportHeight: number;
  setCanvasZoom: (zoom: number) => void;
  setCanvasPan: (pan: { x: number; y: number }) => void;
  setViewportSize: (w: number, h: number) => void;
  panToShapeIds: (ids: string[], viewportW?: number, viewportH?: number) => void;

  canvasBg: string;
  setCanvasBg: (bg: string) => void;

  chatHistory: ChatMessage[];
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;

  contextMenu: ContextMenuState | null;
  showContextMenu: (menu: ContextMenuState) => void;
  hideContextMenu: () => void;
  arrayModalOpen: boolean;
  setArrayModalOpen: (open: boolean) => void;

  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  materials: Material[];
  textStyles: TextStyle[];
  activeTextStyleId: string | null;
  addTextStyle: (style: Omit<TextStyle, 'id'>) => void;
  removeTextStyle: (id: string) => void;
  updateTextStyle: (id: string, patch: Partial<TextStyle>) => void;
  renameTextStyle: (id: string, name: string) => void;
  applyTextStyle: (textIds: string[], styleId: string) => void;
  setActiveTextStyleId: (id: string | null) => void;
  saveMaterial: (shape: Shape, name: string) => void;
  deleteMaterial: (id: string) => void;

  clearCanvas: () => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  duplicateShapes: (ids: string[]) => string[];
  arrayCopy: (ids: string[], count: number, spacing: number, rotation: number, layout: 'circular' | 'linear' | 'grid') => void;
  moveGroupShapes: (groupId: string, leadId: string, newLeadX: number, newLeadY: number) => void;
  alignShapes: (ids: string[], alignment: AlignType) => void;

  reparentShape: (shapeId: string, newParentId: string | undefined) => void;
  getChildren: (parentId: string) => Shape[];
  applyAutoLayout: (frameId: string) => void;
  applyConstraints: (frameId: string, oldW: number, oldH: number, newW: number, newH: number) => void;
  applyBooleanOperation: (ids: [string, string], op: 'union' | 'subtract' | 'intersect' | 'exclude') => void;

  history: HistoryEntry[];
  historyIndex: number;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  showHelp: boolean;
  setShowHelp: (show: boolean) => void;

  showDevicePreview: boolean;
  setShowDevicePreview: (show: boolean) => void;

  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;

  copiedStyle: Partial<Shape> | null;
  copyStyle: () => void;
  pasteStyle: () => void;
  reorderShape: (id: string, targetIndex: number) => void;

  groupSelection: () => void;
  ungroupSelection: () => void;

  components: ComponentDef[];
  createComponent: (shapeIds: string[], name: string) => string;
  createInstance: (componentId: string, x: number, y: number) => string;
  addVariant: (componentId: string, variantName: string) => void;
  deleteVariant: (componentId: string, variantId: string) => void;
  renameVariant: (componentId: string, variantId: string, name: string) => void;
  applyVariant: (shapeId: string, variantId: string) => void;
  syncInstances: (componentId: string) => void;
  detachInstance: (shapeId: string) => void;

  editingComponentId: string | null;
  enterComponentEditing: (componentId: string) => void;
  exitComponentEditing: () => void;

  editingGroupId: string | null;
  enterGroupEditing: (groupId: string) => void;
  exitGroupEditing: () => void;

  prototypeMode: 'EDIT' | 'FLOW' | 'PREVIEW';
  setPrototypeMode: (mode: 'EDIT' | 'FLOW' | 'PREVIEW') => void;
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
  bindToken: (shapeId: string, property: keyof TokenBindings, tokenId: string) => void;
  unbindToken: (shapeId: string, property: keyof TokenBindings) => void;

  snapshots: VersionSnapshot[];
  saveSnapshot: (name: string) => string;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  renameSnapshot: (id: string, name: string) => void;

  versionHistory: VersionSnapshot[];
  currentVersionIndex: number;
  maxVersions: number;
  saveVersion: (name?: string) => void;
  restoreVersion: (versionId: string) => void;
  deleteVersion: (versionId: string) => void;
  clearVersionHistory: () => void;

  // ==================== Variable System ====================
  variables: Variable[];
  variableValues: VariableValue[]; // runtime values (may differ from defaults)
  addVariable: (name: string, type: 'string' | 'number' | 'boolean', defaultValue: string | number | boolean) => string;
  updateVariable: (id: string, patch: Partial<Omit<Variable, 'id'>>) => void;
  deleteVariable: (id: string) => void;
  getVariableValue: (id: string) => string | number | boolean | undefined;
  setVariableValue: (id: string, value: string | number | boolean) => void;
  resetVariableToDefault: (id: string) => void;

  // ==================== Component State ====================
  activeStates: Record<string, ComponentStateType>; // shapeId -> state
  setShapeState: (shapeId: string, state: ComponentStateType) => void;
  resetShapeState: (shapeId: string) => void;
  resetAllStates: () => void;
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
  const wrap = al.wrap && isH;
  const sizes = children.map(c => getChildSize(c));

  // Wrap layout: pack children into rows
  if (wrap) {
    const rows: { child: Shape; size: { w: number; h: number }; idxInRow: number }[][] = [];
    let currentRow: { child: Shape; size: { w: number; h: number }; idxInRow: number }[] = [];
    let currentRowWidth = 0;
    children.forEach((child, i) => {
      const cs = sizes[i];
      if (currentRow.length > 0 && currentRowWidth + al.gap + cs.w > innerW) {
        rows.push(currentRow);
        currentRow = [];
        currentRowWidth = 0;
      }
      currentRow.push({ child, size: cs, idxInRow: currentRow.length });
      currentRowWidth += (currentRow.length > 1 ? al.gap : 0) + cs.w;
    });
    if (currentRow.length > 0) rows.push(currentRow);

    // Position each row
    let rowY = al.paddingTop;
    rows.forEach((row) => {
      const rowH = Math.max(...row.map(r => r.size.h));
      const rowW = row.reduce((sum, r, i) => sum + r.size.w + (i > 0 ? al.gap : 0), 0);
      let rowMainOffset = 0;
      if (al.justifyContent === 'center') rowMainOffset = (innerW - rowW) / 2;
      else if (al.justifyContent === 'end') rowMainOffset = innerW - rowW;
      else if (al.justifyContent === 'space-between' && row.length > 1) {
        const space = (innerW - rowW) / (row.length - 1);
        let cursor = 0;
        row.forEach(({ child, size }) => {
          const cross = computeCrossOffset(al, rowH, size.h);
          const x = frame.x + al.paddingLeft + cursor + space * (row.indexOf(row.find(r => r.child.id === child.id)!));
          const y = frame.y + rowY + cross;
          if (child.type === 'circle' || child.type === 'star' || child.type === 'triangle') {
            updates.set(child.id, { x: x + size.w / 2, y: y + size.h / 2 });
          } else { updates.set(child.id, { x, y }); }
          cursor += size.w + space;
        });
        rowY += rowH + al.gap;
        return;
      }
      let cursor = rowMainOffset;
      row.forEach(({ child, size }) => {
        const cross = computeCrossOffset(al, rowH, size.h);
        const x = frame.x + al.paddingLeft + cursor;
        const y = frame.y + rowY + cross;
        if (child.type === 'circle' || child.type === 'star' || child.type === 'triangle') {
          updates.set(child.id, { x: x + size.w / 2, y: y + size.h / 2 });
        } else { updates.set(child.id, { x, y }); }
        cursor += size.w + al.gap;
      });
      rowY += rowH + al.gap;
    });
    return updates;
  }

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
      viewportWidth: 1440,
      viewportHeight: 900,
      canvasBg: '#1A1A1D',
      chatHistory: [],
      contextMenu: null,
      arrayModalOpen: false,
      materials: [],
      textStyles: [],
      activeTextStyleId: null,
      history: [],
      historyIndex: -1,
      showHelp: false,
      showDevicePreview: false,
      components: [],
      editingComponentId: null,
      editingGroupId: null,
      enterGroupEditing: (groupId) => {
        const shapes = get().shapes;
        const childIds = shapes.filter(s => s.parentId === groupId).map(s => s.id);
        set({ editingGroupId: groupId, selectedIds: childIds });
      },
      exitGroupEditing: () => {
        set({ editingGroupId: null });
      },

      prototypeMode: 'EDIT' as const,
      themes: [{ id: defaultThemeId, name: 'Default', tokens: [...PRESET_TOKENS] }],
      activeThemeId: defaultThemeId,

      // ==================== Variable System ====================
      variables: [],
      variableValues: [],

      addVariable: (name, type, defaultValue) => {
        const id = uuid();
        set(state => ({
          variables: [...state.variables, { id, name, type, defaultValue }],
          variableValues: [...state.variableValues, { variableId: id, value: defaultValue }],
        }));
        return id;
      },
      updateVariable: (id, patch) => {
        set(state => ({
          variables: state.variables.map(v => v.id === id ? { ...v, ...patch } : v),
        }));
      },
      deleteVariable: (id) => {
        set(state => ({
          variables: state.variables.filter(v => v.id !== id),
          variableValues: state.variableValues.filter(vv => vv.variableId !== id),
        }));
      },
      getVariableValue: (id) => {
        const vv = get().variableValues.find(v => v.variableId === id);
        if (vv) return vv.value;
        const v = get().variables.find(v => v.id === id);
        return v?.defaultValue;
      },
      setVariableValue: (id, value) => {
        set(state => {
          const exists = state.variableValues.find(vv => vv.variableId === id);
          if (exists) {
            return { variableValues: state.variableValues.map(vv => vv.variableId === id ? { ...vv, value } : vv) };
          }
          return { variableValues: [...state.variableValues, { variableId: id, value }] };
        });
      },
      resetVariableToDefault: (id) => {
        const v = get().variables.find(v => v.id === id);
        if (v) get().setVariableValue(id, v.defaultValue);
      },

      // ==================== Component State ====================
      activeStates: {},

      setShapeState: (shapeId, state) => {
        set(s => ({ activeStates: { ...s.activeStates, [shapeId]: state } }));
      },
      resetShapeState: (shapeId) => {
        set(s => {
          const next = { ...s.activeStates };
          delete next[shapeId];
          return { activeStates: next };
        });
      },
      resetAllStates: () => set({ activeStates: {} }),

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

      reorderPages: (fromId, toId) => {
        set(state => {
          const pageIndex = state.pages.findIndex(p => p.id === fromId);
          const toIndex = state.pages.findIndex(p => p.id === toId);
          if (pageIndex === -1 || toIndex === -1) return state;
          const newPages = [...state.pages];
          const [removed] = newPages.splice(pageIndex, 1);
          newPages.splice(toIndex, 0, removed);
          return { pages: newPages };
        });
      },

      setShowHelp: (show) => set({ showHelp: show }),
      setShowDevicePreview: (show) => set({ showDevicePreview: show }),
      showExportModal: false,
      setShowExportModal: (show) => set({ showExportModal: show }),
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

      // Moves shape `id` to position `targetIndex` among its siblings (shapes with same parentId).
      // targetIndex is relative to the sibling list (0 = first sibling).
      reorderShape: (id, targetIndex) => {
        const { shapes } = get();
        const shape = shapes.find(s => s.id === id);
        if (!shape) return;
        const parentId = shape.parentId;
        // All siblings including the shape itself, in array order
        const siblings = shapes.filter(s => s.parentId === parentId);
        const fromIdx = siblings.findIndex(s => s.id === id);
        if (fromIdx === -1) return;
        // Clamp target
        const clampedTarget = Math.max(0, Math.min(targetIndex, siblings.length - 1));
        if (fromIdx === clampedTarget) return;

        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => {
            // Build ordered list of sibling ids
            const siblingIds = [...siblings.map(s => s.id)];
            // Remove from current position
            siblingIds.splice(fromIdx, 1);
            // Insert at target position
            siblingIds.splice(clampedTarget, 0, id);
            // Now rebuild the full array: siblings appear in siblingIds order, others stay where they were
            
            // Interleave: for each sibling position, put the right sibling; non-siblings go between top-level items
            // Strategy: start with non-siblings, insert siblings at their relative positions
            // Better: keep non-siblings in place, reorder only the sibling block
            const arr = [...ss];
            // Find the flat indices of all siblings in the current array
            const siblingFlatIndices = siblingIds
              .map(sid => arr.findIndex(a => a.id === sid))
              .filter(i => i !== -1)
              .sort((a, b) => a - b);
            if (siblingFlatIndices.length === 0) return ss;
            // Extract sibling shapes in current array order
            const currentSiblingShapes = siblingFlatIndices.map(i => arr[i]);
            // Build new sibling order
            const newSiblingOrder = siblingIds.map(sid => currentSiblingShapes.find(s => s.id === sid)!).filter(Boolean);
            // Write back
            siblingFlatIndices.forEach((fi, i) => { arr[fi] = newSiblingOrder[i]; });
            return arr;
          });
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      groupSelection: () => {
        const { selectedIds, shapes } = get();
        if (selectedIds.length < 2) return;
        const picked = selectedIds.map(id => shapes.find(s => s.id === id)).filter(Boolean) as Shape[];
        const p0 = picked[0].parentId;
        if (!picked.every(s => s.parentId === p0)) return;
        const union = unionAABBs(picked);
        if (!union || union.w <= 0 || union.h <= 0) return;
        get().pushHistory();
        const gid = uuid();
        const newGroup: Shape = {
          ...DEFAULT_SHAPE_PROPS,
          id: gid,
          type: 'group',
          x: union.left,
          y: union.top,
          width: union.w,
          height: union.h,
          name: 'Group',
          parentId: p0,
          clipContent: false,
          fill: 'transparent',
          stroke: '#6B6B74',
          strokeWidth: 1,
          rotation: 0,
          visible: true,
          locked: false,
        };
        set(state => {
          const ap = state.activePageId;
          const ss = [...pageShapes(state.pages, ap)];
          const idxs = selectedIds.map(id => ss.findIndex(s => s.id === id)).filter(i => i >= 0);
          const insertIdx = Math.min(...idxs);
          ss.splice(insertIdx, 0, newGroup);
          const next = ss.map(s => selectedIds.includes(s.id) ? { ...s, parentId: gid } : s);
          const ps = updatePageShapes(state.pages, ap, () => next);
          return { pages: ps.pages, shapes: ps.shapes, selectedIds: [gid] };
        });
      },

      ungroupSelection: () => {
        const { selectedIds, shapes } = get();
        if (selectedIds.length !== 1) return;
        const g = shapes.find(s => s.id === selectedIds[0]);
        if (!g || g.type !== 'group') return;
        const gp = g.parentId;
        const groupId = g.id;
        const childIds = shapes.filter(s => s.parentId === groupId).map(s => s.id);
        get().pushHistory();
        set(state => {
          const ap = state.activePageId;
          const ps = updatePageShapes(state.pages, ap, ss =>
            ss.filter(s => s.id !== groupId).map(sh =>
              childIds.includes(sh.id) ? { ...sh, parentId: gp } : sh,
            ),
          );
          return { pages: ps.pages, shapes: ps.shapes, selectedIds: childIds.length ? childIds : [] };
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

      updateShapes: (ids, updates) => {
        const idSet = new Set(ids);
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss =>
            ss.map(s => idSet.has(s.id) ? { ...s, ...updates } : s),
          );
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
            if (child.type === 'frame' || child.type === 'group') collectChildren(child.id);
          });
        };
        ids.forEach(id => { const s = shapes.find(sh => sh.id === id); if (s?.type === 'frame' || s?.type === 'group') collectChildren(id); });
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
      setViewportSize: (w, h) => set({ viewportWidth: w, viewportHeight: h }),



      /**
       * 将指定 shapes 滚入视野并居中显示
       * viewportW/viewportH 由 Canvas 组件在调用处传入
       */
      panToShapeIds: (ids: string[], viewportW?: number, viewportH?: number) => {
        const { shapes, canvasZoom, viewportWidth, viewportHeight } = get();
        const vpW = viewportW ?? viewportWidth;
        const vpH = viewportH ?? viewportHeight;
        const targetShapes = shapes.filter(s => ids.includes(s.id) && s.visible);
        if (targetShapes.length === 0) return;

        // 计算包围盒
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const s of targetShapes) {
          const x = s.x ?? 0;
          const y = s.y ?? 0;
          if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') {
            const r = s.radius ?? 50;
            minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r);
            minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r);
          } else {
            const w = s.width ?? 100;
            const h = s.height ?? 100;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x + w);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y + h);
          }
        }

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // 计算合适的 zoom：以内容充满视口 70% 为目标
        const zoomX = (vpW * 0.7) / contentW;
        const zoomY = (vpH * 0.7) / contentH;
        const newZoom = Math.max(0.1, Math.min(canvasZoom, Math.min(zoomX, zoomY)));

        // 计算 pan 使内容居中
        const panX = vpW / 2 - centerX * newZoom;
        const panY = vpH / 2 - centerY * newZoom;

        set({ canvasZoom: newZoom, canvasPan: { x: panX, y: panY } });
      },

      addChatMessage: (message) => {
        const newMessage: ChatMessage = { ...message, id: uuid(), timestamp: Date.now() };
        set((state) => ({ chatHistory: [...state.chatHistory.slice(-49), newMessage] }));
      },
      clearChat: () => set({ chatHistory: [] }),

      saveMaterial: (shape, name) => {
        const { ...rest } = shape;
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
        const { shapes } = get();
        const shape = shapes.find(s => s.id === id);
        if (!shape) return;
        const parentId = shape.parentId;
        const siblings = shapes.filter(s => s.parentId === parentId);
        const idx = siblings.findIndex(s => s.id === id);
        if (idx === -1 || idx === siblings.length - 1) return;
        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => {
            const arr = [...ss];
            const flatIdx = arr.findIndex(s => s.id === id);
            const nextFlatIdx = arr.findIndex(s => s.id === siblings[idx + 1].id);
            if (flatIdx !== -1 && nextFlatIdx !== -1) {
              [arr[flatIdx], arr[nextFlatIdx]] = [arr[nextFlatIdx], arr[flatIdx]];
            }
            return arr;
          });
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      sendBackward: (id) => {
        const { shapes } = get();
        const shape = shapes.find(s => s.id === id);
        if (!shape) return;
        const parentId = shape.parentId;
        const siblings = shapes.filter(s => s.parentId === parentId);
        const idx = siblings.findIndex(s => s.id === id);
        if (idx <= 0) return;
        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => {
            const arr = [...ss];
            const flatIdx = arr.findIndex(s => s.id === id);
            const prevFlatIdx = arr.findIndex(s => s.id === siblings[idx - 1].id);
            if (flatIdx !== -1 && prevFlatIdx !== -1) {
              [arr[flatIdx], arr[prevFlatIdx]] = [arr[prevFlatIdx], arr[flatIdx]];
            }
            return arr;
          });
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      showContextMenu: (menu) => set({ contextMenu: menu }),
      hideContextMenu: () => set({ contextMenu: null }),
      setArrayModalOpen: (open) => set({ arrayModalOpen: open }),

      bringToFront: (id) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => {
            const idx = ss.findIndex(s => s.id === id);
            if (idx === -1 || idx === ss.length - 1) return ss;
            const arr = [...ss];
            const [item] = arr.splice(idx, 1);
            arr.push(item);
            return arr;
          });
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      sendToBack: (id) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => {
            const idx = ss.findIndex(s => s.id === id);
            if (idx === -1 || idx === 0) return ss;
            const arr = [...ss];
            const [item] = arr.splice(idx, 1);
            arr.unshift(item);
            return arr;
          });
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      duplicateShapes: (ids) => {
        const { shapes } = get();
        const groupIds = new Set(ids.map(id => shapes.find(s => s.id === id)?.groupId).filter(Boolean) as string[]);
        const allIds = new Set(ids);
        groupIds.forEach(gid => shapes.filter(s => s.groupId === gid).forEach(s => allIds.add(s.id)));
        const collectDescendants = (pid: string) => {
          shapes.filter(s => s.parentId === pid).forEach(ch => {
            allIds.add(ch.id);
            if (ch.type === 'frame' || ch.type === 'group') collectDescendants(ch.id);
          });
        };
        ids.forEach(id => {
          const s = shapes.find(sh => sh.id === id);
          if (s?.type === 'frame' || s?.type === 'group') collectDescendants(id);
        });
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

      arrayCopy: (ids, count, spacing, rotation, layout) => {
        if (ids.length === 0 || count < 2) return;
        get().pushHistory();
        const shapes = get().shapes;
        const newIds: string[] = [];
        const newShapes: Shape[] = [];
        ids.forEach(id => {
          const s = shapes.find(sh => sh.id === id);
          if (!s) return;
          for (let i = 1; i < count; i++) {
            const newId = uuid();
            newIds.push(newId);
            let nx = s.x, ny = s.y;
            if (layout === 'linear') {
              nx = s.x + (s.width || 100 + (s.width || 0) + spacing) * i;
              ny = s.y;
            } else if (layout === 'grid') {
              const cols = Math.ceil(Math.sqrt(count));
              nx = s.x + ((s.width || 100) + spacing) * (i % cols);
              ny = s.y + ((s.height || 100) + spacing) * Math.floor(i / cols);
            } else {
              // circular / rotate copy around the shape center
              const cx = s.x + (s.width || 100) / 2;
              const cy = s.y + (s.height || 100) / 2;
              const rad = (rotation * i * Math.PI) / 180;
              const r = spacing;
              nx = cx + r * Math.cos(rad) - (s.width || 100) / 2;
              ny = cy + r * Math.sin(rad) - (s.height || 100) / 2;
            }
            newShapes.push({ ...s, id: newId, x: nx, y: ny, name: `${s.name}×${i + 1}`, rotation: layout !== 'linear' && layout !== 'grid' ? (s.rotation || 0) + rotation * i : s.rotation });
          }
        });
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => [...ss, ...newShapes]);
          return { pages: ps.pages, shapes: ps.shapes, selectedIds: newIds };
        });
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
          const c = child.constraints || { horizontal: 'min', vertical: 'min' };
          const cs = getChildSize(child);
          let nx = child.x, ny = child.y, nw = cs.w, nh = cs.h;

          // Apply horizontal constraints
          switch (c.horizontal) {
            case 'min': break; // Pin to left edge, no change
            case 'max': nx = child.x + dw; break; // Pin to right edge
            case 'center': nx = child.x + dw / 2; break; // Center horizontally
            case 'stretch': nw = Math.max(10, cs.w + dw); break; // Stretch horizontally
          }

          // Apply vertical constraints
          switch (c.vertical) {
            case 'min': break; // Pin to top edge, no change
            case 'max': ny = child.y + dh; break; // Pin to bottom edge
            case 'center': ny = child.y + dh / 2; break; // Center vertically
            case 'stretch': nh = Math.max(10, cs.h + dh); break; // Stretch vertically
          }

          // Apply min/max dimension constraints
          if (child.minWidth !== undefined && nw < child.minWidth) nw = child.minWidth;
          if (child.maxWidth !== undefined && nw > child.maxWidth) nw = child.maxWidth;
          if (child.minHeight !== undefined && nh < child.minHeight) nh = child.minHeight;
          if (child.maxHeight !== undefined && nh > child.maxHeight) nh = child.maxHeight;

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

      applyBooleanOperation: (ids, op) => {
        if (ids.length !== 2) return;
        const [aId, bId] = ids;
        const shapeA = get().shapes.find(s => s.id === aId);
        const shapeB = get().shapes.find(s => s.id === bId);
        if (!shapeA || !shapeB) return;
        if (!canDoBoolean(shapeA) || !canDoBoolean(shapeB)) return;
        const pathData = computeBooleanPath(shapeA, shapeB, op);
        if (!pathData) return;
        get().pushHistory();
        const newShape: Shape = {
          id: uuid(),
          type: 'path',
          x: shapeA.x,
          y: shapeA.y,
          fill: shapeA.fill,
          stroke: shapeA.stroke,
          strokeWidth: shapeA.strokeWidth,
          opacity: shapeA.opacity,
          rotation: shapeA.rotation,
          visible: true,
          locked: false,
          name: `${shapeA.name} ∩ ${shapeB.name}`,
          pathData,
          booleanOp: op,
          booleanSourceIds: [aId, bId],
          pathPoints: [],
          closePath: true,
        };
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss =>
            [...ss.filter(s => s.id !== aId && s.id !== bId), newShape]
          );
          return { pages: ps.pages, shapes: ps.shapes, selectedIds: [newShape.id] };
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
        // 建立旧ID → 新ID 的映射，保留嵌套关系
        const idMap = new Map<string, string>();
        comp.shapes.forEach(s => idMap.set(s.id, uuid()));
        const instanceShapes: Shape[] = comp.shapes.map(s => ({
          ...s,
          id: idMap.get(s.id)!,
          x: s.x - offsetX + x,
          y: s.y - offsetY + y,
          masterComponentId: componentId,
          isMainComponent: false,
          groupId: instanceId,
          parentId: s.parentId && idMap.has(s.parentId) ? idMap.get(s.parentId) : s.parentId,
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

      deleteVariant: (componentId, variantId) => {
        set(state => ({
          components: state.components.map(c =>
            c.id === componentId ? { ...c, variants: c.variants.filter(v => v.id !== variantId) } : c
          ),
        }));
      },

      renameVariant: (componentId, variantId, name) => {
        set(state => ({
          components: state.components.map(c =>
            c.id === componentId ? { ...c, variants: c.variants.map(v => v.id === variantId ? { ...v, name } : v) } : c
          ),
        }));
      },

      applyVariant: (shapeId, variantId) => {
        const { components, shapes } = get();
        const shape = shapes.find(s => s.id === shapeId);
        if (!shape || !shape.masterComponentId) return;
        const comp = components.find(c => c.id === shape.masterComponentId);
        if (!comp) return;
        const variant = comp.variants.find(v => v.id === variantId);
        if (!variant) return;

        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss =>
            ss.map(s => s.id === shapeId ? { ...s, overrides: variant.overrides } : s)
          );
          return { pages: ps.pages, shapes: ps.shapes };
        });
        get().syncInstances(shape.masterComponentId);
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

      // === Component Editing Mode ===
      enterComponentEditing: (componentId) => {
        const shapes = get().shapes;
        const childIds = shapes.filter(s => s.parentId === componentId).map(s => s.id);
        set({ editingComponentId: componentId, selectedIds: childIds });
      },

      exitComponentEditing: () => {
        set({ editingComponentId: null });
      },

      // === Prototype ===
      setPrototypeMode: (mode) => set({ prototypeMode: mode, selectedIds: [] }),

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
        // First, get the updated token value to propagate to shapes
        const state = get();
        const theme = state.themes.find(t => t.id === themeId);
        const token = theme?.tokens.find(t => t.id === tokenId);
        const newValue = patch.value ?? token?.value;
        
        // If value changed, propagate to all shapes bound to this token
        if (patch.value !== undefined && newValue !== undefined) {
          const shapesToUpdate: { id: string; updates: Partial<Shape> }[] = [];
          for (const shape of state.shapes) {
            const bindings = (shape as Shape).tokenBindings;
            if (!bindings) continue;
            // Check if any property is bound to this token
            for (const [prop, boundTokenId] of Object.entries(bindings)) {
              if (boundTokenId === tokenId) {
                const updates: Partial<Shape> = {};
                if (prop === 'fill') updates.fill = newValue;
                else if (prop === 'stroke') updates.stroke = newValue;
                else if (prop === 'opacity') updates.opacity = parseFloat(newValue);
                else if (prop === 'cornerRadius') updates.cornerRadius = parseInt(newValue);
                else if (prop === 'fontSize') updates.fontSize = parseInt(newValue);
                if (Object.keys(updates).length > 0) {
                  shapesToUpdate.push({ id: shape.id, updates });
                }
                break;
              }
            }
          }
          
          if (shapesToUpdate.length > 0) {
            set(state => {
              const ps = updatePageShapes(state.pages, state.activePageId, ss =>
                ss.map(s => {
                  const update = shapesToUpdate.find(u => u.id === s.id);
                  return update ? { ...s, ...update.updates } : s;
                })
              );
              return {
                themes: state.themes.map(t => t.id === themeId
                  ? { ...t, tokens: t.tokens.map(tok => tok.id === tokenId ? { ...tok, ...patch } : tok) }
                  : t
                ),
                pages: ps.pages,
                shapes: ps.shapes,
              };
            });
            return;
          }
        }
        
        // No shape update needed, just update the token
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
      bindToken: (shapeId, property, tokenId) => {
        const value = get().getTokenValue(tokenId);
        if (!value) return;
        const propUpdate: Partial<Shape> = {};
        if (property === 'fill') propUpdate.fill = value;
        else if (property === 'stroke') propUpdate.stroke = value;
        else if (property === 'opacity') propUpdate.opacity = parseFloat(value);
        else if (property === 'cornerRadius') propUpdate.cornerRadius = parseInt(value);
        else if (property === 'fontSize') propUpdate.fontSize = parseInt(value);
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s =>
            s.id === shapeId
              ? { ...s, ...propUpdate, tokenBindings: { ...(s.tokenBindings || {}), [property]: tokenId } }
              : s
          ));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },
      unbindToken: (shapeId, property) => {
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss => ss.map(s => {
            if (s.id !== shapeId) return s;
            const bindings = { ...(s.tokenBindings || {}) };
            delete bindings[property];
            return { ...s, tokenBindings: bindings };
          }));
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },

      snapshots: [],
      saveSnapshot: (name) => {
        const id = uuid();
        const MAX_SNAPSHOTS = 24;
        let copy: Shape[];
        try {
          copy = JSON.parse(JSON.stringify(get().shapes)) as Shape[];
        } catch {
          console.error('saveSnapshot: serialization failed');
          return '';
        }
        set(state => {
          let next = [...state.snapshots, { id, name, timestamp: Date.now(), shapes: copy }];
          if (next.length > MAX_SNAPSHOTS) next = next.slice(-MAX_SNAPSHOTS);
          return { snapshots: next };
        });
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

      // Version History
      versionHistory: [],
      currentVersionIndex: -1,
      maxVersions: 50,
      saveVersion: (name) => {
        const state = get();
        const snapshot: VersionSnapshot = {
          id: uuid(),
          name: name || `版本 ${state.versionHistory.length + 1}`,
          timestamp: Date.now(),
          shapes: JSON.parse(JSON.stringify(state.shapes)),
        };
        set(state => ({
          versionHistory: [snapshot, ...state.versionHistory].slice(0, state.maxVersions),
          currentVersionIndex: -1,
        }));
      },
      restoreVersion: (versionId) => {
        const state = get();
        const version = state.versionHistory.find(v => v.id === versionId);
        if (!version) return;
        try {
          const shapes = JSON.parse(JSON.stringify(version.shapes));
          set(state => {
            const ps = updatePageShapes(state.pages, state.activePageId, () => shapes);
            return { 
              pages: ps.pages, 
              shapes: ps.shapes,
              currentVersionIndex: state.versionHistory.findIndex(v => v.id === versionId),
            };
          });
        } catch (e) {
          console.error('Failed to restore version:', e);
        }
      },
      deleteVersion: (versionId) => set(state => ({
        versionHistory: state.versionHistory.filter(v => v.id !== versionId),
      })),
      clearVersionHistory: () => set({ versionHistory: [], currentVersionIndex: -1 }),

      // Text Styles
      addTextStyle: (style: Omit<TextStyle, 'id'>) => {
        const existing = get().textStyles.find(s => s.name === style.name);
        if (existing) return;
        const id = uuid();
        set(state => ({ textStyles: [...state.textStyles, { ...style, id }] }));
      },
      removeTextStyle: (id) => {
        set(state => ({ textStyles: state.textStyles.filter(s => s.id !== id) }));
      },
      updateTextStyle: (id, patch) => {
        set(state => ({
          textStyles: state.textStyles.map(s => s.id === id ? { ...s, ...patch } : s),
        }));
      },
      renameTextStyle: (id, name) => set(state => ({
        textStyles: state.textStyles.map(s => s.id === id ? { ...s, name } : s),
      })),
      applyTextStyle: (textIds, styleId) => {
        const style = get().textStyles.find(s => s.id === styleId);
        if (!style) return;
        const { fontFamily, fontSize, fontWeight, fill, lineHeight, letterSpacing, textAlign } = style;
        get().pushHistory();
        set(state => {
          const ps = updatePageShapes(state.pages, state.activePageId, ss =>
            ss.map(s => textIds.includes(s.id)
              ? { ...s, textStyleId: styleId, fontFamily, fontSize, fontWeight, fill, lineHeight, letterSpacing, textAlign }
              : s
            )
          );
          return { pages: ps.pages, shapes: ps.shapes };
        });
      },
      setActiveTextStyleId: (id) => set({ activeTextStyleId: id }),
    }),
    {
      name: 'ai-canvas-editor',
      partialize: (state) => ({
        pages: state.pages,
        activePageId: state.activePageId,
        materials: state.materials,
        textStyles: state.textStyles,
        chatHistory: state.chatHistory.slice(-20),
        canvasBg: state.canvasBg,
        components: state.components,
        themes: state.themes,
        activeThemeId: state.activeThemeId,
        snapshots: state.snapshots,
        versionHistory: state.versionHistory,
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
