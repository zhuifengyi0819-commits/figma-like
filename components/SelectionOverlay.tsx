// components/SelectionOverlay.tsx
// SVG overlay for marquee selection box and smart guide lines.
// Rendered above the Konva Stage (pointer-events: none).

interface SnapGuide {
  path: string;
  color: string;
}

interface SelectionOverlayProps {
  /** Marquee/selection box in screen coordinates */
  marquee: { x: number; y: number; width: number; height: number } | null;
  /** Active snap guide lines */
  snapGuides: SnapGuide[];
  /** Canvas pan offset (screen coords) */
  pan: { x: number; y: number };
  /** Canvas zoom */
  zoom: number;
}

export function SelectionOverlay({ marquee, snapGuides, pan, zoom }: SelectionOverlayProps) {
  if (!marquee && snapGuides.length === 0) return null;

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
        zIndex: 50,
      }}
    >
      {/* Marquee selection rectangle */}
      {marquee && marquee.width > 2 && marquee.height > 2 && (
        <rect
          x={marquee.x}
          y={marquee.y}
          width={marquee.width}
          height={marquee.height}
          fill="rgba(13, 138, 255, 0.08)"
          stroke="#0D8AFF"
          strokeWidth={1 / zoom}
          strokeDasharray="4 4"
        />
      )}

      {/* Smart guide lines */}
      {snapGuides.map((guide, i) => (
        <path
          key={i}
          d={guide.path}
          stroke={guide.color}
          strokeWidth={1 / zoom}
          fill="none"
        />
      ))}
    </svg>
  );
}
