'use client';

import { TriggerType } from '@/lib/types';

interface FlowEdgeProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  trigger: TriggerType;
  label?: string;
  onClick?: () => void;
  selected?: boolean;
}

/**
 * Compute bezier control points for a smooth curve between two nodes.
 * Connection points are on the facing edges of each node.
 */
function computeConnectionPoints(
  sx: number, sy: number, sw: number, sh: number,
  tx: number, ty: number, tw: number, th: number
): { startX: number; startY: number; endX: number; endY: number; cp1x: number; cp1y: number; cp2x: number; cp2y: number } {
  // Determine which edges to connect based on relative positions
  const sxCenter = sx + sw / 2;
  const syCenter = sy + sh / 2;
  const txCenter = tx + tw / 2;
  const tyCenter = ty + th / 2;

  const dx = txCenter - sxCenter;
  const dy = tyCenter - syCenter;

  let startX: number, startY: number, endX: number, endY: number;

  // Source connection point (right or bottom edge of source)
  // Target connection point (left or top edge of target)
  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal connection
    if (dx >= 0) {
      startX = sx + sw; // right edge of source
      endX = tx;         // left edge of target
    } else {
      startX = sx;       // left edge of source
      endX = tx + tw;    // right edge of target
    }
    startY = syCenter;
    endY = tyCenter;
  } else {
    // Vertical connection
    if (dy >= 0) {
      startY = sy + sh;  // bottom edge of source
      endY = ty;         // top edge of target
    } else {
      startY = sy;       // top edge of source
      endY = ty + th;    // bottom edge of target
    }
    startX = sxCenter;
    endX = txCenter;
  }

  // Compute control points for smooth bezier
  const dist = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const offset = Math.min(dist * 0.4, 80);

  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    cp1x = startX + offset;
    cp1y = startY;
    cp2x = endX - offset;
    cp2y = endY;
  } else {
    cp1x = startX;
    cp1y = startY + (dy >= 0 ? offset : -offset);
    cp2x = endX;
    cp2y = endY + (dy >= 0 ? -offset : offset);
  }

  return { startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y };
}

const TRIGGER_ICONS: Record<string, string> = {
  click: '↗',
  hover: '↗',
  drag: '↗',
  mouseDown: '↓',
  mouseUp: '↑',
  mouseEnter: '↗',
  mouseLeave: '↗',
  keyDown: '⌨',
  afterDelay: '⏱',
  whileDown: '⬇',
  onLoad: '⚡',
  none: '○',
};

export default function FlowEdge({
  sourceX, sourceY, sourceWidth, sourceHeight,
  targetX, targetY, targetWidth, targetHeight,
  trigger, label, onClick, selected,
}: FlowEdgeProps) {
  const { startX, startY, endX, endY, cp1x, cp1y, cp2x, cp2y } = computeConnectionPoints(
    sourceX, sourceY, sourceWidth, sourceHeight,
    targetX, targetY, targetWidth, targetHeight
  );

  const pathD = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const icon = TRIGGER_ICONS[trigger] || '→';
  const color = selected ? '#6366f1' : '#4a5568';

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Invisible wider path for easier clicking */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
      />
      {/* Visible arrow line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={trigger === 'hover' ? '6,4' : undefined}
        className="transition-all duration-200"
      />
      {/* Arrowhead */}
      <polygon
        points={getArrowHead(endX, endY, cp2x, cp2y)}
        fill={color}
      />
      {/* Trigger icon */}
      <g transform={`translate(${midX - 8}, ${midY - 8})`}>
        <rect x={0} y={0} width={16} height={16} rx={3} fill={color} opacity={0.9} />
        <text x={8} y={12} textAnchor="middle" fontSize={9} fill="white">{icon}</text>
      </g>
    </g>
  );
}

function getArrowHead(x: number, y: number, fromX: number, fromY: number): string {
  const angle = Math.atan2(y - fromY, x - fromX);
  const size = 6;
  const a1 = angle + Math.PI / 6;
  const a2 = angle - Math.PI / 6;
  return `${x},${y} ${x - size * Math.cos(a1)},${y - size * Math.sin(a1)} ${x - size * Math.cos(a2)},${y - size * Math.sin(a2)}`;
}
