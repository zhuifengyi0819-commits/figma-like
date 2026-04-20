# path-node-editing

## Overview
双击已有 path 图形进入节点编辑模式，可拖拽锚点和控制手柄调整曲线，添加/删除锚点，Enter 或点击空白完成编辑。

## Data Model

```typescript
interface PathPoint {
  x: number;
  y: number;
  cp1?: { x: number; y: number }; // 入控制手柄（贝塞尔）
  cp2?: { x: number; y: number }; // 出控制手柄
}

interface Shape {
  // ...
  pathPoints?: PathPoint[];
  closePath?: boolean;
  // 新增：
  editingPath?: boolean; // 临时状态，不存储
}
```

## User Flow

1. **进入编辑**：双击 path 图形 → `editingPathId` 设置为该 shape id，进入 path edit mode
2. **显示节点**：
   - 每个 PathPoint 显示 1 个**锚点**（4×4 蓝色方形）
   - 有 cp1 的点：在 cp1 位置显示**控制手柄圆点**（3×3 橙色，空心）
   - 有 cp2 的点：在 cp2 位置显示**控制手柄圆点**
   - cp1 和锚点之间连一条细橙线；cp2 和锚点之间连一条细橙线
3. **拖拽锚点**：拖拽时实时更新 `pathPoints[idx].x / .y`，刷新 Konva 渲染
4. **拖拽手柄**：拖拽手柄圆点时更新 `cp1` 或 `cp2`，曲线实时更新
5. **添加锚点**：在路径线段上点击（不是端点）→ 在该位置插入新 PathPoint
6. **删除锚点**：点击锚点 → 按 `Delete` → 移除该点（只剩 1 个点时不允许删除）
7. **闭合/开放路径**：右键菜单或快捷键 `C` 切换 `closePath`
8. **完成编辑**：
   - 按 `Enter` → 保存修改，退出编辑模式
   - 按 `Escape` → 放弃修改，退出编辑模式
   - 点击空白处 → 保存修改，退出编辑模式

## UI

### Path Edit Mode 视觉
```
[锚点] ■——○ cp1
       |    \
       |     ○ cp2
       |
[锚点] ■
```
- 锚点：4×4px，实心蓝色 `#1677FF`，hover 放大 5×5
- 控制手柄：3×3px，空心橙色 `#FA8C16`，hover 放大 4×4
- 手柄连线：1px 橙色 `#FA8C16`，透明度 60%
- 当前选中锚点/手柄：边框高亮（白色）

### 右键菜单（Path Edit Mode）
- 添加锚点
- 删除锚点（当前选中时）
- 闭合路径 / 开放路径
- 完成编辑（= Enter）

## Keyboard Shortcuts

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 完成编辑，保存 |
| `Escape` | 放弃编辑，退出 |
| `Delete` | 删除当前选中的锚点 |
| `Backspace` | 删除当前选中的锚点 |
| `C` | 切换闭合/开放路径 |
| `A` | 添加锚点（在路径中点） |

## Implementation Details

### 渲染层（Canvas.tsx / ShapeRenderer）

Path edit mode 下的 path 不使用 Konva 原生 Path，而是：
1. 用 `Shape[]` 渲染各线段（Konva.Line with tension）
2. 各锚点用 Konva.Circle（锚点本身）
3. cp1/cp2 控制手柄用 Konva.Circle + Konva.Line

```tsx
// path editing overlay 渲染逻辑
{editingPathId === shape.id && (
  <Group>
    {/* 曲线路径（半透明，不影响交互） */}
    <Line points={flattenPoints(shape.pathPoints)} stroke="#1677FF" strokeWidth={1} opacity={0.5} listening={false} />
    {/* 锚点和手柄 */}
    {shape.pathPoints.map((pt, i) => (
      <Group key={i}>
        {pt.cp1 && <Circle ... cp1 circle />}
        {pt.cp2 && <Circle ... cp2 circle />}
        <Rect x={pt.x - 2} y={pt.y - 2} ... anchor />}
      </Group>
    ))}
  </Group>
)}
```

### 碰撞检测
- 点击线段附近（非端点）→ 添加锚点
- 点击锚点 → 选中该锚点（highlight）
- 点击手柄 → 选中该手柄

## Edge Cases

| 情况 | 处理 |
|------|------|
| 只有 1 个点 | 不允许删除最后一个锚点 |
| pathPoints 为空 | 渲染为单个点 |
| 编辑时按 Delete 全删 | 保留最后 1 个点 |
| 切换页面 | 自动退出编辑模式 |
