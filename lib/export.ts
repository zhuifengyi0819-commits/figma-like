/**
 * Export System — formal API for PNG / SVG / WebP / PDF export.
 * Wraps the existing svgExport helpers and adds canvas-based rasterisation
 * for PNG / WebP, and a print-based PDF path.
 */

import { Shape } from './types';
import { shapesToSvg } from './svgExport';

// ─── Download helper ─────────────────────────────────────────────────────────

export function downloadFile(data: string | Blob, filename: string, mimeType: string): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── SVG ─────────────────────────────────────────────────────────────────────

export function exportToSVG(shapes: Shape[], width = 1920, height = 1080): string {
  return shapesToSvg(shapes, { width, height });
}

export function downloadAsSVG(shapes: Shape[], width = 1920, height = 1080, filename = 'ai-canvas.svg'): void {
  const svg = exportToSVG(shapes, width, height);
  downloadFile(svg, filename, 'image/svg+xml');
}

// ─── PNG / WebP ───────────────────────────────────────────────────────────────

/**
 * Render SVG to an offscreen canvas and return a data URL.
 * @param svgString Valid SVG markup
 * @param width Canvas pixel width (before scale)
 * @param height Canvas pixel height (before scale)
 * @param scale Pixel ratio multiplier (1 = 1x, 2 = 2x, etc.)
 * @param mimeType 'image/png' | 'image/webp'
 * @param quality Quality 0–1 (only used for WebP)
 */
function svgToCanvasDataURL(
  svgString: string,
  width: number,
  height: number,
  scale: number,
  mimeType: 'image/png' | 'image/webp',
  quality = 0.92,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas 2D context unavailable')); return; }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL(mimeType, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load SVG image')); };
    img.src = url;
  });
}

export async function exportToPNG(
  shapes: Shape[],
  width = 1920,
  height = 1080,
  scale = 2,
): Promise<string> {
  const svg = shapesToSvg(shapes, { width, height });
  return svgToCanvasDataURL(svg, width, height, scale, 'image/png', 1);
}

export async function exportToWebP(
  shapes: Shape[],
  width = 1920,
  height = 1080,
  quality = 0.92,
): Promise<string> {
  const svg = shapesToSvg(shapes, { width, height });
  return svgToCanvasDataURL(svg, width, height, 1, 'image/webp', quality);
}

export function downloadAsPNG(
  shapes: Shape[],
  width = 1920,
  height = 1080,
  scale = 2,
  filename = 'ai-canvas.png',
): Promise<void> {
  return exportToPNG(shapes, width, height, scale).then(dataUrl => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  });
}

export function downloadAsWebP(
  shapes: Shape[],
  width = 1920,
  height = 1080,
  quality = 0.92,
  filename = 'ai-canvas.webp',
): Promise<void> {
  return exportToWebP(shapes, width, height, quality).then(dataUrl => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  });
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

/**
 * Export shapes as PDF using the browser print dialog.
 * The SVG is rendered in a new window and the user is prompted to print/save as PDF.
 */
export async function exportToPDF(
  shapes: Shape[],
  width = 1920,
  height = 1080,
): Promise<void> {
  const svg = shapesToSvg(shapes, { width, height, background: '#ffffff' });
  const win = window.open('', '_blank');
  if (!win) { console.warn('exportToPDF: popup blocked'); return; }

  win.document.write(`
    <html>
      <head><title>AI Canvas Export</title>
      <style>
        body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
        img { max-width: 100%; max-height: 100%; }
      </style>
      </head>
      <body>
        <img id="svgimg" src="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}"/>
      </body>
    </html>
  `);
  win.focus();

  const printWhenReady = () => { win.print(); win.close(); };
  const img = win.document.getElementById('svgimg') as HTMLImageElement | null;
  if (img?.complete) {
    printWhenReady();
  } else if (img) {
    img.onload = printWhenReady;
    img.onerror = printWhenReady;
  } else {
    printWhenReady();
  }
}

// ─── Shape → SVG element (public utility) ────────────────────────────────────

export { shapesToSvg };
