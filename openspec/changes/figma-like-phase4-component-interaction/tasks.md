# Tasks: figma-like-phase4-component-interaction

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add component double-click editing mode + layer panel expand/collapse + relationship visuals

**Architecture:** 
- Component editing via `editingComponentId` state in Zustand, isolated canvas rendering in Canvas.tsx
- Layer expand/collapse via local `expandedIds` Set in LayerPanel, no store pollution
- Layer relationship via childCount badge and selected parent highlight

**Tech Stack:** Next.js, React, Konva, Zustand, Tailwind

---

## Task 1: Add `editingComponentId` state and actions to store

**Objective:** Add component editing mode state and navigation actions to the Zustand store

**Files:**
- Modify: `stores/useEditorStore.ts`

**Step 1: Add state declaration**

Find the state interface section in useEditorStore.ts (around line 90-130), add:

```typescript
editingComponentId: string | null;
```

**Step 2: Add initial state**

In the `initialState` object (around line 330), add:

```typescript
editingComponentId: null,
```

**Step 3: Add action declarations**

In the interface section (around line 125), add:

```typescript
enterComponentEditing: (componentId: string) => void;
exitComponentEditing: () => void;
```

**Step 4: Add action implementations**

Find the end of the store's `Object.assign` or where actions are defined (around line 1090), add:

```typescript
enterComponentEditing: (componentId) => {
  const shapes = get().shapes;
  const childIds = shapes.filter(s => s.parentId === componentId).map(s => s.id);
  set({ editingComponentId: componentId, selectedIds: childIds });
},

exitComponentEditing: () => {
  set({ editingComponentId: null });
},
```

**Step 5: Verify TypeScript compiles**

Run: `cd /Users/zhy/Desktop/ai_service/figma_like && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors related to our changes (existing errors are OK)

**Step 6: Commit**

```bash
git add stores/useEditorStore.ts
git commit -m "feat(store): add editingComponentId state and enter/exit actions"
```

---

## Task 2: Add `ComponentEditingOverlay` to Canvas

**Objective:** Add the "return" navigation bar shown when in component editing mode

**Files:**
- Modify: `components/Canvas.tsx`

**Step 1: Find where to add the overlay**

Read the end of Canvas.tsx (around line 1070+) to understand the JSX structure. Look for the `return (` that wraps the main component.

**Step 2: Add overlay JSX before the closing tag**

Add this inside the main container div, at the very end (before the final `</div>`):

```tsx
{/* Component Editing Overlay */}
{editingComponentId && editingComponent && (
  <div className="absolute top-0 left-0 right-0 z-20 h-9 flex items-center gap-3 px-4 bg-[#1a1a1a]/95 backdrop-blur border-b border-[#333]">
    <button
      onClick={() => exitComponentEditing()}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--text-secondary)] hover:text-white hover:bg-[#333] transition-colors"
    >
      <ArrowLeft size={13} />
      返回
    </button>
    <span className="text-xs text-[var(--text-primary)] font-medium">{editingComponent.name}</span>
    <span className="text-[10px] text-[var(--accent)]">Editing component...</span>
  </div>
)}
```

**Step 3: Add imports**

At the top of Canvas.tsx, ensure these imports exist (add if missing):

```typescript
import { ArrowLeft } from 'lucide-react';
```

Also ensure `editingComponentId`, `exitComponentEditing`, and `shapes` are destructured from `useEditorStore()`. Read the store destructuring line (around line 680) and add `editingComponentId` and `exitComponentEditing` if not present.

**Step 4: Derive editingComponent**

In the component body, after `const shapes = useEditorStore(s => s.shapes);`, add:

```typescript
const editingComponent = editingComponentId 
  ? shapes.find(s => s.id === editingComponentId) 
  : null;
