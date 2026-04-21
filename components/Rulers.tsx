'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { useMemo, useRef, useEffect } from 'react';

const RULER_SIZE = 20;
const TICK_COLOR = '#555';
const TEXT_COLOR = '#888';
const BG_COLOR = '#1a1a1d';
const MAJOR_TICK = 100;

function getTickInterval(zoom: number): { major: number; minor: number } {
  const base = MAJOR_TICK / zoom;
  if (base > 400) return { major: 500, minor: 100 };
  if (base > 200) return { major: 200, minor: 50 };
  if (base > 80) return { major: 100, minor: 25 };
  if (base > 40) return { major: 50, minor: 10 };
  if (base > 15) return { major: 20, minor: 5 };
  return { major: 10, minor: 2 };
}

function HorizontalRuler({
  width,
  mouseX,
  guides,
  canvasPan,
  canvasZoom,
  onAddGuide,
}: {
  width: number;
  mouseX: number | null;
  guides: { id: string; x?: number; y?: number; locked: boolean }[];
  canvasPan: { x: number; y: number };
  canvasZoom: number;
  onAddGuide: (pos: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { major, minor } = useMemo(() => getTickInterval(canvasZoom), [canvasZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = RULER_SIZE * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, RULER_SIZE);

    ctx.strokeStyle = TICK_COLOR;
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';

    const startVal = Math.floor(-canvasPan.x / canvasZoom / minor) * minor;
    const endVal = Math.ceil((width - canvasPan.x) / canvasZoom / minor) * minor;

    for (let val = startVal; val <= endVal; val += minor) {
      const x = val * canvasZoom + canvasPan.x;
      if (x < 0 || x > width) continue;
      const isMajor = val % major === 0;

      ctx.beginPath();
      ctx.moveTo(x, RULER_SIZE);
      ctx.lineTo(x, isMajor ? 4 : RULER_SIZE - 6);
      ctx.lineWidth = isMajor ? 1 : 0.5;
      ctx.stroke();

      if (isMajor) {
        ctx.fillText(`${val}`, x + 2, 11);
      }
    }

    ctx.strokeStyle = '#303036';
    ctx.beginPath();
    ctx.moveTo(0, RULER_SIZE - 0.5);
    ctx.lineTo(width, RULER_SIZE - 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mouse indicator line
    if (mouseX !== null && mouseX >= 0 && mouseX <= width) {
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(mouseX, 2);
      ctx.lineTo(mouseX, RULER_SIZE);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [width, canvasZoom, canvasPan, major, minor, mouseX]);

  // Guide markers: vertical guides (x) on horizontal ruler
  const verticalGuides = guides.filter(g => g.x !== undefined);

  return (
    <div className="relative" style={{ width, height: RULER_SIZE }}>
      <canvas
        ref={canvasRef}
        style={{ width, height: RULER_SIZE, display: 'block' }}
      />
      {/* Guide markers */}
      {verticalGuides.map(g => {
        const screenX = (g.x ?? 0) * canvasZoom + canvasPan.x;
        if (screenX < 0 || screenX > width) return null;
        return (
          <div
            key={g.id}
            className="absolute top-0 cursor-ew-resize"
            style={{ left: screenX, top: 0, width: 1, height: RULER_SIZE, transform: 'translateX(-50%)' }}
          >
            <div
              className="absolute rounded-full bg-[#FF6B6B] border border-white"
              style={{ width: 6, height: 6, top: 2, left: '50%', transform: 'translateX(-50%)' }}
            />
          </div>
        );
      })}
      {/* Invisible click target to add vertical guide */}
      <div
        className="absolute inset-0 cursor-crosshair"
        onClick={e => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const canvasX = (screenX - canvasPan.x) / canvasZoom;
          onAddGuide(canvasX);
        }}
      />
    </div>
  );
}

function VerticalRuler({
  height,
  mouseY,
  guides,
  canvasPan,
  canvasZoom,
  onAddGuide,
}: {
  height: number;
  mouseY: number | null;
  guides: { id: string; x?: number; y?: number; locked: boolean }[];
  canvasPan: { x: number; y: number };
  canvasZoom: number;
  onAddGuide: (pos: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { major, minor } = useMemo(() => getTickInterval(canvasZoom), [canvasZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = RULER_SIZE * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, RULER_SIZE, height);

    ctx.strokeStyle = TICK_COLOR;
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '9px monospace';

    const startVal = Math.floor(-canvasPan.y / canvasZoom / minor) * minor;
    const endVal = Math.ceil((height - canvasPan.y) / canvasZoom / minor) * minor;

    for (let val = startVal; val <= endVal; val += minor) {
      const y = val * canvasZoom + canvasPan.y;
      if (y < 0 || y > height) continue;
      const isMajor = val % major === 0;

      ctx.beginPath();
      ctx.moveTo(RULER_SIZE, y);
      ctx.lineTo(isMajor ? 4 : RULER_SIZE - 6, y);
      ctx.lineWidth = isMajor ? 1 : 0.5;
      ctx.stroke();

      if (isMajor) {
        ctx.save();
        ctx.translate(11, y + 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'left';
        ctx.fillText(`${val}`, 0, 0);
        ctx.restore();
      }
    }

    ctx.strokeStyle = '#303036';
    ctx.beginPath();
    ctx.moveTo(RULER_SIZE - 0.5, 0);
    ctx.lineTo(RULER_SIZE - 0.5, height);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Mouse indicator line
    if (mouseY !== null && mouseY >= 0 && mouseY <= height) {
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(2, mouseY);
      ctx.lineTo(RULER_SIZE, mouseY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [height, canvasZoom, canvasPan, major, minor, mouseY]);

  // Guide markers: horizontal guides (y) on vertical ruler
  const horizontalGuides = guides.filter(g => g.y !== undefined);

  return (
    <div className="relative" style={{ width: RULER_SIZE, height }}>
      <canvas
        ref={canvasRef}
        style={{ width: RULER_SIZE, height, display: 'block' }}
      />
      {/* Guide markers */}
      {horizontalGuides.map(g => {
        const screenY = (g.y ?? 0) * canvasZoom + canvasPan.y;
        if (screenY < 0 || screenY > height) return null;
        return (
          <div
            key={g.id}
            className="absolute left-0 cursor-ns-resize"
            style={{ top: screenY, left: 0, height: 1, width: RULER_SIZE, transform: 'translateY(-50%)' }}
          >
            <div
              className="absolute rounded-full bg-[#FF6B6B] border border-white"
              style={{ width: 6, height: 6, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            />
          </div>
        );
      })}
      {/* Invisible click target to add horizontal guide */}
      <div
        className="absolute inset-0 cursor-crosshair"
        onClick={e => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const screenY = e.clientY - rect.top;
          const canvasY = (screenY - canvasPan.y) / canvasZoom;
          onAddGuide(canvasY);
        }}
      />
    </div>
  );
}

export default function Rulers({
  width,
  height,
  mouseX,
  mouseY,
}: {
  width: number;
  height: number;
  mouseX: number | null;
  mouseY: number | null;
}) {
  const { canvasZoom, canvasPan, guides, addGuide } = useEditorStore();

  return (
    <>
      {/* Corner square */}
      <div
        className="absolute top-0 left-0 z-30 select-none"
        style={{
          width: RULER_SIZE,
          height: RULER_SIZE,
          background: BG_COLOR,
          borderRight: '1px solid #303036',
          borderBottom: '1px solid #303036',
        }}
      />
      {/* Horizontal ruler */}
      <div
        className="absolute top-0 z-20 select-none"
        style={{ left: RULER_SIZE }}
      >
        <HorizontalRuler
          width={width - RULER_SIZE}
          mouseX={mouseX}
          guides={guides}
          canvasPan={canvasPan}
          canvasZoom={canvasZoom}
          onAddGuide={(canvasX) => addGuide(canvasX, 'x')}
        />
      </div>
      {/* Vertical ruler */}
      <div
        className="absolute left-0 z-20 select-none"
        style={{ top: RULER_SIZE }}
      >
        <VerticalRuler
          height={height - RULER_SIZE}
          mouseY={mouseY}
          guides={guides}
          canvasPan={canvasPan}
          canvasZoom={canvasZoom}
          onAddGuide={(canvasY) => addGuide(canvasY, 'y')}
        />
      </div>
    </>
  );
}

export { RULER_SIZE };
