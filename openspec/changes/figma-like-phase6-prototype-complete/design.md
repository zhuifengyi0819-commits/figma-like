# Phase 6 Design: Prototype 原型交互系统架构

## 1. 技术架构

### 1.1 Overlay 系统架构

Overlay 是独立于 Konva Canvas 的 DOM 层，使用 React Portal 实现：

```
App
└── Editor (Konva Canvas)
    └── PrototypePlayer (覆盖整个 canvas)
        ├── Toolbar overlay
        ├── Frame canvas (Konva Stage)
        └── Overlay Layer (React Portal)
            ├── Backdrop (fixed, z-index high)
            └── Overlay Panel (positioned relative to trigger element)
```

**Overlay 定位计算**：
- **Center**: `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%)`
- **Top**: `top: 0; left: 50%; transform: translateX(-50%)`
- **Bottom**: `bottom: 0; left: 50%; transform: translateX(-50%)`
- **Left**: `left: 0; top: 50%; transform: translateY(-50%)`
- **Right**: `right: 0; top: 50%; transform: translateY(-50%)`
- **Custom**: 相对于触发元素的偏移量

**Overlay 动画**：
- 从触发元素的 bounding rect 开始
- 使用 FLIP animation 技术动画到目标位置
- 使用 `cubic-bezier` 实现 easing
- 关闭时反向动画回触发元素

### 1.2 Flow 连线架构

Flow 是原型模式的可视化连线层：

```
PrototypeOverlay (SVG layer over Canvas)
├── <svg> (pointer-events: none)
│   ├── <defs> (箭头 marker)
│   └── {edges.map(edge => <FlowEdge edge={edge} />)}
└── (FlowNode handles for dragging)
```

**Path 生成算法**：
- Bezier curve 从 source frame 右边缘 → target frame 左边缘
- 控制点根据相对位置动态计算
- 连接点存储在 edge 上（避免每次重算）

### 1.3 状态管理

在 `useEditorStore` 中新增 prototype 状态：

```typescript
interface PrototypeState {
  mode: 'edit' | 'preview' | 'flow';
  activeFlowId: string | null;
  overlays: ActiveOverlay[];        // 当前打开的 overlay 栈
  prototypeVariables: Variable[];   // 原型变量
}
```

## 2. 核心数据结构

### 2.1 扩展 Interaction 接口

```typescript
// Trigger 类型扩展
type TriggerType =
  | 'click'      // ✅ 已有
  | 'hover'      // ✅ 已有
  | 'drag'       // ✅ 已有
  | 'mouseDown'  // 🆕
  | 'mouseUp'    // 🆕
  | 'mouseEnter' // 🆕
  | 'mouseLeave' // 🆕
  | 'keyDown'    // 🆕
  | 'afterDelay' // 🆕
  | 'whileDown'  // 🆕
  | 'onLoad'     // 🆕
  | 'none';      // 🆕

// Action 类型扩展
type ActionType =
  | 'navigateTo'   // ✅ 已有
  | 'back'          // ✅ 已有
  | 'openUrl'       // ✅ 已有
  | 'swap'          // ✅ 已有
  | 'scrollTo'      // ✅ 已有
  | 'overlay';      // 🆕 叠加层

// Easing 类型
type EasingType =
  | 'ease' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'linear'
  | 'spring' | 'bounce' | 'elastic';

// Overlay 配置
interface OverlayConfig {
  positioning: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'custom';
  offsetX?: number;  // custom 时的偏移
  offsetY?: number;
  closeOnClick?: boolean;  // 点击背景关闭
  closeOnEsc?: boolean;   // ESC 关闭
  backgroundColor?: string; // backdrop 颜色，默认 rgba(0,0,0,0.5)
}
```

### 2.2 Flow 数据结构

```typescript
interface PrototypeFlow {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: number;
}

interface FlowNode {
  frameId: string;
  x: number;         // 在 flow 画布上的 x
  y: number;         // 在 flow 画布上的 y
  width: number;
  height: number;
}

interface FlowEdge {
  id: string;
  sourceNodeId: string;  // source frame id
  targetNodeId: string; // target frame id
  // 动态计算
  sourcePoint?: { x: number; y: number }; // source frame 边缘连接点
  targetPoint?: { x: number; y: number };
  // 显示信息
  trigger: TriggerType;
  label?: string;
}
```

### 2.3 Prototype Variables

```typescript
interface Variable {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean';
  defaultValue: string | number | boolean;
}
```

## 3. 组件设计

### 3.1 新增组件

