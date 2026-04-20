# Delta for Canvas Core

## ADDED Requirements

### Requirement: 图层嵌套树结构

Shape 数据结构支持真正的树形嵌套，Frame 可以包含子元素。

#### Scenario: Frame 包含子元素
- GIVEN 画布上有一个 Frame（id: "frame-1"）和一个 Rectangle（id: "rect-1"）
- WHEN 将 rect-1 移动到 frame-1 内（设置 parentId = "frame-1"）
- THEN rect-1 的 x/y 变为相对于 frame-1 左上角的偏移
- AND LayerPanel 显示 rect-1 为 frame-1 的子节点（缩进）

#### Scenario: 嵌套 Frame
- GIVEN Frame A 包含 Frame B，Frame B 包含 Rectangle C
- WHEN 选择 Rectangle C 并移动
- THEN Rectangle C 的坐标在 Frame B 内变化
- AND Frame B 的边界框不变
- AND Frame A 的边界框不变

#### Scenario: 图层拖拽重排序
- GIVEN 画布按 Z-Order 有 Rect A、B、C（A 在底，C 在顶）
- WHEN 在 LayerPanel 将 C 拖拽到 A 上面
- THEN 渲染顺序变为 C、A、B
- AND Konva 层级更新

---

### Requirement: 选择高亮系统

选择元素时显示精确的控制手柄。

#### Scenario: 单选显示 8 控制点
- GIVEN 选中一个 100x50 的 Rectangle
- THEN 显示 4 个角点 + 4 个边中点（共 8 个）
- AND 顶部中心向上延伸旋转手柄

#### Scenario: 多选显示统一边界
- GIVEN 选中两个元素 A(0,0,100,50) 和 B(50,50,80,80)
- THEN 显示覆盖两者的统一边界框 (0,0,130,130)
- AND 8 个控制点位于统一边界框上

#### Scenario: 选择边框样式
- GIVEN 选中元素
- THEN 边框为 1px 虚线 #D4A853（accent 色）
- AND 控制点为 8x8 白色填充圆形

---

### Requirement: Frame 容器

Frame 作为真正的容器，子元素坐标相对于 Frame。

#### Scenario: Frame 裁剪子元素
- GIVEN Frame 尺寸为 200x150，内部有 Rectangle(160,120,100,100)
- THEN Rectangle 超出 Frame 部分被裁剪（clip）
- AND 仅显示 Rectangle 在 Frame 内的部分 (160,120,40,30)

#### Scenario: 子元素坐标转换
- GIVEN Frame(x:100, y:100, width:200, height:150)
- AND 子元素 Rectangle(x:10, y:10, width:50, height:50, parentId:"frame-1")
- WHEN 在画布上渲染
- THEN Rectangle 渲染位置为 (110, 110)
- AND 实际显示大小为 50x50

---

### Requirement: 多选操作

支持多选元素并进行统一操作。

#### Scenario: Shift+Click 多选
- GIVEN 当前选中元素 A
- WHEN Shift+Click 元素 B
- THEN 同时选中 A 和 B
- AND selection 数组包含 ["a", "b"]

#### Scenario: 多选移动保持相对位置
- GIVEN 选中 A(x:0,y:0) 和 B(x:50,y:50)
- WHEN 拖拽移动 10px
- THEN A 移动到 (10,10)，B 移动到 (60,60)
- AND 相对位置保持不变

---

## MODIFIED Requirements

### Requirement: Shape 数据结构

#### Shape 增加字段
```typescript
interface Shape {
  // 现有字段...
  parentId?: string;  // 新增：父元素 ID，undefined 表示在画布顶层
  order?: number;      // 新增：在父元素内的排序
}
```

### Requirement: Konva Transformer 配置

####现状: 4 角点 + 简单边框
#### 目标: 8 控制点 + 旋转手柄 + 圆角支持
