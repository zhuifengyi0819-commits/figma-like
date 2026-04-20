# text-auto-sizing

## Overview
Text shape 支持 3 种尺寸模式：fixed（固定宽高）、autoWidth（宽度自动）、autoHeight（高度自动）。类似 Figma 的文字工具。

## Data Model

```typescript
type TextSizing = 'fixed' | 'autoWidth' | 'autoHeight';

interface Shape {
  // ...
  textSizing?: TextSizing; // default: 'fixed'
  text?: string;
  width?: number;  // fixed 时有效
  height?: number; // fixed 时有效
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
}
```

## Text Sizing 行为

| 模式 | 宽度 | 高度 | 说明 |
|------|------|------|------|
| `fixed` | 固定 `width`，超出换行 + 省略号 | 固定 `height`，超出省略 | 默认模式 |
| `autoWidth` | 文字宽度自适应，无限宽 | 固定 `lineHeight * (行数)` | 单行为主 |
| `autoHeight` | 固定 `width`，超出自动增加高度 | 高度自适应 | 多行自动展开 |

### Konva 实现

```tsx
// fixed
<Text
  width={shape.width || 200}
  height={shape.height}
  wrap="word"
  ellipsis={true}
  text={shape.text}
/>

// autoWidth — 设置 width 为很大值，Konva 不截断
<Text
  width={10000}  // 足够大
  wrap="none"
  ellipsis={false}
  text={shape.text}
/>

// autoHeight — 设置 width 固定，wrap=word，高度自动
<Text
  width={shape.width || 200}
  wrap="word"
  ellipsis={false}
  text={shape.text}
/>
```

## UI — PropertiesPanel

在"文字" Section 新增 TextSizing 选择器：

```tsx
<Section title="文字">
  <div className="flex gap-1">
    {(['fixed', 'autoWidth', 'autoHeight'] as TextSizing[]).map(mode => (
      <button
        key={mode}
        onClick={() => update({ textSizing: mode })}
        className={`px-2 py-1 text-[10px] rounded ${
          (shape.textSizing || 'fixed') === mode
            ? 'bg-[var(--accent)] text-[var(--bg-deep)]'
            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
        }`}
      >
        {mode === 'fixed' ? '固定' : mode === 'autoWidth' ? '自动宽' : '自动高'}
      </button>
    ))}
  </div>
</Section>
```

## 切换行为

当用户将 `fixed` 切换为 `autoWidth`：
- width 保持当前值作为参考（用户手动输入可修改）
- Konva 实际用 `10000` 渲染（大于任何屏幕）

当用户将 `autoWidth` 切换为 `fixed`：
- 记录当前渲染宽度 → 回写到 `shape.width`

## textAlign 支持

- `left`：Konva `align: 'left'`
- `center`：Konva `align: 'center'`
- `right`：Konva `align: 'right'`
- `justify`：暂不支持（复杂度高）

## Auto Height 行为

```tsx
// autoHeight 下，Konva Text height 设为 undefined，让其自动计算
<Text
  width={shape.width || 200}
  height={undefined}  // 让 Konva 自动高度
  wrap="word"
  text={shape.text}
/>
```
