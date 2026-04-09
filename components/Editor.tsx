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

const Canvas = dynamic(() => import('./Canvas'), { ssr: false });

export default function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

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

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-deep)]">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 flex-shrink-0">
          <LeftPanel />
        </div>
        <div ref={containerRef} className="flex-1 relative" data-canvas-area>
          <Canvas width={canvasSize.width} height={canvasSize.height} />
          <Toolbar />
        </div>
        <div className="w-80 flex-shrink-0">
          <RightPanel />
        </div>
      </div>
      <StatusBar />
      <HelpModal />
      <ContextMenu />
    </div>
  );
}