| 组件 | 职责 | 文件 |
|------|------|------|
| `PrototypeOverlay` | Flow 连线 SVG 覆盖层 | `components/prototype/PrototypeOverlay.tsx` |
| `FlowEdge` | 单条连线 SVG | `components/prototype/FlowEdge.tsx` |
| `FlowNode` | Flow 画布上的节点 | `components/prototype/FlowNode.tsx` |
| `OverlayPortal` | Overlay React Portal | `components/prototype/OverlayPortal.tsx` |
| `OverlayPanel` | 单个 Overlay 面板 | `components/prototype/OverlayPanel.tsx` |
| `Backdrop` | 遮罩背景 | `components/prototype/Backdrop.tsx` |
| `PrototypeToolbar` | 原型工具栏 | `components/prototype/PrototypeToolbar.tsx` |
| `PrototypeOverview` | 概览模式 | `components/prototype/PrototypeOverview.tsx` |
| `PrototypeSettings` | 原型设置面板 | `components/prototype/PrototypeSettings.tsx` |
| `FlowEditor` | Flow 编辑模式 | `components/prototype/FlowEditor.tsx` |

### 3.2 修改组件

| 组件 | 修改内容 |
|------|----------|
| `Canvas.tsx` | 添加 PrototypeOverlay 覆盖层，处理 clipContent |
| `PrototypePlayer.tsx` | 支持 overlay，动画过渡，overrides 应用 |
| `PropertiesPanel.tsx` | 添加 overlay 配置 UI，完善 trigger/action 选择 |
| `Toolbar.tsx` | 添加 prototype 模式切换按钮 |
| `useEditorStore` | 添加 prototype 状态和 actions |

## 4. 动画系统

### 4.1 Easing 函数映射

```typescript
const EASING_MAP: Record<EasingType, string> = {
  'ease': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'easeIn': 'cubic-bezier(0.4, 0, 1, 1)',
  'easeOut': 'cubic-bezier(0, 0, 0.2, 1)',
  'easeInOut': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'linear': 'linear',
  'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  'elastic': 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
};
```

### 4.2 过渡动画组件

使用 CSS transition + requestAnimationFrame：

```typescript
// Overlay 动画状态机
type OverlayAnimState = 'opening' | 'open' | 'closing' | 'closed';

// FLIP 技术：
// First: 记录触发元素的位置/大小
// Last: 目标位置/大小
// Invert: 应用反向 transform
// Play: 动画到最终状态
```

## 5. Canvas 修改

### 5.1 Frame clipContent 实现

在 `FrameRenderer` 中添加 clip：

```typescript
// Konva Group 设置 clip
<Group clipFunc={(ctx) => {
  const w = frame.width || 100;
  const h = frame.height || 100;
  const r = frame.cornerRadius || 0;
  if (r > 0) {
    ctx.roundRect(0, 0, w, h, r);
  } else {
    ctx.rect(0, 0, w, h);
  }
}}>
  {/* children */}
</Group>
```

## 6. Implementation Order

### Phase 6A Tasks

1. **扩展 Interaction 接口** (`lib/types.ts`)
   - 添加 mouseDown/mouseUp/mouseEnter/mouseLeave/keyDown/afterDelay/whileDown/onLoad/none triggers
   - 添加 overlay action
   - 添加 EasingType
   - 添加 OverlayConfig
   - 添加 PrototypeFlow/Variable 数据结构

2. **实现 Overlay 系统** (`components/prototype/OverlayPortal.tsx`, `OverlayPanel.tsx`, `Backdrop.tsx`)
   - React Portal 挂载
   - 6 种定位方式
   - backdrop 遮罩
   - 打开/关闭动画

3. **修改 PrototypePlayer** (`components/PrototypePlayer.tsx`)
   - 支持 overlay action
   - 应用 Easing 曲线
   - 应用 Component Overrides
   - 支持 afterDelay/mouseDown/mouseUp 等 trigger

4. **实现 Flow 连线系统** (`components/prototype/PrototypeOverlay.tsx`, `FlowEdge.tsx`)
   - SVG 层渲染
   - Bezier 曲线连线
   - 箭头 marker
   - 连接点计算

5. **添加 PrototypeToolbar** (`components/prototype/PrototypeToolbar.tsx`)
   - Edit / Preview / Flow 模式切换
   - Flow 管理

6. **添加 PrototypeOverview** (`components/prototype/PrototypeOverview.tsx`)
   - 画布概览模式
   - 连线可视化
   - 点击连线编辑

7. **实现 Frame clipContent** (`components/Canvas.tsx`)
   - Konva Group clipFunc
   - clipContent 字段生效

8. **完善 PropertiesPanel InteractionEditor** (`components/PropertiesPanel.tsx`)
   - 添加 overlay 配置
   - 添加 easing 选择
   - 完善 afterDelay 配置

9. **修改 Toolbar** (`components/Toolbar.tsx`)
   - prototype 模式按钮
   - flow 入口

10. **修改 useEditorStore** (`stores/useEditorStore.ts`)
    - 添加 prototypeMode / prototypeFlowMode
    - 添加 prototypeVariables
    - 添加 flows 管理
    - 添加 overlay 管理
