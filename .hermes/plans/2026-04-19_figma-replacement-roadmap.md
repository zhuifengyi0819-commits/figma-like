# Figma Replacement — figma_like 完整实现计划

> **For Hermes:** 使用 subagent-driven-development skill 逐任务执行。

**目标：** 将 figma_like 打造成个人设计师的完整 Figma 替代品（无协作/插件）

**排除范围：** 协作（多人实时同步、评论）、插件生态、Figma API

**现有状态确认：**
- Lint: 21 warnings, 0 errors（全部为 warning，无需阻断）
- ContextMenu: 已实现（右键创建图形、复制、删除、对齐、样式拷贝）
- PrototypePlayer: 已实现（6种过渡动画，支持 navigateTo/swap/scrollTo）
- 关键缺失：导出系统、Smart Animate、Pen Tool、Mask、TextStyle 应用 UI、设计令牌绑定、设备预览、快捷键覆盖、Alt+拖拽复制、批量重命名

---

## 第一阶段：核心体验补全（高优先级）

### Task 1: 导出系统

**目标：** 实现多格式导出面板（SVG / PNG / WebP / PDF）

**涉及文件：**
- Create: `components/ExportModal.tsx`
- Modify: `components/Editor.tsx`（添加工具栏按钮）
- Modify: `stores/useEditorStore.ts`（添加 `exportShapes` action）
- Create: `lib/export.ts`（各格式导出逻辑）

**Step 1: 创建导出工具函数**

```typescript
// lib/export.ts
export function exportToPNG(shapes: Shape[], width: number, height: number, scale?: number): string
export function exportToSVG(shapes: Shape[]): string
export function exportToWebP(shapes: Shape[], quality?: number): string
export async function exportToPDF(shapes: Shape[]): Promise<Blob>
```

**Step 2: 创建 ExportModal UI**
- 格式选择 tabs: PNG | SVG | WebP | PDF
- Scale 选择: 1x, 2x, 3x（PNG/WebP）
- 预览缩略图
- "导出" 按钮触发下载

**Step 3: 在 Editor 添加工具栏按钮**
- Header 右侧添加下载图标按钮
- 点击打开 ExportModal

**验证：** `npm run lint` 无新 error，打开 localhost:3000 点击导出按钮出现面板

---

### Task 2: Smart Animate（智能动画）

**目标：** 原型交互中，当 shape 属性（位置/尺寸/颜色/旋转/透明度）在两帧之间变化时，自动推断过渡动画

**涉及文件：**
- Modify: `components/PropertiesPanel.tsx`（交互配置区）
- Modify: `lib/measurement.ts` 或新建 `lib/smartAnimate.ts`
- Modify: `components/PrototypePlayer.tsx`

**Step 1: 分析两帧之间的属性差异**

```typescript
// lib/smartAnimate.ts
export interface PropertyDiff {
  property: string;
  from: unknown;
  to: unknown;
}
export function computePropertyDiff(shapeA: Shape, shapeB: Shape): PropertyDiff[]
```

**Step 2: 根据差异自动选择过渡类型**

```typescript
export function inferTransition(diffs: PropertyDiff[]): { transition: string; auto: boolean }
```

- 位置变化 → slide（方向推断）
- 尺寸变化 + 位置不变 → scale
- 透明度变化 → dissolve
- 颜色变化 → dissolve
- 多个属性同时变化 → Figma 默认 dissolve

**Step 3: 在 PropertiesPanel 交互配置中**
- 显示 "自动" 标签（当 Smart Animate 激活时）
- 用户可手动覆盖为其他过渡类型

**Step 4: 在 PrototypePlayer 中**
- 当 `auto: true` 时，读取 frame 的 previous frame 状态计算 transition

**验证：** 创建两个 frame，在不同 shape 属性，切换时有正确的自动过渡

---

### Task 3: Pen Tool（钢笔工具）

**目标：** 在画布上直接绘制复杂 Path

**涉及文件：**
- Modify: `components/Toolbar.tsx`（添加 pen tool 图标）
- Modify: `components/Canvas.tsx`（pen tool 绘制逻辑）
- Modify: `stores/useEditorStore.ts`（添加 `addPath` 或扩展 `addShape`）
- Modify: `lib/types.ts`（扩展 PathPoint）

