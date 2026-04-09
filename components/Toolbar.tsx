'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { ToolType } from '@/lib/types';
import { MousePointer2, Square, Circle, Type, Minus, Hand, Undo2, Redo2, Star, Triangle, ImagePlus, Frame, PenTool } from 'lucide-react';
import { fileToDataUrl, getImageDimensions } from '@/lib/hooks';

const tools: { id: ToolType; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { id: 'select', icon: <MousePointer2 size={18} />, label: '选择', shortcut: 'V' },
  { id: 'hand', icon: <Hand size={18} />, label: '抓手', shortcut: 'H' },
  { id: 'frame', icon: <Frame size={18} />, label: '画框', shortcut: 'F' },
  { id: 'rect', icon: <Square size={18} />, label: '矩形', shortcut: 'R' },
  { id: 'circle', icon: <Circle size={18} />, label: '圆形', shortcut: 'O' },
  { id: 'triangle', icon: <Triangle size={18} />, label: '三角', shortcut: '△' },
  { id: 'star', icon: <Star size={18} />, label: '星形', shortcut: '★' },
  { id: 'line', icon: <Minus size={18} />, label: '线条', shortcut: 'L' },
  { id: 'pen', icon: <PenTool size={18} />, label: '钢笔', shortcut: 'P' },
  { id: 'text', icon: <Type size={18} />, label: '文本', shortcut: 'T' },
];

export default function Toolbar() {
  const { activeTool, setActiveTool, addShape, setSelectedIds, undo, redo, history, historyIndex } = useEditorStore();

  const handleImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      for (const file of Array.from(files)) {
        const dataUrl = await fileToDataUrl(file);
        const dims = await getImageDimensions(dataUrl);
        let w = dims.width; let h = dims.height;
        if (w > 600) { h = h * (600 / w); w = 600; }
        if (h > 400) { w = w * (400 / h); h = 400; }
        const id = addShape({
          type: 'image', x: 200 + Math.random() * 300, y: 200 + Math.random() * 200,
          width: w, height: h, src: dataUrl,
          fill: 'transparent', stroke: 'transparent', strokeWidth: 0,
          opacity: 1, rotation: 0, visible: true, locked: false, name: file.name,
        });
        setSelectedIds([id]);
      }
      setActiveTool('select');
    };
    input.click();
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 px-2 py-1.5 bg-[var(--bg-surface)]/95 backdrop-blur-sm border border-[var(--border)] rounded-xl shadow-lg shadow-black/20">
      {tools.map((tool, i) => (
        <div key={tool.id} className="flex items-center">
          {(i === 2) && <div className="w-px h-5 bg-[var(--border)] mx-1" />}
          <button
            onClick={() => setActiveTool(tool.id)}
            className={`
              relative p-2 rounded-lg transition-all duration-150 group
              ${activeTool === tool.id
                ? 'bg-[var(--accent)] text-[var(--bg-deep)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }
            `}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.icon}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] bg-[var(--bg-deep)] border border-[var(--border)] rounded text-[var(--text-secondary)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
              {tool.label} <kbd className="ml-1 text-[var(--accent)]">{tool.shortcut}</kbd>
            </span>
          </button>
        </div>
      ))}

      <div className="w-px h-5 bg-[var(--border)] mx-1" />

      <button
        onClick={handleImageUpload}
        className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-all group relative"
        title="导入图片"
      >
        <ImagePlus size={18} />
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] bg-[var(--bg-deep)] border border-[var(--border)] rounded text-[var(--text-secondary)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
          图片
        </span>
      </button>

      <div className="w-px h-5 bg-[var(--border)] mx-1" />

      <button onClick={undo} disabled={historyIndex < 0} className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-all disabled:opacity-30 disabled:cursor-not-allowed" title="撤销 (⌘Z)">
        <Undo2 size={18} />
      </button>
      <button onClick={redo} disabled={historyIndex + 2 >= history.length} className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-all disabled:opacity-30 disabled:cursor-not-allowed" title="重做 (⌘⇧Z)">
        <Redo2 size={18} />
      </button>
    </div>
  );
}
