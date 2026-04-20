# Proposal: figma-like Phase 3 — Canvas Core

## Intent

将 figma_like 的核心画布能力提升到接近 Figma 的水平。当前版本在图层嵌套结构、选择高亮、Frame 容器能力上与 Figma 存在显著差距，需要系统性重构。

## Scope

**包含：**
1. **图层树系统**：真正的嵌套树结构，支持 Frame 包含 children，支持拖拽重排序
2. **选择高亮系统**：8 控制点（4 角点 + 4 边中点）+ 旋转手柄 + 多选统一边界框
3. **Frame 容器**：Frame 作为真正的容器，子元素坐标相对于 Frame，支持嵌套变换
4. **多选操作**：多选时智能对齐、分布显示

**不包含：**
- Auto Layout（Phase 4）
- 组件变体系统（Phase 4）
- 原型交互（Phase 4）

## Approach

### 核心技术决策

1. **数据结构**：Shape 增加 `parentId` 字段，Frame 的 children 是真正的子元素
2. **坐标系统**：子元素 x/y 是相对于父 Frame 左上角的偏移量
3. **选择系统**：使用 Konva Transformer，配置 8 锚点 + 旋转手柄
4. **图层渲染**：递归渲染，考虑嵌套层级

### 参考 Figma 数据结构

从 Figma REST API 获取的数据结构：
```
Frame (absoluteBoundingBox: 2436x900)
  └── content-wrapper
      └── header
      └── body
          └── form-item
          └── select
```

子元素 position 是相对于父容器的偏移。
