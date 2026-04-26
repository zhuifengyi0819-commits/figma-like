# AI Canvas — Figma-Like Editor

## 1. Concept & Vision

**"Digital Workshop"** — A personal creative canvas that feels like a well-lit craftsman's workbench. Not cold and corporate, but warm and inviting. Every interaction feels intentional and responsive.

The architecture is built on a **SceneGraph as single source of truth**, with an **EditorEngine** that orchestrates all operations (selection, transform, snap, history). The Canvas renders from SceneGraph and routes all interactions through EditorEngine.

## 2. Design Language

### Color Palette
```css
--bg-deep: #0D0D0F;
--bg-surface: #151518;
--bg-elevated: #1C1C21;
--bg-hover: #252529;
--border: #2A2A30;
--border-active: #3D3D45;
--text-primary: #E8E4DF;
--text-secondary: #8A8680;
--text-tertiary: #5C5A56;
--accent: #D4A853;
--accent-hover: #E5B85C;
--success: #7CB77C;
--danger: #C75D5D;
--canvas-bg: #1A1A1D;
```

### Typography
- **UI**: "Instrument Sans" (Google Fonts)
- **Monospace**: "JetBrains Mono"

### Motion
- Micro-interactions: 150ms ease-out
- Panel transitions: 200ms ease-out
- Canvas zoom: smooth interpolation

## 3. Architecture

### Data Flow (Single Source of Truth)
```
User Action
    ↓
Canvas.tsx (Konva interactions)
    ↓
EditorEngine.startMove() / startResize() / startRotate()
    ↓
TransformEngine + SnapEngine + HistoryManager
    ↓
SceneGraph (read/write nodes)
    ↓
onShapesChange → store._setPageShapes([...shapes])
    ↓
Canvas re-renders from store.shapes
```

### Core Modules

**SceneGraph** (`lib/scene-graph/`)
- Tree structure with O(1) node lookup via Map
- Node types: page, frame, group, rectangle, ellipse, text, line, polygon, star, pen, image, component, instance, boolean, sticky
- Methods: addNode, removeNode, updateNode, reorderNode, getNode, getChildren, getDescendants, getAbsoluteTransform

**EditorEngine** (`lib/editor/`)
- Single entry point for all editor operations
- Owns: SelectionEngine, TransformEngine, SnapEngine, HistoryManager
- API: select(), startMove(), updateTransform(), commitMove(), startResize(), commitResize(), startRotate(), commitRotate(), undo(), redo(), executeCommand()

**HistoryManager** (`lib/history/`)
- Command Pattern: Move, Delete, Create, Resize, Rotate, Group, Reorder, PropertyChange
- Undo/redo with 500ms merge window for continuous operations

**TransformEngine** (`lib/transform/`)
- Move with Shift-constrain
- Resize with 8 handles, Shift-aspect-ratio, Alt-center-pivot
- Rotate with Shift-15° snapping

**SelectionEngine** (`lib/selection/`)
- Single select, multi-select (Shift), marquee select
- enterContext() for double-click container editing
- getSelectionBounds(), getSelectionCenter()

**SnapEngine** (`lib/snap/`)
- Smart guides (alignment + spacing)
- Edge/center snapping with threshold

## 4. File Structure

```
/lib
  /scene-graph
    SceneGraph.ts      — Tree node management (814 lines)
    types.ts           — All node types (358 lines)
  /editor
    EditorEngine.ts    — Central orchestrator (585 lines)
    ShapeConverter.ts  — Shape ↔ SGNode bidirectional sync
    types.ts
  /selection
    SelectionEngine.ts — Selection logic (349 lines)
  /transform
    TransformEngine.ts — Move/resize/rotate (297 lines)
  /history
    HistoryManager.ts  — Command pattern undo/redo (349 lines)
  /snap
    SnapEngine.ts      — Smart guide snapping
  types.ts             — Legacy Shape type (for store compatibility)

/stores
  useEditorStore.ts    — Zustand store (shapes[], selectedIds, UI state)

/hooks
  useEditor.ts         — EditorEngine singleton + sync utilities
  useKeyboardShortcuts.ts

/components
  Canvas.tsx           — Konva Stage + shape rendering + interaction handlers
  SelectionOverlay.tsx — SVG handles + smart guides + marquee
  LayerPanel.tsx       — Tree view from SceneGraph
  PropertiesPanel.tsx  — Property editor
  Toolbar.tsx          — Tool selector
  Header.tsx / StatusBar.tsx
```

