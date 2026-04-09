'use client';

import { useState, useMemo, useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { shapeToCss, shapeToReact, shapeToTailwind, shapeToHtml, shapesToFullReact, shapesToFullHtml } from '@/lib/codeGen';
import { Code, Copy, Check, FileCode, Download } from 'lucide-react';

type CodeMode = 'css' | 'react' | 'tailwind' | 'html';

const modes: { id: CodeMode; label: string }[] = [
  { id: 'css', label: 'CSS' },
  { id: 'react', label: 'React' },
  { id: 'tailwind', label: 'Tailwind' },
  { id: 'html', label: 'HTML' },
];

export default function CodeInspector() {
  const { shapes, selectedIds } = useEditorStore();
  const [mode, setMode] = useState<CodeMode>('css');
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const selectedShapes = useMemo(
    () => shapes.filter(s => selectedIds.includes(s.id)),
    [shapes, selectedIds]
  );

  const code = useMemo(() => {
    if (showFull) {
      if (mode === 'react') return shapesToFullReact(shapes);
      if (mode === 'html') return shapesToFullHtml(shapes);
      return shapes.filter(s => s.visible).map(s => shapeToCss(s)).join('\n\n');
    }

    if (selectedShapes.length === 0) return '';

    return selectedShapes.map(s => {
      switch (mode) {
        case 'css': return shapeToCss(s);
        case 'react': return shapeToReact(s);
        case 'tailwind': return shapeToTailwind(s);
        case 'html': return shapeToHtml(s);
      }
    }).join('\n\n');
  }, [selectedShapes, shapes, mode, showFull]);

  const cssProps = useMemo(() => {
    if (selectedShapes.length !== 1) return [];
    const s = selectedShapes[0];
    const props: { key: string; value: string }[] = [];

    if (s.type === 'rect' || s.type === 'image' || s.type === 'component' || s.type === 'frame') {
      if (s.width) props.push({ key: 'width', value: `${Math.round(s.width)}px` });
      if (s.height) props.push({ key: 'height', value: `${Math.round(s.height)}px` });
    }
    if (s.type === 'frame' && s.autoLayout) {
      props.push({ key: 'display', value: 'flex' });
      props.push({ key: 'flex-direction', value: s.autoLayout.direction === 'horizontal' ? 'row' : 'column' });
      props.push({ key: 'gap', value: `${s.autoLayout.gap}px` });
      props.push({ key: 'padding', value: `${s.autoLayout.paddingTop}px ${s.autoLayout.paddingRight}px ${s.autoLayout.paddingBottom}px ${s.autoLayout.paddingLeft}px` });
    }
    if (s.type === 'circle') {
      const d = (s.radius || 50) * 2;
      props.push({ key: 'width', value: `${d}px` });
      props.push({ key: 'height', value: `${d}px` });
      props.push({ key: 'border-radius', value: '50%' });
    }
    if (s.type === 'text') {
      if (s.fontSize) props.push({ key: 'font-size', value: `${s.fontSize}px` });
      if (s.fontFamily) props.push({ key: 'font-family', value: s.fontFamily });
      if (s.fontWeight) props.push({ key: 'font-weight', value: s.fontWeight });
      props.push({ key: 'color', value: s.fill });
    } else {
      if (s.gradient) {
        if (s.gradient.type === 'linear') {
          const stops = s.gradient.stops.map(st => `${st.color} ${Math.round(st.offset * 100)}%`).join(', ');
          props.push({ key: 'background', value: `linear-gradient(${s.gradient.angle ?? 0}deg, ${stops})` });
        } else {
          const stops = s.gradient.stops.map(st => `${st.color} ${Math.round(st.offset * 100)}%`).join(', ');
          props.push({ key: 'background', value: `radial-gradient(circle, ${stops})` });
        }
      } else if (s.fill && s.fill !== 'transparent') {
        props.push({ key: 'background', value: s.fill });
      }
    }
    if ((s.type === 'rect' || s.type === 'frame') && s.cornerRadius) props.push({ key: 'border-radius', value: `${s.cornerRadius}px` });
    if (s.stroke && s.stroke !== 'transparent' && s.strokeWidth > 0) {
      props.push({ key: 'border', value: `${s.strokeWidth}px ${s.strokeDash ? 'dashed' : 'solid'} ${s.stroke}` });
    }
    if (s.opacity < 1) props.push({ key: 'opacity', value: `${s.opacity}` });
    if (s.rotation) props.push({ key: 'transform', value: `rotate(${Math.round(s.rotation)}deg)` });
    const shadows = s.shadows || (s.shadow ? [s.shadow] : []);
    if (shadows.length > 0) {
      props.push({ key: 'box-shadow', value: shadows.map(sh => `${sh.offsetX}px ${sh.offsetY}px ${sh.blur}px ${sh.color}`).join(', ') });
    }

    return props;
  }, [selectedShapes]);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleExport = useCallback(() => {
    const ext = mode === 'react' ? 'tsx' : mode === 'html' ? 'html' : 'css';
    const content = mode === 'react' ? shapesToFullReact(shapes) : mode === 'html' ? shapesToFullHtml(shapes) : shapes.filter(s => s.visible).map(s => shapeToCss(s)).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [shapes, mode]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)]">
      {/* Mode tabs */}
      <div className="flex items-center border-b border-[var(--border)]">
        <div className="flex flex-1">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                mode === m.id
                  ? 'text-[var(--accent)] border-[var(--accent)]'
                  : 'text-[var(--text-tertiary)] border-transparent hover:text-[var(--text-secondary)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={handleCopy}
            disabled={!code}
            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-30 transition-colors"
            title="复制代码"
          >
            {copied ? <Check size={13} className="text-[var(--success)]" /> : <Copy size={13} />}
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
            title="导出文件"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Toggle: selected vs full */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <button
          onClick={() => setShowFull(false)}
          className={`px-2 py-1 text-[10px] rounded transition-colors ${!showFull ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)]'}`}
        >
          选中元素
        </button>
        <button
          onClick={() => setShowFull(true)}
          className={`px-2 py-1 text-[10px] rounded transition-colors ${showFull ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)]'}`}
        >
          导出全部
        </button>
      </div>

      {/* CSS Properties (Figma-like inspect) */}
      {!showFull && selectedShapes.length === 1 && (
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <h4 className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-2 font-semibold">CSS 属性</h4>
          <div className="space-y-1">
            {cssProps.map((prop, i) => (
              <div key={i} className="flex items-center justify-between py-0.5 group">
                <span className="text-[11px] text-[var(--text-secondary)] font-mono">{prop.key}</span>
                <div className="flex items-center gap-1.5">
                  {(prop.key === 'background' || prop.key === 'color' || prop.key === 'border') && prop.value.includes('#') && (
                    <div
                      className="w-3 h-3 rounded-sm border border-[var(--border)]"
                      style={{ background: prop.value.includes('px') ? prop.value.split(' ').pop() : prop.value }}
                    />
                  )}
                  <span className="text-[11px] text-[var(--accent)] font-mono">{prop.value}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${prop.key}: ${prop.value};`)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
                    title="复制"
                  >
                    <Copy size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code */}
      <div className="flex-1 overflow-auto">
        {!code && !showFull ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 mb-3 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center">
              <Code size={20} className="text-[var(--text-tertiary)]" />
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">选择元素查看代码</p>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">支持 CSS / React / Tailwind / HTML</p>
          </div>
        ) : (
          <pre className="p-3 text-[11px] font-mono text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-all select-all">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