**Step 1: Toolbar 添加 Pen 工具按钮**

**Step 2: Canvas 中 pen tool 交互逻辑**
- 点击：添加锚点
- 点击+拖拽：添加带控制手柄的贝塞尔点
- 双击/Enter：结束路径
- Escape：取消当前路径
- 显示当前路径预览（临时 Konva Line / Path）

**Step 3: 将绘制结果存入 shape.pathData 和 shape.pathPoints**

**验证：** 选择 pen tool，在画布上绘制一条曲线路径，结束路径后 shape 添加到图层列表

---

### Task 4: 蒙版（Masks）

**目标：** 实现图片/图形蒙版遮罩功能

**涉及文件：**
- Modify: `components/Canvas.tsx`（蒙版渲染逻辑）
- Modify: `components/PropertiesPanel.tsx`（蒙版配置区）
- Modify: `lib/types.ts`（`maskSourceId` 已定义）

**Step 1: Canvas 渲染蒙版**
- 找到 `maskSourceId` 对应的 shape
- 使用 Konva `clipFunc` 或 `clipPath` 实现遮罩
- 渲染顺序：先渲染被蒙版的 shape，再在同层渲染蒙版源（蒙版本身不显示）

**Step 2: PropertiesPanel 添加蒙版配置**
- 选择图片/shape → 出现 "蒙版" 区
- 点击 "添加蒙版" → 选择画布上的一个 shape 作为蒙版源
- 支持切换/移除蒙版

**验证：** 创建一个圆形蒙版，应用到一张图片上，图片按圆形裁剪显示

---

### Task 5: TextStyle 应用 UI

**目标：** 将已定义的 TextStyle 便捷应用到文字图形

**涉及文件：**
- Modify: `components/PropertiesPanel.tsx`（文字样式区）
- Modify: `components/TextStylesPanel.tsx`
- Modify: `stores/useEditorStore.ts`（`applyTextStyle` 已存在）

**Step 1: PropertiesPanel 文字属性区添加 "样式" 下拉**
- 列出所有已保存 TextStyle
- 选择后应用到当前文字 shape

**Step 2: 快捷按钮：保存选中文字为新样式**

**验证：** 创建文字 → 从 TextStylesPanel 保存样式 → 应用到其他文字

---

## 第二阶段：设计系统完善

### Task 6: 设计令牌绑定 UI

**目标：** 将 Design Token 绑定到 shape 属性，实现全局更新

**涉及文件：**
- Modify: `components/DesignTokenPanel.tsx`
- Modify: `components/PropertiesPanel.tsx`（每个颜色属性旁显示 token 标签）
- Modify: `stores/useEditorStore.ts`（`applyTokenToShape` 已存在，需完善）

**Step 1: PropertiesPanel 颜色属性旁添加 "链接 token" 按钮**
- 点击后弹出已存在的 token 列表
- 选择后，该属性旁边显示 token 名称标签

**Step 2: Token 值变更时自动更新所有引用它的 shapes**

**验证：** 修改一个 color token，所有使用该 token 的 shape 颜色同步更新

---

### Task 7: 设备预览（响应式）

**目标：** 在画布上预览不同设备的显示效果

**涉及文件：**
- Create: `components/DevicePreviewModal.tsx`
- Modify: `components/Editor.tsx`（添加工具栏按钮）

**Step 1: 定义设备预设**

```typescript
const DEVICE_PRESETS = [
  { name: 'iPhone 14', width: 390, height: 844 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
  { name: 'iPad Pro 11"', width: 834, height: 1194 },
  { name: 'Desktop HD', width: 1920, height: 1080 },
  { name: 'MacBook Air', width: 1440, height: 900 },
]
```

**Step 2: DevicePreviewModal**
- 左侧设备列表，右侧预览区
- 选中设备后，画布内容缩放至设备尺寸显示
- 画布保持 1920x1080 实际内容，只在预览区做缩放框架

**验证：** 打开设备预览，选择 iPhone 14，画布正确缩放预览

---

## 第三阶段：效率工具

### Task 8: 快捷键完整覆盖

