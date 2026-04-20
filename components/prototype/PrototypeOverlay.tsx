'use client';

import { useMemo } from 'react';
import { Shape, FlowEdge as FlowEdgeType } from '@/lib/types';
import FlowEdge from './FlowEdge';

interface PrototypeOverlayProps {
  frames: Shape[];
  edges: FlowEdgeType[];
  selectedEdgeId?: string;
  onEdgeClick?: (edgeId: string) => void;
  viewOffset?: { x: number; y: number };
  scale?: number;
}

/**
 * SVG overlay layer that renders flow connections between frames.
 * This sits above the Canvas in edit mode, showing prototype flow.
 */
export default function PrototypeOverlay({
  frames,
  edges,
  selectedEdgeId,
  onEdgeClick,
  viewOffset = { x: 0, y: 0 },
  scale = 1,
}: PrototypeOverlayProps) {
  // Build frame id → shape map for quick lookup
  const frameMap = useMemo(() => {
    const map = new Map<string, Shape>();
    for (const f of frames) map.set(f.id, f);
    return map;
  }, [frames]);

  if (edges.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 10,
      }}
    >
      <defs>
        {/* Arrowhead marker */}
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#4a5568" />
        </marker>
      </defs>

      {edges.map(edge => {
        const source = frameMap.get(edge.sourceNodeId);
        const target = frameMap.get(edge.targetNodeId);
        if (!source || !target) return null;

        // Apply view transform
        const sx = (source.x + (viewOffset?.x || 0)) * scale;
        const sy = (source.y + (viewOffset?.y || 0)) * scale;
        const tx = (target.x + (viewOffset?.x || 0)) * scale;
        const ty = (target.y + (viewOffset?.y || 0)) * scale;
        const sw = (source.width || 200) * scale;
        const sh = (source.height || 150) * scale;
        const tw = (target.width || 200) * scale;
        const th = (target.height || 150) * scale;

        return (
          <FlowEdge
            key={edge.id}
            sourceX={sx}
            sourceY={sy}
            sourceWidth={sw}
            sourceHeight={sh}
            targetX={tx}
            targetY={ty}
            targetWidth={tw}
            targetHeight={th}
            trigger={edge.trigger}
            label={edge.label}
            selected={edge.id === selectedEdgeId}
            onClick={() => onEdgeClick?.(edge.id)}
          />
        );
      })}
    </svg>
  );
}
