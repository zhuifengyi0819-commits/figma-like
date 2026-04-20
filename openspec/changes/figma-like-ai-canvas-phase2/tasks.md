# Tasks: figma-like-ai-canvas-phase2

## 1. 布尔运算 (boolean-ops)

- [x] 1.1 安装依赖：`npm install polygon-clipping @types/polygon-clipping`
- [x] 1.2 新建 `lib/boolean.ts`：`shapeToPolygon` / `polygonToSvgPath` / `computeBooleanPath`
- [x] 1.3 新建 `lib/pixelColor.ts`：`getPixelColor` 函数
- [x] 1.4 `stores/useEditorStore.ts`：新增 `applyBooleanOperation` action
- [x] 1.5 `Canvas.tsx` ShapeRenderer：新增 `booleanOp` 渲染分支（booleanOp 存在时用 Konva.Path）
- [x] 1.6 `PropertiesPanel.tsx`：新增布尔运算按钮组 UI（选中 2 个 rect/circle/path 时显示）
- [x] 1.7 `PropertiesPanel.tsx`：选中 2 个不支持类型时显示 Toast 错误提示

## 2. Path 节点编辑 (path-node-editing)

- [x] 2.1 `Canvas.tsx`：新增 `editingPathId` state + `selectedAnchorIdx` state
- [x] 2.2 `Canvas.tsx`：双击 path shape → 设置 `editingPathId`
- [x] 2.3 `Canvas.tsx`：path edit mode 渲染锚点（Konva.Rect）和控制手柄（Konva.Circle + Konva.Line）
- [x] 2.4 `Canvas.tsx`：拖拽锚点 → 更新 `pathPoints[idx].x/y`，实时刷新
- [x] 2.5 `Canvas.tsx`：拖拽控制手柄 → 更新 `pathPoints[idx].cp1/cp2`
- [x] 2.6 `Canvas.tsx`：添加锚点（点击路径线段中点）
- [x] 2.7 `Canvas.tsx`：删除锚点（Delete/Backspace）
- [x] 2.8 `Canvas.tsx`：按 Enter/Escape/点击空白 → 完成/放弃编辑
- [x] 2.9 `Canvas.tsx`：path edit mode 右键菜单（添加/删除锚点/闭合路径）

## 3. 文字自动尺寸 (text-auto-sizing)

- [x] 3.1 `Canvas.tsx` Text case：根据 `textSizing` 设置 Konva Text 的 width/height/ellipsis 属性
- [x] 3.2 `PropertiesPanel.tsx`：在"文字" Section 新增 textSizing 选择器（fixed/autoWidth/autoHeight）
- [x] 3.3 `PropertiesPanel.tsx`：切换 textSizing 时的行为处理（记录/恢复宽度）
- [x] 3.4 `types.ts`：确认 `TextSizing` 类型已存在（已有 ✓）

## 4. 吸管工具 (eyedropper-tool)

- [x] 4.1 `Toolbar.tsx`：新增 `'eyedropper'` tool + Pipette 图标
- [x] 4.2 `stores/useEditorStore.ts`：确认 eyedropper 在 ToolType 中（已有 ✓）
- [x] 4.3 `Canvas.tsx`：eyedropper 模式 → 鼠标变成放大镜，显示颜色预览
- [x] 4.4 `Canvas.tsx`：点击读取像素颜色 → `updateShape(selectedIds[0], { fill: color })`
- [x] 4.5 `Canvas.tsx`：吸取后自动切回 select 工具
- [x] 4.6 `Canvas.tsx`：无选中图形时 Toast 提示

## 5. 旋转/线性阵列复制 (rotate-copy)

- [x] 5.1 新建 `components/ArrayModal.tsx`：模态框 UI（类型切换/数量/半径/偏移）
- [x] 5.2 `ContextMenu.tsx`：新增"阵列复制..."菜单项
- [x] 5.3 `stores/useEditorStore.ts` 或 `Canvas.tsx`：新增 `rotateCopy` / `linearCopy` 函数
- [x] 5.4 `Editor.tsx`：渲染 `<ArrayModal />`（受控于 `showArrayModal` state）
- [x] 5.5 `Canvas.tsx`：右键菜单 → 打开 ArrayModal（通过 store action 或 prop）

## 6. Auto Layout Wrap (auto-layout-wrap)

- [x] 6.1 `types.ts`：确认 `AutoLayout.wrap?: boolean` 已存在（已有 ✓）
- [x] 6.2 `stores/useEditorStore.ts`：`computeAutoLayout` 函数新增 wrap 检测分支
- [x] 6.3 `stores/useEditorStore.ts`：`computeWrappedLayout` 函数
- [x] 6.4 `PropertiesPanel.tsx`：AutoLayout Section 末尾新增 Wrap 开关（仅 direction=horizontal 时显示）
- [x] 6.5 `PropertiesPanel.tsx`：Wrap 开启时自动设置 direction=horizontal

## 7. 集成 & 验收

- [x] 7.1 全量 build：`npm run build`，0 errors
- [x] 7.2 布尔运算：选中 2 个 rect → union → 验证 pathData 生成 + 渲染正确
- [x] 7.3 Path 编辑：双击 path → 拖动锚点 → Enter 确认 → 验证 pathPoints 更新
- [x] 7.4 文字尺寸：创建 text → 切换 autoWidth → 验证宽度自适应
- [x] 7.5 吸管工具：选中 rect → eyedropper → 点击画布 → 验证 fill 变化
- [x] 7.6 阵列复制：选中图形 → 右键 → 阵列复制 → 5份圆形 → 验证生成 5 个旋转复制
- [x] 7.7 Wrap：Frame + AutoLayout + 多个子图形 → 开启 wrap → 验证自动换行
- [x] 7.8 lint 检查：修复所有新增代码的 lint errors