## 5. Interaction Model

### Canvas Interactions

| Action | Handler | Engine Method |
|--------|---------|--------------|
| Click shape | Konva onClick | `engine.select(id)` |
| Shift+Click | Konva onClick | `engine.addToSelection(id)` |
| Drag shape | Konva onDragMove | `engine.startMove()` → `engine.updateTransform()` → `engine.commitMove()` |
| Resize handle | Konva onTransformEnd | `engine.startResize()` → `engine.updateTransform()` → `engine.commitResize()` |
| Rotate handle | Konva onTransformEnd | `engine.startRotate()` → `engine.updateTransform()` → `engine.commitRotate()` |
| Marquee drag | Konva onMouseDown (empty) | `engine.selectWithMarquee()` |
| Double-click frame | Konva onDblClick | `engine.enterContext(id)` |
| Escape | keydown | `engine.clearSelection()` / `engine.exitContext()` |

### Keyboard Shortcuts
- `V` — Select tool
- `R` — Rectangle
- `T` — Text
- `F` — Frame
- `O` — Ellipse
- `L` — Line
- `P` — Pen
- `Space+Drag` — Pan
- `Cmd/Ctrl+0` — Zoom 100%
- `Cmd/Ctrl+1` — Zoom to fit
- `Cmd/Ctrl+Z` — Undo
- `Cmd/Ctrl+Shift+Z` — Redo
- `Delete/Backspace` — Delete selected
- `Cmd/Ctrl+A` — Select all
- `Cmd/Ctrl+D` — Duplicate
- `Cmd/Ctrl+G` — Group
- `Cmd/Ctrl+Shift+G` — Ungroup

## 6. Component Editing

### Double-Click Flow
1. Double-click on frame/component → `engine.enterContext(nodeId)`
2. `selectionContextId` set to container ID
3. Canvas shows only children of that container (isolation mode)
4. Layer panel shows container's children as root
5. Double-click empty canvas or press Escape → `engine.exitContext()` → restore full page view

### Component Instance
- Create: select frame → right-click → "Create Component" → creates ComponentNode + replaces original with InstanceNode
- Edit: double-click instance → enter component editing mode
- Exit: "Exit" button or Escape

## 7. Text Editing

- Double-click text node → show HTML textarea overlay positioned over text
- Type to edit, click outside or Escape to commit
- Commits via `engine.executeCommand(propertyCommand)` for undo support

## 8. Layer Panel

- Tree view of SceneGraph (page → children → grandchildren...)
- Each item shows: type icon, name, visibility toggle, lock toggle
- Chevron for expand/collapse (containers: frame, group, component)
- Click to select, Shift+click to multi-select
- Double-click name to rename
- Drag to reorder (changes z-index)
- Right-click for context menu (delete, duplicate, group, ungroup)

## 9. Properties Panel

- Shows when shape(s) selected
- Position: X, Y (editable inputs)
- Size: W, H (editable, with lock aspect ratio toggle)
- Rotation: degree input
- Appearance: fill color, stroke color, stroke width
- Opacity: slider 0–100%
- For text: font size, font family, alignment
- For frame: corner radius, background color

## 10. State Management

### Zustand Store (useEditorStore)
```typescript
interface EditorState {
  // Document
  pages: Page[];
  activePageId: string;
  shapes: Shape[];  // Flat array, synced from SceneGraph

  // Selection
  selectedIds: string[];
  selectionContextId: string | null;  // For component isolation mode

  // Viewport
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;

  // Tool
  activeTool: ToolType;

  // UI
  contextMenu: ContextMenuState | null;
}
```

### History
- Store does NOT own history array
- All undo/redo via HistoryManager (Command Pattern)
- Undo/redo wired to Cmd+Z / Cmd+Shift+Z in useKeyboardShortcuts

## 11. Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Canvas**: react-konva + konva
- **State**: Zustand with persist middleware
- **Icons**: lucide-react
- **Styling**: Tailwind CSS + CSS variables
- **Build**: 0 TypeScript errors, 0 warnings
