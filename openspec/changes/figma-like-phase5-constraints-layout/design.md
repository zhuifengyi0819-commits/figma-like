# Phase 5 Design: Constraints + Nested Auto Layout

## Architecture

### 核心思路
在 `FrameRenderer` 渲染子元素时，根据 constraints 和 autoLayout 递归计算每个子元素的**最终布局属性**（x, y, width, height），然后传递给子元素渲染。不修改 store 中的 shape 数据。

### 1. 布局计算函数 `computeChildLayout`

```typescript
// 放在 lib/measurement.ts 或 lib/layout.ts

interface ComputedChildLayout {
  x: number;      // 相对于 frame 左上角的 x
  y: number;       // 相对于 frame 左上角的 y
  width: number;
  height: number;
  opacity?: number;
}

/**
 * 计算单个 child 在 frame 中的最终布局位置。
 * 规则：
 * - constraints.horizontal:
 *   min → child.x 保持不变
 *   max → child.x = frame.width - child.width（固定右对齐）
 *   center → child.x = (frame.width - child.width) / 2
 *   stretch → child.width = frame.width，child.x = 0
 * - constraints.vertical: 同理
 */
function computeChildLayout(
  child: Shape,
  frame: Shape,
  allShapes: Shape[]
): ComputedChildLayout
```

### 2. Auto Layout 嵌套计算

Figma Auto Layout 规则：
- 水平：依次排列，gap 间隔，最后一个 `stretch` 填满剩余空间
- 垂直：同上
- 嵌套时：子 frame 的 `width/height` 由其内容决定（如果是 Hug Contents）

```typescript
/**
 * 递归计算 Auto Layout frame 内所有 children 的最终布局。
 * 返回 Map<childId, ComputedChildLayout>
 */
function computeAutoLayoutChildren(
  frame: Shape,       // 带有 autoLayout 的 frame
  children: Shape[],  // 直接子元素
  allShapes: Shape[]
): Map<string, ComputedChildLayout>
```

算法：
1. 按 z-order 排序 children
2. 初始化 cursor = paddingTop / paddingLeft
3. 逐个计算每个 child：
   - 如果 child 有 autoLayout → 先递归计算它的子布局，再决定它在本级的大小
   - 否则：用 `getShapeAABB` 获取当前尺寸
   - 根据 direction 决定位置，cursor 前进
4. 处理 `stretch` 项：用 `remainingSpace / stretchCount` 分配

### 3. FrameRenderer 修改

```typescript
function FrameRenderer({ frame, allShapes, ... }) {
  const children = allShapes.filter(s => s.parentId === frame.id);
  const fw = frame.width || 200, fh = frame.height || 200;

  // 预处理 children 布局
  const childLayouts = useMemo(() => {
    if (frame.autoLayout) {
      return computeAutoLayoutChildren(frame, children, allShapes);
    }
    // 普通 frame：用 constraints 计算
    const layouts = new Map<string, ComputedChildLayout>();
    for (const child of children) {
      layouts.set(child.id, computeChildLayout(child, frame, allShapes));
    }
    return layouts;
  }, [frame, children, allShapes]);

  // 渲染 children 时使用计算后的布局
  // ...
}
```

### 4. textarea 位置修复

问题：textEditPosition 从 `node.getAbsolutePosition()` 获取，但 children 的 Konva node 坐标已经是 `child.x - frame.x`。

修复：在 `FrameRenderer` 中渲染 text 时，不要用 Konva group 包裹，而要给子元素显式设置 `x={child.x - frame.x}`。

textarea 位置：当前已经是 absolute + getAbsolutePosition()，应该能正确工作。

但如果 frame 本身有 rotation，getAbsoluteRotation() 也会返回正确的。

## 关键文件修改

| 文件 | 修改内容 |
|------|----------|
| `lib/layout.ts` (新建) | `computeChildLayout()`, `computeAutoLayoutChildren()`, `resolveAutoLayoutSize()` |
| `lib/measurement.ts` | 导出 `getShapeAABB` |
| `components/Canvas.tsx` | FrameRenderer 使用 childLayouts 渲染 children |

## 验证步骤

1. 创建一个 frame，给子元素设置不同 constraints
2. 缩放 frame，验证 children 位置是否按 constraints 变化
3. 创建嵌套 Auto Layout，验证子元素是否正确排列
4. 文字在 frame 内双击编辑，验证 textarea 位置
