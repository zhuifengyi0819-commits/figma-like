'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/types';

const toolLabels: Record<string, string> = {
  select: '选择', hand: '抓手', rect: '矩形', circle: '圆形',
  text: '文本', line: '线条', star: '星形', triangle: '三角', image: '图片',
  frame: '画框', pen: '钢笔',
};

export default function StatusBar() {
  const { shapes, canvasZoom, selectedIds, activeTool } = useEditorStore();

  return (
    <footer className="h-8 flex items-center justify-between px-4 bg-[var(--bg-deep)] border-t border-[var(--border)] text-[10px] text-[var(--text-tertiary)] font-mono select-none">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
          就绪
        </span>
        <span className="text-[var(--accent)]">{toolLabels[activeTool] || activeTool}</span>
        {selectedIds.length > 0 && <span>已选 {selectedIds.length}</span>}
      </div>
      <div className="flex items-center gap-4">
        <span>画布 {CANVAS_WIDTH}×{CANVAS_HEIGHT}</span>
        <span>缩放 {Math.round(canvasZoom * 100)}%</span>
        <span>{shapes.length} 个图形</span>
        <span className="text-[var(--text-tertiary)]/60">拖入图片 · Ctrl+V 粘贴</span>
      </div>
    </footer>
  );
}