**目标：** 补全 20-30 个 Figma 常用快捷键

**涉及文件：**
- Modify: `components/Canvas.tsx`（现有键盘处理）
- Create: `lib/hotkeys.ts`（统一快捷键注册表）
- Modify: `components/HelpModal.tsx`（快捷键帮助表更新）

**Step 1: 新增快捷键映射**

| 快捷键 | 功能 |
|--------|------|
| `V` | select tool |
| `R` | rect tool |
| `O` | circle tool |
| `T` | text tool |
| `L` | line tool |
| `P` | pen tool |
| `H` | hand(pan) tool |
| `F` | frame tool |
| `Cmd+D` | 复制到后面（Alt+Drag 效果） |
| `Cmd+Shift+D` | 复制到前面 |
| `Cmd+Alt+C` | 复制样式 |
| `Cmd+Alt+V` | 粘贴样式 |
| `Cmd+Shift+E` | 导出 |
| `Cmd+Shift+K` | 设备预览 |
| `]` | 上移一层 |
| `[` | 下移一层 |
| `Cmd+]` | 置顶 |
| `Cmd+[` | 置底 |
| `Cmd+Enter` | 进入原型预览 |
| `Space`（非按住） | 临时 hand tool |
| `Cmd+/` | 打开帮助 |

**Step 2: HelpModal 更新快捷键列表（去掉无效的，补充缺失的）**

**验证：** 每个快捷键在应用中正常工作

---

### Task 9: Alt+拖拽复制

**目标：** 按住 Alt 拖拽选中 shape 时，自动复制一份并移动

**涉及文件：**
- Modify: `components/Canvas.tsx`（拖拽处理逻辑）

**Step 1: 在拖拽开始时检测 Alt 键状态**
- Alt 按下 + 拖拽距离 > 5px → 进入复制模式
- 复制原 shape，删除原 shape 的选中

**Step 2: 复制位置 = 拖拽释放位置**
- `duplicateShapes` + `setSelectedIds(newIds)` + 更新位置

**验证：** 选中一个矩形，按 Alt 拖拽，松开后原位置保留复制品，拖拽终点放置新复制

---

### Task 10: 批量重命名

**目标：** 批量修改选中 shapes 的名称，支持序号

**涉及文件：**
- Create: `components/BatchRenameModal.tsx`
- Modify: `components/LayerPanel.tsx`（选中多个图层后右键添加"批量重命名"）
- Modify: `stores/useEditorStore.ts`（添加 `batchRename` action）

**Step 1: BatchRenameModal UI**
- 输入框: `{name}-{##}` 格式（例如 `Button-##` → Button-01, Button-02...）
- 支持 `{name}` 直接替换， `{##}` 序号，`{++}` 递进序号

**Step 2: store `batchRename(ids, pattern)`**

**验证：** 选择 5 个图层，打开批量重命名，输入 `Card-##` → 命名为 Card-01...Card-05

---

### Task 11: 文件管理（搜索 + 收藏）

**目标：** 多画板文件中快速搜索/筛选 shapes

**涉及文件：**
- Modify: `components/LayerPanel.tsx`（添加搜索框）
- Modify: `components/PageTabs.tsx`（优化页面管理）

**Step 1: LayerPanel 顶部添加搜索框**
- 实时过滤图层列表（名称匹配）
- 搜索框下方显示匹配计数

**Step 2: PageTabs 优化**
- 支持右键页面 → 重命名 / 复制 / 删除
- 页面支持拖拽重排序

**验证：** 在有 20+ shapes 的文件中，通过搜索框快速找到目标图层

---

## 第四阶段：性能与稳定性

### Task 12: 布尔运算渲染

**目标：** 将 types 中定义的 booleanOp（union/subtract/intersect/exclude）实现渲染逻辑

**涉及文件：**
- Modify: `lib/boolean.ts`（现有 `computeBooleanPath` — 检查完整性）
- Modify: `components/Canvas.tsx`（布尔运算结果渲染）
- Modify: `components/PropertiesPanel.tsx`（布尔运算操作面板）

**Step 1: 检查 `lib/boolean.ts` 的 `computeBooleanPath` 实现**
- 是否正确处理 union/subtract/intersect/exclude
- 路径运算依赖 paper.js 还是纯算法

