'use client';

import { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Header from './Header';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import StatusBar from './StatusBar';
import Toolbar from './Toolbar';
import HelpModal from './HelpModal';
import ContextMenu from './ContextMenu';
import ArrayModal from './ArrayModal';
import PageTabs from './PageTabs';
import PrototypePlayer from './PrototypePlayer';
import Rulers, { RULER_SIZE } from './Rulers';
import DevicePreviewModal from './DevicePreviewModal';
import VersionHistoryPanel from './VersionHistoryPanel';
import { useEditorStore } from '@/stores/useEditorStore';

const Canvas = dynamic(() => import('./Canvas'), { ssr: false });

export default function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const { prototypeMode, setPrototypeMode, arrayModalOpen, setArrayModalOpen, selectedIds, showDevicePreview, setShowDevicePreview } = useEditorStore();

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (arrayModalOpen) { setArrayModalOpen(false); return; }
        if (prototypeMode) { setPrototypeMode(false); }
      }
    };
    // '/' key focuses AI chat input
    const handleSlash = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-chat-input'));
      }
    };
    // Cmd+Shift+K opens device preview
    const handleDevicePreview = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowDevicePreview(true);
      }
    };
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('keydown', handleSlash);
    window.addEventListener('keydown', handleDevicePreview);
    // Cmd+Shift+S opens version history
    const handleVersionHistory = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setShowVersionHistory(true);
      }
    };
    window.addEventListener('keydown', handleVersionHistory);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('keydown', handleSlash);
      window.removeEventListener('keydown', handleDevicePreview);
      window.removeEventListener('keydown', handleVersionHistory);
    };
  }, [prototypeMode, setPrototypeMode, arrayModalOpen, setArrayModalOpen, setShowDevicePreview, setShowVersionHistory]);

  if (prototypeMode) return <PrototypePlayer />;

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-deep)]">
      <Header />
      <PageTabs />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 flex-shrink-0">
          <LeftPanel />
        </div>
        <div ref={containerRef} className="flex-1 relative" data-canvas-area>
          <Rulers width={canvasSize.width} height={canvasSize.height} />
          <div className="absolute" style={{ top: RULER_SIZE, left: RULER_SIZE, right: 0, bottom: 0 }}>
            <Canvas width={canvasSize.width - RULER_SIZE} height={canvasSize.height - RULER_SIZE} />
          </div>
          <Toolbar />
        </div>
        <div className="w-80 flex-shrink-0">
          <RightPanel />
        </div>
      </div>
      <StatusBar />
      <HelpModal />
      <ContextMenu />
      {arrayModalOpen && (
        <ArrayModal
          selectedIds={selectedIds}
          onClose={() => setArrayModalOpen(false)}
        />
      )}
      {showDevicePreview && (
        <DevicePreviewModal onClose={() => setShowDevicePreview(false)} />
      )}
      {showVersionHistory && (
        <VersionHistoryPanel onClose={() => setShowVersionHistory(false)} />
      )}
    </div>
  );
}
