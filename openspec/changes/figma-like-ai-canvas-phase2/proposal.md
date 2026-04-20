## Why

当前 figma_like 项目 Phase 1 已完成 AI 画图核心 + 基础编辑器能力。经过代码审查发现：
1. **布尔运算**：数据模型（`booleanOp`）已定义但渲染层缺失，两个图形无法真正合并/相减/相交/排除
2. **Path 节点编辑**：用户能画 path 但无法编辑已有 path 的锚点和曲线控制手柄
3. **文字自动宽高**：`textSizing` 类型已定义但 Canvas 未处理，`autoWidth/autoHeight` 无效
4. **吸管工具**：完全缺失，无法从画布吸取颜色
5. **旋转阵列**：缺失，无法做圆形/线性阵列复制
6. **Auto Layout Wrap**：Auto Layout 算法和 UI 已有，但 wrap 换行功能缺失

这 6 项是 Figma 基础编辑体验的关键组成，解决后项目完成度将从 ~85% 提升至 ~95%。

## What Changes

Phase 2 在 Phase 1 基础上新增/完善 6 个功能模块，所有改动向后兼容，不影响现有功能。

## Capabilities

### New Capabilities
- `boolean-ops`: 两个图形（rect/circle/path）做 union/subtract/intersect/exclude 运算，结果渲染为可继续编辑的 path
- `path-node-editing`: 双击 path 进入节点编辑模式，显示锚点和控制手柄，支持拖拽编辑，Enter 完成
- `text-auto-sizing`: text shape 支持 fixed/autoWidth/autoHeight 三种尺寸模式，Konva 渲染层适配
- `eyedropper-tool`: Toolbar 添加吸管工具，点击画布任意像素读取颜色并应用到选中图形的 fill
- `rotate-copy`: 选中图形 → 右键菜单 → 圆形/线性阵列复制，支持数量和间距参数
- `auto-layout-wrap`: Auto Layout 容器支持 wrap 换行（类似 CSS flex-wrap），Gap 间距控制

### Modified Capabilities
- （无现有 capability 的需求级变更）

## Impact

- 新增依赖：`polygon-clipping`（布尔运算路径计算）
- `Canvas.tsx`：新增 path edit mode 状态 + 节点渲染 + 布尔运算渲染分支
- `ShapeRenderer.tsx`（Canvas 内）：新增 booleanOp 渲染逻辑
- `PropertiesPanel.tsx`：新增布尔运算按钮 + textSizing 切换 + AutoLayout Wrap 开关
- `Toolbar.tsx`：新增 eyedropper 工具 + rotate-copy 按钮
- `ContextMenu.tsx`：新增"阵列复制"菜单项
- `stores/useEditorStore.ts`：新增 `applyBooleanOperation` action
- `lib/measurement.ts`：新增 `computeBooleanPath` 函数
