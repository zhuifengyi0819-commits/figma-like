# Proposal: figma-like-phase4-component-interaction

## Why

Phase 1-3 完成了基础画布、AI 对话、布尔运算、Path、AutoLayout、Component/Instance、原型交互。当前组件编辑和图层关系功能未达到 Figma 水平：

- **组件双击编辑**：无法双击组件实例进入 Master Component 编辑
- **图层展开/折叠**：frame/group/component 的子图层无法折叠
- **图层关系可视化**：子元素数量、嵌套关系不直观

本阶段目标：补全组件深度编辑能力 + 图层树交互体验。

## What Changes

Phase 4 完成以下能力：

1. **组件双击编辑模式**
   - 双击组件实例 → 进入组件编辑模式（画布只显示该组件内容）
   - 画布上方显示"返回"导航栏
   - 编辑的是 Master Component，所有实例同步反映变化

2. **图层树展开/折叠**
   - frame/group/component 左侧有 ▶/▼ 切换按钮
   - 点击可展开/折叠子图层
   - 记住展开状态

3. **图层关系增强**
   - 容器型图层显示子元素数量 badge
   - 选中容器时，子图层也高亮
   - 右键菜单：展开全部 / 折叠全部

## Capabilities

### New Capabilities
- `component-editing-mode`: 双击进入组件编辑模式
- `layer-tree-collapse`: 图层树展开/折叠
- `layer-relationship-visuals`: 子元素数量、嵌套高亮

### Modified Capabilities
- `component-system`: 扩展以支持编辑模式
- `layer-panel`: 扩展以支持折叠和关系可视化

## Impact

- Store 新增 `editingComponentId` 状态
- Canvas.tsx 新增双击处理和编辑模式渲染逻辑
- LayerPanel.tsx 新增展开折叠状态和 badge 显示
- 新增 `ComponentEditingOverlay` 组件（画布顶部导航栏）

## Context

项目使用 Next.js + React + Konva + Zustand + Tailwind。当前组件系统已有 `createInstance`、`detachInstance`、`syncInstances`，但缺少编辑入口。图层系统有 `parentId`/`groupId` 树结构，但缺少折叠 UI。

## Goals / Non-Goals

**Goals:**
- 双击组件实例进入组件编辑模式
- 画布正确渲染组件内部结构
- 图层面板支持展开/折叠
- 子元素数量 badge 显示

**Non-Goals:**
- 不做 Variants 编辑 UI（已有 VariantPanel）
- 不做组件锁定/解锁
- 不做嵌套组件的双击深度编辑（只做一层）

## Decisions

1. **组件编辑模式**: 使用 `editingComponentId` 状态隔离，画布 filter 只显示该组件的子图形
2. **返回机制**: 退出编辑模式时 `editingComponentId = null`，无需历史栈
3. **折叠状态**: 使用 `expandedShapeIds: Set<string>` 在 LayerPanel 内部管理，不侵入 store
4. **Badge**: 容器型图层的 LayerItem 右侧显示 `(${children.length})`

## Risks / Trade-offs

- Konva 渲染隔离：进入组件编辑模式时，需要正确处理坐标转换（子图形坐标是相对父级的）
- 性能：大量图层时折叠状态需要正确重建树
