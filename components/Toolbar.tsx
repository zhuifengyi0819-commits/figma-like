'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { ToolType } from '@/lib/types';
import { MousePointer2, Square, Circle, Type, Minus, Hand, Undo2, Redo2, Star, Triangle, ImagePlus, Frame, PenTool, ChevronDown, Ruler, Pipette, Pencil } from 'lucide-react';
import { fileToDataUrl, getImageDimensions } from '@/lib/hooks';
import { useState, useRef, useEffect, useCallback } from 'react';

const FRAME_PRESETS = [
  { name: 'iPhone 15 Pro', w: 393, h: 852 },
  { name: 'iPhone 15 Pro Max', w: 430, h: 932 },
  { name: 'iPhone SE', w: 375, h: 667 },
  { name: 'iPad Pro 11"', w: 834, h: 1194 },
  { name: 'iPad Pro 12.9"', w: 1024, h: 1366 },
  { name: 'Android Small', w: 360, h: 640 },
  { name: 'Android Large', w: 412, h: 915 },
  { name: 'Desktop', w: 1440, h: 900 },
  { name: 'Desktop HD', w: 1920, h: 1080 },
  { name: 'MacBook Pro 14"', w: 1512, h: 982 },
  { name: 'MacBook Pro 16"', w: 1728, h: 1117 },
  { name: 'Presentation (16:9)', w: 1920, h: 1080 },
  { name: 'A4', w: 595, h: 842 },
  { name: 'Social Post', w: 1080, h: 1080 },
  { name: 'Story', w: 1080, h: 1920 },
  { name: 'Twitter Header', w: 1500, h: 500 },
] as const;

const tools: { id: ToolType; icon: React.ReactNode; label: string; shortcut: string }[] = [
  { id: 'select', icon: <MousePointer2 size={18} />, label: '选择', shortcut: 'V' },
  { id: 'measure', icon: <Ruler size={18} />, label: '测量', shortcut: 'M' },
  { id: 'eyedropper', icon: <Pipette size={18} />, label: '取色器', shortcut: 'I' },
  { id: 'hand', icon: <Hand size={18} />, label: '抓手', shortcut: 'H' },
  { id: 'frame', icon: <Frame size={18} />, label: '画框', shortcut: 'F' },
  { id: 'rect', icon: <Square size={18} />, label: '矩形', shortcut: 'R' },
  { id: 'circle', icon: <Circle size={18} />, label: '圆形', shortcut: 'O' },
  { id: 'triangle', icon: <Triangle size={18} />, label: '三角', shortcut: '△' },
  { id: 'star', icon: <Star size={18} />, label: '星形', shortcut: '★' },
  { id: 'line', icon: <Minus size={18} />, label: '线条', shortcut: 'L' },
  { id: 'pen', icon: <PenTool size={18} />, label: '钢笔', shortcut: 'P' },
  { id: 'pencil', icon: <Pencil size={18} />, label: '铅笔', shortcut: 'N' },
  { id: 'text', icon: <Type size={18} />, label: '文本', shortcut: 'T' },
];

export default function Toolbar() {
  const { activeTool, setActiveTool, addShape, setSelectedIds, undo, redo, history, historyIndex } = useEditorStore();
  const [showFramePresets, setShowFramePresets] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) setShowFramePresets(false);
    };
    if (showFramePresets) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showFramePresets]);

  const insertPresetFrame = useCallback((preset: typeof FRAME_PRESETS[number]) => {
    const id = addShape({
      type: 'frame',
      x: 200 + Math.random() * 200,
      y: 100 + Math.random() * 100,
      width: preset.w,
      height: preset.h,
      fill: '#FFFFFF08',
      stroke: '#555560',
      strokeWidth: 1,
      opacity: 1,
      rotation: 0,
      visible: true,
      locked: false,
      name: preset.name,
      clipContent: true,
      cornerRadius: 0,
    });
    setSelectedIds([id]);
    setActiveTool('select');
    setShowFramePresets(false);
  }, [addShape, setSelectedIds, setActiveTool, setShowFramePresets]);

  const handleImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;

      // 并行读取所有文件尺寸和信息
      const fileInfos = await Promise.all(
        Array.from(files).map(async (file) => {
          const dataUrl = await fileToDataUrl(file);
          const dims = await getImageDimensions(dataUrl);
          let w = dims.width, h = dims.height;
          if (w > 600) { h = h * (600 / w); w = 600; }
          if (h > 400) { w = w * (400 / h); h = 400; }
          return { dataUrl, w, h, name: file.name };
        }),
      );

      // 批量添加所有图片（串行因为 addShape 有副作用）
      const newIds: string[] = [];
      for (let i = 0; i < fileInfos.length; i++) {
        const { dataUrl, w, h, name } = fileInfos[i];
        const id = addShape({
          type: 'image', x: 200 + i * 30, y: 200 + i * 30,
          width: w, height: h, src: dataUrl,
          fill: 'transparent', stroke: 'transparent', strokeWidth: 0,
          opacity: 1, rotation: 0, visible: true, locked: false, name,
        });
        newIds.push(id);
      }
      setSelectedIds(newIds);
      setActiveTool('select');
    };
    input.click();
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 px-2 py-1.5 bg-[var(--bg-surface)]/95 backdrop-blur-sm border border-[var(--border)] rounded-xl shadow-lg shadow-black/20">
      {tools.map((tool, i) => (
        <div key={tool.id} className="flex items-center">
          {(i === 2) && <div className="w-px h-5 bg-[var(--border)] mx-1" />}
          <div className="relative">
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
            {tool.id === 'frame' && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowFramePresets(!showFramePresets); }}
                className="absolute -right-1 -bottom-1 w-3 h-3 rounded-sm bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                title="画框预设"
                aria-label="画框预设"
              >
                <ChevronDown size={7} />
              </button>
            )}
          </div>
        </div>
      ))}
      {showFramePresets && (
        <div ref={presetRef} className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-56 max-h-80 overflow-y-auto py-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/40 animate-scale-in">
          <div className="px-3 py-1.5 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">画框预设</div>
          {FRAME_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => insertPresetFrame(preset)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <span className="text-xs">{preset.name}</span>
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{preset.w}×{preset.h}</span>
            </button>
          ))}
        </div>
      )}

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
