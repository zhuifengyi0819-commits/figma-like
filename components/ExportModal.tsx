'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, Download, Image as LucideImage, FileCode2, FileType, FileText } from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { shapesToSvg, downloadSvg } from '@/lib/svgExport';
import Konva from 'konva';

interface ExportModalProps {
  onClose: () => void;
}

type Format = 'png' | 'svg' | 'webp' | 'pdf';
type Scale = 1 | 2 | 3;

export default function ExportModal({ onClose }: ExportModalProps) {
  const [format, setFormat] = useState<Format>('png');
  const [scale, setScale] = useState<Scale>(2);
  const [includeBackground, setIncludeBackground] = useState(true);
  const [exportSelection, setExportSelection] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { shapes, selectedIds, canvasBg } = useEditorStore();

  useEffect(() => {
    const stageNode = Konva.stages[0];
    if (!stageNode) return;

    const oldScale = { x: stageNode.scaleX(), y: stageNode.scaleY() };
    const oldPos = { x: stageNode.x(), y: stageNode.y() };

    // Temporarily set preview scale, capture, then immediately restore
    stageNode.scale({ x: 0.3, y: 0.3 });
    stageNode.position({ x: 0, y: 0 });
    stageNode.draw();

    const dataUrl = stageNode.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });

    // Immediately restore — no need for async cleanup
    stageNode.scale(oldScale);
    stageNode.position(oldPos);
    stageNode.draw();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(dataUrl);
  }, [shapes]);

  const handleExportPngOrWebp = useCallback((ext: 'png' | 'webp') => {
    // When exporting selection only, fall back to SVG-based approach
    if (exportSelection && selectedIds.length > 0) {
      const svg = shapesToSvg(shapes, { selectedIds, background: includeBackground ? canvasBg : undefined });
      const img = new Image(1, 1);
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const mimeType = ext === 'webp' ? 'image/webp' : 'image/png';
        const dataUrl = canvas.toDataURL(mimeType, 0.92);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `ai-canvas-${Date.now()}.${ext}`;
        a.click();
      };
      img.src = url;
      onClose();
      return;
    }

    const stageNode = Konva.stages[0];
    if (!stageNode) return;
    const mimeType = ext === 'webp' ? 'image/webp' : 'image/png';

    const oldScale = { x: stageNode.scaleX(), y: stageNode.scaleY() };
    const oldPos = { x: stageNode.x(), y: stageNode.y() };

    stageNode.scale({ x: scale, y: scale });
    stageNode.position({ x: 0, y: 0 });
    stageNode.draw();

    const dataUrl = stageNode.toDataURL({ pixelRatio: 1, mimeType, quality: 0.92 });

    stageNode.scale(oldScale);
    stageNode.position(oldPos);
    stageNode.draw();

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `ai-canvas-${Date.now()}.${ext}`;
    a.click();
  }, [scale, exportSelection, selectedIds, shapes, canvasBg, includeBackground, onClose]);

  const handleExportSvg = useCallback(() => {
    const svg = shapesToSvg(shapes, {
      background: includeBackground ? canvasBg : undefined,
      selectedIds: exportSelection && selectedIds.length > 0 ? selectedIds : undefined,
    });
    downloadSvg(svg, `ai-canvas-${Date.now()}.svg`);
  }, [shapes, selectedIds, canvasBg, includeBackground, exportSelection]);

  const handleExportPdf = useCallback(() => {
    const svg = shapesToSvg(shapes, {
      background: includeBackground ? canvasBg : '#ffffff',
      selectedIds: exportSelection && selectedIds.length > 0 ? selectedIds : undefined,
    });
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>AI Canvas Export</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;height:100vh}img{max-width:100%;max-height:100%}</style></head><body><img id="svgimg" src="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}"/></body></html>`);
    win.focus();
    const img = win.document.getElementById('svgimg') as HTMLImageElement | null;
    const printWhenReady = () => {
      win.print();
      win.close();
    };
    if (img?.complete) {
      printWhenReady();
    } else if (img) {
      img.onload = printWhenReady;
      img.onerror = printWhenReady; // still print even if image failed
    } else {
      printWhenReady();
    }
  }, [shapes, canvasBg, includeBackground, exportSelection, selectedIds]);

  const handleExport = useCallback(() => {
    switch (format) {
      case 'png':
        handleExportPngOrWebp('png');
        break;
      case 'webp':
        handleExportPngOrWebp('webp');
        break;
      case 'svg':
        handleExportSvg();
        break;
      case 'pdf':
        handleExportPdf();
        break;
    }
    onClose();
  }, [format, handleExportPngOrWebp, handleExportSvg, handleExportPdf, onClose]);

  const formatLabel: Record<Format, string> = {
    png: 'PNG',
    svg: 'SVG',
    webp: 'WebP',
    pdf: 'PDF',
  };

  const hasSelection = selectedIds.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[480px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">导出</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Format Tabs */}
        <div className="flex gap-1 px-5 pt-4">
          {(['png', 'svg', 'webp', 'pdf'] as Format[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                format === f
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }`}
            >
              {f === 'png' && <LucideImage size={12} role="img" aria-label="PNG" />}
              {f === 'svg' && <FileCode2 size={12} role="img" aria-label="SVG" />}
              {f === 'webp' && <FileType size={12} role="img" aria-label="WebP" />}
              {f === 'pdf' && <FileText size={12} role="img" aria-label="PDF" />}
              {formatLabel[f]}
            </button>
          ))}
        </div>

        {/* Preview Area */}
        <div className="mx-5 mt-4 mb-3">
          <div className="relative w-full h-40 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl overflow-hidden flex items-center justify-center">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="导出预览" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-xs text-[var(--text-tertiary)]">暂无预览</span>
            )}
          </div>
          <div className="mt-2 text-center text-xs text-[var(--text-tertiary)]">
            {format === 'png' && `${formatLabel[format]} · ${scale}x · ${shapes.length} 个图形`}
            {format === 'svg' && `${formatLabel[format]} · ${shapes.length} 个图形`}
            {format === 'webp' && `${formatLabel[format]} · ${scale}x · ${shapes.length} 个图形`}
            {format === 'pdf' && `${formatLabel[format]} · ${shapes.length} 个图形`}
          </div>
        </div>

        {/* Options */}
        <div className="px-5 pb-4 space-y-3">
          {/* Scale selector — PNG/WebP only */}
          {(format === 'png' || format === 'webp') && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-secondary)] w-12">比例</span>
              <div className="flex gap-1">
                {([1, 2, 3] as Scale[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      scale === s
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Background toggle */}
          {format !== 'pdf' && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  includeBackground
                    ? 'bg-[var(--accent)] border-[var(--accent)]'
                    : 'bg-transparent border-[var(--border)]'
                }`}
                onClick={() => setIncludeBackground(!includeBackground)}
              >
                {includeBackground && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                checked={includeBackground}
                onChange={() => setIncludeBackground(!includeBackground)}
                className="sr-only"
              />
              <span className="text-xs text-[var(--text-secondary)]">包含背景</span>
            </label>
          )}

          {/* Selection toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer opacity-50 disabled:opacity-30">
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                exportSelection
                  ? 'bg-[var(--accent)] border-[var(--accent)]'
                  : 'bg-transparent border-[var(--border)]'
              }`}
              onClick={() => hasSelection && setExportSelection(!exportSelection)}
            >
              {exportSelection && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <input
              type="checkbox"
              checked={exportSelection}
              onChange={() => hasSelection && setExportSelection(!exportSelection)}
              disabled={!hasSelection}
              className="sr-only"
            />
            <span className="text-xs text-[var(--text-secondary)]">
              仅导出选中图形 {!hasSelection && '(无选中)'}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border)] flex justify-end">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <Download size={13} />
            导出 {formatLabel[format]}
          </button>
        </div>
      </div>
    </div>
  );
}
