'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { getEditorEngine, syncEditorFromStore } from '@/hooks/useEditor';
import { Shape, Shadow, Gradient, Fill, Stroke, AutoLayout, Interaction, TextSizing, BlendMode, BlurEffect, LayoutGrid as LayoutGridType, DEFAULT_AUTO_LAYOUT, DesignToken, DesignTheme, TokenBindings, ConstraintAxis, OverlayConfig, ComponentStateType } from '@/lib/types';
import {
  ArrowUp, ArrowDown, Trash2, Copy, Move, Plus, Eye, EyeOff,
  AlignLeft, AlignCenterHorizontal, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween,
  ArrowRightLeft, ArrowUpDown, LayoutGrid,
  Component, Unlink, Zap, Link,
  Download, Combine, Minus, Layers, X,
  FlipHorizontal, FlipVertical,
} from 'lucide-react';
import { useCallback, useRef, useState, useEffect } from 'react';
import { canDoBoolean } from '@/lib/boolean';
import { canBeMaskSource } from '@/lib/maskUtils';
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

function TokenPicker({ property, currentTokenId, onSelect, onClose }: {
  property: keyof TokenBindings;
  currentTokenId?: string;
  onSelect: (tokenId: string) => void;
  onClose: () => void;
}) {
  const { themes, activeThemeId } = useEditorStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const activeTheme = themes.find(t => t.id === activeThemeId);
  if (!activeTheme) return null;

  // Filter tokens by property type
  const categoryMap: Record<keyof TokenBindings, DesignToken['category'][]> = {
    fill: ['color'],
    stroke: ['color'],
    opacity: ['spacing'],
    cornerRadius: ['borderRadius'],
    fontSize: ['fontSize'],
  };
  const categories = categoryMap[property] || ['color'];
  const tokens = activeTheme.tokens.filter(t => categories.includes(t.category));

  return (
    <div ref={ref} className="absolute left-0 top-full mt-1 z-50 w-48 p-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/40 animate-scale-in">
      <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">绑定 Token</div>
      {tokens.length === 0 ? (
        <div className="text-[10px] text-[var(--text-tertiary)] py-2 text-center">无可用 Token</div>
      ) : (
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {tokens.map(token => (
            <button
              key={token.id}
              onClick={() => { onSelect(token.id); onClose(); }}
              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors ${
                currentTokenId === token.id
                  ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              {token.category === 'color' && (
                <div className="w-4 h-4 rounded border border-[var(--border)]" style={{ backgroundColor: token.value }} />
              )}
              <span className="flex-1 text-left truncate">{token.name}</span>
              <span className="text-[9px] text-[var(--text-tertiary)] font-mono">{token.value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TokenBoundIndicator({ tokenName, tokenValue, onUnbind }: {
  tokenId: string;
  tokenName: string;
  tokenValue: string;
  onUnbind: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/20">
      <div className="w-4 h-4 rounded border border-[var(--border)]" style={{ backgroundColor: tokenValue }} />
      <span className="flex-1 text-[10px] text-[var(--accent)] truncate">{tokenName}</span>
      <button
        onClick={onUnbind}
        className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors"
        title="取消绑定"
        aria-label="取消绑定"
      >
        <Unlink size={10} />
      </button>
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

// Editor for component state overrides (hover/active/pressed/focused/disabled)
function StateOverridesEditor({ shape }: { shape: Shape }) {
  const { updateShape } = useEditorStore();
  const overrides = shape.stateOverrides || {};

  const STATE_OPTIONS: { key: 'hover' | 'active' | 'pressed' | 'focused' | 'disabled'; label: string; color: string }[] = [
    { key: 'hover', label: '悬停 (Hover)', color: 'bg-blue-500' },
    { key: 'active', label: '激活 (Active)', color: 'bg-green-500' },
    { key: 'pressed', label: '按下 (Pressed)', color: 'bg-orange-500' },
    { key: 'focused', label: '聚焦 (Focused)', color: 'bg-purple-500' },
    { key: 'disabled', label: '禁用 (Disabled)', color: 'bg-gray-500' },
  ];

  const handleOverrideChange = (stateKey: string, property: string, value: unknown) => {
    const newOverrides = {
      ...overrides,
      [stateKey]: {
        ...(overrides[stateKey as keyof typeof overrides] || {}),
        [property]: value,
      },
    };
    updateShape(shape.id, { stateOverrides: newOverrides });
  };

  const handleRemoveOverride = (stateKey: string, property: string) => {
    const stateObj = { ...(overrides[stateKey as keyof typeof overrides] || {}) };
    delete (stateObj as Record<string, unknown>)[property];
    const newOverrides = { ...overrides };
    if (Object.keys(stateObj).length === 0) {
      delete newOverrides[stateKey as keyof typeof newOverrides];
    } else {
      newOverrides[stateKey as keyof typeof newOverrides] = stateObj;
    }
    updateShape(shape.id, { stateOverrides: newOverrides });
  };

  return (
    <Section title="状态覆盖">
      <p className="text-[9px] text-[var(--text-tertiary)] mb-2">
        为组件的各状态定义属性覆盖。在原型预览中，交互会自动触发状态切换。
      </p>
      {STATE_OPTIONS.map(({ key, label, color }) => {
        const stateOverrides = overrides[key] || {};
        const hasOverrides = Object.keys(stateOverrides).length > 0;
        return (
          <details key={key} className="mb-1 rounded border border-[var(--border)] overflow-hidden">
            <summary className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors ${hasOverrides ? 'bg-[var(--bg-elevated)]' : ''}`}>
              <div className={`w-2 h-2 rounded-full ${color} opacity-70`} />
              <span className="text-[11px] text-[var(--text-primary)] flex-1">{label}</span>
              {hasOverrides && (
                <span className="text-[9px] text-[var(--text-tertiary)]">
                  {Object.keys(stateOverrides).length} 个覆盖
                </span>
              )}
            </summary>
            <div className="px-2 pb-2 space-y-1.5">
              {/* Fill override */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[var(--text-tertiary)] w-12">填充</span>
                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="color"
                    value={stateOverrides.fill || '#000000'}
                    onChange={e => handleOverrideChange(key, 'fill', e.target.value)}
                    className="w-6 h-6 rounded border border-[var(--border)] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={stateOverrides.fill || ''}
                    onChange={e => handleOverrideChange(key, 'fill', e.target.value)}
                    placeholder="无"
                    className="flex-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-1 py-0.5 text-[10px] text-[var(--text-primary)] outline-none font-mono"
                  />
                  {stateOverrides.fill && (
                    <button onClick={() => handleRemoveOverride(key, 'fill')} className="text-[var(--text-tertiary)] hover:text-[var(--danger)]">
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
              {/* Opacity override */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[var(--text-tertiary)] w-12">不透明度</span>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={stateOverrides.opacity ?? 1}
                  onChange={e => handleOverrideChange(key, 'opacity', parseFloat(e.target.value))}
                  className="flex-1 accent-[var(--accent)]"
                />
                <span className="text-[10px] text-[var(--text-tertiary)] w-8 text-right font-mono">
                  {Math.round((stateOverrides.opacity ?? 1) * 100)}%
                </span>
                {stateOverrides.opacity !== undefined && (
                  <button onClick={() => handleRemoveOverride(key, 'opacity')} className="text-[var(--text-tertiary)] hover:text-[var(--danger)]">
                    <X size={10} />
                  </button>
                )}
              </div>
              {/* ScaleX override */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[var(--text-tertiary)] w-12">缩放 X</span>
                <input
                  type="number" min={0.1} max={3} step={0.05}
                  value={stateOverrides.scaleX ?? 1}
                  onChange={e => handleOverrideChange(key, 'scaleX', parseFloat(e.target.value))}
                  className="flex-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-1 py-0.5 text-[10px] text-[var(--text-primary)] outline-none font-mono"
                />
                {stateOverrides.scaleX !== undefined && (
                  <button onClick={() => handleRemoveOverride(key, 'scaleX')} className="text-[var(--text-tertiary)] hover:text-[var(--danger)]">
                    <X size={10} />
                  </button>
                )}
              </div>
              {/* ScaleY override */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[var(--text-tertiary)] w-12">缩放 Y</span>
                <input
                  type="number" min={0.1} max={3} step={0.05}
                  value={stateOverrides.scaleY ?? 1}
                  onChange={e => handleOverrideChange(key, 'scaleY', parseFloat(e.target.value))}
                  className="flex-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-1 py-0.5 text-[10px] text-[var(--text-primary)] outline-none font-mono"
                />
                {stateOverrides.scaleY !== undefined && (
                  <button onClick={() => handleRemoveOverride(key, 'scaleY')} className="text-[var(--text-tertiary)] hover:text-[var(--danger)]">
                    <X size={10} />
                  </button>
                )}
              </div>
              {/* Text override */}
              {(shape.type === 'text' || shape.type === 'frame') && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[var(--text-tertiary)] w-12">文本</span>
                  <input
                    type="text"
                    value={stateOverrides.text || ''}
                    onChange={e => handleOverrideChange(key, 'text', e.target.value)}
                    placeholder="无"
                    className="flex-1 bg-[var(--bg-deep)] border border-[var(--border)] rounded px-1 py-0.5 text-[10px] text-[var(--text-primary)] outline-none"
                  />
                  {stateOverrides.text && (
                    <button onClick={() => handleRemoveOverride(key, 'text')} className="text-[var(--text-tertiary)] hover:text-[var(--danger)]">
                      <X size={10} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </details>
        );
      })}
      {Object.keys(overrides).length === 0 && (
        <p className="text-[10px] text-[var(--text-tertiary)] italic">暂无状态覆盖</p>
      )}
    </Section>
  );
}

function InteractionEditor({ shape }: { shape: Shape }) {
  const { addInteraction, removeInteraction, updateInteraction, pages } = useEditorStore();
  const interactions = shape.interactions || [];
  const allFrames = pages.flatMap(p => p.shapes.filter(s => (s.type === 'frame' || s.type === 'group') && !s.parentId));

  const handleAdd = () => {
    addInteraction(shape.id, {
      trigger: 'click',
      action: 'navigateTo',
      transition: 'dissolve',
      duration: 300,
      easing: 'easeInOut',
    });
  };

  const TRIGGERS: { value: Interaction['trigger']; label: string }[] = [
    { value: 'click', label: '点击 (Click)' },
    { value: 'hover', label: '悬停 (Hover)' },
    { value: 'drag', label: '拖拽 (Drag)' },
    { value: 'whileDragging', label: '拖拽中 (While Dragging)' },
    { value: 'afterDelay', label: '延迟后 (After Delay)' },
    { value: 'mouseDown', label: '鼠标按下 (Mouse Down)' },
    { value: 'mouseUp', label: '鼠标释放 (Mouse Up)' },
    { value: 'mouseEnter', label: '鼠标进入 (Mouse Enter)' },
    { value: 'mouseLeave', label: '鼠标离开 (Mouse Leave)' },
    { value: 'onFocus', label: '获得焦点 (On Focus)' },
    { value: 'onBlur', label: '失去焦点 (On Blur)' },
  ];

  const ACTIONS: { value: Interaction['action']; label: string }[] = [
    { value: 'navigateTo', label: '跳转画框' },
    { value: 'back', label: '返回' },
    { value: 'openUrl', label: '打开链接' },
    { value: 'scrollTo', label: '滚动到' },
    { value: 'setOverlay', label: '打开 Overlay' },
    { value: 'closeOverlay', label: '关闭 Overlay' },
    { value: 'swap', label: '交换画框' },
    { value: 'stateChange', label: '切换状态' },
    { value: 'setVariable', label: '设置变量' },
    { value: 'none', label: '无' },
  ];

  const TRANSITIONS: { value: Interaction['transition']; label: string }[] = [
    { value: 'instant', label: '立即' },
    { value: 'dissolve', label: '渐变' },
    { value: 'slideLeft', label: '左滑' },
    { value: 'slideRight', label: '右滑' },
    { value: 'slideUp', label: '上滑' },
    { value: 'slideDown', label: '下滑' },
    { value: 'scale', label: '缩放' },
    { value: 'smartAnimate', label: '智能动画' },
  ];

  const EASINGS: { value: Interaction['easing']; label: string }[] = [
    { value: 'ease', label: '缓动 (Ease)' },
    { value: 'linear', label: '线性 (Linear)' },
    { value: 'easeIn', label: '缓入 (Ease In)' },
    { value: 'easeOut', label: '缓出 (Ease Out)' },
    { value: 'easeInOut', label: '缓入缓出 (Ease In Out)' },
    { value: 'easeInQuad', label: '二次方缓入' },
    { value: 'easeOutQuad', label: '二次方缓出' },
    { value: 'easeInOutQuad', label: '二次方缓入缓出' },
    { value: 'easeInCubic', label: '三次方缓入' },
    { value: 'easeOutCubic', label: '三次方缓出' },
    { value: 'easeInOutCubic', label: '三次方缓入缓出' },
    { value: 'easeInQuart', label: '四次方缓入' },
    { value: 'easeOutQuart', label: '四次方缓出' },
    { value: 'easeInOutQuart', label: '四次方缓入缓出' },
    { value: 'easeInExpo', label: '指数缓入' },
    { value: 'easeOutExpo', label: '指数缓出' },
    { value: 'easeInOutExpo', label: '指数缓入缓出' },
    { value: 'easeInBack', label: '回弹缓入' },
    { value: 'easeOutBack', label: '回弹缓出' },
    { value: 'easeInOutBack', label: '回弹缓入缓出' },
    { value: 'spring', label: '弹簧' },
    { value: 'bounce', label: '弹跳' },
  ];

  const OVERLAY_ANCHORS: { value: OverlayConfig['anchor']; label: string }[] = [
    { value: 'TOP_LEFT', label: '左上' },
    { value: 'TOP_CENTER', label: '顶部居中' },
    { value: 'TOP_RIGHT', label: '右上' },
    { value: 'CENTER_LEFT', label: '左侧居中' },
    { value: 'CENTER', label: '居中' },
    { value: 'CENTER_RIGHT', label: '右侧居中' },
    { value: 'BOTTOM_LEFT', label: '左下' },
    { value: 'BOTTOM_CENTER', label: '底部居中' },
    { value: 'BOTTOM_RIGHT', label: '右下' },
  ];

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
          {/* Trigger */}
          <div>
            <label className="text-[9px] text-[var(--text-tertiary)]">触发</label>
            <select
              value={int.trigger}
              onChange={e => updateInteraction(shape.id, idx, { trigger: e.target.value as Interaction['trigger'] })}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)]"
              title="触发方式"
            >
              {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {/* Delay for afterDelay trigger */}
          {int.trigger === 'afterDelay' && (
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">延迟 (ms)</label>
              <input
                type="number" value={int.delay || 500} min={0} max={10000} step={100}
                onChange={e => updateInteraction(shape.id, idx, { delay: parseInt(e.target.value) || 0 })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] font-mono outline-none"
              />
            </div>
          )}
          {/* Action */}
          <div>
            <label className="text-[9px] text-[var(--text-tertiary)]">动作</label>
            <select
              value={int.action}
              onChange={e => updateInteraction(shape.id, idx, { action: e.target.value as Interaction['action'] })}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)]"
              title="动作类型"
            >
              {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          {/* Target frame for navigateTo/scrollTo/swap */}
          {(int.action === 'navigateTo' || int.action === 'scrollTo' || int.action === 'swap') && (
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
          {/* stateChange action — select target state */}
          {int.action === 'stateChange' && (
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">目标状态</label>
              <select
                value={int.targetState || 'default'}
                onChange={e => updateInteraction(shape.id, idx, { targetState: e.target.value as ComponentStateType })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)]"
              >
                <option value="default">默认 (Default)</option>
                <option value="hover">悬停 (Hover)</option>
                <option value="active">激活 (Active)</option>
                <option value="pressed">按下 (Pressed)</option>
                <option value="focused">聚焦 (Focused)</option>
                <option value="disabled">禁用 (Disabled)</option>
              </select>
            </div>
          )}
          {/* setVariable action — select variable and value */}
          {int.action === 'setVariable' && (
            <div className="space-y-1 p-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
              <div>
                <label className="text-[9px] text-[var(--text-tertiary)]">变量</label>
                <select
                  value={int.variableId || ''}
                  onChange={e => updateInteraction(shape.id, idx, { variableId: e.target.value })}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] outline-none"
                >
                  <option value="">选择变量...</option>
                  {useEditorStore.getState().variables.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                  ))}
                </select>
              </div>
              {int.variableId && (() => {
                const variable = useEditorStore.getState().variables.find(v => v.id === int.variableId);
                if (!variable) return null;
                if (variable.type === 'boolean') {
                  return (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`bool-${idx}`}
                        checked={int.variableValue === true || int.variableValue === 'true'}
                        onChange={e => updateInteraction(shape.id, idx, { variableValue: e.target.checked })}
                        className="accent-[var(--accent)]"
                      />
                      <label htmlFor={`bool-${idx}`} className="text-[9px] text-[var(--text-tertiary)]">设为 true</label>
                    </div>
                  );
                }
                return (
                  <div>
                    <label className="text-[9px] text-[var(--text-tertiary)]">值</label>
                    <input
                      type={variable.type === 'number' ? 'number' : 'text'}
                      value={String(int.variableValue ?? variable.defaultValue ?? '')}
                      onChange={e => updateInteraction(shape.id, idx, {
                        variableValue: variable.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                      })}
                      className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] outline-none font-mono"
                    />
                  </div>
                );
              })()}
            </div>
          )}
          {/* URL for openUrl */}
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
          {/* Overlay config for setOverlay action */}
          {int.action === 'setOverlay' && (
            <div className="space-y-1 p-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
              <div>
                <label className="text-[9px] text-[var(--text-tertiary)]">Overlay 画框</label>
                <select
                  value={int.overlay?.targetFrameId || ''}
                  onChange={e => updateInteraction(shape.id, idx, { overlay: { ...int.overlay, targetFrameId: e.target.value, anchor: int.overlay?.anchor || 'CENTER' } })}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] outline-none"
                >
                  <option value="">选择 Overlay...</option>
                  {allFrames.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-[var(--text-tertiary)]">锚点位置</label>
                <select
                  value={int.overlay?.anchor || 'CENTER'}
                  onChange={e => updateInteraction(shape.id, idx, { overlay: { ...int.overlay!, targetFrameId: int.overlay?.targetFrameId || '', anchor: e.target.value as OverlayConfig['anchor'] } })}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)] outline-none"
                >
                  {OVERLAY_ANCHORS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`modal-${idx}`}
                  checked={int.overlay?.modal ?? false}
                  onChange={e => updateInteraction(shape.id, idx, { overlay: { ...int.overlay!, targetFrameId: int.overlay?.targetFrameId || '', anchor: int.overlay?.anchor || 'CENTER', modal: e.target.checked } })}
                  className="accent-[var(--accent)]"
                />
                <label htmlFor={`modal-${idx}`} className="text-[9px] text-[var(--text-tertiary)]">模态 (点击背景关闭)</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`embed-${idx}`}
                  checked={int.overlay?.embedWithin ?? false}
                  onChange={e => updateInteraction(shape.id, idx, { overlay: { ...int.overlay!, targetFrameId: int.overlay?.targetFrameId || '', anchor: int.overlay?.anchor || 'CENTER', modal: int.overlay?.modal ?? false, embedWithin: e.target.checked } })}
                  className="accent-[var(--accent)]"
                />
                <label htmlFor={`embed-${idx}`} className="text-[9px] text-[var(--text-tertiary)]">嵌入父级</label>
              </div>
            </div>
          )}
          {/* Transition & Easing */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] text-[var(--text-tertiary)]">过渡</label>
              <select
                value={int.transition || 'dissolve'}
                onChange={e => updateInteraction(shape.id, idx, { transition: e.target.value as Interaction['transition'] })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)]"
                title="过渡效果"
              >
                {TRANSITIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
          {/* Easing */}
          <div>
            <label className="text-[9px] text-[var(--text-tertiary)]">缓动曲线</label>
            <select
              value={int.easing || 'easeInOut'}
              onChange={e => updateInteraction(shape.id, idx, { easing: e.target.value as Interaction['easing'] })}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] text-[var(--text-primary)]"
              title="缓动曲线"
            >
              {EASINGS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
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

function ContainerSummary({ shape }: { shape: Shape }) {
  const { shapes, setSelectedIds } = useEditorStore();

  // Count direct children of this container
  const directChildren = shapes.filter(s => s.parentId === shape.id);
  const childCount = directChildren.length;

  // Type breakdown
  const typeBreakdown = directChildren.reduce<Record<string, number>>((acc, child) => {
    acc[child.type] = (acc[child.type] || 0) + 1;
    return acc;
  }, {});

  const typeLabels: Record<string, string> = {
    rect: '矩形',
    circle: '圆形',
    text: '文字',
    line: '线条',
    arrow: '箭头',
    image: '图片',
    star: '星形',
    triangle: '三角形',
    frame: '画框',
    group: '编组',
    component: '组件',
    path: '路径',
  };

  const typeIcons: Record<string, string> = {
    rect: '▭',
    circle: '◯',
    text: 'T',
    line: '╱',
    arrow: '→',
    image: '🖼',
    star: '★',
    triangle: '△',
    frame: '□',
    group: '⊞',
    component: '◈',
    path: '⌒',
  };

  if (childCount === 0) {
    return (
      <Section title="容器概览">
        <div className="flex items-center justify-center py-3 px-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
          <span className="text-[11px] text-[var(--text-tertiary)]">暂无子元素</span>
        </div>
      </Section>
    );
  }

  return (
    <Section title="容器概览">
      {/* Summary row */}
      <div className="flex items-center gap-2 px-2 py-2 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">{childCount}</span>
            <span className="text-[10px] text-[var(--text-tertiary)]">个子元素</span>
          </div>
        </div>
        <button
          onClick={() => setSelectedIds(directChildren.map(c => c.id))}
          className="px-2 py-1 text-[10px] rounded bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors border border-[var(--accent)]/20"
          title="选中所有子元素"
        >
          全选
        </button>
      </div>

      {/* Type breakdown */}
      <div className="space-y-1">
        <span className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">类型分布</span>
        <div className="grid grid-cols-2 gap-0.5">
          {Object.entries(typeBreakdown).map(([type, count]) => (
            <div key={type} className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-deep)]">
              <span className="text-[10px] text-[var(--text-tertiary)] w-4 text-center">
                {typeIcons[type] || '•'}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)] flex-1 truncate">
                {typeLabels[type] || type}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono">×{count}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ─── Corner Radius Editor ─────────────────────────────────────────────────────
interface CornerRadiusEditorProps {
  shape: Shape;
  onUpdate: (updates: Partial<Shape>) => void;
  themes: DesignTheme[];
  activeThemeId: string;
  onUnbindToken: (shapeId: string, property: keyof TokenBindings) => void;
  onBindToken: (shapeId: string, property: keyof TokenBindings, tokenId: string) => void;
  tokenPickerFor: keyof TokenBindings | null;
  onTokenPickerForChange: (v: keyof TokenBindings | null) => void;
}

function CornerRadiusEditor({ shape, onUpdate, themes, activeThemeId, onUnbindToken, onBindToken, tokenPickerFor, onTokenPickerForChange }: CornerRadiusEditorProps) {
  const crBinding = shape.tokenBindings?.cornerRadius;
  const boundToken = crBinding ? (themes.find(t => t.id === activeThemeId)?.tokens.find((tok: DesignToken) => tok.id === crBinding) ?? null) : null;
  const cr = shape.cornerRadius ?? 0;
  const isArray = Array.isArray(cr);
  const [crMode, setCrMode] = useState<'single' | 'four'>(isArray ? 'four' : 'single');

  return (
    <div className="relative">
      {boundToken ? (
        <TokenBoundIndicator
          tokenId={crBinding ?? ''}
          tokenName={String(boundToken.name ?? '')}
          tokenValue={boundToken.value ?? ''}
          onUnbind={() => onUnbindToken(shape.id, 'cornerRadius')}
        />
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-tertiary)] flex-1">圆角</span>
            <button
              onClick={() => {
                if (crMode === 'single') {
                  const v = typeof cr === 'number' ? cr : 0;
                  setCrMode('four');
                  onUpdate({ cornerRadius: [v, v, v, v] as [number, number, number, number] });
                } else {
                  const arr = Array.isArray(cr) ? cr : [0, 0, 0, 0];
                  setCrMode('single');
                  onUpdate({ cornerRadius: arr[0] });
                }
              }}
              className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
              title={crMode === 'single' ? '切换为独立圆角' : '切换为统一圆角'}
            >
              {crMode === 'single' ? '⚏ 独立' : '☐ 统一'}
            </button>
          </div>
          {crMode === 'single' ? (
            <div className="relative">
              <NumInput
                label=""
                value={typeof cr === 'number' ? cr : 0}
                onChange={v => onUpdate({ cornerRadius: v })}
                suffix="px" min={0} max={200}
              />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1">
              {(['tl', 'tr', 'br', 'bl'] as const).map((pos, idx) => {
                const val = Array.isArray(cr) ? (cr[idx] ?? 0) : 0;
                return (
                  <div key={pos} className="relative">
                    <input
                      type="number"
                      value={val}
                      min={0} max={200}
                      onChange={e => {
                        const arr = Array.isArray(cr) ? [...cr] : [0, 0, 0, 0];
                        arr[idx] = parseFloat(e.target.value) || 0;
                        onUpdate({ cornerRadius: arr as [number, number, number, number] });
                      }}
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1 py-1 text-[10px] text-[var(--text-primary)] font-mono focus:border-[var(--accent)] focus:outline-none text-center"
                      title={pos === 'tl' ? '左上' : pos === 'tr' ? '右上' : pos === 'br' ? '右下' : '左下'}
                    />
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-[var(--text-tertiary)] pointer-events-none">
                      {pos === 'tl' ? '↖' : pos === 'tr' ? '↗' : pos === 'br' ? '↘' : '↙'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => onTokenPickerForChange(tokenPickerFor === 'cornerRadius' ? null : 'cornerRadius')}
        className={`absolute right-0 top-0 p-1 rounded transition-colors ${crBinding ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--accent)]'}`}
        title={crBinding ? '取消绑定' : '绑定 Token'}
        aria-label={crBinding ? '取消绑定' : '绑定 Token'}
      >
        <Link size={12} />
      </button>
      {tokenPickerFor === 'cornerRadius' && (
        <div className="absolute left-0 top-full mt-1 z-50">
          <TokenPicker
            property="cornerRadius"
            currentTokenId={crBinding}
            onSelect={id => { onBindToken(shape.id, 'cornerRadius', id); onTokenPickerForChange(null); }}
            onClose={() => onTokenPickerForChange(null)}
          />
        </div>
      )}
    </div>
  );
}

function ComponentSection({ shape }: { shape: Shape }) {
  const { components, createComponent, createInstance, syncInstances, detachInstance, selectedIds } = useEditorStore();
  const [compName, setCompName] = useState('');

  const comp = shape.masterComponentId ? components.find(c => c.id === shape.masterComponentId) : null;
  const isMainComponent = shape.isMainComponent;
  const isInstance = !!shape.masterComponentId && !shape.isMainComponent;

  return (
    <Section title="组件">
      {/* Main Component indicator */}
      {isMainComponent && comp && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-2 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/20">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center">
              <Component size={16} className="text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider text-[var(--accent)] font-semibold bg-[var(--accent)]/20 px-1.5 py-0.5 rounded">主组件</span>
              </div>
              <p className="text-[12px] text-[var(--accent)] font-medium truncate mt-0.5">{comp.name}</p>
            </div>
          </div>
          <button
            onClick={() => syncInstances(comp.id)}
            className="w-full py-1.5 text-[11px] rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors border border-[var(--border)] flex items-center justify-center gap-1.5"
            title="同步所有实例到此主组件"
          >
            <Component size={12} /> 同步所有实例
          </button>
        </div>
      )}

      {/* Instance indicator */}
      {isInstance && comp && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-2 rounded bg-purple-500/10 border border-purple-500/20">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Link size={16} className="text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider text-purple-400 font-semibold bg-purple-500/20 px-1.5 py-0.5 rounded">实例</span>
              </div>
              <p className="text-[12px] text-purple-400 font-medium truncate mt-0.5">{comp.name}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => detachInstance(shape.id)}
              className="flex-1 py-1.5 text-[11px] rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-purple-400 hover:bg-purple-500/10 transition-colors border border-[var(--border)] flex items-center justify-center gap-1.5"
              title="分离实例（断开与主组件的链接）"
            >
              <Unlink size={12} /> 分离实例
            </button>
          </div>
          <p className="text-[9px] text-[var(--text-tertiary)] italic px-1">
            分离后将作为独立图形，不再响应主组件更新
          </p>
        </div>
      )}

      {/* Create component UI */}
      {!shape.masterComponentId && shape.type === 'frame' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              value={compName}
              onChange={e => setCompName(e.target.value)}
              placeholder="输入组件名称..."
              className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[10px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] min-w-0"
            />
            <button
              onClick={() => {
                if (!compName.trim()) return;
                createComponent(selectedIds, compName.trim());
                setCompName('');
              }}
              disabled={!compName.trim()}
              className="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-[10px] disabled:opacity-30 hover:opacity-90 transition-opacity flex items-center gap-1"
              title="创建组件"
            >
              <Component size={11} /> 创建
            </button>
          </div>
        </div>
      )}

      {/* Insert instance */}
      {components.length > 0 && !shape.masterComponentId && (
        <div className="space-y-1 pt-1">
          <span className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">插入实例</span>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {components.map(c => (
              <button
                key={c.id}
                onClick={() => createInstance(c.id, shape.x + (shape.width || 100) + 20, shape.y)}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[10px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors border border-transparent hover:border-[var(--border)]"
              >
                <Component size={11} className="text-[var(--accent)] flex-shrink-0" />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-[9px] text-[var(--text-tertiary)]">+实例</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

export default function PropertiesPanel() {
  const { shapes, selectedIds, updateShape, updateShapes, deleteShapes, duplicateShapes, bringForward, sendBackward, pushHistory, alignShapes, applyAutoLayout, applyBooleanOperation, addTextStyle, textStyles, applyTextStyle, bindToken, unbindToken, themes, activeThemeId } = useEditorStore();

  const selected = shapes.filter(s => selectedIds.includes(s.id));
  const single = selected.length === 1 ? selected[0] : null;
  const isLine = single?.type === 'line' || single?.type === 'arrow';
  const isFrame = single?.type === 'frame' || single?.type === 'group';
  const isPath = single?.type === 'path';

  const [tokenPickerFor, setTokenPickerFor] = useState<keyof TokenBindings | null>(null);

  const update = useCallback((u: Partial<Shape>) => {
    updateShapes(selectedIds, u);
  }, [selectedIds, updateShapes]);

  const updateShadow = useCallback((idx: number, patch: Partial<Shadow>) => {
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const shadows = [...(shape.shadows || (shape.shadow ? [shape.shadow] : []))];
      if (shadows[idx]) {
        shadows[idx] = { ...shadows[idx], ...patch };
        updateShape(id, { shadows, shadow: shadows[0] });
      }
    });
  }, [selectedIds, shapes, updateShape]);

  const addShadow = useCallback(() => {
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const shadows = [...(shape.shadows || (shape.shadow ? [shape.shadow] : []))];
      shadows.push({ color: '#00000040', blur: 10, offsetX: 4, offsetY: 4 });
      updateShape(id, { shadows, shadow: shadows[0] });
    });
  }, [selectedIds, shapes, updateShape]);

  const removeShadow = useCallback((idx: number) => {
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const shadows = [...(shape.shadows || (shape.shadow ? [shape.shadow] : []))];
      shadows.splice(idx, 1);
      updateShape(id, { shadows, shadow: shadows[0] || undefined });
    });
  }, [selectedIds, shapes, updateShape]);

  const addFill = useCallback(() => {
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const fills = [...(shape.fills || [{ type: 'solid' as const, color: shape.fill }])];
      fills.push({ type: 'solid', color: '#D4A853' });
      updateShape(id, { fills });
    });
  }, [selectedIds, shapes, updateShape]);

  const updateFill = useCallback((idx: number, patch: Partial<Fill>) => {
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const fills = [...(shape.fills || [{ type: 'solid' as const, color: shape.fill }])];
      if (fills[idx]) {
        fills[idx] = { ...fills[idx], ...patch };
        updateShape(id, { fills, fill: fills[0]?.color || shape.fill });
      }
    });
  }, [selectedIds, shapes, updateShape]);

  const removeFill = useCallback((idx: number) => {
    selectedIds.forEach(id => {
      const shape = shapes.find(s => s.id === id);
      if (!shape) return;
      const fills = [...(shape.fills || [{ type: 'solid' as const, color: shape.fill }])];
      fills.splice(idx, 1);
      updateShape(id, { fills, fill: fills[0]?.color || 'transparent' });
    });
  }, [selectedIds, shapes, updateShape]);

  const updateGradient = useCallback((g: Gradient | undefined) => {
    selectedIds.forEach(id => updateShape(id, { gradient: g }));
  }, [selectedIds, updateShape]);

  const updateAutoLayout = useCallback((patch: Partial<AutoLayout>) => {
    if (!selectedIds[0]) return;
    const currentShape = shapes.find(s => s.id === selectedIds[0]);
    if (!currentShape) return;
    const current = currentShape.autoLayout || DEFAULT_AUTO_LAYOUT;
    updateShape(currentShape.id, { autoLayout: { ...current, ...patch } });
    setTimeout(() => applyAutoLayout(currentShape.id), 0);
  }, [selectedIds, shapes, updateShape, applyAutoLayout]);

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

            {/* Container summary — only for frames/groups */}
            {isFrame && (
              <ContainerSummary shape={single} />
            )}

            {/* State overrides section — only for components/instances */}
            {(single.type === 'component' || single.masterComponentId) && (
              <StateOverridesEditor shape={single} />
            )}

            {/* Position */}
            <Section title="位置与变换">
              <div className="grid grid-cols-2 gap-2">
                <NumInput label="X" value={Math.round(single.x)} onChange={v => update({ x: v })} suffix="px" />
                <NumInput label="Y" value={Math.round(single.y)} onChange={v => update({ y: v })} suffix="px" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumInput label="旋转" value={Math.round(single.rotation)} onChange={v => update({ rotation: v })} suffix="°" min={-360} max={360} />
                {(() => {
                  const opacityBinding = single.tokenBindings?.opacity;
                  const boundToken = opacityBinding ? (themes.find(t => t.id === activeThemeId)?.tokens.find(tok => tok.id === opacityBinding) ?? null) : null;
                  return (
                    <div className="relative">
                      {boundToken ? (
                        <TokenBoundIndicator
                          tokenId={opacityBinding ?? ''}
                          tokenName={String(boundToken.name ?? '')}
                          tokenValue={boundToken.value ?? ''}
                          onUnbind={() => unbindToken(single.id, 'opacity')}
                        />
                      ) : (
                        <NumInput label="不透明度" value={Math.round(single.opacity * 100)} onChange={v => update({ opacity: v / 100 })} suffix="%" min={0} max={100} />
                      )}
                      <button
                        onClick={() => setTokenPickerFor(tokenPickerFor === 'opacity' ? null : 'opacity')}
                        className={`absolute right-0 top-3 -translate-y-1/2 p-1 rounded transition-colors ${opacityBinding ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--accent)]'}`}
                        title={opacityBinding ? '取消绑定' : '绑定 Token'}
                        aria-label={opacityBinding ? '取消绑定' : '绑定 Token'}
                      >
                        <Link size={12} />
                      </button>
                      {tokenPickerFor === 'opacity' && (
                        <div className="absolute left-0 top-full mt-1 z-50">
                          <TokenPicker
                            property="opacity"
                            currentTokenId={opacityBinding}
                            onSelect={id => { bindToken(single.id, 'opacity', id); setTokenPickerFor(null); }}
                            onClose={() => setTokenPickerFor(null)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                  <CornerRadiusEditor
                    shape={single}
                    onUpdate={update}
                    themes={themes}
                    activeThemeId={activeThemeId}
                    onUnbindToken={unbindToken}
                    onBindToken={bindToken}
                    tokenPickerFor={tokenPickerFor}
                    onTokenPickerForChange={setTokenPickerFor}
                  />
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
                <div className="space-y-3">
                  {/* 3x3 constraint grid */}
                  <div className="space-y-1">
                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">对齐</div>
                    <div className="grid grid-cols-3 gap-1 w-20 mx-auto">
                      {([
                        ['top-left', 'top', 'min'],
                        ['top-center', 'top', 'center'],
                        ['top-right', 'top', 'max'],
                        ['left', 'min', 'center'],
                        ['center', 'min', 'center'],
                        ['right', 'max', 'center'],
                        ['bottom-left', 'bottom', 'min'],
                        ['bottom-center', 'bottom', 'center'],
                        ['bottom-right', 'bottom', 'max'],
                      ] as [string, ConstraintAxis, ConstraintAxis][]).map(([pos, v, h]) => (
                        <button
                          key={pos}
                          onClick={() => update({ constraints: { horizontal: h, vertical: v } })}
                          className={`w-6 h-6 rounded border text-[8px] flex items-center justify-center ${
                            (single.constraints?.horizontal || 'min') === h && (single.constraints?.vertical || 'min') === v
                              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                              : "bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)]"
                          }`}
                          title={pos}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Dropdown selects for constraints */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">水平</label>
                      <select
                        value={single.constraints?.horizontal || 'min'}
                        onChange={e => update({ constraints: { ...(single.constraints || { horizontal: 'min', vertical: 'min' }), horizontal: e.target.value as ConstraintAxis } })}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs"
                      >
                        <option value="min">左</option>
                        <option value="center">居中</option>
                        <option value="max">右</option>
                        <option value="stretch">拉伸</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-[var(--text-tertiary)] block mb-1">垂直</label>
                      <select
                        value={single.constraints?.vertical || 'min'}
                        onChange={e => update({ constraints: { ...(single.constraints || { horizontal: 'min', vertical: 'min' }), vertical: e.target.value as ConstraintAxis } })}
                        className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs"
                      >
                        <option value="min">上</option>
                        <option value="center">居中</option>
                        <option value="max">下</option>
                        <option value="stretch">拉伸</option>
                      </select>
                    </div>
                  </div>

                  {/* Min/Max Size */}
                  <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
                    <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">尺寸限制</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[var(--text-tertiary)] w-3">W</span>
                        <input
                          type="number"
                          value={single.minWidth || ''}
                          onChange={e => update({ minWidth: Number(e.target.value) || undefined })}
                          placeholder="最小"
                          className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[var(--text-tertiary)] w-3">W</span>
                        <input
                          type="number"
                          value={single.maxWidth || ''}
                          onChange={e => update({ maxWidth: Number(e.target.value) || undefined })}
                          placeholder="最大"
                          className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[var(--text-tertiary)] w-3">H</span>
                        <input
                          type="number"
                          value={single.minHeight || ''}
                          onChange={e => update({ minHeight: Number(e.target.value) || undefined })}
                          placeholder="最小"
                          className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[var(--text-tertiary)] w-3">H</span>
                        <input
                          type="number"
                          value={single.maxHeight || ''}
                          onChange={e => update({ maxHeight: Number(e.target.value) || undefined })}
                          placeholder="最大"
                          className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1 text-xs"
                        />
                      </div>
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
                    {single.autoLayout.direction === 'horizontal' && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-[var(--text-secondary)]">自动换行</span>
                        <button
                          onClick={() => updateAutoLayout({ wrap: !single.autoLayout!.wrap })}
                          className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${single.autoLayout.wrap ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                          aria-label="自动换行"
                        >
                          <div className={`w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${single.autoLayout.wrap ? 'translate-x-4' : ''}`} />
                        </button>
                      </div>
                    )}
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
                {/* Text Style Applied */}
                {textStyles.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">文本样式</label>
                      {single.textStyleId && (
                        <button
                          onClick={() => update({ textStyleId: undefined })}
                          className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors"
                          title="移除样式引用（保留当前属性）"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                    <select
                      value={textStyles.find(s => 
                        single.fontFamily === s.fontFamily &&
                        single.fontSize === s.fontSize &&
                        single.fontWeight === s.fontWeight &&
                        single.fill === s.fill
                      )?.id || ''}
                      onChange={e => {
                        if (e.target.value) {
                          applyTextStyle([single.id], e.target.value);
                        } else {
                          update({ textStyleId: undefined });
                        }
                      }}
                      className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    >
                      <option value="">无样式</option>
                      {textStyles.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {single.textStyleId && (
                      <div className="flex items-center gap-1 text-[9px] text-[var(--accent)]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: textStyles.find(s => s.id === single.textStyleId)?.fill }} />
                        已应用: {textStyles.find(s => s.id === single.textStyleId)?.name}
                      </div>
                    )}
                  </div>
                )}
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
                {/* Save as text style */}
                <button
                  onClick={() => {
                    const name = prompt('样式名称:');
                    if (name) {
                      addTextStyle({
                        name,
                        fontFamily: single.fontFamily || 'sans-serif',
                        fontSize: single.fontSize || 16,
                        fontWeight: single.fontWeight || 'normal',
                        fill: single.fill || '#E8E4DF',
                        lineHeight: single.lineHeight,
                        letterSpacing: single.letterSpacing,
                        textAlign: (single.textAlign || 'left') as 'left' | 'center' | 'right',
                      });
                    }
                  }}
                  className="w-full mt-1 py-1.5 text-xs text-[var(--text-secondary)] border border-dashed border-[var(--border)] rounded hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  + 保存当前为新样式
                </button>
              </Section>
            )}

            {/* Multiple fills stack */}
            {!isLine && single.type !== 'image' && (
              <Section title="填充">
                {fills.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      {i === 0 ? (() => {
                        const fillBinding = single.tokenBindings?.fill;
                        const boundToken = fillBinding ? (themes.find(t => t.id === activeThemeId)?.tokens.find(tok => tok.id === fillBinding) ?? null) : null;
                        return (
                          <>
                            {boundToken ? (
                              <TokenBoundIndicator
                                tokenId={fillBinding ?? ''}
                                tokenName={String(boundToken.name ?? '')}
                                tokenValue={boundToken.value ?? ''}
                                onUnbind={() => unbindToken(single.id, 'fill')}
                              />
                            ) : (
                              <ColorPicker
                                label={fills.length > 1 ? `填充 ${i + 1}` : '填充'}
                                value={f.color || single.fill}
                                gradient={single.gradient}
                                onChange={v => { updateFill(i, { color: v }); if (i === 0) update({ fill: v }); }}
                                onGradientChange={updateGradient}
                              />
                            )}
                          </>
                        );
                      })() : (
                        <ColorPicker
                          label={fills.length > 1 ? `填充 ${i + 1}` : '填充'}
                          value={f.color || single.fill}
                          onChange={v => { updateFill(i, { color: v }); if (i === 0) update({ fill: v }); }}
                        />
                      )}
                    </div>
                    {i === 0 && (
                      <button
                        onClick={() => setTokenPickerFor(tokenPickerFor === 'fill' ? null : 'fill')}
                        className={`p-1 rounded transition-colors ${single.tokenBindings?.fill ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--accent)]'}`}
                        title={single.tokenBindings?.fill ? '取消绑定' : '绑定 Token'}
                        aria-label={single.tokenBindings?.fill ? '取消绑定' : '绑定 Token'}
                      >
                        <Link size={12} />
                      </button>
                    )}
                    {tokenPickerFor === 'fill' && i === 0 && (
                      <div className="absolute left-0 top-full mt-1 z-50">
                        <TokenPicker
                          property="fill"
                          currentTokenId={single.tokenBindings?.fill}
                          onSelect={id => { bindToken(single.id, 'fill', id); setTokenPickerFor(null); }}
                          onClose={() => setTokenPickerFor(null)}
                        />
                      </div>
                    )}
                    {fills.length > 1 && (
                      <button onClick={() => removeFill(i)} className="p-1 text-[var(--text-tertiary)] hover:text-[var(--danger)]" title="删除填充" aria-label="删除填充">
                        <Trash2 size={11} />
                      </button>
                    )}
                    {/* Visibility toggle for all fills */}
                    <button
                      onClick={() => {
                        selectedIds.forEach(id => {
                          const shape = shapes.find(s => s.id === id);
                          if (!shape) return;
                          const fills = [...(shape.fills || [])];
                          if (!fills[i]) return;
                          fills[i] = { ...fills[i], visible: !(fills[i].visible !== false) };
                          updateShape(id, { fills });
                        });
                      }}
                      className={`p-1 rounded transition-colors ${f.visible === false ? 'text-[var(--text-tertiary)]' : 'text-[var(--accent)]'}`}
                      title={f.visible === false ? '显示填充' : '隐藏填充'}
                      aria-label={f.visible === false ? '显示填充' : '隐藏填充'}
                    >
                      {f.visible === false ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
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
                {(() => {
                  // Build effective strokes list
                  const strokes = single.strokes && single.strokes.length > 0
                    ? single.strokes
                    : [{ color: single.stroke, width: single.strokeWidth, opacity: 1, style: 'solid' as const }];
                  return (
                    <>
                      {strokes.map((s, i) => (
                        <div key={i} className="space-y-2 pb-2 border-b border-[var(--border)] last:border-b-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--text-tertiary)]">描边 {strokes.length > 1 ? i + 1 : ''}</span>
                            {strokes.length > 1 && (
                              <button
                                onClick={() => {
                                  selectedIds.forEach(id => {
                                    const shape = shapes.find(s => s.id === id);
                                    if (!shape) return;
                                    const strokes = [...(shape.strokes || [{ color: shape.stroke, width: shape.strokeWidth, opacity: 1 }])];
                                    strokes.splice(i, 1);
                                    updateShape(id, { strokes });
                                  });
                                }}
                                className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                                title="删除描边" aria-label="删除描边"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                          <ColorPicker
                            label="颜色"
                            value={s.color}
                            onChange={v => {
                              selectedIds.forEach(id => {
                                const shape = shapes.find(s => s.id === id);
                                if (!shape) return;
                                const strokes = [...(shape.strokes || [{ color: shape.stroke, width: shape.strokeWidth, opacity: 1 }])];
                                if (!strokes[i]) return;
                                strokes[i] = { ...strokes[i], color: v };
                                if (i === 0) updateShape(id, { stroke: v, strokes });
                                else updateShape(id, { strokes });
                              });
                            }}
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <NumInput
                              label="宽度"
                              value={s.width}
                              onChange={v => {
                                selectedIds.forEach(id => {
                                  const shape = shapes.find(s => s.id === id);
                                  if (!shape) return;
                                  const strokes = [...(shape.strokes || [{ color: shape.stroke, width: shape.strokeWidth, opacity: 1 }])];
                                  if (!strokes[i]) return;
                                  strokes[i] = { ...strokes[i], width: v };
                                  if (i === 0) updateShape(id, { strokeWidth: v, strokes });
                                  else updateShape(id, { strokes });
                                });
                              }}
                              suffix="px" min={0} max={20}
                            />
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">样式</label>
                              <select
                                value={s.style || 'solid'}
                                onChange={e => {
                                  selectedIds.forEach(id => {
                                    const shape = shapes.find(s => s.id === id);
                                    if (!shape) return;
                                    const strokes = [...(shape.strokes || [{ color: shape.stroke, width: shape.strokeWidth, opacity: 1 }])];
                                    if (!strokes[i]) return;
                                    strokes[i] = { ...strokes[i], style: e.target.value as 'solid' | 'dashed' };
                                    updateShape(id, { strokes });
                                  });
                                }}
                                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1 py-1 text-[10px] text-[var(--text-primary)]"
                              >
                                <option value="solid">实线</option>
                                <option value="dashed">虚线</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">不透明度</label>
                              <select
                                value={Math.round((s.opacity ?? 1) * 100)}
                                onChange={e => {
                                  selectedIds.forEach(id => {
                                    const shape = shapes.find(s => s.id === id);
                                    if (!shape) return;
                                    const strokes = [...(shape.strokes || [{ color: shape.stroke, width: shape.strokeWidth, opacity: 1 }])];
                                    if (!strokes[i]) return;
                                    strokes[i] = { ...strokes[i], opacity: Number(e.target.value) / 100 };
                                    updateShape(id, { strokes });
                                  });
                                }}
                                className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1 py-1 text-[10px] text-[var(--text-primary)]"
                              >
                                <option value="100">100%</option>
                                <option value="80">80%</option>
                                <option value="60">60%</option>
                                <option value="40">40%</option>
                                <option value="20">20%</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          selectedIds.forEach(id => {
                            const shape = shapes.find(s => s.id === id);
                            if (!shape) return;
                            const strokes = [...(shape.strokes || [{ color: shape.stroke, width: shape.strokeWidth, opacity: 1 }])];
                            strokes.push({ color: '#D4A853', width: 1, opacity: 1, style: 'solid' });
                            updateShape(id, { strokes });
                          });
                        }}
                        className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                      >
                        <Plus size={11} /> 添加描边
                      </button>
                    </>
                  );
                })()}
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
                    title="模糊类型（背景模糊在画布中为图层高斯模糊的近似）"
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

            {/* Mask Section */}
            {single && (
              <Section title="遮罩">
                {/* Check if this shape is a mask source (some shape has maskSourceId pointing to it) */}
                {shapes.some(s => s.maskSourceId === single.id) ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      此图形正在遮罩 {shapes.filter(s => s.maskSourceId === single.id).length} 个图形
                    </p>
                    <button
                      onClick={() => {
                        const engine = getEditorEngine();
                        if (engine) {
                          shapes.forEach(s => {
                            if (s.maskSourceId === single.id) {
                              const cmd = engine.getHistoryManager().propertyCommand(s.id, 'maskSourceId' as any, s.maskSourceId, undefined, 'Release Mask');
                              engine.executeCommand(cmd);
                            }
                          });
                          syncEditorFromStore();
                        } else {
                          pushHistory();
                          shapes.forEach(s => {
                            if (s.maskSourceId === single.id) {
                              updateShape(s.id, { maskSourceId: undefined });
                            }
                          });
                        }
                      }}
                      className="w-full py-1.5 text-[11px] rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-400 transition-colors border border-[var(--border)]"
                    >
                      释放遮罩
                    </button>
                  </div>
                ) : single.maskSourceId ? (
                  /* Check if this shape is masked by another shape */
                  <div className="space-y-2">
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      被遮罩: <span className="text-[var(--accent)]">{shapes.find(s => s.id === single.maskSourceId)?.name || '未知'}</span>
                    </p>
                    <button
                      onClick={() => {
                        const engine = getEditorEngine();
                        if (engine) {
                          const cmd = engine.getHistoryManager().propertyCommand(single.id, 'maskSourceId' as any, single.maskSourceId, undefined, 'Release Mask');
                          engine.executeCommand(cmd);
                          syncEditorFromStore();
                        } else {
                          pushHistory();
                          updateShape(single.id, { maskSourceId: undefined });
                        }
                      }}
                      className="w-full py-1.5 text-[11px] rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-400 transition-colors border border-[var(--border)]"
                    >
                      释放遮罩
                    </button>
                  </div>
                ) : canBeMaskSource(single) ? (
                  /* Shape can be mask source but is neither masked nor a mask source */
                  <div className="space-y-2">
                    <p className="text-[10px] text-[var(--text-tertiary)]">将此图形设为遮罩源，其下方所有图形将被裁切</p>
                    <button
                      onClick={() => {
                        const engine = getEditorEngine();
                        const siblings = shapes.filter(s => s.parentId === single.parentId);
                        const thisIndex = siblings.findIndex(s => s.id === single.id);
                        if (engine) {
                          siblings.forEach((s, idx) => {
                            if (idx > thisIndex) {
                              const cmd = engine.getHistoryManager().propertyCommand(s.id, 'maskSourceId' as any, s.maskSourceId, single.id, 'Set Mask');
                              engine.executeCommand(cmd);
                            }
                          });
                          syncEditorFromStore();
                        } else {
                          pushHistory();
                          siblings.forEach((s, idx) => {
                            if (idx > thisIndex) {
                              updateShape(s.id, { maskSourceId: single.id });
                            }
                          });
                        }
                      }}
                      className="w-full py-1.5 text-[11px] rounded bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors border border-[var(--accent)]/20"
                    >
                      设为遮罩
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-[var(--text-tertiary)] italic">此图形类型不支持作为遮罩</p>
                )}
              </Section>
            )}

            {/* Export Section */}
            <Section title="导出">
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => {
                    const w = single.width || (single.radius ? single.radius * 2 : 200);
                    const h = single.height || (single.radius ? single.radius * 2 : 200);
                    const svg = shapesToSvg([single], { width: w, height: h });
                    const safe = (single.name || 'export').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 120);
                    downloadSvg(svg, `${safe}.svg`);
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
                    const safe = (single.name || 'export').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 120);
                    img.onload = () => {
                      ctx?.drawImage(img, 0, 0, w * 2, h * 2);
                      const a = document.createElement('a');
                      a.href = canvas.toDataURL('image/png');
                      a.download = `${safe}@2x.png`;
                      a.click();
                      URL.revokeObjectURL(url);
                    };
                    img.onerror = () => { URL.revokeObjectURL(url); console.error('PNG rasterize failed'); };
                    img.src = url;
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent)] bg-[var(--bg-elevated)] rounded transition-colors"
                >
                  <Download size={11} /> PNG
                </button>
                <button
                  onClick={() => {
                    const css = shapeToCss(single);
                    void navigator.clipboard.writeText(css).catch(() => console.error('Clipboard unavailable'));
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

        {/* Boolean operations — shown when exactly 2 compatible shapes selected */}
        {selected.length === 2 && (
          <Section title="布尔运算">
            {selected.every(s => canDoBoolean(s)) ? (
              <div className="flex gap-1">
                <IconBtn
                  icon={<Combine size={13} />}
                  label="合并 (Union)"
                  onClick={() => applyBooleanOperation([selected[0].id, selected[1].id], 'union')}
                />
                <IconBtn
                  icon={<Minus size={13} />}
                  label="相减 (Subtract)"
                  onClick={() => applyBooleanOperation([selected[0].id, selected[1].id], 'subtract')}
                />
                <IconBtn
                  icon={<Layers size={13} />}
                  label="相交 (Intersect)"
                  onClick={() => applyBooleanOperation([selected[0].id, selected[1].id], 'intersect')}
                />
                <IconBtn
                  icon={<Combine size={13} strokeWidth={3} />}
                  label="排除 (Exclude)"
                  onClick={() => applyBooleanOperation([selected[0].id, selected[1].id], 'exclude')}
                />
              </div>
            ) : (
              <p className="text-[10px] text-[var(--text-tertiary)] italic">布尔运算仅支持矩形 / 圆形 / 路径 图形</p>
            )}
          </Section>
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
                <IconBtn icon={<AlignLeft size={14} />} label="左对齐" onClick={() => alignShapes(selectedIds, 'left')} />
                <IconBtn icon={<AlignCenterHorizontal size={14} />} label="水平居中" onClick={() => alignShapes(selectedIds, 'centerH')} />
                <IconBtn icon={<AlignRight size={14} />} label="右对齐" onClick={() => alignShapes(selectedIds, 'right')} />
                <IconBtn icon={<AlignStartVertical size={14} />} label="顶对齐" onClick={() => alignShapes(selectedIds, 'top')} />
                <IconBtn icon={<AlignCenterVertical size={14} />} label="垂直居中" onClick={() => alignShapes(selectedIds, 'centerV')} />
                <IconBtn icon={<AlignEndVertical size={14} />} label="底对齐" onClick={() => alignShapes(selectedIds, 'bottom')} />
              </div>
              {selected.length >= 3 && (
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <button
                    onClick={() => alignShapes(selectedIds, 'distributeH')}
                    title="水平均布"
                    className="flex items-center justify-center gap-1 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded transition-colors"
                  >
                    <AlignHorizontalSpaceBetween size={13} /> 水平均布
                  </button>
                  <button
                    onClick={() => alignShapes(selectedIds, 'distributeV')}
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
