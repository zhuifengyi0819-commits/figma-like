# design.md — figma-like-ai-canvas Phase 2

## 依赖关系

```
boolean-ops        ──→  lib/measurement.ts (computeBooleanPath)
                      stores/useEditorStore.ts (applyBooleanOperation action)
                      ShapeRenderer (Canvas.tsx) — booleanOp 渲染分支
                      PropertiesPanel — 布尔运算按钮组

path-node-editing  ──→  Canvas.tsx — editingPathId state + path edit overlay
                      ShapeRenderer — 锚点/手柄渲染
                      useEditorStore — 无新 action（原地 updateShape）

text-auto-sizing   ──→  Canvas.tsx Text case — width/height/ellipsis 逻辑
                      PropertiesPanel — textSizing 选择器
                      types.ts — TextSizing 类型已存在

eyedropper-tool    ──→  Toolbar.tsx — eyedropper tool
                      Canvas.tsx — pixel color reading
                      useEditorStore — eyedropper activeTool
                      lib/pixelColor.ts (new)

rotate-copy        ──→  ContextMenu.tsx — 菜单项
                      ArrayModal.tsx (new) — 模态框
                      useEditorStore — addShapes action

auto-layout-wrap   ──→  stores/useEditorStore.ts — computeWrappedLayout
                      PropertiesPanel — Wrap 开关 UI
                      lib/measurement.ts — 无需改动
```

## 新增依赖

```bash
npm install polygon-clipping @types/polygon-clipping
```

## Canvas.tsx 变更

### 新增 State
```typescript
const [editingPathId, setEditingPathId] = useState<string | null>(null);
const [selectedAnchorIdx, setSelectedAnchorIdx] = useState<number | null>(null);
const [colorPickerPos, setColorPickerPos] = useState<{ x: number; y: number } | null>(null); // eyedropper preview
```

### 新增 Ref
```typescript
const konvaStageRef = useRef<Konva.Stage>(null); // for eyedropper pixel reading
```

## PropertiesPanel.tsx 变更

### 新增 Section
- 布尔运算按钮组（选中 2 个兼容图形时显示）
- TextSizing 选择器（在"文字" Section）
- AutoLayout Wrap 开关（AutoLayout Section 末尾）

## ContextMenu.tsx 变更

- 新增菜单项：`阵列复制...` → 打开 ArrayModal

## Toolbar.tsx 变更

- 新增 eyedropper tool (`'eyedropper'`) 及 Pipette 图标
- 更新 `TOOLS` 列表

## ArrayModal.tsx (新建)

- 模态框组件，固定 320px 宽
- 类型切换（圆形/线性）
- 数量 slider
- 圆形：半径 input
- 线性：X/Y 偏移 input
- 确定/取消按钮

## 布尔运算按钮组（Toolbar 区域）

当 `selectedIds.length === 2` 时，在工具栏右侧（或下方）显示：
```
┌──┬──┬──┬──┐
│∪ │∩ │⊓ │⊖ │
└──┴──┴──┴──┘
Union Sub Intersect Exclude
```

## pixelColor.ts (新建)

```typescript
export function getPixelColor(canvas: HTMLCanvasElement, x: number, y: number): string
```

## 样式变更

- path edit mode 下 Konva 舞台添加 CSS class `path-edit-mode`（cursor: crosshair）
- eyedropper 光标：CSS `.cursor-eyedropper { cursor: crosshair; }`
- ArrayModal：居中 overlay，backdrop blur
