# Design: figma-like-ai-canvas-phase1

## 技术架构

### 目录结构
```
/app
  /page.tsx              # 主编辑器页面
  /layout.tsx            # Root layout（fonts, metadata）
  /globals.css           # CSS variables, base styles
/components
  /Editor.tsx            # 三栏布局容器
  /Canvas.tsx            # Konva Stage 包装
  /LayerPanel.tsx        # 左侧图层面板
  /ChatPanel.tsx         # 右侧 AI 聊天面板
  /PropertiesPanel.tsx   # 右侧属性面板
  /Header.tsx            # 顶部 Header
  /StatusBar.tsx         # 底部状态栏
  /LayerItem.tsx         # 单个图层项
  /ChatMessage.tsx       # 单条聊天消息
  /ShapeRenderer.tsx     # Konva 图形渲染器
/stores
  /useEditorStore.ts     # Zustand store（shapes/selection/UI）
/lib
  /shapes.ts             # Shape 类型定义和工具函数
  /storage.ts            # localStorage 读写封装
  /ai.ts                 # AI API 调用和 prompt 构建
  /ai-schema.ts          # Function Calling Schema 定义
/public
  /favicon.svg
```

## Zustand Store 设计

```typescript
interface Shape {
  id: string;
  type: 'rect' | 'circle' | 'text' | 'line';
  x: number;
  y: number;
  width?: number;      // rect
  height?: number;     // rect
  radius?: number;     // circle
  text?: string;       // text
  points?: number[];   // line [x1, y1, x2, y2]
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
  name: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  toolCall?: {
    name: 'add_shapes';
    args: { shapes: Shape[] };
  };
}

interface AppState {
  // Canvas
  shapes: Shape[];
  selectedIds: string[];
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  
  // Panels
  chatHistory: ChatMessage[];
  
  // Actions
  addShapes: (shapes: Omit<Shape, 'id'>[]) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShapes: (ids: string[]) => void;
  setSelection: (ids: string[]) => void;
  // ...
}
```

## AI Function Calling Schema

```typescript
const ADD_SHAPES_TOOL = {
  name: 'add_shapes',
  description: '在画布上添加一个或多个图形。当用户要求画形状时使用。',
  parameters: {
    type: 'object',
    properties: {
      shapes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { 
              enum: ['rect', 'circle', 'text', 'line'],
              description: '图形类型'
            },
            x: { type: 'number', description: 'X坐标（画布原点为0,0）' },
            y: { type: 'number', description: 'Y坐标（画布原点为0,0）' },
            width: { type: 'number', description: '矩形宽度' },
            height: { type: 'number', description: '矩形高度' },
            radius: { type: 'number', description: '圆形半径' },
            text: { type: 'string', description: '文字内容' },
            fill: { type: 'string', description: '填充色（HEX格式，如#FF0000）' },
            stroke: { type: 'string', description: '描边色' },
            strokeWidth: { type: 'number', description: '描边宽度' },
          },
          required: ['type', 'x', 'y']
        }
      }
    },
    required: ['shapes']
  }
};

// System Prompt 关键部分
const SYSTEM_PROMPT = `你是一个 AI 画布助手。用户描述他们想在画布上画什么图形。
Canvas size: 1920x1080，坐标从左上角(0,0)开始。
当前图形数量: {count}
当用户要求画图时，使用 add_shapes tool。

支持的图形类型：
- rect: 需要 width, height
- circle: 需要 radius  
- text: 需要 text 内容
- line: 需要 points=[x1,y1,x2,y2]

颜色使用 HEX 格式（如 #FF5500）。`;
```

## Konva Canvas 实现

```typescript
// ShapeRenderer.tsx
const ShapeRenderer: React.FC<{ shape: Shape; isSelected: boolean }> = ({ shape, isSelected }) => {
  const shapeRef = useRef<KonvaShape>(null);
  
  // 根据 type 渲染对应 Konva 组件
  // isSelected 时显示 Transformer 控制点
  
  return (
    <>
      {shape.type === 'rect' && <Rect {...} />}
      {shape.type === 'circle' && <Circle {...} />}
      {shape.type === 'text' && <Text {...} />}
      {shape.type === 'line' && <Line {...} />}
      {isSelected && <Transformer ref={shapeRef} />}
    </>
  );
};

// Canvas.tsx
const Canvas: React.FC = () => {
  const { shapes, selectedIds, canvasZoom, canvasPan } = useEditorStore();
  
  return (
    <Stage
      width={containerWidth}
      height={containerHeight}
      scaleX={canvasZoom}
      scaleY={canvasZoom}
      x={canvasPan.x}
      y={canvasPan.y}
    >
      <Layer>
        {/* Dot grid background */}
        {/* Shapes */}
        {shapes.filter(s => s.visible).map(shape => (
          <ShapeRenderer
            key={shape.id}
            shape={shape}
            isSelected={selectedIds.includes(shape.id)}
          />
        ))}
      </Layer>
    </Stage>
  );
};
```

## AI 集成流程

```
用户输入 "画一个蓝色圆形"
    ↓
ChatPanel 发送到 AI API（携带 System Prompt + Canvas Context）
    ↓
AI 返回 { tool_calls: [{ name: 'add_shapes', args: { shapes: [...] } }] }
    ↓
检测到 add_shapes tool call
    ↓
解析 shapes 参数，补充默认样式（fill/stroke/opacity 等）
    ↓
调用 store.addShapes(shapes)
    ↓
Konva 重新渲染新图形
    ↓
AI 消息更新显示 "✅ 已添加圆形到画布"
```

## 组件状态流

```
Editor (三栏布局)
├── LayerPanel ←→ useEditorStore (shapes, selectedIds)
├── Canvas ←→ useEditorStore (shapes, selectedIds, zoom, pan)
│   └── ShapeRenderer ←→ Konva Events (onClick/drag)
└── ChatPanel ←→ useEditorStore (chatHistory)
    ├── AIInput (onSend → AI API → add_shapes)
    └── PropertiesPanel ←→ useEditorStore (selectedIds, shapes)
```

## 样式方案

CSS Variables（在 `globals.css` 中）:

```css
:root {
  --bg-deep: #0D0D0F;
  --bg-surface: #151518;
  --bg-elevated: #1C1C21;
  --accent: #D4A853;
  --accent-hover: #E5B85C;
  --text-primary: #E8E4DF;
  --text-secondary: #8A8680;
  /* ... 其他来自 SPEC.md 的变量 */
}
```

使用 Tailwind 对应 `bg-[var(--bg-surface)]` 方式，或在 `tailwind.config.ts` 中映射。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Space + Drag | 平移画布 |
| Scroll | 缩放（以光标为中心）|
| Click 图形 | 选中 |
| Shift + Click | 多选 |
| Delete/Backspace | 删除选中 |
| Escape | 取消选择 |
| Ctrl/Cmd + A | 全选 |
| Ctrl/Cmd + S | 保存到 localStorage |
