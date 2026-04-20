# auto-layout-wrap

## Overview
Auto Layout 容器支持 wrap 换行（类似 CSS flex-wrap），子图形超出容器宽度时自动换行。

## Data Model

```typescript
interface AutoLayout {
  direction: 'horizontal' | 'vertical';
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  alignItems: 'start' | 'center' | 'end' | 'stretch';
  justifyContent: 'start' | 'center' | 'end' | 'space-between';
  // 新增
  wrap?: boolean; // default: false
}
```

## User Flow

1. 在 Frame/Group 上启用 Auto Layout
2. AutoLayout Section 显示 Wrap 开关
3. 当 `wrap: true` + `direction: 'horizontal'` 时：
   - 子图形从左到右排列
   - 超出容器宽度 → 自动换到下一行
   - 每一行应用 `alignItems`（顶对齐/居中/底对齐/拉伸）
   - 行之间应用 `gap`

## computeAutoLayout 修改

在 `stores/useEditorStore.ts` 的 `computeAutoLayout` 函数中新增 wrap 支持：

```typescript
function computeAutoLayout(frame: Shape, children: Shape[]): Map<string, { x: number; y: number }> {
  const al = frame.autoLayout || DEFAULT_AUTO_LAYOUT;
  // ...
  if (al.wrap && al.direction === 'horizontal') {
    // Wrap 算法：按行排列
    return computeWrappedLayout(frame, children, al);
  }
  // 原有逻辑...
}

function computeWrappedLayout(frame: Shape, children: Shape[], al: AutoLayout): Map<string, { x: number; y: number }> {
  const updates = new Map<string, { x: number; y: number }>();
  const fw = frame.width || 200;
  const innerW = fw - al.paddingLeft - al.paddingRight;
  const innerH = (frame.height || 200) - al.paddingTop - al.paddingBottom;
  const gap = al.gap;
  const sizes = children.map(c => getChildSize(c));

  // 按原顺序分行
  const rows: { id: string; w: number; h: number }[][] = [];
  let currentRow: { id: string; w: number; h: number }[] = [];
  let currentRowWidth = 0;

  for (let i = 0; i < children.length; i++) {
    const cs = sizes[i];
    if (currentRowWidth + cs.w > innerW && currentRow.length > 0) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWidth = 0;
    }
    currentRow.push({ id: children[i].id, ...cs });
    currentRowWidth += cs.w + (currentRow.length > 1 ? gap : 0);
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // 布局每行
  let yOffset = al.paddingTop;
  for (const row of rows) {
    const rowH = Math.max(...row.map(r => r.h));
    let xOffset = al.paddingLeft;

    for (const item of row) {
      const crossOffset = computeCrossOffset(al, innerH, item.h);
      const x = frame.x + xOffset;
      const y = frame.y + yOffset + crossOffset;
      updates.set(item.id, { x, y });
      xOffset += item.w + gap;
    }
    yOffset += rowH + gap;
  }

  return updates;
}
```

## PropertiesPanel UI

在 AutoLayout Section 末尾添加：

```tsx
<div className="flex items-center justify-between">
  <span className="text-[11px] text-[var(--text-secondary)]">换行 Wrap</span>
  <button
    onClick={() => updateAutoLayout({ wrap: !single.autoLayout?.wrap })}
    className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
      single.autoLayout?.wrap ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
    }`}
    title={single.autoLayout?.wrap ? '关闭换行' : '开启换行'}
  >
    <div className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${
      single.autoLayout?.wrap ? 'translate-x-4' : ''
    }`} />
  </button>
</div>
```

注意：只有 `direction === 'horizontal'` 时 Wrap 开关才显示。

## Edge Cases

| 情况 | 处理 |
|------|------|
| 子图形宽度 > 容器宽度 | 该图形单独一行，宽度超出容器（正常行为） |
| `direction: 'vertical'` 时 wrap | 不支持，Wrap 开关隐藏 |
| wrap 开启但容器无明确宽度 | 使用默认 200px 宽度计算 |
| 100+ 子图形 | 正常 wrap 排列 |
