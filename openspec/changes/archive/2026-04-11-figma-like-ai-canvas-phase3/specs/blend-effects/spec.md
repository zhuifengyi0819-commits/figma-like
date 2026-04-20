# spec.md — Blend Effects（混合模式 & 透明度）

## 功能概述

在 PropertiesPanel 外观 Section 增加透明度滑块和混合模式下拉，Canvas 渲染层支持 opacity 和 globalCompositeOperation。

## 用户故事

- 用户选中任意图形，在右侧属性面板的"外观"区域调整 opacity 和 blend mode，图形实时预览效果。

---

## Requirements

### 1. 透明度（Opacity）

#### Scenario: 调整图形透明度
- Given 用户选中了一个矩形（fill="#4A90E2"）
- When 用户在外观 Section 将透明度滑块从 100% 拖至 50%
- Then 矩形 fill 颜色变为 rgba(74, 144, 226, 0.5)，Canvas 实时更新

#### Scenario: 透明度数值直接输入
- Given 用户选中了图形
- When 用户在 opacity 输入框直接输入 "25"
- Then 图形 opacity = 0.25

### 2. 混合模式（Blend Mode）

#### Scenario: 应用 multiply 混合模式
- Given 用户选中了一个矩形（覆盖在某图形上方）
- When 用户在混合模式下拉选择 "multiply"
- Then 矩形以 multiply 模式渲染，与下方图形产生叠加效果

#### Scenario: 清除混合模式
- Given 用户选中了一个应用了 blend mode 的图形
- When 用户在下拉中选择 "normal"
- Then 图形恢复正常混合模式

---

## 验收标准

- [ ] opacity 范围 0-100，步进 1，默认为 100
- [ ] blend mode 支持：normal / multiply / screen / overlay / darken / lighten / color-dodge / color-burn / hard-light / soft-light / difference / exclusion
- [ ] Canvas 渲染层正确应用 Konva 节点的 `opacity` 和 `globalCompositeOperation`
- [ ] PropertiesPanel 外观 Section 已有 opacity 滑块和 blend mode 下拉（现有），无需新增 Section，只扩展现有 UI
