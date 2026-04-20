# spec.md — Text Styles（文本样式）

## 功能概述

将文本属性（字体/字号/字重/颜色/行高）对保存为可复用样式，在左侧面板新增 "文本样式" Tab，支持创建/应用/重命名/删除。

---

## Requirements

### 1. 保存文本样式

#### Scenario: 将选中文本的属性保存为样式
- Given 用户选中了一个文本图形（fontSize=16, fontWeight=400, fill="#333", fontFamily="Inter"）
- When 用户在 PropertiesPanel 文本 Section 点击 "保存为样式"
- Then 弹出 name 输入框，输入 "正文" 确认后，样式存入 `useEditorStore.textStyles`
- And 左侧面板文本样式 Tab 显示 "正文" 条目

#### Scenario: 样式重名处理
- Given 用户已有样式名为 "标题"
- When 用户尝试将另一文本保存为 "标题"
- Then 提示 "样式名称已存在"，不重复创建

### 2. 应用文本样式

#### Scenario: 将样式应用到选中文本
- Given 用户选中了一个文本图形（fontSize=12）
- And 用户在左侧文本样式 Tab 点击了 "正文" 样式（fontSize=16）
- Then 选中文本的 fontSize 变为 16，其他属性也被覆盖

### 3. 管理样式

#### Scenario: 重命名样式
- Given 用户在文本样式 Tab 右键点击 "正文"
- When 选择 "重命名" 输入 "副标题"
- Then 列表中名称更新为 "副标题"

#### Scenario: 删除样式
- Given 用户在文本样式 Tab 右键点击 "正文"
- When 选择 "删除"
- Then 样式从列表移除，已应用该样式的图形属性不变（保留已应用的值）

---

## 验收标准

- [ ] `useEditorStore` 新增 `textStyles: TextStyle[]` state 和 `addTextStyle`/`removeTextStyle`/`applyTextStyle` action
- [ ] `TextStyle` 类型包含：id / name / fontFamily / fontSize / fontWeight / fill / lineHeight / letterSpacing
- [ ] 左侧面板新增 "文本样式" Tab（与现有 LeftPanel tabs 并列）
- [ ] 样式支持创建/应用/重命名/删除
- [ ] Build 0 errors
