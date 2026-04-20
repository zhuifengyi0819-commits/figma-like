# Phase 5 Proposal: Constraints + Nested Auto Layout

## 需求背景

经过对 Figma 真实行为的认真对比，发现以下严重功能缺失：

### 1. Constraints 未实现预览效果
- `constraints?: Constraints` 字段已定义（horizontal/vertical 各有 min/center/max/stretch 4种）
- `applyConstraints()` 在 store 中存在（frame 缩放时调用）
- **但预览时（Canvas 渲染）children 位置直接用 `child.x - frame.x` 计算，忽略了 constraints**
- Figma: 预览模式下 children 按 constraints 计算后的位置/尺寸显示

### 2. Auto Layout 嵌套未实现
- 单个 Auto Layout frame 渲染时，`frame.x`/`frame.y` 是其在父容器中的偏移量
- 当 frame 有 `autoLayout` 时，其 children 应该按 AL 计算排列
- **当前：frame 的 children 仍用 canvas 绝对坐标渲染，没有按 AL 计算**

### 3. Frame clipContent
- `containerClipOverflow()` 已在 `measurement.ts` 中实现
- Frame 的 `clipFunc` 已设置（`clipContent !== false`）
- 但嵌套的 children 没有正确计算，导致裁切可能错位

### 4. 文字编辑 textarea 位置错误
- 当文字在 frame/group 内部时，`getAbsolutePosition()` 应该返回相对于 stage 的绝对位置
- 但 children 的坐标是 `{ x: child.x - frame.x, y: child.y - frame.y }`，即相对于 frame 左上角
- textarea 是 absolute 定位，需要叠在 canvas 元素上方，坐标应该是相对于 canvas container 的

## 目标

1. 实现 constraints 预览：Canvas 渲染 frame children 时，根据 constraints 计算最终位置/尺寸
2. 实现 Auto Layout 嵌套：frame 有 autoLayout 时，递归计算 children 布局（位置 = frame偏移 + AL计算后的相对位置）
3. 修复 textarea 位置：对嵌套文字，textarea 需要正确考虑父级 transform
4. 完善 Frame clipContent：确保裁切坐标正确

## 关键决策

### Q: Constraints 计算放在哪里做？
A: 在 `FrameRenderer` 中，渲染 children 之前计算每个 child 的最终布局属性。不修改 store 数据（预览效果）。

### Q: Auto Layout 嵌套如何实现？
A: 在 `FrameRenderer` 中：
- 如果 frame 有 `autoLayout`，使用递归布局算法计算所有 children 的最终 x,y,w,h
- 递归处理：frame 的某个 child 如果本身也是 autoLayout frame，则先计算它的子元素，再决定它在父 AL 中的位置

### Q: textarea 位置如何修正？
A: textarea 叠在 Konva stage 上方。对嵌套文字，需要考虑 frame/group 的 x,y 偏移。