**Step 2: Canvas 中渲染布尔结果 shape**
- 当 shape.booleanOp 存在时，渲染为 Path 而不是基础图形
- 使用 pathData 存储运算结果 SVG path

**Step 3: PropertiesPanel 添加布尔运算按钮**
- 选中 2 个图形 → 工具栏出现布尔运算图标
- 点击下拉选择运算类型

**验证：** 创建两个重叠矩形，选择后执行"并集"，生成合并后的新图形

---

### Task 13: 约束精细控制

**目标：** 完善 Frame 内子元素的约束系统

**涉及文件：**
- Modify: `components/PropertiesPanel.tsx`（约束配置区）
- Modify: `stores/useEditorStore.ts`（`applyConstraints` 完善）

**Step 1: 约束 UI 精细化**
- 每个子 shape 显示 9 个锚点约束图标（类似 Figma）
- 点击锚点切换: left/right/center/scale
- 显示 "固定比例" 开关
- 显示 "最小/最大尺寸" 输入框

**验证：** 创建 frame 放入按钮，修改约束为"宽度撑满 + 高度固定"，修改 frame 宽高时按钮正确响应

---

### Task 14: 版本历史 UI 完善

**目标：** 将 Snapshot 系统做成完整的版本历史面板

**涉及文件：**
- Create: `components/VersionHistoryPanel.tsx`
- Modify: `components/RightPanel.tsx`（添加 Version History tab）
- Modify: `stores/useEditorStore.ts`（`saveSnapshot` 已有）

**Step 1: VersionHistoryPanel UI**
- 列表显示所有 snapshot（名称 + 时间）
- 点击 "预览" → 临时覆盖当前画布（但不保存）
- "恢复" 按钮确认覆盖
- 支持重命名、删除

**Step 2: 自动保存**
- 每次重要操作后自动生成 snapshot（debounce 5s）
- 或者提供手动 "保存版本" 按钮

**验证：** 保存 3 个版本，通过版本历史面板预览和恢复到任意版本

---

## 第五阶段：收尾

### Task 15: lint 警告清理

**目标：** 将 21 个 warnings 全部清除

**涉及文件：**（根据 lint 输出）
- `components/Canvas.tsx` (7 warnings)
- `components/Header.tsx` (3 warnings - alt text)
- `components/LayerPanel.tsx` (3 warnings - unused vars)
- `lib/codeGen.ts` (1 warning)
- `stores/useEditorStore.ts` (4 warnings)

**逐文件修复：**
- Header: 给 logo image 添加 alt=""
- LayerPanel: 删除未使用的变量 `reorderShape`, `updateShape`, `reparentShape`
- Canvas: 修复 useLayoutEffect 依赖、useCallback 依赖
- codeGen: 删除未使用 import
- store: 删除未使用变量

**验证：** `npm run lint` → 0 warnings, 0 errors

---

## 执行顺序建议

```
阶段一（核心）
  Task 1  导出系统          — 日常使用最高频
  Task 2  Smart Animate     — 原型交互核心
  Task 3  Pen Tool          — 矢量编辑核心
  Task 4  Mask              — 常见需求
  Task 5  TextStyle UI      — 小但重要

阶段二（设计系统）
  Task 6  Token → Shape     — 设计系统核心
  Task 7  设备预览          — 响应式必备

阶段三（效率）
  Task 8  快捷键            — 使用效率大幅提升
  Task 9  Alt+Drag 复制     — 高频操作
  Task 10 批量重命名        — 提升效率
  Task 11 文件管理          — 多页面项目必备

阶段四（稳定性）
  Task 12 布尔运算渲染       — 已有类型定义，补全渲染
  Task 13 约束精细控制       — 提升专业度
  Task 14 版本历史完善       — 数据安全

阶段五（收尾）
  Task 15 lint 清理         — 代码质量
```

**总工作量估算：**
- Task 1-5: 各 1-2 小时
- Task 6-11: 各 0.5-1.5 小时
- Task 12-15: 各 0.5 小时

**建议分批执行，每批 2-3 个 task，避免上下文切换成本。**
