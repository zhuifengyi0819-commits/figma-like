'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { Download, Upload, Grid3X3, Keyboard, PaintBucket, Image, FileCode2, FileJson, Play, Maximize, History, Save, Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import Konva from 'konva';
import { shapesToSvg, downloadSvg } from '@/lib/svgExport';

export default function Header() {
  const { shapes, clearCanvas, canvasZoom, setCanvasZoom, setCanvasPan, setShowHelp, canvasBg, setCanvasBg, pages, activePageId, setPrototypeMode, snapshots, saveSnapshot, restoreSnapshot, deleteSnapshot } = useEditorStore();
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const [snapName, setSnapName] = useState('');

  const activePage = pages.find(p => p.id === activePageId);

  const handleResetView = useCallback(() => {
    setCanvasZoom(1);
    setCanvasPan({ x: 0, y: 0 });
  }, [setCanvasZoom, setCanvasPan]);

  const handleExportJSON = useCallback(() => {
    const data = JSON.stringify(shapes, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ai-canvas-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }, [shapes]);

  const handleExportPNG = useCallback(() => {
    const stageNode = Konva.stages[0];
    if (!stageNode) return;
    const oldScale = { x: stageNode.scaleX(), y: stageNode.scaleY() };
    const oldPos = { x: stageNode.x(), y: stageNode.y() };
    stageNode.scale({ x: 2, y: 2 });
    stageNode.position({ x: 0, y: 0 });
    stageNode.draw();
    const dataUrl = stageNode.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
    stageNode.scale(oldScale);
    stageNode.position(oldPos);
    stageNode.draw();
    const a = document.createElement('a');
    a.href = dataUrl; a.download = `ai-canvas-${Date.now()}.png`; a.click();
    setExportOpen(false);
  }, []);

  const handleExportSVG = useCallback(() => {
    const svg = shapesToSvg(shapes, { background: canvasBg });
    downloadSvg(svg, `ai-canvas-${Date.now()}.svg`);
    setExportOpen(false);
  }, [shapes, canvasBg]);

  const handleExportSelectionSVG = useCallback(() => {
    const { selectedIds } = useEditorStore.getState();
    if (selectedIds.length === 0) return;
    const svg = shapesToSvg(shapes, { selectedIds, background: 'transparent' });
    downloadSvg(svg, `selection-${Date.now()}.svg`);
    setExportOpen(false);
  }, [shapes]);

  const handleExportPNG2x = useCallback(() => {
    const stageNode = Konva.stages[0];
    if (!stageNode) return;
    const oldScale = { x: stageNode.scaleX(), y: stageNode.scaleY() };
    const oldPos = { x: stageNode.x(), y: stageNode.y() };
    stageNode.scale({ x: 2, y: 2 });
    stageNode.position({ x: 0, y: 0 });
    stageNode.draw();
    const dataUrl = stageNode.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
    stageNode.scale(oldScale);
    stageNode.position(oldPos);
    stageNode.draw();
    const a = document.createElement('a');
    a.href = dataUrl; a.download = `ai-canvas-@2x-${Date.now()}.png`; a.click();
    setExportOpen(false);
  }, []);

  const handleExportPNG3x = useCallback(() => {
    const stageNode = Konva.stages[0];
    if (!stageNode) return;
    const oldScale = { x: stageNode.scaleX(), y: stageNode.scaleY() };
    const oldPos = { x: stageNode.x(), y: stageNode.y() };
    stageNode.scale({ x: 3, y: 3 });
    stageNode.position({ x: 0, y: 0 });
    stageNode.draw();
    const dataUrl = stageNode.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
    stageNode.scale(oldScale);
    stageNode.position(oldPos);
    stageNode.draw();
    const a = document.createElement('a');
    a.href = dataUrl; a.download = `ai-canvas-@3x-${Date.now()}.png`; a.click();
    setExportOpen(false);
  }, []);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          useEditorStore.getState()._setPageShapes(data);
          useEditorStore.setState({ selectedIds: [] });
        }
      } catch (err) { console.error('Failed to import:', err); }
    };
    input.click();
  }, []);

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-[var(--bg-surface)] border-b border-[var(--border)]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--accent)]">
            <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h1 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">AI Canvas</h1>
        </div>
        <div className="h-4 w-px bg-[var(--border)]" />
        <span className="text-xs text-[var(--text-tertiary)]">
          {activePage?.name || 'Page'} · {shapes.length} 个图形
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleResetView}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
          title="重置视图 (⌘+0)"
        >
          <Grid3X3 size={14} />
          <span className="font-mono">{Math.round(canvasZoom * 100)}%</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {/* Prototype play */}
        <button
          onClick={() => setPrototypeMode(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
          title="预览原型"
        >
          <Play size={13} fill="currentColor" />
          预览
        </button>

        <div className="h-4 w-px bg-[var(--border)] mx-1" />

        <button
          onClick={() => bgInputRef.current?.click()}
          className="relative p-2 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors"
          title="画布背景色" aria-label="画布背景色"
        >
          <PaintBucket size={16} />
          <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-[var(--border)]" style={{ background: canvasBg }} />
          <input ref={bgInputRef} type="color" value={canvasBg} onChange={e => setCanvasBg(e.target.value)} className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none" aria-hidden="true" />
        </button>

        <button onClick={handleImport} className="p-2 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors" title="导入 JSON">
          <Upload size={16} />
        </button>

        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="p-2 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors"
            title="导出"
          >
            <Download size={16} />
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] py-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/40 animate-scale-in">
                <button onClick={handleExportPNG} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                  <Image size={14} className="text-[var(--text-tertiary)]" /> PNG @1x
                </button>
                <button onClick={handleExportPNG2x} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                  <Image size={14} className="text-[var(--text-tertiary)]" /> PNG @2x
                </button>
                <button onClick={handleExportPNG3x} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                  <Image size={14} className="text-[var(--text-tertiary)]" /> PNG @3x
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button onClick={handleExportSVG} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                  <FileCode2 size={14} className="text-[var(--text-tertiary)]" /> 矢量 SVG
                </button>
                <button onClick={handleExportSelectionSVG} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-30" disabled={useEditorStore.getState().selectedIds.length === 0}>
                  <Maximize size={14} className="text-[var(--text-tertiary)]" /> 导出选中 SVG
                </button>
                <div className="my-1 border-t border-[var(--border)]" />
                <button onClick={handleExportJSON} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                  <FileJson size={14} className="text-[var(--text-tertiary)]" /> 导出 JSON
                </button>
              </div>
            </>
          )}
        </div>

        <button onClick={() => clearCanvas()} className="p-2 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--danger)] transition-colors" title="清空画布">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3,6 5,6 21,6" />
            <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
          </svg>
        </button>

        {/* Version History */}
        <div className="relative" ref={historyRef}>
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="p-2 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors"
            title="版本历史"
          >
            <History size={16} />
          </button>
          {historyOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setHistoryOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-[260px] py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl shadow-black/40 animate-scale-in">
                <div className="px-3 pb-2 flex items-center gap-1.5">
                  <input
                    value={snapName}
                    onChange={e => setSnapName(e.target.value)}
                    placeholder="快照名称…"
                    className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
                    title="快照名称"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && snapName.trim()) {
                        saveSnapshot(snapName.trim());
                        setSnapName('');
                      }
                    }}
                  />
                  <button
                    onClick={() => { if (snapName.trim()) { saveSnapshot(snapName.trim()); setSnapName(''); } }}
                    disabled={!snapName.trim()}
                    className="p-1.5 rounded-md bg-[var(--accent)] text-white disabled:opacity-30 hover:opacity-90 transition-opacity"
                    title="保存快照"
                  ><Save size={12} /></button>
                </div>
                <div className="border-t border-[var(--border)]" />
                {snapshots.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-[var(--text-tertiary)] text-center">暂无快照</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    {[...snapshots].reverse().map(s => (
                      <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[var(--bg-hover)] group">
                        <button
                          onClick={() => { restoreSnapshot(s.id); setHistoryOpen(false); }}
                          className="flex-1 text-left"
                          title="恢复此快照"
                        >
                          <div className="text-xs text-[var(--text-primary)] truncate">{s.name}</div>
                          <div className="text-[10px] text-[var(--text-tertiary)]">{new Date(s.timestamp).toLocaleString()}</div>
                        </button>
                        <button onClick={() => deleteSnapshot(s.id)} className="p-0.5 opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-all" title="删除快照">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="h-4 w-px bg-[var(--border)] mx-1" />

        <button onClick={() => setShowHelp(true)} className="p-2 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors" title="快捷键 (?)">
          <Keyboard size={16} />
        </button>
      </div>
    </header>
  );
}