```

**Step 5: Adjust canvas content padding when editing**

In the main canvas container div, add conditional padding:

```tsx
className={`flex-1 relative bg-[var(--canvas-bg)] overflow-hidden ${editingComponentId ? 'pt-9' : ''}`}
```

**Step 6: Verify TypeScript compiles**

Run: `cd /Users/zhy/Desktop/ai_service/figma_like && npx tsc --noEmit 2>&1 | head -30`

**Step 7: Commit**

```bash
git add components/Canvas.tsx
git commit -m "feat(canvas): add ComponentEditingOverlay navigation bar"
```

---

## Task 3: Update Canvas shape rendering for component editing mode

**Objective:** Make Canvas filter and render shapes correctly when `editingComponentId` is set

**Files:**
- Modify: `components/Canvas.tsx`

**Step 1: Find the shape filtering logic**

Search for `const visibleShapes` or the filter that determines which shapes to render on canvas (around line 660-700).

**Step 2: Update the filtering logic**

Replace the existing shape filtering with:

```typescript
// Determine which shapes to render on canvas
let visibleShapes: Shape[];
if (editingComponentId) {
  // In component editing mode: show only direct children of the component
  visibleShapes = shapes.filter(s => s.parentId === editingComponentId && s.visible);
} else {
  // Normal mode: show only top-level shapes (no parentId)
  visibleShapes = shapes.filter(s => !s.parentId && s.visible);
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/zhy/Desktop/ai_service/figma_like && npx tsc --noEmit 2>&1 | head -30`

**Step 4: Commit**

```bash
git add components/Canvas.tsx
git commit -m "feat(canvas): filter shapes by editingComponentId in component editing mode"
```

---

## Task 4: Add double-click handler to enter component editing

**Objective:** Detect double-clicks on component shapes and enter editing mode

**Files:**
- Modify: `components/Canvas.tsx`

**Step 1: Find the Stage onDblClick handler**

Search for `onDblClick` in Canvas.tsx. The Konva Stage should have an `onDblClick` handler (around line 760-800).

**Step 2: Add double-click detection logic**

Find the existing `onDblClick` handler on the Konva Stage and update it to detect component double-clicks. The handler should:

```typescript
onDblClick={(e) => {
  // ... existing double-click handling for text editing if any
  
  // Get clicked shape
  const clickedShape = e.target;
  if (clickedShape === stageRef.current) return; // clicked empty area
  
  // Find the actual shape data from shapes array
  const shapeId = clickedShape.id();
  const shape = shapes.find(s => s.id === shapeId);
  if (!shape) return;
  
  // Check if this is a component (instance or master)
  if (shape.type === 'component' || shape.type === 'frame') {
    if (shape.masterComponentId) {
      // It's an instance - enter the master component's editing mode
      enterComponentEditing(shape.masterComponentId);
    } else if (shape.isMainComponent) {
      // It's a master component - enter its editing mode
      enterComponentEditing(shape.id);
    }
  }
}}
```

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/zhy/Desktop/ai_service/figma_like && npx tsc --noEmit 2>&1 | head -30`

**Step 4: Commit**

```bash
git add components/Canvas.tsx
git commit -m "feat(canvas): add double-click to enter component editing mode"
```

---

## Task 5: Add expand/collapse state to LayerPanel

**Objective:** Add `expandedIds` state and toggle logic to LayerPanel

**Files:**
- Modify: `components/LayerPanel.tsx`

**Step 1: Add expandedIds state**

Find the `useState` declarations at the top of `LayerPanel` component (around line 170). Add:

```typescript
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
```

**Step 2: Add initExpandedSet function**

Add this function before the `LayerPanel` component definition (around line 115):

```typescript
function initExpandedSet(nodes: TreeNode[]): Set<string> {
  const expanded = new Set<string>();
  const traverse = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        expanded.add(node.shape.id);
        traverse(node.children);
      }
    }
  };
  traverse(nodes);
  return expanded;
}
```

**Step 3: Initialize expandedIds from buildTree**

After `const tree = useMemo(() => buildTree(shapes), [shapes]);` (around line 172), add:

```typescript
// Initialize expanded set from tree
useEffect(() => {
  const initial = initExpandedSet(tree);
  setExpandedIds(initial);
}, [tree]);
```

**Step 4: Add handleToggleExpand callback**

Add this near other callback definitions (around line 175):

```typescript
const handleToggleExpand = useCallback((id: string) => {
  setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
}, []);
```

**Step 5: Verify TypeScript compiles**

Run: `cd /Users/zhy/Desktop/ai_service/figma_like && npx tsc --noEmit 2>&1 | head -30`

**Step 6: Commit**

```bash
git add components/LayerPanel.tsx
git commit -m "feat(layers): add expand/collapse state management"
```

---

## Task 6: Update LayerItem for expand/collapse UI

**Objective:** Add expand/collapse chevron button and conditional children rendering

**Files:**
- Modify: `components/LayerPanel.tsx`

**Step 1: Find LayerItem props interface**

Update `LayerItemProps` interface (around line 23-33) to add:

```typescript
interface LayerItemProps {
  // ...existing
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  childCount?: number;
}
```

**Step 2: Update LayerItem destructuring**

Update the LayerItem function parameters (around line 35) to include:

```typescript
function LayerItem({ shape, isSelected, depth, isDragOver, onSelect, onDragStart, onDragOver, onDragLeave, onDrop, isExpanded, onToggleExpand, childCount }: LayerItemProps) {
```

**Step 3: Determine if shape is a container**

Add this at the beginning of LayerItem (around line 35):

```typescript
const isContainer = shape.type === 'frame' || shape.type === 'group' || shape.type === 'component';
```

**Step 4: Add expand/collapse chevron button**

Find the LayerItem return statement, specifically where the icon is rendered (around line 71). Add before the icon span:

```tsx
{isContainer && (
  <button
    onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
    className="p-0.5 hover:bg-[var(--bg-hover)] rounded flex-shrink-0"
    title={isExpanded ? '折叠' : '展开'}
    aria-label={isExpanded ? '折叠' : '展开'}
  >
    <ChevronRight
      size={12}
      className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
    />
  </button>
)}
```

**Step 5: Add childCount badge**

Find where the name span ends (around line 91-93) and add after the closing `</span>`:

```tsx
{isContainer && (childCount ?? 0) > 0 && (
  <span className="text-[9px] text-[var(--text-tertiary)] flex-shrink-0">({childCount})</span>
)}
```

**Step 6: Verify TypeScript compiles**

Run: `cd /Users/zhy/Desktop/ai_service/figma_like && npx tsc --noEmit 2>&1 | head -30`

**Step 7: Commit**

```bash
git add components/LayerPanel.tsx
git commit -m "feat(layers): add expand/collapse chevron and childCount badge"
```

---

## Task 7: Update LayerPanel to pass expand props and render children conditionally

**Objective:** Connect the expand/collapse state to LayerItem and render children only when expanded

**Files:**
- Modify: `components/LayerPanel.tsx`

**Step 1: Find the recursive rendering section**

Look in LayerPanel's return (around line 310+) for where `LayerItem` is rendered for root nodes and where children are rendered.

**Step 2: Add render function for tree nodes**

Add this recursive render function before the `LayerPanel` component (around line 168):

```typescript
function renderTreeNodes(nodes: TreeNode[], depth: number): React.ReactNode {
  return nodes.map(node => {
    const isExpanded = expandedIds.has(node.shape.id);
    const childCount = node.children.length;
    
    return (
      <div key={node.shape.id}>
        <LayerItem
          shape={node.shape}
          isSelected={selectedIds.includes(node.shape.id)}
          depth={depth}
          isExpanded={isExpanded}
          onToggleExpand={() => handleToggleExpand(node.shape.id)}
          childCount={childCount}
          isDragOver={dragOverId === node.shape.id}
          onSelect={handleSelect}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
        {isExpanded && node.children.length > 0 && (
          <div>
            {renderTreeNodes(node.children, depth + 1)}
          </div>
        )}
      </div>
    );
  });
}
```

**Step 3: Replace the LayerItem renders with renderTreeNodes call**

Find where the main LayerItem is rendered (around line 310-340) and replace the manual LayerItem renders and children mapping with:

```tsx
<div className="space-y-0.5">
  {renderTreeNodes(tree, 0)}
</div>
```

**Step 4: Remove old children mapping code**

The old code that manually renders children (around lines 310-340 in original) should be removed since `renderTreeNodes` handles recursion.

**Step 5: Verify TypeScript compiles**

Run: `cd /Users/zhy/Desktop/ai_service/figma_like && npx tsc --noEmit 2>&1 | head -30`

**Step 6: Commit**

```bash
git add components/LayerPanel.tsx
git commit -m "feat(layers): wire up expand/collapse to recursive tree rendering"
```

---

## Task 8: Add "expand all / collapse all" to LayerPanel

**Objective:** Add toolbar buttons or context menu options to expand/collapse all layers

**Files:**
- Modify: `components/LayerPanel.tsx`

**Step 1: Add helper functions**

Add before the LayerPanel component (around line 168):

```typescript
function getAllContainerIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  const traverse = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        ids.push(node.shape.id);
        traverse(node.children);
      }
    }
  };
  traverse(nodes);
  return ids;
}
```

**Step 2: Add expand/collapse all buttons**

Find the LayerPanel's return, specifically where the header/search area is (around line 170-180). Add after the search input:

```tsx
<div className="flex items-center gap-1">
  <button
    onClick={() => setExpandedIds(new Set(getAllContainerIds(tree)))}
    className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
    title="展开全部"
    aria-label="展开全部"
  >
    <ChevronsDown size={13} />
  </button>
  <button
    onClick={() => setExpandedIds(new Set())}
    className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
    title="折叠全部"
    aria-label="折叠全部"
  >
    <ChevronsUp size={13} />
  </button>
</div>
```

**Step 3: Add imports**

Add to the imports from lucide-react (around line 5):

```typescript
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, Star, ImageIcon, Triangle, ArrowRight, Type, Minus, Square, Circle, Component, Layers, Frame, PenTool, ChevronRight, ChevronDown, ChevronsDown, ChevronsUp, Search, X, Group } from 'lucide-react';
```

**Step 4: Verify TypeScript compiles**

Run: `cd /Users/zhy/Desktop/ai_service/figma_like && npx tsc --noEmit 2>&1 | head -30`

**Step 5: Commit**

```bash
git add components/LayerPanel.tsx
git commit -m "feat(layers): add expand all / collapse all buttons"
```

---

## Task 9: Final integration test

**Objective:** Verify everything works together in the browser

**Step 1: Run the dev server**

```bash
cd /Users/zhy/Desktop/ai_service/figma_like && npm run dev
```

**Step 2: Test component editing**

- Create a component from shapes (select shapes → create component)
- Double-click the component instance on canvas → should enter component editing mode
- Should see the overlay with "返回" button
- Click "返回" → should exit component editing

**Step 3: Test layer expand/collapse**

- Expand/collapse buttons (▶/▼) should appear next to frame/group/component layers
- Clicking should toggle children visibility
- childCount badge should show number of children
- Expand all / Collapse all buttons should work

**Step 4: Commit final**

```bash
git add -A
git commit -m "feat: phase4 complete - component editing mode + layer expand/collapse"
```

---

## Verification Commands

```bash
# TypeScript check
cd /Users/zhy/Desktop/ai_service/figma_like && npx tsc --noEmit

# Lint check  
cd /Users/zhy/Desktop/ai_service/figma_like && npm run lint

# Dev server
cd /Users/zhy/Desktop/ai_service/figma_like && npm run dev
```
