# design.md — figma-like-ai-canvas Phase 3

## 依赖关系

```
blend-effects      ──→  types.ts — BlendMode 类型已存在，opacity 字段已存在
                      PropertiesPanel.tsx — 外观 Section（扩展 opacity 滑块 + blend 下拉）
                      Canvas.tsx — ShapeRenderer 传递 opacity + globalCompositeOperation

text-styles        ──→  useEditorStore — textStyles state + CRUD actions
                      types.ts — TextStyle 接口
                      LeftPanel.tsx — 新增 "文本样式" Tab
                      PropertiesPanel.tsx — "保存为样式" 按钮

prototype-links    ──→  types.ts — PrototypeLink 接口
                      PropertiesPanel.tsx — 原型 Section（target 下拉 + trigger 下拉）
                      Canvas.tsx — handleClick → 检测 prototypeLinks
                      PrototypePlayer / Editor.tsx — prototypeMode 扩展

component-variants ──→  types.ts — isComponent / isMainComponent / masterComponentId / componentVariants
                      ContextMenu.tsx — "转换为组件" 菜单项
                      PropertiesPanel.tsx — Component 区域（variant 列表 + 编辑状态切换）
                      Canvas.tsx — FrameRenderer — 根据当前 variant 渲染子图形
```

## 技术方案

### blend-effects
- `opacity` 字段已在 `Shape` 类型（默认 1）
- Canvas ShapeRenderer 对所有 shape 设置 `opacity={shape.opacity}`
- Konva 的 `globalCompositeOperation` 对应 blend mode，传入各 shape 的 Konva 节点
- BlendMode 下拉放在 PropertiesPanel 外观 Section（现有 Section 扩展）

### text-styles
- `TextStyle` 接口：`id / name / fontFamily / fontSize / fontWeight / fill / lineHeight / letterSpacing`
- `useEditorStore` 新增 `textStyles: TextStyle[]`，通过 persist 持久化
- LeftPanel 新增 `TextStylesPanel` 组件（与 Layers / Components Tab 并列）
- PropertiesPanel 文本 Section 新增 "💾 保存为样式" 按钮

### prototype-links
- `PrototypeLink` 接口：`targetId / type(navigate|overlay|trigger) / trigger(click|hover)`
- `Shape.prototypeLinks?: PrototypeLink[]`
- PropertiesPanel 原型 Section：Frame 选中时显示；target 下拉列出所有 Frame
- prototypeMode 开启时 Canvas 点击检测 prototypeLinks 并执行跳转

### component-variants
- `Shape.isComponent / isMainComponent / masterComponentId / componentVariants: Record<string, Partial<Shape>>`
- variant 存储为 `{ [variantId]: { childShapeId: partialProps } }`
- FrameRenderer 根据当前 `activeVariant` 渲染子图形属性
- 右键菜单添加 "转换为组件"（当 shape.type === 'frame'）
