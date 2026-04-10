'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { X } from 'lucide-react';
import { useEffect } from 'react';

const shortcuts = [
  { category: '工具', items: [
    { keys: ['V'], desc: '选择工具' },
    { keys: ['M'], desc: '测量工具（悬停测距，无需按 Alt）' },
    { keys: ['H'], desc: '抓手工具' },
    { keys: ['R'], desc: '矩形工具' },
    { keys: ['O'], desc: '圆形工具' },
    { keys: ['T'], desc: '文本工具' },
    { keys: ['L'], desc: '线条工具' },
  ]},
  { category: '画布', items: [
    { keys: ['Space', '拖动'], desc: '平移画布' },
    { keys: ['滚轮'], desc: '缩放画布' },
    { keys: ['⌘', '0'], desc: '重置缩放' },
    { keys: ['⌘', '1'], desc: '居中画布' },
  ]},
  { category: '编辑', items: [
    { keys: ['⌘', 'A'], desc: '全选' },
    { keys: ['⌘', 'G'], desc: '编组（同父级、≥2 选区）' },
    { keys: ['⌘', '⇧', 'G'], desc: '取消编组' },
    { keys: ['Alt', '悬停'], desc: '测两对象间距（选择工具下单选）' },
    { keys: ['⌘', 'D'], desc: '复制图形' },
    { keys: ['⌘', 'Z'], desc: '撤销' },
    { keys: ['⌘', '⇧', 'Z'], desc: '重做' },
    { keys: ['Delete'], desc: '删除选中' },
    { keys: ['Escape'], desc: '取消选择' },
    { keys: ['双击文字'], desc: '直接编辑文字' },
  ]},
  { category: '导出', items: [
    { keys: ['Header 按钮'], desc: '导出 PNG / SVG / JSON' },
  ]},
];

export default function HelpModal() {
  const { showHelp, setShowHelp } = useEditorStore();

  useEffect(() => {
    if (!showHelp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHelp(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showHelp, setShowHelp]);

  if (!showHelp) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowHelp(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-[520px] max-h-[80vh] bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">键盘快捷键</h2>
          <button
            onClick={() => setShowHelp(false)}
            className="p-1.5 hover:bg-[var(--bg-elevated)] rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-60px)]">
          {shortcuts.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-3">
                {group.category}
              </h3>
              <div className="space-y-2">
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-[var(--text-secondary)]">{item.desc}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, ki) => (
                        <kbd key={ki} className="min-w-[28px] px-2 py-1 text-center text-xs font-mono bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md text-[var(--text-primary)]">
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
