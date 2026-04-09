import { Shape, Gradient } from './types';

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gradientToSvgDefs(g: Gradient, id: string): string {
  if (g.type === 'linear') {
    const angle = g.angle || 0;
    const rad = (angle * Math.PI) / 180;
    const x1 = 50 - Math.cos(rad) * 50, y1 = 50 - Math.sin(rad) * 50;
    const x2 = 50 + Math.cos(rad) * 50, y2 = 50 + Math.sin(rad) * 50;
    const stops = g.stops.map(s => `<stop offset="${s.offset * 100}%" stop-color="${s.color}" />`).join('');
    return `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">${stops}</linearGradient>`;
  }
  const stops = g.stops.map(s => `<stop offset="${s.offset * 100}%" stop-color="${s.color}" />`).join('');
  return `<radialGradient id="${id}" cx="50%" cy="50%">${stops}</radialGradient>`;
}

function shadowToFilter(shadows: Shape['shadows'], id: string): string {
  if (!shadows || shadows.length === 0) return '';
  const s = shadows[0];
  return `<filter id="${id}"><feDropShadow dx="${s.offsetX}" dy="${s.offsetY}" stdDeviation="${s.blur / 2}" flood-color="${s.color}" /></filter>`;
}

function buildPathD(shape: Shape): string {
  if (shape.pathData) return shape.pathData;
  const pts = shape.pathPoints;
  if (!pts || pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], pt = pts[i];
    if (prev.cp2 || pt.cp1) {
      const c1 = prev.cp2 || prev, c2 = pt.cp1 || pt;
      d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${pt.x} ${pt.y}`;
    } else {
      d += ` L ${pt.x} ${pt.y}`;
    }
  }
  if (shape.closePath) d += ' Z';
  return d;
}

function shapeToSvgElement(shape: Shape, allShapes: Shape[], defs: string[], idCounter: { n: number }): string {
  if (!shape.visible) return '';
  const attrs: string[] = [];
  const shadows = shape.shadows || (shape.shadow ? [shape.shadow] : []);
  let gradId = '';

  if (shape.gradient) {
    gradId = `grad-${idCounter.n++}`;
    defs.push(gradientToSvgDefs(shape.gradient, gradId));
  }

  if (shadows.length > 0) {
    const fid = `shadow-${idCounter.n++}`;
    defs.push(shadowToFilter(shadows, fid));
    attrs.push(`filter="url(#${fid})"`);
  }

  if (shape.opacity < 1) attrs.push(`opacity="${shape.opacity}"`);
  const transform: string[] = [];
  if (shape.rotation) transform.push(`rotate(${shape.rotation})`);
  if (shape.scaleX === -1 || shape.scaleY === -1) {
    transform.push(`scale(${shape.scaleX ?? 1},${shape.scaleY ?? 1})`);
  }

  const fill = shape.gradient ? `url(#${gradId})` : (shape.fill === 'transparent' ? 'none' : shape.fill);
  const stroke = shape.stroke === 'transparent' ? 'none' : shape.stroke;
  const sw = shape.strokeWidth;
  const dash = shape.strokeDash ? `stroke-dasharray="${shape.strokeDash.join(' ')}"` : '';

  switch (shape.type) {
    case 'rect':
    case 'frame': {
      const w = shape.width || 100, h = shape.height || 100;
      const cr = shape.cornerRadius || 0;
      const txStr = transform.length ? `transform="${transform.join(' ')}"` : '';
      const children = allShapes.filter(s => s.parentId === shape.id && s.visible);
      if (children.length > 0) {
        const clip = shape.clipContent !== false;
        const clipId = clip ? `clip-${idCounter.n++}` : '';
        if (clip) defs.push(`<clipPath id="${clipId}"><rect x="${shape.x}" y="${shape.y}" width="${w}" height="${h}" rx="${cr}" /></clipPath>`);
        let inner = `<rect x="${shape.x}" y="${shape.y}" width="${w}" height="${h}" rx="${cr}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash} ${attrs.join(' ')} />`;
        inner += children.map(c => shapeToSvgElement(c, allShapes, defs, idCounter)).join('');
        return `<g ${txStr} ${clip ? `clip-path="url(#${clipId})"` : ''}>${inner}</g>`;
      }
      return `<rect x="${shape.x}" y="${shape.y}" width="${w}" height="${h}" rx="${cr}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash} ${attrs.join(' ')} ${txStr} />`;
    }
    case 'circle': {
      const r = shape.radius || 50;
      const txStr = transform.length ? `transform="${transform.join(' ')}"` : '';
      return `<circle cx="${shape.x}" cy="${shape.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash} ${attrs.join(' ')} ${txStr} />`;
    }
    case 'text': {
      const txParts = [...transform];
      const txStr = txParts.length ? `transform="${txParts.join(' ')}"` : '';
      const style = [
        `font-size:${shape.fontSize || 24}px`,
        `font-family:${shape.fontFamily || 'sans-serif'}`,
        shape.fontWeight && shape.fontWeight !== 'normal' ? `font-weight:${shape.fontWeight}` : '',
        shape.letterSpacing ? `letter-spacing:${shape.letterSpacing}px` : '',
      ].filter(Boolean).join(';');
      const anchor = shape.textAlign === 'center' ? 'middle' : shape.textAlign === 'right' ? 'end' : 'start';
      const tx = shape.textAlign === 'center' ? (shape.width || 0) / 2 : shape.textAlign === 'right' ? (shape.width || 0) : 0;
      return `<text x="${shape.x + tx}" y="${shape.y + (shape.fontSize || 24)}" fill="${shape.fill}" text-anchor="${anchor}" style="${style}" ${attrs.join(' ')} ${txStr}>${escapeXml(shape.text || '')}</text>`;
    }
    case 'line': {
      const pts = shape.points || [0, 0, 100, 100];
      return `<line x1="${pts[0] + shape.x}" y1="${pts[1] + shape.y}" x2="${pts[2] + shape.x}" y2="${pts[3] + shape.y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" ${dash} ${attrs.join(' ')} />`;
    }
    case 'arrow': {
      const pts = shape.points || [0, 0, 150, 0];
      const markerId = `arrow-${idCounter.n++}`;
      defs.push(`<marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${stroke}" /></marker>`);
      return `<line x1="${pts[0] + shape.x}" y1="${pts[1] + shape.y}" x2="${pts[2] + shape.x}" y2="${pts[3] + shape.y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" marker-end="url(#${markerId})" ${attrs.join(' ')} />`;
    }
    case 'star': {
      const r = shape.radius || 50, ir = shape.innerRadius || 20, n = shape.numPoints || 5;
      const pts: string[] = [];
      for (let i = 0; i < n * 2; i++) {
        const angle = (Math.PI / n) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : ir;
        pts.push(`${shape.x + rad * Math.cos(angle)},${shape.y + rad * Math.sin(angle)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${attrs.join(' ')} />`;
    }
    case 'triangle': {
      const r = shape.radius || 50;
      const pts: string[] = [];
      for (let i = 0; i < 3; i++) {
        const angle = (2 * Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${shape.x + r * Math.cos(angle)},${shape.y + r * Math.sin(angle)}`);
      }
      return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${attrs.join(' ')} />`;
    }
    case 'path': {
      const d = buildPathD(shape);
      if (!d) return '';
      return `<path d="${d}" fill="${fill === 'none' || shape.fill === 'transparent' ? 'none' : fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${attrs.join(' ')} />`;
    }
    case 'image':
    case 'component': {
      if (!shape.src) return '';
      const w = shape.width || 100, h = shape.height || 100;
      const cr = shape.cornerRadius;
      if (cr) {
        const clipId = `img-clip-${idCounter.n++}`;
        defs.push(`<clipPath id="${clipId}"><rect x="${shape.x}" y="${shape.y}" width="${w}" height="${h}" rx="${cr}" /></clipPath>`);
        return `<image x="${shape.x}" y="${shape.y}" width="${w}" height="${h}" href="${shape.src}" clip-path="url(#${clipId})" ${attrs.join(' ')} />`;
      }
      return `<image x="${shape.x}" y="${shape.y}" width="${w}" height="${h}" href="${shape.src}" ${attrs.join(' ')} />`;
    }
    default:
      return '';
  }
}

export function shapesToSvg(shapes: Shape[], options?: { width?: number; height?: number; background?: string; selectedIds?: string[] }): string {
  const { width = 1920, height = 1080, background, selectedIds } = options || {};
  const targetShapes = selectedIds && selectedIds.length > 0
    ? shapes.filter(s => selectedIds.includes(s.id))
    : shapes.filter(s => s.visible && !s.parentId);

  const defs: string[] = [];
  const idCounter = { n: 0 };
  const elements = targetShapes.map(s => shapeToSvgElement(s, shapes, defs, idCounter));

  const bgRect = background ? `<rect width="${width}" height="${height}" fill="${background}" />` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${defs.length > 0 ? `  <defs>\n${defs.map(d => `    ${d}`).join('\n')}\n  </defs>` : ''}
  ${bgRect}
${elements.map(e => `  ${e}`).join('\n')}
</svg>`;
}

export function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPngMultiRes(stageGetter: () => { toDataURL: (opts: Record<string, unknown>) => string; scaleX: (v?: number) => number; scaleY: (v?: number) => number; x: (v?: number) => number; y: (v?: number) => number; draw: () => void }, filename: string, scale: number) {
  const stage = stageGetter();
  if (!stage) return;
  const oldScale = { x: stage.scaleX(), y: stage.scaleY() };
  const oldPos = { x: stage.x(), y: stage.y() };
  stage.scaleX(scale); stage.scaleY(scale);
  stage.x(0); stage.y(0);
  stage.draw();
  const dataUrl = stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
  stage.scaleX(oldScale.x); stage.scaleY(oldScale.y);
  stage.x(oldPos.x); stage.y(oldPos.y);
  stage.draw();
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
