# eyedropper-tool

## Overview
Toolbar 添加吸管工具，点击画布任意像素读取颜色，自动填充到当前选中图形的 fill。

## Tool 激活

- Toolbar 点击吸管图标，或按 `I` 键
- `activeTool === 'eyedropper'`
- 鼠标光标变为放大镜样式（CSS cursor）

## User Flow

1. 激活 eyedropper 工具
2. 鼠标移入 Canvas，显示放大镜 + 实时颜色预览（圆形小色块 + hex 值）
3. 点击画布任意位置 → 读取该像素颜色
4. 若有选中图形：将颜色写入 `updateShape(selectedIds[0], { fill: color })`
5. 若无选中图形：Toast 提示"请先选中一个图形"
6. 自动切换回 select 工具

## Implementation

### 颜色读取

使用 Canvas 2D API：

```typescript
function getPixelColor(canvas: HTMLCanvasElement, x: number, y: number): string {
  const ctx = canvas.getContext('2d');
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const [r, g, b] = pixel;
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
```

### Konva Stage 坐标转换

```typescript
const stage = konvaStageRef.current;
const pos = stage.getPointerPosition();
const canvasX = (pos.x - canvasPan.x) / canvasZoom;
const canvasY = (pos.y - canvasPan.y) / canvasZoom;
// 然后从 Konva 的 toCanvas() 转换到 actual canvas pixels
```

### 颜色预览

随鼠标移动的 DOM 元素（fixed 定位）:
```
┌──────┐
│ ████ │ #4A4A52
└──────┘
  40×40px color swatch + hex label
```

## Toolbar 图标

使用 `Pipette` (lucide-react) 图标。

## Keyboard Shortcut

`I` → 切换到 eyedropper 工具

## Edge Cases

| 情况 | 处理 |
|------|------|
| 点击空白处（无图形区域）| 仍读取颜色，可应用于选中图形 |
| 读取透明像素 | fallback 到 `#000000`，提示"透明区域已设为黑色" |
| 无选中图形 | Toast 提示，不执行填充 |
| 选中多个图形 | 只填充第一个 |
