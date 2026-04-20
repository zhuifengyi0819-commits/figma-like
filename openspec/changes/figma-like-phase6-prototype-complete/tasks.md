# Phase 6 Tasks: Prototype 原型交互系统 — 完整复刻

## Task 1: 扩展类型系统
**文件**: `lib/types.ts`
**内容**:
- 添加 TriggerType 联合类型（click/hover/drag/mouseDown/mouseUp/mouseEnter/mouseLeave/keyDown/afterDelay/whileDown/onLoad/none）
- 添加 ActionType 联合类型（navigateTo/back/openUrl/swap/scrollTo/overlay）
- 添加 EasingType 联合类型（ease/easeIn/easeOut/easeInOut/linear/spring/bounce/elastic）
- 扩展 Interaction 接口：添加 overlay、easing、delay 等字段
- 添加 OverlayConfig 接口
- 添加 PrototypeFlow、FlowNode、FlowEdge 接口
- 添加 Variable 接口
- 添加 `prototypeMode: 'edit' | 'preview' | 'flow'` 到 editor store 状态

**验证**: `npx tsc --noEmit` 无新错误

## Task 2: 实现 Overlay 系统
**文件**: 新建 `components/prototype/OverlayPortal.tsx`, `OverlayPanel.tsx`, `Backdrop.tsx`
**内容**:
- `OverlayPortal`: React Portal 在 document.body 上创建 overlay 层
- `OverlayPanel`: 单个 overlay 面板，支持 6 种定位，计算动画起点/终点
- `Backdrop`: 全屏遮罩，支持点击关闭
- FLIP 动画实现：从触发元素位置动画到 overlay 位置
- CSS cubic-bezier easing 支持
- ESC 键关闭、点击背景关闭

**验证**: 手动测试点击按钮 → overlay 从按钮位置动画展开

## Task 3: 修改 PrototypePlayer 支持 Overlay
**文件**: 修改 `components/PrototypePlayer.tsx`
**内容**:
- 支持 `overlay` action：在 OverlayPortal 中打开目标 frame 作为 overlay
- 支持所有新 trigger（afterDelay 用 setTimeout，mouseDown/mouseUp 用事件监听）
- 应用 EasingType 到 CSS transition
- 应用 Component Overrides 到 INSTANCE shapes
- overlay 打开时记录触发元素位置用于 FLIP 动画
- 支持多个 overlay 栈（嵌套打开）

**验证**: 手动测试 click → overlay 动画效果

## Task 4: 实现 Flow 连线系统
**文件**: 新建 `components/prototype/PrototypeOverlay.tsx`, `FlowEdge.tsx`
**内容**:
- `PrototypeOverlay`: SVG 层，覆盖在 Canvas 之上
- `FlowEdge`: 单条连线，使用 Bezier curve，从 source 右边缘 → target 左边缘
- SVG `<defs>` 定义箭头 marker
- 根据两个 frame 的相对位置动态计算曲线控制点
- 连接点预计算存储
- Flow edges 从 prototypeFlows store 读取

**验证**: Flow 模式下能看到画框之间的箭头连线

## Task 5: 实现 PrototypeToolbar
**文件**: 新建 `components/prototype/PrototypeToolbar.tsx`
**内容**:
- 3 种模式切换：Edit / Preview(播放) / Flow
- Edit: 正常编辑，交互可点击选中编辑
- Preview: 全屏播放原型
- Flow: 显示连线，可拖拽节点位置
- 左侧放置 logo/name
- 右侧放置 presentation 按钮

**验证**: Toolbar 上能看到 3 个模式按钮，切换功能正常

## Task 6: 实现 PrototypeOverview
**文件**: 新建 `components/prototype/PrototypeOverview.tsx`
**内容**:
- 概览模式：显示所有 frame 的缩略图 + 连线
- 可拖拽 frame 节点改变位置
- 点击 edge 可以编辑/删除交互
- mini-map 支持
- 从 editorStore 读取 prototypeFlows

**验证**: Flow 概览模式显示所有画框和连线

## Task 7: 实现 Frame clipContent
**文件**: 修改 `components/Canvas.tsx`
**内容**:
- 在 FrameRenderer 中检测 `clipContent` 字段
- 使用 Konva Group `clipFunc` 实现裁剪
- clipFunc 使用 `roundRect` 如果有 cornerRadius，否则用 `rect`
- 对于 auto-layout frames，同样正确 clip

**验证**: 画框内子元素超出边界时被裁剪，不显示

## Task 8: 完善 PropertiesPanel InteractionEditor
**文件**: 修改 `components/PropertiesPanel.tsx`
**内容**:
- 扩展 trigger 下拉框：添加 mouseDown/mouseUp/mouseEnter/mouseLeave/keyDown/afterDelay/whileDown/onLoad/none
- 扩展 action 下拉框：添加 overlay
- 当 action = overlay 时，显示 OverlayConfig 配置面板（定位选择、关闭选项）
- 当 trigger = afterDelay 时，显示 delay 输入框（ms）
- 添加 Easing 选择下拉框
- 完善过渡时长输入

**验证**: PropertiesPanel 中配置 overlay 交互选项

## Task 9: 添加 prototype 模式到 Toolbar
**文件**: 修改 `components/Toolbar.tsx`
**内容**:
- 在 toolbar 右侧添加 prototype 按钮组
- 图标按钮：Play(▶) / Flow(→)
- 当前模式高亮显示
- 点击 Play 进入 PrototypePlayer 全屏预览
- 点击 Flow 进入 Flow 概览模式

**验证**: Toolbar 显示 prototype 入口按钮

## Task 10: 扩展 useEditorStore
**文件**: 修改 `stores/useEditorStore.ts`
**内容**:
- 添加 `prototypeMode: 'edit' | 'preview' | 'flow'`
- 添加 `prototypeFlows: PrototypeFlow[]`
- 添加 `prototypeVariables: Variable[]`
- 添加 `activeOverlays: ActiveOverlay[]`
- 添加 `setPrototypeMode`, `addFlow`, `updateFlow`, `removeFlow`
- 添加 `setVariable`, `addOverlay`, `removeOverlay` actions
- 添加 `addInteraction(shapeId, interaction)`, `removeInteraction`, `updateInteraction`

**验证**: `npx tsc --noEmit` 无错误

## Task 11: 最终集成测试
**内容**:
- 全系统集成测试
- TypeScript 验证
- Git commit

---

## 优先级排序

1. Task 1 (类型系统) — 必须先做，其他都依赖它
2. Task 10 (store) — 紧跟类型定义
3. Task 7 (clipContent) — 简单独立，验证基础框架
4. Task 2 (Overlay 系统) — 核心功能
5. Task 3 (Player 支持 Overlay) — 核心功能
6. Task 4 (Flow 连线) — 核心功能
7. Task 5 (Toolbar) — UI 入口
8. Task 6 (Overview) — Flow 模式完善
9. Task 8 (InteractionEditor 完善) — 编辑体验
10. Task 9 (Toolbar 集成) — UI 入口
11. Task 11 (测试验证)

## 验收标准

- [ ] PropertiesPanel 可以配置所有 trigger 和 overlay action
- [ ] PrototypePlayer 播放时 overlay 动画正常
- [ ] Flow 概览模式显示所有画框连线
- [ ] Frame clipContent 正常工作
- [ ] Component INSTANCE 在播放时显示 overrides
- [ ] TypeScript 无错误
- [ ] Git commit 完成
- [ ] Vercel 部署成功
