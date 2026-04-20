# Phase 5 Tasks: Constraints + Nested Auto Layout

## Task 1: Create lib/layout.ts — Layout computation

Create a new file `lib/layout.ts` with:

### `getChildNaturalSize(child: Shape): { w: number, h: number }`
Returns the natural size of a child shape.

### `computeChildLayout(child: Shape, frame: Shape, allShapes: Shape[]): ComputedChildLayout`
For NON-autoLayout frames, applies constraints to compute final x/y/w/h relative to frame.

Rules:
- horizontal = min → child.x unchanged
- horizontal = max → child.x = frame.w - child.w
- horizontal = center → child.x = (frame.w - child.w) / 2
- horizontal = stretch → child.w = frame.w, child.x = 0
- vertical: analogous

Handles:
- Circle/star/triangle: sizes scale uniformly
- Min/max dimension constraints

### `resolveAutoLayoutSize(frame: Shape, children: Shape[], allShapes: Shape[]): { width: number, height: number }`
Recursively computes the hug-contents size of an auto-layout frame based on its children.

### `computeAutoLayoutChildren(frame: Shape, children: Shape[], allShapes: Shape[]): Map<string, ComputedChildLayout>`
Main auto layout algorithm for auto-layout frames:

Algorithm:
1. Sort children by z-order (use `children` array order)
2. Compute padding rect
3. Initialize cursor at paddingTop/paddingLeft
4. For each child:
   a. If child has autoLayout → recursively call `computeAutoLayoutChildren` on it, then use `resolveAutoLayoutSize` for its size
   b. Else use `getChildNaturalSize`
   c. Position based on direction (horizontal: x=cursor, y based on align; vertical: y=cursor, x based on align)
   d. For `stretch` items in the primary axis: accumulate stretchCount, defer position
5. After all non-stretch: distribute remaining space to stretch items
6. Apply counter-axis alignment (min/center/max)

Returns Map of childId → ComputedChildLayout.

### `getShapeNaturalSize(s: Shape): { w: number, h: number }`
Helper: for circle/star/triangle, derive w/h from radius; for text, use width + computed height.

---

## Task 2: Modify FrameRenderer to use computed layouts

In `components/Canvas.tsx`, modify `FrameRenderer`:

### Step 2a: Import `computeChildLayout` and `computeAutoLayoutChildren` from `@/lib/layout`

### Step 2b: Add `childLayouts` memo

```typescript
const childLayouts = useMemo(() => {
  if (!frame.autoLayout) {
    const m = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const child of children) {
      m.set(child.id, computeChildLayout(child, frame, allShapes));
    }
    return m;
  }
  return computeAutoLayoutChildren(frame, children, allShapes);
}, [frame, children, allShapes]);
```

### Step 2c: Update child rendering to use childLayouts

For ALL child rendering (masked and non-masked), change:
```tsx
// Before:
frame={{ ...child, x: child.x - frame.x, y: child.y - frame.y }}

// After:
frame={{
  ...child,
  ...(() => {
    const layout = childLayouts.get(child.id);
    return layout ? { x: layout.x, y: layout.y, width: layout.width, height: layout.height } : { x: child.x - frame.x, y: child.y - frame.y };
  })()
}}
```

For ShapeRenderer:
```tsx
// Before:
shape={{ ...child, x: child.x - frame.x, y: child.y - frame.y }}

// After:
shape={{
  ...child,
  ...(() => {
    const layout = childLayouts.get(child.id);
    return layout ? { x: layout.x, y: layout.y, width: layout.width, height: layout.height } : { x: child.x - frame.x, y: child.y - frame.y };
  })()
}}
```

### Step 2d: Textarea position fix for nested text

The textarea issue is: for text inside a frame/group, `getAbsolutePosition()` of the Konva Text node gives the position relative to the stage's canvas, but the textarea is positioned relative to the canvas container.

Actually the current code does `stageRef.current.findOne('#' + editingTextId)` → `node.getAbsolutePosition()` which should give screen coordinates. But if the shape is inside a group/frame, the group's transform (x, y offset) affects the child's position.

The real issue: when we render `{ ...child, x: child.x - frame.x, y: child.y - frame.y }`, the Konva node's position IS `child.x - frame.x` (relative to frame origin). The `getAbsolutePosition()` of that node returns the position relative to the stage's top-left, which equals `frame.x + (child.x - frame.x) = child.x` in canvas space.

But the textarea `left/top` needs to be in viewport (container) coordinates:
```
textarea.x = (child.x * canvasZoom) + canvasPan.x
textarea.y = (child.y * canvasZoom) + canvasPan.y
```

Currently the code uses `node.getAbsolutePosition()` which should work... Let’s verify by NOT changing textarea logic for now.

### Step 2e: TypeScript verify + commit

Run `npx tsc --noEmit` and fix any type errors. Commit: `feat(canvas): apply constraints and auto-layout when rendering frame children`.

---

## Task 3: Fix text edit position for nested text

Current issue: when editing text inside a frame, the textarea position might be wrong because Konva text nodes inside a Group have their own coordinate space.

The fix should be: use a recursive approach to get the true canvas-space position.

Add to `measurement.ts`:

```typescript
/**
 * Get the absolute canvas-space position of a shape's top-left corner.
 * Accounts for parent transforms (frame/group offset).
 */
export function getShapeCanvasPosition(shape: Shape, allShapes: Shape[]): { x: number; y: number } {
  let x = shape.x;
  let y = shape.y;
  let current = shape;
  while (current.parentId) {
    const parent = allShapes.find(s => s.id === current.parentId);
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    current = parent;
  }
  return { x, y };
}
```

Then in Canvas.tsx's `textEditPosition` useEffect, add a fallback:

```typescript
// Find the Konva node for the text shape
const node = stageRef.current?.findOne('#' + editingTextId);
if (node) {
  setTextEditPosition(node.getAbsolutePosition());
  setTextEditRotation(node.getAbsoluteRotation());
} else {
  // Fallback: compute from shape data traversing parent chain
  const pos = getShapeCanvasPosition(editingShape, shapes);
  setTextEditPosition({
    x: pos.x * canvasZoom + canvasPan.x,
    y: pos.y * canvasZoom + canvasPan.y,
  });
  setTextEditRotation(editingShape.rotation || 0);
}
```

Commit: `fix(canvas): correctly position text editing textarea for nested shapes`.
