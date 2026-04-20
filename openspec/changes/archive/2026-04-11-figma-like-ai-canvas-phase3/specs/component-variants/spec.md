# spec.md — Component Variants（组件变体）

## 功能概述

将 Frame 及其子图形转换为组件（Component），支持在组件内创建多个变体（Variant），通过右侧属性面板切换显示哪个变体。变体可以是不同属性值的组合。

---

## Requirements

### 1. 转换为组件

#### Scenario: 将 Frame 转换为组件
- Given 用户选中了一个 Frame（内含多个子图形）
- When 用户在右键菜单选择 "转换为组件"
- Then Frame 的 `isComponent = true`，`isMainComponent = true`
- And 右侧面板显示 Component 区域（组件名称 + 变体列表）

#### Scenario: 创建变体
- Given 用户选中了一个 Component Frame
- When 用户在右侧面板点击 "添加变体"
- Then 生成新 variant（基于当前所有子图形属性集的克隆），变体 id = `variant-N`
- And variant 列表显示 [main, variant-1, variant-2, ...]

### 2. 编辑变体

#### Scenario: 切换当前编辑的变体
- Given 用户选中了一个 Component Frame
- When 用户在右侧面板 variant 列表点击 "variant-1"
- Then 画布显示 variant-1 的子图形状态
- And 右侧属性能编辑 variant-1 的子图形属性

#### Scenario: 修改变体属性
- Given 用户在编辑 "variant-1"
- When 用户修改了某个子文本的 fontSize
- Then 仅 variant-1 的该属性更新，main 和其他 variant 不变

### 3. 实例化组件

#### Scenario: 从组件创建实例
- Given 用户选中了一个 Component Frame（main）
- When 用户使用 ⌘D 或右键 "复制" 该 Frame
- Then 新 Frame 的 `masterComponentId = 原组件 id`，`isMainComponent = false`
- And 实例 Frame 的显示内容跟随当前选中的 variant

#### Scenario: 实例切换 variant
- Given 用户选中了一个 Component 实例
- When 用户在右侧面板 variant 列表选择不同 variant
- Then 实例显示内容更新为新 variant 的属性

---

## 验收标准

- [ ] `Shape.isComponent / isMainComponent / masterComponentId / componentVariants` 字段存在于 `types.ts`
- [ ] Frame → 右键菜单 → "转换为组件" → 完成转换
- [ ] 组件 Frame 支持添加/切换/删除 variant
- [ ] 实例跟随 variant 显示，但实例的改动不影响主组件（detach 逻辑）
- [ ] Build 0 errors
