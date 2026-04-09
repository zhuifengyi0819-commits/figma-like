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

function HorizontalRuler({ width }: { width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { canvasZoom, canvasPan } = useEditorStore();

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
  }, [width, canvasZoom, canvasPan, major, minor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height: RULER_SIZE, display: 'block' }}
      className="select-none pointer-events-none"
    />
  );
}

function VerticalRuler({ height }: { height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { canvasZoom, canvasPan } = useEditorStore();

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
  }, [height, canvasZoom, canvasPan, major, minor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: RULER_SIZE, height, display: 'block' }}
      className="select-none pointer-events-none"
    />
  );
}

export default function Rulers({ width, height }: { width: number; height: number }) {
  return (
    <>
      {/* Corner square */}
      <div
        className="absolute top-0 left-0 z-30"
        style={{ width: RULER_SIZE, height: RULER_SIZE, background: BG_COLOR, borderRight: '1px solid #303036', borderBottom: '1px solid #303036' }}
      />
      {/* Horizontal ruler */}
      <div className="absolute top-0 z-20" style={{ left: RULER_SIZE }}>
        <HorizontalRuler width={width - RULER_SIZE} />
      </div>
      {/* Vertical ruler */}
      <div className="absolute left-0 z-20" style={{ top: RULER_SIZE }}>
        <VerticalRuler height={height - RULER_SIZE} />
      </div>
    </>
  );
}

export { RULER_SIZE };
