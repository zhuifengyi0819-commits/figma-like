# rotate-copy

## Overview
选中图形后，通过右键菜单执行圆形阵列（Rotate Copy）或线性阵列（Duplicate Along），生成 N 个围绕中心点旋转或沿直线分布的复制图形。

## User Flow

1. 选中 1 个或多个图形
2. 右键菜单 → "阵列复制..." → 弹出 ArrayModal
3. 用户选择类型（圆形/线性）、数量（2-20）、间距/半径
4. 点击"确定" → 生成复制图形，原图形取消选择，新图形全部选中
5. CMD+Z 可撤销

## 圆形阵列（Rotate Copy）

### 参数
- **数量**：2-20（slider + input）
- **半径**：10-1000px（input，默认为图形到中心的距离）

### 算法
```typescript
function rotateCopy(shapes: Shape[], count: number, radius: number, centerX: number, centerY: number): Shape[] {
  const angleStep = 360 / count; // degrees
  const results: Shape[] = [];
  for (let i = 1; i < count; i++) {
    const angle = (angleStep * i * Math.PI) / 180;
    for (const orig of shapes) {
      const origCX = orig.x + (orig.width || 0) / 2;
      const origCY = orig.y + (orig.height || 0) / 2;
      const nx = centerX + (origCX - centerX) * Math.cos(angle) - (origCY - centerY) * Math.sin(angle);
      const ny = centerY + (origCX - centerX) * Math.sin(angle) + (origCY - centerY) * Math.cos(angle);
      results.push({
        ...JSON.parse(JSON.stringify(orig)),
        id: nanoid(),
        x: nx - (orig.width || 0) / 2,
        y: ny - (orig.height || 0) / 2,
        rotation: (orig.rotation || 0) + angleStep * i,
      });
    }
  }
  return results;
}
```

## 线性阵列（Duplicate Along Line）

### 参数
- **数量**：2-20
- **X 偏移**：-1000 到 1000px
- **Y 偏移**：-1000 到 1000px

### 算法
```typescript
function linearCopy(shapes: Shape[], count: number, dx: number, dy: number): Shape[] {
  const results: Shape[] = [];
  for (let i = 1; i < count; i++) {
    for (const orig of shapes) {
      results.push({
        ...JSON.parse(JSON.stringify(orig)),
        id: nanoid(),
        x: orig.x + dx * i,
        y: orig.y + dy * i,
      });
    }
  }
  return results;
}
```

## ArrayModal UI

模态弹窗，固定宽度 320px，居中显示：

```
┌─────────────────────────────────┐
│  阵列复制                    ✕  │
├─────────────────────────────────┤
│  类型：  ○ 圆形   ● 线性        │
│                                 │
│  数量：  [ 5 ]  (2-20)          │
│                                 │
│  ○ 圆形                         │
│  半径：  [ 200 ] px             │
│                                 │
│  ● 线性                         │
│  X 偏移：  [ 100 ] px           │
│  Y 偏移：  [ 0 ] px             │
│                                 │
├─────────────────────────────────┤
│         [取消]    [确定]         │
└─────────────────────────────────┘
```

## 右键菜单入口

在 ContextMenu.tsx 中添加：
```tsx
{selectedIds.length > 0 && (
  <>
    <MenuItem label="阵列复制..." onClick={() => setShowArrayModal(true)} />
    <Divider />
  </>
)}
```

## Edge Cases

| 情况 | 处理 |
|------|------|
| 数量=1 | 等同于普通复制 |
| 圆形半径过小 | 最小 10px |
| 线性偏移=0,0 | 等同于普通复制 |
| 20+ 图形 × 20 份 | 最多生成 400 个，超出 Toast 警告 |
