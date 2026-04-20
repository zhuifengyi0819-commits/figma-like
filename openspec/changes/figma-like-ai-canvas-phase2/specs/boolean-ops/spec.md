# boolean-ops

## Overview
两个图形（rect/circle/path）做 union/subtract/intersect/exclude 布尔运算，结果渲染为可继续编辑的 path。

## Data Model

```typescript
type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

interface BooleanShape extends Shape {
  type: 'path'; // 结果永远是 path
  booleanOp?: BooleanOp;
  booleanSourceIds?: [string, string]; // [基准图形ID, 操作图形ID]
  pathData: string; // SVG path data (computed result)
}
```

## User Flow

1. 选中图形 A（按 Shift 多选第二个图形 B）
2. 顶部工具栏或右键菜单出现"布尔运算"按钮组
3. 点击 union/subtract/intersect/exclude 之一
4. 运算结果替换 A 和 B，生成新 path 图形（中心点为 A 的位置）
5. 新 path 继承 A 的 fill/stroke/opacity，pathData 由算法计算得出

## UI

### 触发方式
- **Toolbar**：选中 2 个图形时，工具栏区域显示布尔运算图标按钮组
- **右键菜单**：选中 2 个图形时，菜单显示 4 个布尔运算项

### 按钮组（Toolbar）
```
[∪ Union] [∩ Subtract] [⊓ Intersect] [⊖ Exclude]
```
- 未选中 2 个图形时，按钮组灰显（disabled）
- hover 显示 tooltip 说明

## Algorithm

使用 `polygon-clipping` 库（`npm install polygon-clipping`）：

```typescript
import polygonClipping from 'polygon-clipping';

function computeBooleanPath(shapeA: Shape, shapeB: Shape, op: BooleanOp): string {
  // 1. 将 shape A/B 转换为 polygon（数组 of 环形坐标）
  const polyA = shapeToPolygon(shapeA);
  const polyB = shapeToPolygon(shapeB);

  // 2. polygon-clipping 操作
  let result: number[][][];
  switch (op) {
    case 'union':       result = polygonClipping.union([polyA, polyB]); break;
    case 'subtract':    result = polygonClipping.diff([polyA], [polyB]); break;
    case 'intersect':   result = polygonClipping.intersection([polyA], [polyB]); break;
    case 'exclude':     result = polygonClipping.xor([polyA], [polyB]); break;
  }

  // 3. polygon → SVG path data
  return polygonToSvgPath(result);
}
```

### shapeToPolygon 规则
- **rect**：4 个顶点 (x,y), (x+w,y), (x+w,y+h), (x,y+h)
- **circle**：用 64 边形近似，中心 (cx,cy)，半径 r
- **path**：直接取 pathPoints 转换为顶点列表
- **其他类型**：不支持，显示 Toast 错误

### polygonToSvgPath 规则
- 首位 `M x y`，后续 `L x y`，末尾 `Z`
- 多部件用 `M` 分隔

## Render

ShapeRenderer 在 `booleanOp` 存在时：
1. 将 `pathData` 解析为 Konva.Path
2. 应用 shape 的 fill/stroke/opacity/blendMode
3. 不显示 Transformer（path 作为整体）
4. 双击进入 path node editing 模式

## Constraints

- 只支持 rect + circle + path 之间的布尔运算
- line/arrow/text 不支持，显示 "此图形类型不支持布尔运算" Toast
- 结果 path 失去布尔能力（不再能参与布尔运算）
- 原始 A/B 图形从 store 中删除

## Edge Cases

| 情况 | 处理 |
|------|------|
| 图形不相交 | union 返回两个分离 path；subtract 返回 A；intersect/exclude 返回空 path |
| 重叠面积=0 | 同上 |
| 3+ 图形选中 | 只取前 2 个，Toast 提示"只支持 2 个图形布尔运算" |
