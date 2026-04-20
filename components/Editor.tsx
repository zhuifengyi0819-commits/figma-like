'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
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
import PrototypeToolbar from './prototype/PrototypeToolbar';
import PrototypeOverlay from './prototype/PrototypeOverlay';
import Rulers, { RULER_SIZE } from './Rulers';
import DevicePreviewModal from './DevicePreviewModal';
import VersionHistoryPanel from './VersionHistoryPanel';
import { useEditorStore } from '@/stores/useEditorStore';
import { Shape, FlowEdge as FlowEdgeType } from '@/lib/types';

const Canvas = dynamic(() => import('./Canvas'), { ssr: false });
const PrototypeOverview = dynamic(() => import('./prototype/PrototypeOverview'), { ssr: false });

export default function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showPrototypeOverview, setShowPrototypeOverview] = useState(false);
  const { prototypeMode, setPrototypeMode, arrayModalOpen, setArrayModalOpen, selectedIds, showDevicePreview, setShowDevicePreview, shapes, pages, activePageId } = useEditorStore();

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
        if (prototypeMode === 'PREVIEW' || prototypeMode === 'FLOW') {
          setPrototypeMode('EDIT');
          setShowPrototypeOverview(false);
        }
      }
    };
    const handleSlash = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-chat-input'));
      }
    };
    const handleDevicePreview = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowDevicePreview(true);
      }
    };
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('keydown', handleSlash);
    window.addEventListener('keydown', handleDevicePreview);
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

  // Compute frames and edges for prototype overlay from store state
  const { frames, edges } = useMemo(() => {
    const activePage = pages.find(p => p.id === activePageId);
    const pageShapes = activePage?.shapes || shapes;
    const topFrames = pageShapes.filter((s: Shape) => (s.type === 'frame' || s.type === 'group') && !s.parentId);

    const extractedEdges: FlowEdgeType[] = [];
    for (const frame of topFrames) {
      const children = pageShapes.filter((s: Shape) => s.parentId === frame.id);
      for (const child of children) {
        if (child.interactions) {
          for (const int of child.interactions) {
            if (int.action === 'navigateTo' && int.targetFrameId) {
              extractedEdges.push({
                id: `${child.id}-${int.targetFrameId}-${Math.random().toString(36).slice(2)}`,
                sourceNodeId: frame.id,
                targetNodeId: int.targetFrameId,
                trigger: int.trigger,
              });
            }
          }
        }
      }
    }
    return { frames: topFrames, edges: extractedEdges };
  }, [shapes, pages, activePageId]);

  // Prototype Preview mode — full screen player
  if (prototypeMode === 'PREVIEW') {
    // @ts-expect-error dynamic import type mismatch
    return <PrototypePlayer onClose={() => setPrototypeMode('FLOW')} />;
  }

  // Prototype Overview — full screen flow diagram
  if (showPrototypeOverview) {
    return <PrototypeOverview onClose={() => setShowPrototypeOverview(false)} />;
  }

  // Normal edit or Flow mode
  const isFlowMode = prototypeMode === 'FLOW';

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
            {isFlowMode && frames.length > 0 && (
              <PrototypeOverlay frames={frames} edges={edges} />
            )}
          </div>
          <Toolbar />
          {isFlowMode && (
            <PrototypeToolbar
              onOverview={() => setShowPrototypeOverview(true)}
              onPreview={() => setPrototypeMode('PREVIEW')}
              onExit={() => setPrototypeMode('EDIT')}
            />
          )}
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
