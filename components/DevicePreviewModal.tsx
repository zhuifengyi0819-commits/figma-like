'use client';

import { useState, useEffect } from 'react';
import { X, Smartphone, Monitor, Tablet } from 'lucide-react';
import Konva from 'konva';

const DEVICE_PRESETS = [
  { id: 'iphone-14', name: 'iPhone 14', width: 390, height: 844, icon: Smartphone },
  { id: 'iphone-14-pro', name: 'iPhone 14 Pro', width: 430, height: 932, icon: Smartphone },
  { id: 'ipad-pro', name: 'iPad Pro 11"', width: 834, height: 1194, icon: Tablet },
  { id: 'desktop-hd', name: 'Desktop HD', width: 1920, height: 1080, icon: Monitor },
  { id: 'macbook-air', name: 'MacBook Air', width: 1440, height: 900, icon: Monitor },
  { id: 'custom', name: 'Custom', width: 0, height: 0, icon: Monitor },
] as const;

type DevicePreset = typeof DEVICE_PRESETS[number];

const PREVIEW_AREA_W = 360;
const PREVIEW_AREA_H = 280;

export default function DevicePreviewModal({ onClose }: { onClose: () => void }) {
  const [selectedDevice, setSelectedDevice] = useState<DevicePreset>(DEVICE_PRESETS[0]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  // Compute scale to fit the device in the preview area
  const scaleX = PREVIEW_AREA_W / selectedDevice.width;
  const scaleY = PREVIEW_AREA_H / selectedDevice.height;
  const computedScale = Math.min(scaleX, scaleY, 1);

  useEffect(() => {
    setScale(computedScale);
  }, [computedScale]);

  // Capture the Konva stage when device or scale changes
  useEffect(() => {
    const captureCanvas = () => {
      try {
        const stageNode = Konva.stages[0];
        if (!stageNode) return;

        // Save current state
        const oldScale = { x: stageNode.scaleX(), y: stageNode.scaleY() };
        const oldPos = { x: stageNode.x(), y: stageNode.y() };
        const oldWidth = stageNode.width();
        const oldHeight = stageNode.height();

        // Temporarily scale stage to show the full canvas at device resolution
        stageNode.scale({ x: 1, y: 1 });
        stageNode.position({ x: 0, y: 0 });
        stageNode.width(selectedDevice.width);
        stageNode.height(selectedDevice.height);
        stageNode.batchDraw();

        const dataUrl = stageNode.toDataURL({ pixelRatio: 1 });

        // Restore
        stageNode.scale(oldScale);
        stageNode.position(oldPos);
        stageNode.width(oldWidth);
        stageNode.height(oldHeight);
        stageNode.batchDraw();

        setPreviewUrl(dataUrl);
      } catch (err) {
        console.error('Failed to capture canvas for device preview:', err);
      }
    };

    // Small delay to ensure modal is rendered
    const timer = setTimeout(captureCanvas, 50);
    return () => clearTimeout(timer);
  }, [selectedDevice, scale]);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-[700px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">设备预览</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex" style={{ height: 360 }}>
          {/* Device list */}
          <div className="w-48 border-r border-[var(--border)] p-3 space-y-1 overflow-y-auto">
            {DEVICE_PRESETS.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedDevice(d)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                    selectedDevice.id === d.id
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <Icon size={14} />
                  <span>{d.name}</span>
                  <span className="ml-auto text-[10px] text-[var(--text-tertiary)] font-mono">
                    {d.width > 0 ? `${d.width}×${d.height}` : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Preview area */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#1a1a1d]">
            <div
              className="relative bg-white rounded-lg overflow-hidden shadow-2xl"
              style={{
                width: selectedDevice.width * scale,
                height: selectedDevice.height * scale,
              }}
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={`${selectedDevice.name} preview`}
                  className="w-full h-full object-contain"
                  style={{ imageRendering: 'auto' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)] text-xs">
                  加载中…
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-[var(--border)] text-xs text-[var(--text-tertiary)] flex items-center justify-between">
          <span>
            {selectedDevice.name}
            {selectedDevice.width > 0 && ` — ${selectedDevice.width}×${selectedDevice.height}px`}
            {selectedDevice.width > 0 && ` — 比例 ${Math.round(scale * 100)}%`}
          </span>
          <span className="text-[10px]">按比例缩放显示 · {selectedDevice.width > 0 ? '实际尺寸' : '自适应'}</span>
        </div>
      </div>
    </div>
  );
}
