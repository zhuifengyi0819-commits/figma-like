'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { Shape, FlowEdge as FlowEdgeType } from '@/lib/types';
import FlowEdgeComponent from './FlowEdge';

interface PrototypeOverviewProps {
  onClose: () => void;
  onEditEdge?: (sourceId: string, targetId: string) => void;
}

/**
 * Full-screen prototype overview mode.
 * Shows all frames as draggable mini-nodes with flow edges between them.
 */
export default function PrototypeOverview({ onClose, onEditEdge }: PrototypeOverviewProps) {
  const { shapes, pages } = useEditorStore();
  const allShapes = shapes;

  // All top-level frames
  const frames = useMemo(
    () => allShapes.filter(s => (s.type === 'frame' || s.type === 'group') && !s.parentId),
    [allShapes]
  );

  // Extract interactions as edges
  const edges = useMemo<FlowEdgeType[]>(() => {
    const result: FlowEdgeType[] = [];
    for (const frame of frames) {
      const children = allShapes.filter(s => s.parentId === frame.id);
      for (const child of children) {
        if (child.interactions) {
          for (const int of child.interactions) {
            if (int.targetFrameId && int.action !== 'back' && int.action !== 'openUrl') {
              result.push({
                id: `edge-${child.id}-${int.targetFrameId}`,
                sourceNodeId: frame.id,
                targetNodeId: int.targetFrameId,
                trigger: int.trigger,
              });
            }
          }
        }
      }
    }
    return result;
  }, [frames, allShapes]);

  // Node positions (draggable)
  const [nodePositions, setNodePositions] = useState(() => {
    const map = new Map<string, { x: number; y: number }>();
    frames.forEach((f, i) => {
      map.set(f.id, { x: 50 + (i % 4) * 280, y: 50 + Math.floor(i / 4) * 200 });
    });
    return map;
  });

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent, frameId: string) => {
    e.preventDefault();
    const pos = nodePositions.get(frameId);
    if (!pos) return;
    setDraggingId(frameId);
    setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  }, [nodePositions]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingId) return;
    setNodePositions(prev => new Map(prev).set(draggingId, {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    }));
  }, [draggingId, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  const handleEdgeClick = useCallback((edgeId: string) => {
    setSelectedEdgeId(prev => prev === edgeId ? null : edgeId);
    const edge = edges.find(e => e.id === edgeId);
    if (edge && onEditEdge) {
      onEditEdge(edge.sourceNodeId, edge.targetNodeId);
    }
  }, [edges, onEditEdge]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-[#0d0d12] flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 bg-[#111] border-b border-[#2a2a35]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">原型概览</span>
          <span className="text-xs text-[#666]">{frames.length} 个画框 · {edges.length} 条连线</span>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors"
        >
          完成
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-auto">
        <div className="absolute inset-0" style={{ width: 3000, height: 2000 }}>
          {/* Grid background */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Flow edges (SVG layer) */}
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
          >
            {edges.map(edge => {
              const sourcePos = nodePositions.get(edge.sourceNodeId);
              const targetPos = nodePositions.get(edge.targetNodeId);
              const sourceFrame = frames.find(f => f.id === edge.sourceNodeId);
              const targetFrame = frames.find(f => f.id === edge.targetNodeId);
              if (!sourcePos || !targetPos || !sourceFrame || !targetFrame) return null;

              return (
                <FlowEdgeComponent
                  key={edge.id}
                  sourceX={sourcePos.x}
                  sourceY={sourcePos.y}
                  sourceWidth={240}
                  sourceHeight={160}
                  targetX={targetPos.x}
                  targetY={targetPos.y}
                  targetWidth={240}
                  targetHeight={160}
                  trigger={edge.trigger}
                  selected={edge.id === selectedEdgeId}
                  onClick={() => handleEdgeClick(edge.id)}
                />
              );
            })}
          </svg>

          {/* Frame nodes */}
          {frames.map(frame => {
            const pos = nodePositions.get(frame.id);
            if (!pos) return null;
            return (
              <div
                key={frame.id}
                className="absolute bg-[#1a1a24] border border-[#2a2a35] rounded-xl overflow-hidden cursor-move select-none"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: 240,
                  height: 160,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}
                onMouseDown={(e) => handleMouseDown(e, frame.id)}
              >
                {/* Mini preview */}
                <div
                  className="w-full h-full relative"
                  style={{ backgroundColor: frame.fill || '#1A1A1D' }}
                >
                  {/* Simplified preview - just children thumbnails */}
                  <div className="absolute inset-0 p-2">
                    <span className="text-[10px] text-white/50 font-medium">{frame.name}</span>
                  </div>
                  {/* Resize handle */}
                  <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize">
                    <svg viewBox="0 0 10 10" className="w-full h-full opacity-30">
                      <path d="M 9 1 L 1 9 M 5 1 L 1 5" stroke="white" strokeWidth="1.5" fill="none"/>
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer hint */}
      <div className="h-8 flex items-center justify-center bg-[#111] border-t border-[#2a2a35]">
        <span className="text-[10px] text-[#555]">拖拽画框节点可重新排列 · 点击连线可编辑交互</span>
      </div>
    </div>
  );
}
