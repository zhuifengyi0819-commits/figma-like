# Design: figma-like-phase4-component-interaction

## 1. Store Changes

### 1.1 useEditorStore.ts — New State

```typescript
// 新增状态
editingComponentId: string | null;  // 当前正在编辑的组件 ID (Master Component)

// 新增 action
enterComponentEditing: (componentId: string) => void;
exitComponentEditing: () => void;
```

### 1.2 State Behavior

```typescript
// 进入组件编辑模式
// - 设置 editingComponentId = componentId
// - selectedIds 设为该组件的直接子图形 IDs
// - 画布只渲染该组件的子图形（坐标已转换）

// 退出组件编辑模式
// - editingComponentId = null
// - selectedIds 恢复
```

---

## 2. Canvas — Component Editing Mode

### 2.1 双击检测

在 Konva Stage 的 `onDblClick` 中：
1. 获取点击位置
2. 从 `shapes` 中找到该位置最上层的 shape
3. 如果 shape.type === 'component' 且有 `masterComponentId`，调用 `enterComponentEditing(shape.masterComponentId)`
4. 如果 shape.type === 'component' 且是 Master Component（`isMainComponent === true`），调用 `enterComponentEditing(shape.id)`

### 2.2 组件编辑模式渲染逻辑

```typescript
// Canvas.tsx 渲染逻辑变更

// 正常模式
const visibleShapes = shapes.filter(s => !s.parentId);

// 组件编辑模式 (editingComponentId != null)
const editingShapes = shapes.filter(s => s.parentId === editingComponentId);
const editingComponent = shapes.find(s => s.id === editingComponentId);
const visibleShapes = editingShapes; // 只显示组件的子图形

// 坐标处理：editingComponent 的子图形 x,y 已经是相对坐标（相对于组件左上角）
// 无需额外转换，因为组件内子图形存储时就是相对坐标
```

### 2.3 ComponentEditingOverlay 组件

画布顶部显示一个迷你导航栏：

```tsx
// 位置：Canvas 容器顶部，绝对定位
// 样式：固定高度 36px，半透明背景，白色文字
// 内容：
//   [← 返回] "ComponentName" (editing...)

// 行为：
//   点击返回 → exitComponentEditing()
```

---

## 3. LayerPanel — 展开/折叠

### 3.1 新增 State (LayerPanel 内部)

```typescript
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
// 初始状态：所有 frame/group/component 都是展开的
```

### 3.2 LayerItem Props 变更

```typescript
interface LayerItemProps {
  // ...existing
  isExpanded?: boolean;      // 是否展开（容器型）
  onToggleExpand?: () => void;  // 切换展开/折叠
  childCount?: number;       // 子元素数量
}
```

### 3.3 展开/折叠渲染

```tsx
// LayerItem 渲染
return (
  <div className="flex items-center gap-1.5 py-1.5 cursor-pointer ...">
    {/* 展开/折叠按钮 - 仅容器型显示 */}
    {isContainer && (
      <button
        onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
        className="p-0.5 hover:bg-[var(--bg-hover)] rounded"
      >
        <ChevronRight
          size={12}
          className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
        />
      </button>
    )}
    
    {/* 图标 */}
    <span className="w-4 h-4...">{typeIconMap[shape.type]}</span>
    
    {/* 名称 */}
    <span className="flex-1 text-xs truncate...">{shape.name}</span>
    
    {/* 子元素数量 badge */}
    {isContainer && childCount > 0 && (
      <span className="text-[9px] text-[var(--text-tertiary)]">({childCount})</span>
    )}
    
    {/* ...existing 按钮 */}
  </div>
);
```

### 3.4 条件渲染子节点

```tsx
{isExpanded && children.length > 0 && (
  <div>
    {children.map(child => (
      <LayerItem
        key={child.id}
        shape={child.shape}
        depth={depth + 1}
        isExpanded={expandedIds.has(child.id)}
        onToggleExpand={() => handleToggleExpand(child.id)}
        childCount={child.children.length}
        // ...其他 props
      />
    ))}
  </div>
)}
```

### 3.5 初始展开状态

```typescript
// buildTree 后，对所有容器型节点初始化为展开
function initExpandedSet(nodes: TreeNode[]): Set<string> {
  const expanded = new Set<string>();
  const traverse = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.children.length > 0) {
        expanded.add(node.shape.id);
        traverse(node.children);
      }
    }
  };
  traverse(nodes);
  return expanded;
}
```

---

## 4. LayerPanel — 选中高亮联动

### 4.1 选中容器时子图层也高亮

当 `selectedIds` 包含某个容器型图层的 ID 时：
- 该容器的子图层（直接子节点）视觉上也应该高亮
- 可以通过 CSS class 实现：`bg-[var(--bg-hover)] border-l-[var(--accent)]`

```tsx
const isChildOfSelected = selectedIds.some(selId => {
  const sel = shapes.find(s => s.id === selId);
  return sel && sel.type === 'frame' && shape.parentId === selId;
});
```

---

## 5. 右键菜单扩展

### 5.1 Context Menu 新增选项

在现有 `ContextMenu.tsx` 的基础上，为容器型图层添加：

```typescript
const layerContextItems = [
  // ...existing
  { label: '展开全部', action: () => setExpandedIds(allContainerIds) },
  { label: '折叠全部', action: () => setExpandedIds(new Set()) },
];
```

---

## 6. 文件变更清单

| 文件 | 变更 |
|------|------|
| `stores/useEditorStore.ts` | 新增 `editingComponentId` 状态 + `enterComponentEditing`/`exitComponentEditing` actions |
| `components/Canvas.tsx` | 双击检测 + 组件编辑模式渲染逻辑 + ComponentEditingOverlay |
| `components/LayerPanel.tsx` | 展开/折叠状态 + badge + 子节点条件渲染 |
| `components/LayerItem.tsx` | 展开按钮 + badge 渲染 |

---

## 7. 交互流程

### 7.1 双击组件实例 → 进入组件编辑

```
用户双击画布上的组件实例
    ↓
onDblClick 检测到 shape.type === 'component' && masterComponentId != null
    ↓
调用 enterComponentEditing(masterComponentId)
    ↓
editingComponentId = masterComponentId
    ↓
Canvas 切换到组件编辑模式渲染
    ↓
画布顶部显示 ComponentEditingOverlay
```

### 7.2 双击 Master Component → 进入组件编辑

```
用户双击画布上的 Master Component (isMainComponent === true)
    ↓
调用 enterComponentEditing(shape.id)
    ↓
同上
```

### 7.3 返回正常模式

```
用户点击 ComponentEditingOverlay 的返回按钮
    ↓
调用 exitComponentEditing()
    ↓
editingComponentId = null
    ↓
Canvas 恢复正常模式渲染
    ↓
隐藏 ComponentEditingOverlay
```

### 7.4 图层折叠

```
用户点击容器图层的 ▶ 按钮
    ↓
调用 handleToggleExpand(containerId)
    ↓
expandedIds 中 toggle 该 id
    ↓
React 重新渲染，子节点不再显示
```
