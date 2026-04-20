# Design: figma-like Phase 3 Canvas Core

## 1. 图层树系统

### 1.1 数据结构变更

**现有 Shape 类型** (`lib/types.ts`):
```typescript
interface Shape {
  id: string;
  type: ShapeType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // ... 其他属性
}
```

**变更后**:
```typescript
interface Shape {
  id: string;
  type: ShapeType;
  name: string;
  x: number;      // 相对于 parent 的 X（如果是顶层元素则为画布坐标）
  y: number;      // 相对于 parent 的 Y
  width: number;
  height: number;
  parentId?: string;  // 新增：父元素 ID
  order: number;      // 新增：在父容器内的排序（Z-Index）
  // ... 其他属性
}
```

### 1.2 Store 变更

**新增 selector**:
```typescript
// 获取元素的绝对坐标（考虑所有祖先变换）
selectors: {
  getAbsoluteBounds: (id) => Shape,
  getAbsolutePosition: (id) => {x, y},
  getShapeChildren: (parentId) => Shape[],
  getShapeAncestors: (id) => Shape[], // 从近到远排列
  isAncestorOf: (ancestorId, descendantId) => boolean,
}
```

### 1.3 LayerPanel 嵌套显示

```
▼ Frame 1 (frame-1)
  ├── Rectangle 1 (rect-1)
  └── ▼ Group 1 (group-1)
        ├── Ellipse 1 (ellipse-1)
        └── Text 1 (text-1)
```

- 展开/折叠状态存储在 localStorage
- 缩进 = depth * 16px
- 展开图标：ChevronRight / ChevronDown

---

## 2. 选择高亮系统

### 2.1 Konva Transformer 配置

```typescript
// Canvas.tsx 中的 Transformer 配置
<Transformer
  ref={transformerRef}
  boundBoxFunc={(oldBox, newBox) => newBox}
  anchorSize={8}
  anchorCornerRadius={4}
  anchorStroke="#D4A853"
  anchorFill="#FFFFFF"
  borderStroke="#D4A853"
  borderStrokeWidth={1}
  borderDash={[4, 4]}
  rotateAnchorOffset={25}  // 旋转手柄距离
  enabledAnchors={[
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right'
  ]}
/>
```

### 2.2 旋转手柄

- 位置：顶部边界中心点向上 25px
- 样式：8x8 白色填充圆形，#D4A853 边框
- 交互：拖拽旋转，按住 Shift 锁定 15° 增量

### 2.3 多选边界框

当 `selectedIds.length > 1` 时：
1. 计算所有选中元素的 AABB（轴对齐边界框）
2. 将 Transformer 的边界框设置为合并后的 AABB
3. 仅在统一框上显示 8 个控制点

---

## 3. Frame 容器

### 3.1 坐标转换

```typescript
// 获取元素的画布绝对坐标
function getAbsolutePosition(shape: Shape, allShapes: Shape[]): {x: number, y: number} {
  if (!shape.parentId) {
    return { x: shape.x, y: shape.y };
  }
  
  const parent = allShapes.find(s => s.id === shape.parentId);
  if (!parent) {
    return { x: shape.x, y: shape.y };
  }
  
  const parentPos = getAbsolutePosition(parent, allShapes);
  return {
    x: parentPos.x + shape.x,
    y: parentPos.y + shape.y
  };
}
```

### 3.2 Konva Frame 渲染

```typescript
<Group x={frame.x} y={frame.y}>
  {/* Frame 背景（可选） */}
  <Rect
    width={frame.width}
    height={frame.height}
    fill={frame.backgroundColor || 'transparent'}
    cornerRadius={frame.cornerRadius}
    listening={false}  // 不拦截事件
  />
  
  {/* Frame 裁剪 */}
  <Group clipX={0} clipY={0} clipWidth={frame.width} clipHeight={frame.height}>
    {/* 子元素渲染 */}
    {children.map(child => (
      <ShapeRenderer key={child.id} shape={child} ... />
    ))}
  </Group>
</Group>
```

### 3.3 变换传递

当 Frame 变换时（移动、缩放、旋转）：
1. 计算 Frame 的变换矩阵
2. 子元素应用相同的变换
3. 子元素自己的变换叠加

---

## 4. 多选操作

### 4.1 Shift+Click 多选逻辑

```typescript
function handleSelect(id: string, addToSelection: boolean) {
  if (addToSelection) {
    if (selectedIds.includes(id)) {
      // 已选中则取消选中
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      // 添加到选中
      setSelectedIds([...selectedIds, id]);
    }
  } else {
    // 单独选中
    setSelectedIds([id]);
  }
}
```

### 4.2 多选移动

```typescript
function handleMultiSelectDrag(dx: number, dy: number) {
  selectedIds.forEach(id => {
    const shape = shapes[id];
    updateShape(id, {
      x: shape.x + dx,
      y: shape.y + dy
    });
  });
}
```

---

## 5. 右键菜单

### 5.1 菜单项

**元素上右键**:
- 复制 (Cmd+C)
- 删除 (Delete)
- 置顶
- 置底
- 上移一层
- 下移一层
- 编组 (Cmd+G)
- 取消编组

**画布空白处右键**:
- 粘贴 (Cmd+V)
- 创建 Rectangle
- 创建 Frame
- 全选 (Cmd+A)

### 5.2 实现位置

`ContextMenu.tsx` 已存在，需扩展支持：
- 判断右键点击位置是元素还是空白
- 根据选中状态显示不同菜单项

---

## 6. 文件变更清单

| 文件 | 变更 |
|------|------|
| `lib/types.ts` | Shape 增加 parentId, order 字段 |
| `stores/useEditorStore.ts` | selectors 增加嵌套相关方法 |
| `components/Canvas.tsx` | Transformer 配置、Frame clip、坐标转换 |
| `components/LayerPanel.tsx` | 嵌套显示、拖拽重排 |
| `components/ContextMenu.tsx` | 扩展右键菜单 |
| `lib/measurement.ts` | getAbsolutePosition 等工具函数 |
