# Phase 6: Prototype 原型交互系统 — 完整复刻 Figma

## 背景与目标

当前项目的原型交互系统处于非常初级的阶段：

**现有能力**：
- `Interaction` 接口支持 click/hover/drag 触发
- navigateTo/back/openUrl/swap/scrollTo 动作
- 基础过渡效果 (instant/dissolve/slide/scale)
- Smart Animate 基础版本
- 全屏预览播放器

**与 Figma 的完整差距**（核心项）：
1. **Overlay 系统**：Figma 最核心的交互能力，modal/side panel 叠加层完全缺失
2. **Prototype Flows**：画框间的连线流程，概览模式
3. **完整 Trigger/Action**：afterDelay/whileDown/mouseDown/keyDown 和 overlay 动作
4. **Easing 曲线**：弹性/缓动等真实过渡曲线
5. **Prototype 状态系统**：变量、条件、状态切换
6. **原型编辑 UI**：Toolbar 集成、Flow 连线预览
7. **Smart Animate 完善**：FLIP、easing curves、改进匹配
8. **Component Overrides**：INSTANCE 在播放时应显示 overrides
9. **Frame Overflow Clip**：Canvas 中 frame 的 clipContent 未实现

## 需要解决的 3 个关键问题

### 1. Overlay 系统（最核心）
Figma 的 overlay 不是简单的"打开另一个 frame"，而是有独立的叠加层语义：
- 定位：Center / Top / Bottom / Left / Right / 自定义坐标
- 背景遮罩（backdrop）：深色半透明背景，点击关闭
- 过渡动画：从触发元素的位置/大小 animate 到 overlay 位置
- 关闭行为：点击遮罩、按 ESC、按关闭按钮
- 当前设计中完全没有 `overlay` action 类型

### 2. Prototype Flows（可视化核心）
Figma 原型模式的核心 UI：
- 画框之间用箭头连线表示交互流向
- 连线上显示触发类型（点击/悬停图标）
- 点击连线可编辑交互
- 概览模式：显示所有画框和连线
- 当前完全没有 `Flow` 数据结构和 UI

### 3. 原型状态系统（交互逻辑核心）
真正的交互需要状态：
- 变量（prototype variables）：字符串/数字/布尔
- 状态改变 action：设置变量值
- 条件判断：根据变量值决定跳转
- 当前交互是静态的，无法实现"点击后改变颜色"这类状态切换

## 决策

### 决策 1：分阶段实施
由于工作量极大，分 3 个子阶段：
- **Phase 6A**：Overlay 系统 + Easing 曲线 + Flow 连线基础
- **Phase 6B**：完整 Trigger/Action 集合 + Prototype 概览模式
- **Phase 6C**：状态系统 + 条件逻辑

### 决策 2：Overlay 实现方式
采用 React portal + 绝对定位实现 overlay，不使用 Konva：
- Overlay 在 Canvas 之上（DOM 层）
- 使用 CSS transition + cubic-bezier 实现动画
- backdrop 使用 fixed overlay
- 避免修改 Konva stage 结构

### 决策 3：Flow 数据结构
```typescript
interface PrototypeFlow {
  id: string;
  name: string;
  nodes: FlowNode[];     // 画框节点（屏幕上的位置）
  edges: FlowEdge[];     // 交互连线
}

interface FlowNode {
  frameId: string;
  x: number;             // 在 flow 画布上的位置
  y: number;
}

interface FlowEdge {
  id: string;
  sourceFrameId: string;
  targetFrameId: string;
  trigger: Interaction['trigger'];
  action: Interaction['action'];
}
```

### 决策 4：动画引擎
使用 CSS transitions + JavaScript cubic-bezier，不引入外部动画库：
```typescript
type EasingType =
  | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'linear'
  | 'spring' | 'bounce' | 'elastic';
```

## 实施范围

**Phase 6A（本次实施）**：
- ✅ Overlay 系统（定位、遮罩、动画、关闭）
- ✅ 8 种 Easing 曲线
- ✅ Flow 数据结构
- ✅ Flow 连线预览（Canvas 覆盖层）
- ✅ Prototype Overview 概览模式
- ✅ Prototype Toolbar 集成
- ✅ Component Overrides 在播放时应用
- ✅ Frame clipContent 实现

**Phase 6B/C**（后续）：
- 完整 trigger/action 集合
- 变量系统
- 条件逻辑
