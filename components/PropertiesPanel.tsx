'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { Shape, Shadow, Gradient, Fill, AutoLayout, Interaction, Constraints, TextSizing, BlendMode, BlurEffect, LayoutGrid as LayoutGridType, DEFAULT_AUTO_LAYOUT } from '@/lib/types';
import {
  ArrowUp, ArrowDown, Trash2, Copy, Move, Plus,
  AlignLeft, AlignCenterHorizontal, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  FlipHorizontal, FlipVertical,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween,
  ArrowRightLeft, ArrowUpDown, LayoutGrid,
  Component, Unlink, Zap, MousePointer2, Link,
  Download,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import ColorPicker from './ColorPicker';
import { shapesToSvg, downloadSvg } from '@/lib/svgExport';
import { shapeToCss } from '@/lib/codeGen';

function NumInput({ label, value, onChange, suffix, min, max, step = 1, title }: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; min?: number; max?: number; step?: number; title?: string;
}) {
  return (
    <div className="flex flex-col gap-1" title={title}>
      <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n); }}
          className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1.5 pr-7 text-sm text-[var(--text-primary)] font-mono focus:border-[var(--accent)] focus:outline-none transition-colors"
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-tertiary)]">{suffix}</span>}
      </div>
    </div>
  );
}

function IconBtn({ icon, label, onClick, active, danger }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded transition-colors ${
        danger ? 'hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400' :
        active ? 'bg-[var(--accent)]/20 text-[var(--accent)]' :
        'hover:bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
      }`}
    >
      {icon}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function InteractionEditor({ shape }: { shape: Shape }) {
  const { addInteraction, removeInteraction, updateInteraction, shapes, pages } = useEditorStore();
  const interactions = shape.interactions || [];
  const allFrames = pages.flatMap(p => p.shapes.filter(s => s.type === 'frame' && !s.parentId));

  const handleAdd = () => {
    addInteraction(shape.id, {
      trigger: 'click',
      action: 'navigateTo',
      transition: 'dissolve',
      duration: 300,
    });
  };

  return (
    <Section title="交互">
      {interactions.map((int, idx) => (
        <div key={idx} className="space-y-1.5 pb-2 border-b border-[var(--border)] last:border-b-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
              <Zap size={10} /> 交互 {idx + 1}
            </span>
            <button onClick={() => removeInteraction(shape.id, idx)} className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--danger)]" title="删除" aria-label="删除">
              <Trash2 size={10} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">触发</label>
              <select
                value={int.trigger}
                onChange={e => updateInteraction(shape.id, idx, { trigger: e.target.value as Interaction['trigger'] })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)]"
                title="触发方式"
              >
                <option value="click">点击</option>
                <option value="hover">悬停</option>
                <option value="drag">拖拽</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">动作</label>
              <select
                value={int.action}
                onChange={e => updateInteraction(shape.id, idx, { action: e.target.value as Interaction['action'] })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)]"
                title="动作类型"
              >
                <option value="navigateTo">跳转画框</option>
                <option value="back">返回</option>
                <option value="openUrl">打开链接</option>
                <option value="scrollTo">滚动到</option>
              </select>
            </div>
          </div>
          {int.action === 'navigateTo' && (
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">目标画框</label>
              <select
                value={int.targetFrameId || ''}
                onChange={e => updateInteraction(shape.id, idx, { targetFrameId: e.target.value })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)]"
                title="目标画框"
              >
                <option value="">选择...</option>
                {allFrames.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}
          {int.action === 'openUrl' && (
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">URL</label>
              <input
                value={int.url || ''}
                onChange={e => updateInteraction(shape.id, idx, { url: e.target.value })}
                placeholder="https://..."
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] outline-none"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">过渡</label>
              <select
                value={int.transition || 'instant'}
                onChange={e => updateInteraction(shape.id, idx, { transition: e.target.value as Interaction['transition'] })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)]"
                title="过渡效果"
              >
                <option value="instant">立即</option>
                <option value="dissolve">渐变</option>
                <option value="slideLeft">左滑</option>
                <option value="slideRight">右滑</option>
                <option value="slideUp">上滑</option>
                <option value="slideDown">下滑</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">时长</label>
              <input
                type="number" value={int.duration || 300} min={0} max={3000} step={50}
                onChange={e => updateInteraction(shape.id, idx, { duration: parseInt(e.target.value) })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] font-mono outline-none"
                title="过渡时长(ms)"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={handleAdd}
        className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
      >
        <Plus size={11} /> 添加交互
      </button>
    </Section>
  );
}

function ComponentSection({ shape }: { shape: Shape }) {
  const { components, createComponent, createInstance, syncInstances, detachInstance, selectedIds } = useEditorStore();
  const [compName, setCompName] = useState('');

  const comp = shape.masterComponentId ? components.find(c => c.id === shape.masterComponentId) : null;

  return (
    <Section title="组件">
      {shape.isMainComponent && comp && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/20">
          <Component size={13} className="text-[var(--accent)]" />
          <span className="text-[11px] text-[var(--accent)] font-medium flex-1 truncate">{comp.name}</span>
          <button
            onClick={() => syncInstances(comp.id)}
            className="text-[10px] text-[var(--accent)] hover:underline"
            title="同步所有实例"
          >
            同步
          </button>
        </div>
      )}
      {shape.masterComponentId && !shape.isMainComponent && comp && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-purple-500/10 border border-purple-500/20">
          <Link size={13} className="text-purple-400" />
          <span className="text-[11px] text-purple-400 flex-1 truncate">实例: {comp.name}</span>
          <button
            onClick={() => detachInstance(shape.id)}
            className="p-0.5 text-purple-400 hover:text-purple-300"
            title="分离实例"
            aria-label="分离实例"
          >
            <Unlink size={12} />
          </button>
        </div>
      )}
      {!shape.masterComponentId && (
        <div className="flex items-center gap-1.5">
          <input
            value={compName}
            onChange={e => setCompName(e.target.value)}
            placeholder="组件名称"
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-[10px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] min-w-0"
          />
          <button
            onClick={() => {
              if (!compName.trim()) return;
              createComponent(selectedIds, compName.trim());
              setCompName('');
            }}
            disabled={!compName.trim()}
            className="px-2 py-1 rounded bg-[var(--accent)] text-white text-[10px] disabled:opacity-30 hover:opacity-90"
            title="创建组件"
          >
            创建
          </button>
        </div>
      )}
      {components.length > 0 && !shape.masterComponentId && (
        <div className="space-y-1 pt-1">
          <span className="text-[9px] text-[var(--text-tertiary)]">插入实例:</span>
          {components.map(c => (
            <button
              key={c.id}
              onClick={() => createInstance(c.id, shape.x + (shape.width || 100) + 20, shape.y)}
              className="w-full text-left flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <Component size={10} className="text-[var(--accent)]" />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

export default function PropertiesPanel() {
  const { shapes, selectedIds, updateShape, deleteShapes, duplicateShapes, bringForward, sendBackward, pushHistory, alignShapes, applyAutoLayout } = useEditorStore();

  const selected = shapes.filter(s => selectedIds.includes(s.id));
  const single = selected.length === 1 ? selected[0] : null;
  const isLine = single?.type === 'line' || single?.type === 'arrow';
  const isFrame = single?.type === 'frame';
  const isPath = single?.type === 'path';

  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyPushed = useRef(false);

  const debouncedPushHistory = useCallback(() => {
    if (!historyPushed.current) {
      pushHistory();
      historyPushed.current = true;
    }
    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => { historyPushed.current = false; }, 400);
  }, [pushHistory]);

  const update = useCallback((u: Partial<Shape>) => {
    debouncedPushHistory();
    selectedIds.forEach(id => updateShape(id, u));
  }, [selectedIds, updateShape, debouncedPushHistory]);

  const updateShadow = useCallback((idx: number, patch: Partial<Shadow>) => {
    debouncedPushHistory();
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const shadows = [...(shape.shadows || (shape.shadow ? [shape.shadow] : []))];
      if (shadows[idx]) {
        shadows[idx] = { ...shadows[idx], ...patch };
        updateShape(id, { shadows, shadow: shadows[0] });
      }
    });
  }, [selectedIds, shapes, updateShape, debouncedPushHistory]);

  const addShadow = useCallback(() => {
    debouncedPushHistory();
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const shadows = [...(shape.shadows || (shape.shadow ? [shape.shadow] : []))];
      shadows.push({ color: '#00000040', blur: 10, offsetX: 4, offsetY: 4 });
      updateShape(id, { shadows, shadow: shadows[0] });
    });
  }, [selectedIds, shapes, updateShape, debouncedPushHistory]);

  const removeShadow = useCallback((idx: number) => {
    debouncedPushHistory();
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const shadows = [...(shape.shadows || (shape.shadow ? [shape.shadow] : []))];
      shadows.splice(idx, 1);
      updateShape(id, { shadows, shadow: shadows[0] || undefined });
    });
  }, [selectedIds, shapes, updateShape, debouncedPushHistory]);

  const addFill = useCallback(() => {
    debouncedPushHistory();
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const fills = [...(shape.fills || [{ type: 'solid' as const, color: shape.fill }])];
      fills.push({ type: 'solid', color: '#D4A853' });
      updateShape(id, { fills });
    });
  }, [selectedIds, shapes, updateShape, debouncedPushHistory]);

  const updateFill = useCallback((idx: number, patch: Partial<Fill>) => {
    debouncedPushHistory();
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const fills = [...(shape.fills || [{ type: 'solid' as const, color: shape.fill }])];
      if (fills[idx]) {
        fills[idx] = { ...fills[idx], ...patch };
        updateShape(id, { fills, fill: fills[0]?.color || shape.fill });
      }
    });
  }, [selectedIds, shapes, updateShape, debouncedPushHistory]);

  const removeFill = useCallback((idx: number) => {
    debouncedPushHistory();
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const fills = [...(shape.fills || [{ type: 'solid' as const, color: shape.fill }])];
      fills.splice(idx, 1);
      updateShape(id, { fills, fill: fills[0]?.color || 'transparent' });
    });
  }, [selectedIds, shapes, updateShape, debouncedPushHistory]);

  const updateGradient = useCallback((g: Gradient | undefined) => {
    debouncedPushHistory();
    selectedIds.forEach(id => updateShape(id, { gradient: g }));
  }, [selectedIds, updateShape, debouncedPushHistory]);

  const updateAutoLayout = useCallback((patch: Partial<AutoLayout>) => {
    if (!single) return;
    debouncedPushHistory();
    const current = single.autoLayout || DEFAULT_AUTO_LAYOUT;
    updateShape(single.id, { autoLayout: { ...current, ...patch } });
    setTimeout(() => applyAutoLayout(single.id), 0);
  }, [single, updateShape, debouncedPushHistory, applyAutoLayout]);

  if (selected.length === 0) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-surface)]">
        <div className="flex items-center px-4 py-2 border-b border-[var(--border)]">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">属性</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-12 h-12 mb-3 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center">
            <Move size={20} className="text-[var(--text-tertiary)]" />
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">选择图形以编辑属性</p>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1 opacity-60">支持拖入图片 · 双击文字编辑</p>
        </div>
      </div>
    );
  }

  const shadows = single ? (single.shadows || (single.shadow ? [single.shadow] : [])) : [];
  const fills = single ? (single.fills || [{ type: 'solid' as const, color: single.fill }]) : [];

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <h2 className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[140px]">
          {selected.length > 1 ? `${selected.length} 个选中` : single?.name || '属性'}
        </h2>
        <div className="flex items-center gap-0.5">
          <IconBtn icon={<Copy size={13} />} label="复制 (⌘D)" onClick={() => duplicateShapes(selectedIds)} />
          <IconBtn icon={<ArrowUp size={13} />} label="上移一层" onClick={() => bringForward(selectedIds[0])} />
          <IconBtn icon={<ArrowDown size={13} />} label="下移一层" onClick={() => sendBackward(selectedIds[0])} />
          <IconBtn icon={<Trash2 size={13} />} label="删除 (Del)" onClick={() => deleteShapes(selectedIds)} danger />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {single && (
          <>
            {/* Component section */}
            <ComponentSection shape={single} />

            {/* Position */}
            <Section title="位置与变换">
              <div className="grid grid-cols-2 gap-2">
                <NumInput label="X" value={Math.round(single.x)} onChange={v => update({ x: v })} suffix="px" />
                <NumInput label="Y" value={Math.round(single.y)} onChange={v => update({ y: v })} suffix="px" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumInput label="旋转" value={Math.round(single.rotation)} onChange={v => update({ rotation: v })} suffix="°" min={-360} max={360} />
                <NumInput label="不透明度" value={Math.round(single.opacity * 100)} onChange={v => update({ opacity: v / 100 })} suffix="%" min={0} max={100} />
              </div>
              <div className="flex items-center gap-1 pt-1">
                <span className="text-[10px] text-[var(--text-tertiary)] mr-1">翻转</span>
                <button
                  onClick={() => update({ scaleX: single.scaleX === -1 ? 1 : -1 })}
                  title="水平翻转" aria-label="水平翻转"
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${single.scaleX === -1 ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}`}
                >
                  <FlipHorizontal size={13} /> H
                </button>
                <button
                  onClick={() => update({ scaleY: single.scaleY === -1 ? 1 : -1 })}
                  title="垂直翻转" aria-label="垂直翻转"
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${single.scaleY === -1 ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}`}
                >
                  <FlipVertical size={13} /> V
                </button>
              </div>
            </Section>

            {/* Size */}
            {(single.type === 'rect' || single.type === 'image' || single.type === 'component' || isFrame) && (
              <Section title="尺寸">
                <div className="grid grid-cols-2 gap-2">
                  <NumInput label="W" value={Math.round(single.width || 0)} onChange={v => update({ width: v })} suffix="px" min={1} />
                  <NumInput label="H" value={Math.round(single.height || 0)} onChange={v => update({ height: v })} suffix="px" min={1} />
                </div>
                {(single.type === 'rect' || isFrame) && (
                  <NumInput label="圆角" value={single.cornerRadius || 0} onChange={v => update({ cornerRadius: v })} suffix="px" min={0} max={200} />
                )}
                {isFrame && (
                  <div className="flex items-center gap-2 pt-1">
                    <input type="checkbox" checked={single.clipContent !== false} onChange={e => update({ clipContent: e.target.checked })} className="accent-[var(--accent)]" />
                    <span className="text-[11px] text-[var(--text-secondary)]">裁切内容</span>
                  </div>
                )}
              </Section>
            )}

            {(single.type === 'circle' || single.type === 'star' || single.type === 'triangle') && (
              <Section title="尺寸">
                <NumInput label="半径" value={Math.round(single.radius || 0)} onChange={v => update({ radius: v })} suffix="px" min={1} />
                {single.type === 'star' && (
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput label="内半径" value={Math.round(single.innerRadius || 20)} onChange={v => update({ innerRadius: v })} suffix="px" min={1} />
                    <NumInput label="角数" value={single.numPoints || 5} onChange={v => update({ numPoints: v })} min={3} max={20} />
                  </div>
                )}
              </Section>
            )}

            {/* Constraints — only for children of frames */}
            {single.parentId && (
              <Section title="约束">
                <div className="space-y-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">水平</label>
                    <div className="grid grid-cols-5 gap-0.5">
                      {([['left', '左'], ['right', '右'], ['center', '中'], ['leftRight', '两端'], ['scale', '缩放']] as [Constraints['horizontal'], string][]).map(([v, l]) => (
                        <button
                          key={v}
                          onClick={() => update({ constraints: { ...(single.constraints || { horizontal: 'left', vertical: 'top' }), horizontal: v } })}
                          className={`py-1 text-[9px] rounded transition-colors ${(single.constraints?.horizontal || 'left') === v ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}
                          aria-label={l}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">垂直</label>
                    <div className="grid grid-cols-5 gap-0.5">
                      {([['top', '上'], ['bottom', '下'], ['center', '中'], ['topBottom', '两端'], ['scale', '缩放']] as [Constraints['vertical'], string][]).map(([v, l]) => (
                        <button
                          key={v}
                          onClick={() => update({ constraints: { ...(single.constraints || { horizontal: 'left', vertical: 'top' }), vertical: v } })}
                          className={`py-1 text-[9px] rounded transition-colors ${(single.constraints?.vertical || 'top') === v ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}
                          aria-label={l}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {(single.type === 'line' || single.type === 'arrow') && (
              <Section title="线条">
                <NumInput label="粗细" value={single.strokeWidth || 2} onChange={v => update({ strokeWidth: v })} suffix="px" min={1} max={50} />
              </Section>
            )}

            {isPath && (
              <Section title="路径">
                <NumInput label="描边粗细" value={single.strokeWidth || 2} onChange={v => update({ strokeWidth: v })} suffix="px" min={1} max={50} />
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={single.closePath || false} onChange={e => update({ closePath: e.target.checked })} className="accent-[var(--accent)]" />
                  <span className="text-[11px] text-[var(--text-secondary)]">闭合路径</span>
                </div>
              </Section>
            )}

            {/* Auto Layout */}
            {isFrame && (
              <Section title="Auto Layout">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => {
                      if (single.autoLayout) update({ autoLayout: undefined });
                      else { update({ autoLayout: DEFAULT_AUTO_LAYOUT }); setTimeout(() => applyAutoLayout(single.id), 0); }
                    }}
                    className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${single.autoLayout ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                    title={single.autoLayout ? '关闭 Auto Layout' : '开启 Auto Layout'}
                    aria-label={single.autoLayout ? '关闭' : '开启'}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${single.autoLayout ? 'translate-x-4' : ''}`} />
                  </button>
                  <LayoutGrid size={14} className="text-[var(--text-tertiary)]" />
                  <span className="text-[10px] text-[var(--text-tertiary)]">{single.autoLayout ? '已启用' : '未启用'}</span>
                </div>
                {single.autoLayout && (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateAutoLayout({ direction: 'horizontal' })}
                        className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${single.autoLayout.direction === 'horizontal' ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}
                        aria-label="水平排列"
                      >
                        <ArrowRightLeft size={12} /> 水平
                      </button>
                      <button
                        onClick={() => updateAutoLayout({ direction: 'vertical' })}
                        className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${single.autoLayout.direction === 'vertical' ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}
                        aria-label="垂直排列"
                      >
                        <ArrowUpDown size={12} /> 垂直
                      </button>
                    </div>
                    <NumInput label="间距" value={single.autoLayout.gap} onChange={v => updateAutoLayout({ gap: v })} suffix="px" min={0} />
                    <div className="grid grid-cols-2 gap-2">
                      <NumInput label="上内距" value={single.autoLayout.paddingTop} onChange={v => updateAutoLayout({ paddingTop: v })} suffix="px" min={0} />
                      <NumInput label="右内距" value={single.autoLayout.paddingRight} onChange={v => updateAutoLayout({ paddingRight: v })} suffix="px" min={0} />
                      <NumInput label="下内距" value={single.autoLayout.paddingBottom} onChange={v => updateAutoLayout({ paddingBottom: v })} suffix="px" min={0} />
                      <NumInput label="左内距" value={single.autoLayout.paddingLeft} onChange={v => updateAutoLayout({ paddingLeft: v })} suffix="px" min={0} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">对齐</label>
                      <div className="grid grid-cols-4 gap-1">
                        {(['start', 'center', 'end', 'stretch'] as const).map(a => (
                          <button
                            key={a}
                            onClick={() => updateAutoLayout({ alignItems: a })}
                            className={`py-1 text-[10px] rounded transition-colors ${single.autoLayout!.alignItems === a ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}
                            aria-label={a}
                          >
                            {a === 'start' ? '起' : a === 'center' ? '中' : a === 'end' ? '末' : '拉'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </Section>
            )}

            {single.type === 'text' && (
              <Section title="文本">
                <textarea
                  value={single.text || ''}
                  onChange={e => update({ text: e.target.value })}
                  title="文本内容"
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors resize-none"
                  rows={2}
                />
                {/* Text sizing mode */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">调整模式</label>
                  <div className="grid grid-cols-3 gap-1">
                    {([['fixed', '固定'], ['autoWidth', '自适宽'], ['autoHeight', '自适高']] as [TextSizing, string][]).map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => update({ textSizing: v })}
                        className={`py-1 text-[10px] rounded transition-colors ${(single.textSizing || 'fixed') === v ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                        aria-label={l}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumInput label="字号" value={single.fontSize || 24} onChange={v => update({ fontSize: v })} suffix="px" min={8} max={200} />
                  {(single.textSizing || 'fixed') === 'fixed' && single.width && <NumInput label="宽度" value={Math.round(single.width)} onChange={v => update({ width: v })} suffix="px" min={10} />}
                </div>
                {/* Font family selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">字体</label>
                  <select
                    value={single.fontFamily || 'sans-serif'}
                    onChange={e => update({ fontFamily: e.target.value })}
                    title="字体族"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  >
                    <option value="sans-serif">Sans Serif</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Verdana">Verdana</option>
                    <option value="SF Pro Display">SF Pro Display</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Noto Sans SC">Noto Sans SC</option>
                    <option value="PingFang SC">PingFang SC</option>
                    <option value="Microsoft YaHei">Microsoft YaHei</option>
                    <option value="Source Han Sans">Source Han Sans</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">字重</label>
                  <select
                    value={single.fontWeight || 'normal'}
                    onChange={e => update({ fontWeight: e.target.value })}
                    title="字重"
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  >
                    <option value="100">Thin (100)</option>
                    <option value="200">ExtraLight (200)</option>
                    <option value="300">Light (300)</option>
                    <option value="normal">Regular (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">SemiBold (600)</option>
                    <option value="bold">Bold (700)</option>
                    <option value="800">ExtraBold (800)</option>
                    <option value="900">Black (900)</option>
                    <option value="italic">Italic</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumInput label="行高" value={single.lineHeight ?? 1.2} onChange={v => update({ lineHeight: v })} step={0.1} min={0.5} max={5} />
                  <NumInput label="字间距" value={single.letterSpacing ?? 0} onChange={v => update({ letterSpacing: v })} suffix="px" min={-10} max={50} step={0.5} />
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['left', 'center', 'right'] as const).map(align => (
                    <button
                      key={align}
                      onClick={() => update({ textAlign: align })}
                      aria-label={`文字${align === 'left' ? '左' : align === 'center' ? '居中' : '右'}对齐`}
                      className={`py-1 text-[11px] rounded transition-colors ${(single.textAlign || 'left') === align ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                    >
                      {align === 'left' ? '左' : align === 'center' ? '中' : '右'}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* Multiple fills stack */}
            {!isLine && single.type !== 'image' && (
              <Section title="填充">
                {fills.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <ColorPicker
                        label={fills.length > 1 ? `填充 ${i + 1}` : '填充'}
                        value={f.color || single.fill}
                        gradient={i === 0 ? single.gradient : undefined}
                        onChange={v => {
                          updateFill(i, { color: v });
                          if (i === 0) update({ fill: v });
                        }}
                        onGradientChange={i === 0 ? updateGradient : undefined}
                      />
                    </div>
                    {fills.length > 1 && (
                      <button onClick={() => removeFill(i)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--danger)]" title="删除填充" aria-label="删除填充">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addFill} className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors">
                  <Plus size={11} /> 添加填充
                </button>
              </Section>
            )}

            {/* Stroke */}
            {!isLine && single.type !== 'image' && (
              <Section title="描边">
                <ColorPicker label="描边" value={single.stroke} onChange={v => update({ stroke: v })} />
                <NumInput label="描边宽度" value={single.strokeWidth} onChange={v => update({ strokeWidth: v })} suffix="px" min={0} max={20} />
              </Section>
            )}

            {isLine && (
              <Section title="外观">
                <ColorPicker label="线条颜色" value={single.stroke} onChange={v => update({ stroke: v })} />
              </Section>
            )}

            {/* Multiple shadows stack */}
            <Section title="阴影">
              {shadows.map((s, i) => (
                <div key={i} className="space-y-2 pb-2 border-b border-[var(--border)] last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[var(--text-tertiary)]">阴影 {shadows.length > 1 ? i + 1 : ''}</span>
                    <button onClick={() => removeShadow(i)} className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--danger)]" title="删除阴影" aria-label="删除阴影">
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <ColorPicker label="颜色" value={s.color} onChange={v => updateShadow(i, { color: v })} />
                  <div className="grid grid-cols-3 gap-2">
                    <NumInput label="模糊" value={s.blur} onChange={v => updateShadow(i, { blur: v })} suffix="px" min={0} max={100} />
                    <NumInput label="X偏移" value={s.offsetX} onChange={v => updateShadow(i, { offsetX: v })} />
                    <NumInput label="Y偏移" value={s.offsetY} onChange={v => updateShadow(i, { offsetY: v })} />
                  </div>
                </div>
              ))}
              <button onClick={addShadow} className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors">
                <Plus size={11} /> 添加阴影
              </button>
            </Section>

            {/* Blur Effects */}
            <Section title="模糊">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-[var(--text-tertiary)] w-16 flex-shrink-0">类型</label>
                  <select
                    value={single.blur?.type || 'layer'}
                    title="模糊类型"
                    onChange={e => update({ blur: { type: e.target.value as BlurEffect['type'], radius: single.blur?.radius || 0 } })}
                    className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-[11px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  >
                    <option value="layer">图层模糊</option>
                    <option value="background">背景模糊</option>
                  </select>
                </div>
                <NumInput
                  label="半径"
                  value={single.blur?.radius || 0}
                  onChange={v => update({ blur: { type: single.blur?.type || 'layer', radius: v } })}
                  suffix="px" min={0} max={100}
                />
                {single.blur && single.blur.radius > 0 && (
                  <button
                    onClick={() => update({ blur: undefined })}
                    className="text-[10px] text-[var(--danger)] hover:underline"
                  >移除模糊</button>
                )}
              </div>
            </Section>

            {/* Blend Mode */}
            <Section title="混合模式">
              <select
                value={single.blendMode || 'normal'}
                title="混合模式"
                onChange={e => update({ blendMode: e.target.value as BlendMode })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              >
                {[
                  ['normal', '正常'], ['multiply', '正片叠底'], ['screen', '滤色'], ['overlay', '叠加'],
                  ['darken', '变暗'], ['lighten', '变亮'], ['color-dodge', '颜色减淡'], ['color-burn', '颜色加深'],
                  ['hard-light', '强光'], ['soft-light', '柔光'], ['difference', '差值'], ['exclusion', '排除'],
                ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Section>

            {/* Layout Grid (frames only) */}
            {isFrame && (
              <Section title="布局网格">
                {(single.layoutGrids || []).map((g, i) => (
                  <div key={i} className="space-y-2 pb-2 border-b border-[var(--border)] last:border-b-0">
                    <div className="flex items-center justify-between">
                      <select
                        value={g.type}
                        title="网格类型"
                        onChange={e => {
                          const grids = [...(single.layoutGrids || [])];
                          grids[i] = { ...grids[i], type: e.target.value as LayoutGridType['type'] };
                          update({ layoutGrids: grids });
                        }}
                        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1 py-0.5 text-[10px] text-[var(--text-primary)] focus:outline-none"
                      >
                        <option value="columns">列</option>
                        <option value="rows">行</option>
                        <option value="grid">网格</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const grids = [...(single.layoutGrids || [])];
                            grids[i] = { ...grids[i], visible: !grids[i].visible };
                            update({ layoutGrids: grids });
                          }}
                          className={`p-0.5 rounded text-[10px] ${g.visible ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}
                          title={g.visible ? '隐藏' : '显示'}
                          aria-label={g.visible ? '隐藏网格' : '显示网格'}
                        >{g.visible ? '👁' : '👁‍🗨'}</button>
                        <button
                          onClick={() => {
                            const grids = (single.layoutGrids || []).filter((_, idx) => idx !== i);
                            update({ layoutGrids: grids.length ? grids : undefined });
                          }}
                          className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                          title="删除网格" aria-label="删除网格"
                        ><Trash2 size={11} /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <NumInput label="数量" value={g.count} onChange={v => {
                        const grids = [...(single.layoutGrids || [])];
                        grids[i] = { ...grids[i], count: v };
                        update({ layoutGrids: grids });
                      }} min={1} max={24} />
                      <NumInput label="间距" value={g.gutterSize} onChange={v => {
                        const grids = [...(single.layoutGrids || [])];
                        grids[i] = { ...grids[i], gutterSize: v };
                        update({ layoutGrids: grids });
                      }} suffix="px" min={0} max={100} />
                      <NumInput label="边距" value={g.margin} onChange={v => {
                        const grids = [...(single.layoutGrids || [])];
                        grids[i] = { ...grids[i], margin: v };
                        update({ layoutGrids: grids });
                      }} suffix="px" min={0} max={200} />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-[var(--text-tertiary)]">颜色</label>
                      <input
                        type="color"
                        value={g.color.startsWith('#') ? g.color.slice(0, 7) : '#FF000044'}
                        onChange={e => {
                          const grids = [...(single.layoutGrids || [])];
                          grids[i] = { ...grids[i], color: e.target.value + '44' };
                          update({ layoutGrids: grids });
                        }}
                        className="w-6 h-6 rounded border border-[var(--border)] cursor-pointer bg-transparent"
                        title="网格颜色"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const grids = [...(single.layoutGrids || []), { type: 'columns' as const, count: 12, gutterSize: 16, margin: 16, color: '#FF000044', visible: true }];
                    update({ layoutGrids: grids });
                  }}
                  className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                >
                  <Plus size={11} /> 添加网格
                </button>
              </Section>
            )}

            {/* Prototype Interactions */}
            <InteractionEditor shape={single} />

            {/* Export Section */}
            <Section title="导出">
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => {
                    const w = single.width || (single.radius ? single.radius * 2 : 200);
                    const h = single.height || (single.radius ? single.radius * 2 : 200);
                    const svg = shapesToSvg([single], { width: w, height: h });
                    downloadSvg(svg, `${single.name}.svg`);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent)] bg-[var(--bg-elevated)] rounded transition-colors"
                >
                  <Download size={11} /> SVG
                </button>
                <button
                  onClick={() => {
                    const w = single.width || (single.radius ? single.radius * 2 : 200);
                    const h = single.height || (single.radius ? single.radius * 2 : 200);
                    const svg = shapesToSvg([single], { width: w, height: h });
                    const canvas = document.createElement('canvas');
                    canvas.width = w * 2; canvas.height = h * 2;
                    const ctx = canvas.getContext('2d');
                    const img = new window.Image();
                    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    img.onload = () => {
                      ctx?.drawImage(img, 0, 0, w * 2, h * 2);
                      const a = document.createElement('a');
                      a.href = canvas.toDataURL('image/png');
                      a.download = `${single.name}@2x.png`;
                      a.click();
                      URL.revokeObjectURL(url);
                    };
                    img.src = url;
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent)] bg-[var(--bg-elevated)] rounded transition-colors"
                >
                  <Download size={11} /> PNG
                </button>
                <button
                  onClick={() => {
                    const css = shapeToCss(single);
                    navigator.clipboard.writeText(css);
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent)] bg-[var(--bg-elevated)] rounded transition-colors"
                  title="复制CSS到剪贴板"
                >
                  <Download size={11} /> CSS
                </button>
              </div>
            </Section>
          </>
        )}

        {/* Multi-select panel */}
        {selected.length > 1 && (
          <>
            <Section title="批量编辑">
              {selected.every(s => s.type === 'line' || s.type === 'arrow') ? (
                <ColorPicker label="线条颜色" value={selected[0].stroke} onChange={v => update({ stroke: v })} />
              ) : (
                <>
                  <ColorPicker label="填充" value={selected[0].fill} onChange={v => update({ fill: v })} />
                  <ColorPicker label="描边" value={selected[0].stroke} onChange={v => update({ stroke: v })} />
                </>
              )}
              <NumInput label="不透明度" value={Math.round(selected[0].opacity * 100)} onChange={v => update({ opacity: v / 100 })} suffix="%" min={0} max={100} />
            </Section>

            <Section title="对齐">
              <div className="grid grid-cols-6 gap-1">
                <IconBtn icon={<AlignLeft size={14} />} label="左对齐" onClick={() => { pushHistory(); alignShapes(selectedIds, 'left'); }} />
                <IconBtn icon={<AlignCenterHorizontal size={14} />} label="水平居中" onClick={() => { pushHistory(); alignShapes(selectedIds, 'centerH'); }} />
                <IconBtn icon={<AlignRight size={14} />} label="右对齐" onClick={() => { pushHistory(); alignShapes(selectedIds, 'right'); }} />
                <IconBtn icon={<AlignStartVertical size={14} />} label="顶对齐" onClick={() => { pushHistory(); alignShapes(selectedIds, 'top'); }} />
                <IconBtn icon={<AlignCenterVertical size={14} />} label="垂直居中" onClick={() => { pushHistory(); alignShapes(selectedIds, 'centerV'); }} />
                <IconBtn icon={<AlignEndVertical size={14} />} label="底对齐" onClick={() => { pushHistory(); alignShapes(selectedIds, 'bottom'); }} />
              </div>
              {selected.length >= 3 && (
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <button
                    onClick={() => { pushHistory(); alignShapes(selectedIds, 'distributeH'); }}
                    title="水平均布"
                    className="flex items-center justify-center gap-1 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded transition-colors"
                  >
                    <AlignHorizontalSpaceBetween size={13} /> 水平均布
                  </button>
                  <button
                    onClick={() => { pushHistory(); alignShapes(selectedIds, 'distributeV'); }}
                    title="垂直均布"
                    className="flex items-center justify-center gap-1 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded transition-colors"
                  >
                    <AlignVerticalSpaceBetween size={13} /> 垂直均布
                  </button>
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
