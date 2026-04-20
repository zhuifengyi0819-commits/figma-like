# proposal.md — figma-like-ai-canvas Phase 3

## 背景与目标

Phase 1 完成了核心画布、图层、AI 对话。Phase 2 完成了布尔运算、Path 编辑、文字自动尺寸、取色器、阵列复制、AutoLayout Wrap。

Phase 3 聚焦 4 个中等优先级功能：
1. **组件变体（Component Variants）** — 支持 Frame 内多个子图形作为变体，右侧面板切换显示
2. **文本样式（Text Styles）** — 将文字属性保存为可复用样式，批量应用到多个文本
3. **混合模式/透明度（Blend Effects）** — 支持 multiply/screen/overlay 等混合模式，以及图形透明度
4. **原型链接（Prototype Links）** — Frame 之间可设置交互链接，点击跳转/覆盖/触发

---

## 功能列表

### 1. 组件变体 (component-variants)
- 右键 Frame → "转换为组件"（component）
- Frame 右侧面板显示 variant 下拉切换（类似 Figma 的 Component 切换）
- 支持设置 variant 属性（文字/颜色）在切换时保持
- 主组件（mainComponent）和实例（instance）关系

### 2. 文本样式 (text-styles)
- PropertiesPanel 文本 Section 增加 "保存为样式" 按钮
- 样式保存到 `useEditorStore` 的 `textStyles` 数组（name + textStyle 属性）
- 左侧面板新增 "文本样式" Tab，展示已保存样式列表
- 点击样式应用到选中文本；支持重命名/删除

### 3. 混合模式 & 透明度 (blend-effects)
- PropertiesPanel 外观 Section 增加：
  - 透明度滑块（opacity: 0-100%）
  - 混合模式下拉（normal/multiply/screen/overlay/darken/lighten）
- Canvas 渲染层：Konva 节点 `opacity` + `globalCompositeOperation` 支持
- BlendMode 类型已存在于 `types.ts`

### 4. 原型链接 (prototype-links)
- 选中 Frame 时，PropertiesPanel 显示 "原型" Section
- 设置：targetFrameId + 交互类型（navigate/push/overlay）
- 交互类型为 overlay 时可设置 trigger（click/hover）
- `prototypeMode=true` 时，点击可预览跳转

---

## 优先级

| 功能 | 优先级 | 估计工作 |
|------|--------|---------|
| 混合模式/透明度 | P0 | 小，UI + Canvas 渲染 |
| 文本样式 | P1 | 中，需新建 LeftPanel Tab |
| 原型链接 | P1 | 中，状态管理 + PrototypePlayer 扩展 |
| 组件变体 | P2 | 大，需完整设计 component/instance 体系 |

---

## 约束

- 技术栈不变：Next.js + react-konva + Zustand + Tailwind
- 不做后端，所有状态存 Zustand + localStorage persist
- Build 质量目标：0 TypeScript errors
