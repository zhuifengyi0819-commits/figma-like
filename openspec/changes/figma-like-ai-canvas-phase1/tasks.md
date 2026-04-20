# Tasks: figma-like-ai-canvas-phase1

## 1. 项目基础搭建

- [ ] 1.1 安装依赖：`npm install react-konva konva zustand lucide-react`
- [ ] 1.2 确认 Tailwind 配置正确（CSS Variables 映射）
- [ ] 1.3 配置 `globals.css` 中的所有 CSS Variables（来自 SPEC.md）
- [ ] 1.4 验证 Next.js dev server 启动无报错

## 2. Zustand Store（`/stores/useEditorStore.ts`）

- [ ] 2.1 定义 `Shape` 接口（id, type, x, y, width?, height?, radius?, text?, points?, fill, stroke, strokeWidth, opacity, rotation, visible, locked, name）
- [ ] 2.2 定义 `ChatMessage` 接口
- [ ] 2.3 实现 `AppState`：shapes[], selectedIds[], canvasZoom, canvasPan, chatHistory[]
- [ ] 2.4 实现 actions：addShapes, updateShape, deleteShapes, setSelection, toggleVisibility, toggleLock, reorderShapes
- [ ] 2.5 实现 `loadFromStorage()` 和 `saveToStorage()` 集成（依赖 `/lib/storage.ts`）

## 3. `/lib/` 工具模块

- [x] 3.1 实现 `shapes.ts`：id 生成、默认样式、shape 类型guard（已有 lib/types.ts）
- [x] 3.2 实现 `storage.ts`：localStorage 读写（Zustand persist middleware 已集成）
- [x] 3.3 实现 `ai-schema.ts`：`ADD_SHAPES_TOOL` schema + system prompt 构建函数 ✅
- [x] 3.4 实现 `ai.ts`：MiniMax API 调用、解析 tool call ✅

## 4. Canvas 核心（`/components/Canvas.tsx` + `/components/ShapeRenderer.tsx`）

- [ ] 4.1 `ShapeRenderer`：根据 type 渲染 Rect/Circle/Text/Line，应用 shape styles
- [ ] 4.2 `ShapeRenderer`：选中时显示 Konva `Transformer`（8个控制点）
- [ ] 4.3 `ShapeRenderer`：可见性/锁定状态处理（visible=false 不渲染，locked=true 禁用交互）
- [ ] 4.4 `Canvas`：`Stage` + `Layer` + dot grid 背景
- [ ] 4.5 `Canvas`：滚轮缩放（scaleX/Y，以 cursor 位置为中心）
- [ ] 4.6 `Canvas`：Space+拖拽平移（监听 keydown/keyup space）
- [ ] 4.7 `Canvas`：点击空白取消选择（onClick Stage）
- [ ] 4.8 `Canvas`：点击 shape 选择（onClick Shape → setSelection）
- [ ] 4.9 `Canvas`：拖拽 shape 移动（draggable=true, onDragEnd → updateShape）

## 5. LayerPanel（`/components/LayerPanel.tsx` + `/components/LayerItem.tsx`）

- [ ] 5.1 `LayerPanel`：列表渲染（reverse order，新图形在底部）
- [ ] 5.2 `LayerItem`：显示 type icon + name + visibility toggle + lock toggle
- [ ] 5.3 `LayerItem`：点击选中对应图形
- [ ] 5.4 `LayerItem`：hover 显示 delete 按钮
- [ ] 5.5 `LayerPanel`：多选时显示"已选择 N 个"header
- [ ] 5.6 同步 selectedIds 状态（画布选中 ↔ 面板高亮联动）

## 6. ChatPanel（`/components/ChatPanel.tsx` + `/components/ChatMessage.tsx`）

- [ ] 6.1 `ChatPanel`：消息列表（user 右对齐, AI 左对齐，中间区分）
- [ ] 6.2 `ChatPanel`：多行 textarea（Shift+Enter 换行，Enter 发送）
- [ ] 6.3 `ChatPanel`：空消息拦截
- [ ] 6.4 `ChatMessage`：user 消息（accent 背景）, AI 消息（surface 背景）
- [ ] 6.5 `ChatMessage`：tool call 结果内联显示（如 "✅ 已添加圆形"）
- [ ] 6.6 快捷命令处理：`/clear`（清空 shapes），`/undo`（暂不实现，可 later）

## 7. AI 集成（`/lib/ai.ts`）

- [x] 7.1 MiniMax API 调用封装（带 model + API key）✅
- [x] 7.2 构建 System Prompt（Canvas size + shapes count + selected shapes context）✅ (via ai-schema.ts buildSystemPrompt)
- [x] 7.3 构建消息历史：system + chatHistory + user message ✅
- [x] 7.4 解析 AI 响应：检测 `tool_calls` 字段中的 `add_shapes` ✅ (parseAddShapesToolCall)
- [x] 7.5 执行 `add_shapes`：解析参数 → 补充默认样式 → `store.addShapes()` ✅
- [x] 7.6 ChatPanel 接入真实 AI：handleSend / /clear 命令 / 错误处理 ✅

## 8. PropertiesPanel（`/components/PropertiesPanel.tsx`）

- [ ] 8.1 无选中时显示空状态
- [ ] 8.2 单选时显示完整属性：X/Y, W/H（或 Radius）, Fill, Stroke, Stroke Width, Opacity, Rotation
- [ ] 8.3 多选时显示共同属性，批量修改
- [ ] 8.4 上移/下移图层按钮（Bring Forward / Send Backward）
- [ ] 8.5 所有输入 onChange 实时更新 store

## 9. Header + StatusBar

- [ ] 9.1 `Header`：Logo + "AI Canvas" 标题 + 帮助图标
- [ ] 9.2 `StatusBar`：显示 "Ready" + Zoom level（可点击 reset）+ Canvas size + Shape count

## 10. 集成 + 持久化

- [ ] 10.1 Ctrl+S 快捷键保存到 localStorage
- [ ] 10.2 页面加载时从 localStorage 恢复 shapes + chatHistory
- [ ] 10.3 shapes 变化时自动 debounce 保存（300ms）
- [ ] 10.4 聊天超过 50 条时截断旧消息

## 11. 主页面组装（`/app/page.tsx`）

- [ ] 11.1 `Editor` 组件三栏布局
- [ ] 11.2 三个面板正确挂载（LayerPanel + Canvas + ChatPanel+PropertiesPanel）
- [ ] 11.3 全局快捷键注册（Space 平移, Delete, Escape, Ctrl+S）
- [ ] 11.4 验证页面在 1920×1080 分辨率下正常显示

## 12. 验收测试

- [ ] 12.1 AI 对话："画一个红色圆形"，验证圆形出现在画布
- [ ] 12.2 图形选择/移动/缩放/删除基本操作正常
- [ ] 12.3 Layer Panel 选择/可见性/锁定/删除正常
- [ ] 12.4 Properties Panel 属性编辑实时生效
- [ ] 12.5 刷新页面数据恢复（localStorage）
- [ ] 12.6 无 console errors
