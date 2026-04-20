# spec.md — Prototype Links（原型链接）

## 功能概述

在 Frame 之间设置交互链接（点击跳转/覆盖/触发），支持设置 target + interaction type + trigger，prototypeMode 下可预览。

---

## Requirements

### 1. 设置原型链接

#### Scenario: 为 Frame 设置跳转链接
- Given 用户选中了一个 Frame
- When 用户在 PropertiesPanel 的 "原型" Section 选择 target Frame "页面 2"
- And 设置交互类型为 "navigate（跳转）"
- Then 该 Frame 的 `prototypeLinks` 中存储 `{ targetId, type: 'navigate', trigger: 'click' }`

#### Scenario: 设置 overlay 交互
- Given 用户选中了一个 Frame
- When 用户设置交互类型为 "overlay（覆盖）"
- Then UI 显示 trigger 下拉（click / hover），并可选择 "关闭" 行为

#### Scenario: 预览交互
- Given 用户开启了 Prototype 预览模式（工具栏或菜单）
- When 点击设置了 navigate 链接的 Frame
- Then 界面跳转到目标 Frame 所在页面

### 2. 原型数据管理

#### Scenario: 清除链接
- Given 用户选中了一个有 prototypeLink 的 Frame
- When 用户点击 "移除链接"
- Then `prototypeLinks` 中该条目被删除

---

## 验收标准

- [ ] `Shape.prototypeLinks?: PrototypeLink[]` 已存在于 `types.ts`
- [ ] `PrototypeLink` 类型：targetId / type(navigate | overlay | trigger) / trigger(click | hover)
- [ ] PropertiesPanel 选中 Frame 时显示 "原型" Section（无链接时显示 "添加链接" 按钮）
- [ ] prototypeMode 开启后，点击带链接的 Frame 触发对应行为
- [ ] Build 0 errors
