# Tasks: figma-like-ai-canvas-phase3

## 0. 准备

- [x] 0.1 确认 `types.ts` 现有字段（opacity, BlendMode, TextStyle, Interaction）
- [x] 0.2 确认 `PropertiesPanel.tsx` 外观 Section 现有结构

---

## 1. 混合模式 & 透明度 (blend-effects)

- [x] 1.1 `types.ts`：确认 `Shape.opacity`（默认 1）和 `BlendMode` 类型存在
- [x] 1.2 `PropertiesPanel.tsx`：外观 Section 已有 opacity 滑块
- [x] 1.3 `PropertiesPanel.tsx`：外观 Section 已有 BlendMode 下拉（normal/multiply/screen/overlay/...）
- [x] 1.4 `Canvas.tsx` ShapeRenderer：opacity + globalCompositeOperation 已实现
- [x] 1.5 验证：选中图形 → 调 opacity=50% → 验证透明效果
- [x] 1.6 验证：两个重叠矩形 → 设置 top 为 multiply → 验证叠加效果

---

## 2. 文本样式 (text-styles)

- [x] 2.1 `types.ts`：新增 `TextStyle` 接口（id/name/fontFamily/fontSize/fontWeight/fill/lineHeight/letterSpacing/textAlign）
- [x] 2.2 `stores/useEditorStore.ts`：`textStyles` state + `addTextStyle`/`removeTextStyle`/`renameTextStyle`/`applyTextStyle` actions
- [x] 2.3 `LeftPanel.tsx`：新增 `TextStylesTab`（第4个tab）+ `TextStylesPanel.tsx`（新建）
- [x] 2.4 `PropertiesPanel.tsx`：文本 Section 新增 "💾 保存为文本样式" 按钮
- [x] 2.5 验证：创建文本 → 保存为样式 → 应用到另一文本 → 验证属性同步

---

## 3. 原型链接 (prototype-links)

- [x] 3.1 `types.ts`：`Interaction` 接口已存在（trigger/action/targetFrameId/url/transition/duration）
- [x] 3.2 `stores/useEditorStore.ts`：确认 `Shape.interactions` 字段 + CRUD actions 存在
- [x] 3.3 `PropertiesPanel.tsx`：`InteractionEditor` 组件完整实现（trigger/action/target 下拉）
- [x] 3.4 `Canvas.tsx`：prototypeMode 下点击带链接 Frame → 执行跳转（已实现）
- [x] 3.5 验证：设置 Frame A → 点击跳转到 Frame B → 验证页面切换

---

## 4. 组件变体 (component-variants)

- [x] 4.1 `types.ts`：新增 `isComponent / isMainComponent / masterComponentId` 字段
- [x] 4.2 `ContextMenu.tsx`：Frame 类型时添加 "转换为组件" 菜单项
- [x] 4.3 `stores/useEditorStore.ts`：`createComponent` action 已有
- [x] 4.4 `PropertiesPanel.tsx`：Component Frame 选中时显示主组件/实例/变体 UI（已实现）
- [x] 4.5 验证：Frame → 右键 → 转换为组件 → 验证 isMainComponent + 组件库出现

---

## 5. 集成 & 验收

- [x] 5.1 全量 build：`npm run build`，0 errors
- [ ] 5.2 混合模式：重叠两个图形 → top 设置 multiply → 验证叠加效果
- [ ] 5.3 文本样式：保存样式 → 应用到其他文本 → 验证属性
- [ ] 5.4 原型链接：Frame 间跳转 → prototypeMode 预览
- [ ] 5.5 组件变体：转换 → 添加 variant → 切换 → 验证显示内容
- [ ] 5.6 lint 检查：修复所有新增代码的 lint errors

---

## 执行顺序

已完成 1（已有）→ 2（新增）→ 3（已有）→ 4（补全"转换为组件"菜单项）
