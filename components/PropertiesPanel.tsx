'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { Shape, Shadow, Gradient, Fill, AutoLayout, DEFAULT_AUTO_LAYOUT } from '@/lib/types';
import {
  ArrowUp, ArrowDown, Trash2, Copy, Move, Plus,
  AlignLeft, AlignCenterHorizontal, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  FlipHorizontal, FlipVertical,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween,
  ArrowRightLeft, ArrowUpDown, LayoutGrid,
} from 'lucide-react';
import { useCallback, useRef } from 'react';
import ColorPicker from './ColorPicker';

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
                  title="水平翻转"
                  aria-label="水平翻转"
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${single.scaleX === -1 ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}`}
                >
                  <FlipHorizontal size={13} /> H
                </button>
                <button
                  onClick={() => update({ scaleY: single.scaleY === -1 ? 1 : -1 })}
                  title="垂直翻转"
                  aria-label="垂直翻转"
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${single.scaleY === -1 ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'}`}
                >
                  <FlipVertical size={13} /> V
                </button>
              </div>
            </Section>

            {/* Size — frame/rect/image/component */}
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
                    <input
                      type="checkbox"
                      checked={single.clipContent !== false}
                      onChange={e => update({ clipContent: e.target.checked })}
                      className="accent-[var(--accent)]"
                    />
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

            {(single.type === 'line' || single.type === 'arrow') && (
              <Section title="线条">
                <NumInput label="粗细" value={single.strokeWidth || 2} onChange={v => update({ strokeWidth: v })} suffix="px" min={1} max={50} />
              </Section>
            )}

            {isPath && (
              <Section title="路径">
                <NumInput label="描边粗细" value={single.strokeWidth || 2} onChange={v => update({ strokeWidth: v })} suffix="px" min={1} max={50} />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={single.closePath || false}
                    onChange={e => update({ closePath: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-[11px] text-[var(--text-secondary)]">闭合路径</span>
                </div>
              </Section>
            )}

            {/* Auto Layout — frame only */}
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
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors resize-none"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <NumInput label="字号" value={single.fontSize || 24} onChange={v => update({ fontSize: v })} suffix="px" min={8} max={200} />
                  {single.width && <NumInput label="宽度" value={Math.round(single.width)} onChange={v => update({ width: v })} suffix="px" min={10} />}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">字重</label>
                  <select
                    value={single.fontWeight || 'normal'}
                    onChange={e => update({ fontWeight: e.target.value })}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  >
                    <option value="normal">Regular</option>
                    <option value="bold">Bold</option>
                    <option value="300">Light (300)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">SemiBold (600)</option>
                    <option value="700">Bold (700)</option>
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
                <button
                  onClick={addFill}
                  className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                >
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
              <button
                onClick={addShadow}
                className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
              >
                <Plus size={11} /> 添加阴影
              </button>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">{title}</h3>
      {children}
    </div>
  );
}
