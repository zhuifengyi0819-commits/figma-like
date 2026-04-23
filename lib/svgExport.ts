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

/** Generate SVG path with per-corner radius.
 *  cr can be number (all corners same) or [TL, TR, BR, BL].
 *  Generates a path with rounded arcs at each corner. */
function roundedRectPath(w: number, h: number, cr: number | [number, number, number, number]): string {
  const [tl, tr, br, bl] = typeof cr === 'number'
    ? [cr, cr, cr, cr]
    : cr;
  const r = (v: number) => Math.min(v, Math.min(w, h) / 2);
  return [
    `M ${r(tl)} 0`,
    `L ${w - r(tr)} 0`,
    `Q ${w} 0 ${w} ${r(tr)}`,
    `L ${w} ${h - r(br)}`,
    `Q ${w} ${h} ${w - r(br)} ${h}`,
    `L ${r(bl)} ${h}`,
    `Q 0 ${h} 0 ${h - r(bl)}`,
    `L 0 ${r(tl)}`,
    `Q 0 0 ${r(tl)} 0`,
    'Z',
  ].join(' ');
}

/** Resolve fill color for SVG from Fill object */
function fillColor(f: { type?: string; color?: string; gradient?: Gradient }, defs: string[], idCounter: { n: number }): string {
  if (f.type === 'solid' || !f.type) return f.color || '#000000';
  if (f.type === 'linear' || f.type === 'radial') {
    if (!f.gradient) return '#000000';
    const gid = `grad-${idCounter.n++}`;
    defs.push(gradientToSvgDefs(f.gradient, gid));
    return `url(#${gid})`;
  }
  return f.color || '#000000';
}

/** Resolve stroke attrs from Stroke object */
function strokeAttrs(s: { color?: string; width?: number; style?: string; opacity?: number }, defs: string[], idCounter: { n: number }): string {
  const color = s.color === 'transparent' || !s.color ? 'none' : s.color;
  const width = s.width ?? 1;
  const dash = s.style === 'dashed' ? `stroke-dasharray="4 2"` : '';
  const opacity = s.opacity !== undefined && s.opacity < 1 ? `stroke-opacity="${s.opacity}"` : '';
  return `${color !== 'none' ? `stroke="${color}"` : 'stroke="none"'} stroke-width="${width}" ${dash} ${opacity}`.trim();
}

function shapeToSvgElement(shape: Shape, allShapes: Shape[], defs: string[], idCounter: { n: number }): string {
  if (!shape.visible) return '';
  const shadows = shape.shadows || (shape.shadow ? [shape.shadow] : []);
  let gradId = '';

  if (shadows.length > 0) {
    const fid = `shadow-${idCounter.n++}`;
    defs.push(shadowToFilter(shadows, fid));
  }

  const commonAttrs: string[] = [];
  if (shape.opacity !== undefined && shape.opacity < 1) commonAttrs.push(`opacity="${shape.opacity}"`);
  const transform: string[] = [];
  if (shape.rotation) transform.push(`rotate(${shape.rotation})`);
  if (shape.scaleX === -1 || shape.scaleY === -1) {
    transform.push(`scale(${shape.scaleX ?? 1},${shape.scaleY ?? 1})`);
  }
  const txStr = transform.length ? `transform="${transform.join(' ')}"` : '';

  switch (shape.type) {
    case 'rect':
    case 'frame': {
      const w = shape.width || 100, h = shape.height || 100;
      const cr = shape.cornerRadius ?? 0;
      const children = allShapes.filter(s => s.parentId === shape.id && s.visible);

      // Build multi-fill: each fill is a separate rect layered
      const fills = shape.fills && shape.fills.length > 0
        ? shape.fills.filter(f => f.visible !== false)
        : [{ type: 'solid', color: shape.fill || '#3D3D45' }];

      const strokes = shape.strokes && shape.strokes.length > 0
        ? shape.strokes.filter(s => {
            const c = s.color;
            return c !== 'transparent' && c !== 'none';
          })
        : (shape.stroke && shape.stroke !== 'transparent'
            ? [{ color: shape.stroke, width: shape.strokeWidth ?? 1, style: shape.strokeDash ? 'dashed' : 'solid', opacity: 1 }]
            : []);

      const clip = shape.clipContent !== false;
      const clipId = clip ? `clip-${idCounter.n++}` : '';
      if (clip && children.length > 0) {
        const clipPathStr = roundedRectPath(w, h, cr);
        defs.push(`<clipPath id="${clipId}"><path d="${clipPathStr}" /></clipPath>`);
      }

      // Build layered elements
      const els: string[] = [];

      // For single fill + stroke: use rect directly
      if (fills.length === 1 && strokes.length <= 1) {
        const fc = fillColor(fills[0], defs, idCounter);
        const st = strokes[0] ? strokeAttrs(strokes[0], defs, idCounter) : 'stroke="none"';
        const rx = typeof cr === 'number' ? ` rx="${cr}"` : '';
        els.push(`<path d="${roundedRectPath(w, h, cr)}" fill="${fc}" ${st} ${commonAttrs.join(' ')} ${txStr} />`);
      } else {
        // Multi-fill/stroke: each fill + each stroke as separate rect
        const rx = typeof cr === 'number' ? ` rx="${cr}"` : '';
        for (let fi = 0; fi < fills.length; fi++) {
          const f = fills[fi];
          const fc = fillColor(f, defs, idCounter);
          const st = strokes[fi] ? strokeAttrs(strokes[fi], defs, idCounter) : 'stroke="none"';
          els.push(`<path d="${roundedRectPath(w, h, cr)}" fill="${fc}" ${st} ${commonAttrs.join(' ')} ${txStr} />`);
        }
        // Extra strokes beyond fill count
        for (let si = fills.length; si < strokes.length; si++) {
          const st = strokeAttrs(strokes[si], defs, idCounter);
          els.push(`<path d="${roundedRectPath(w, h, cr)}" fill="none" ${st} ${commonAttrs.join(' ')} ${txStr} />`);
        }
      }

      let inner = els.join('');
      if (children.length > 0) {
        inner += children.map(c => shapeToSvgElement(c, allShapes, defs, idCounter)).join('');
      }

      if (clip && children.length > 0) {
        return `<g ${txStr} clip-path="url(#${clipId})">${inner}</g>`;
      }
      return inner;
    }
    case 'circle': {
      const r = shape.radius || 50;
      // Build multi-stroke: each stroke renders as concentric circle
      const strokes = shape.strokes && shape.strokes.length > 0
        ? shape.strokes.filter(s => {
          const c = s.color;
          return c !== 'transparent' && c !== 'none';
        })
        : (shape.stroke && shape.stroke !== 'transparent'
            ? [{ color: shape.stroke, width: shape.strokeWidth ?? 1, style: shape.strokeDash ? 'dashed' : 'solid', opacity: 1 }]
            : []);
      const fills = shape.fills && shape.fills.length > 0
        ? shape.fills.filter(f => f.visible !== false)
        : [{ type: 'solid' as const, color: shape.fill || '#3D3D45' }];

      const fillColorStr = fillColor(fills[0], defs, idCounter);
      const fillGrad = fills[0].type !== 'solid' && fills[0].gradient
        ? (() => { const gid = `grad-${idCounter.n++}`; defs.push(gradientToSvgDefs(fills[0].gradient!, gid)); return `url(#${gid})`; })()
        : undefined;

      if (strokes.length <= 1) {
        const stroke = strokes[0] ? strokeAttrs(strokes[0], defs, idCounter) : 'stroke="none"';
        return `<circle cx="${shape.x}" cy="${shape.y}" r="${r}" fill="${fillGrad || fillColorStr}" ${stroke} ${commonAttrs.join(' ')} ${txStr} />`;
      }
      // Multi-stroke: multiple concentric circles
      const circles: string[] = [];
      for (let si = 0; si < strokes.length; si++) {
        const s = strokes[si];
        const strokeAttr = strokeAttrs(s, defs, idCounter);
        circles.push(`<circle cx="${shape.x}" cy="${shape.y}" r="${r}" fill="${si === 0 ? (fillGrad || fillColorStr) : 'none'}" ${strokeAttr} ${commonAttrs.join(' ')} ${txStr} />`);
      }
      return circles.join('');
    }
    case 'text': {
      const style = [
        `font-size:${shape.fontSize || 24}px`,
        `font-family:${shape.fontFamily || 'sans-serif'}`,
        shape.fontWeight && shape.fontWeight !== 'normal' ? `font-weight:${shape.fontWeight}` : '',
        shape.letterSpacing ? `letter-spacing:${shape.letterSpacing}px` : '',
      ].filter(Boolean).join(';');
      const anchor = shape.textAlign === 'center' ? 'middle' : shape.textAlign === 'right' ? 'end' : 'start';
      const tx = shape.textAlign === 'center' ? (shape.width || 0) / 2 : shape.textAlign === 'right' ? (shape.width || 0) : 0;
      return `<text x="${shape.x + tx}" y="${shape.y + (shape.fontSize || 24)}" fill="${shape.fill}" text-anchor="${anchor}" style="${style}" ${commonAttrs.join(' ')} ${txStr}>${escapeXml(shape.text || '')}</text>`;
    }
    case 'line': {
      const pts = shape.points || [0, 0, 100, 100];
      const stroke = shape.stroke === 'transparent' ? 'none' : shape.stroke;
      const sw = shape.strokeWidth;
      const dash = shape.strokeDash ? `stroke-dasharray="${shape.strokeDash.join(' ')}"` : '';
      return `<line x1="${pts[0] + shape.x}" y1="${pts[1] + shape.y}" x2="${pts[2] + shape.x}" y2="${pts[3] + shape.y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" ${dash} ${commonAttrs.join(' ')} />`;
    }
    case 'arrow': {
      const pts = shape.points || [0, 0, 150, 0];
      const stroke = shape.stroke === 'transparent' ? 'none' : shape.stroke;
      const sw = shape.strokeWidth;
      const markerId = `arrow-${idCounter.n++}`;
      defs.push(`<marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${stroke}" /></marker>`);
      return `<line x1="${pts[0] + shape.x}" y1="${pts[1] + shape.y}" x2="${pts[2] + shape.x}" y2="${pts[3] + shape.y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" marker-end="url(#${markerId})" ${commonAttrs.join(' ')} />`;
    }
    case 'star': {
      const r = shape.radius || 50, ir = shape.innerRadius || 20, n = shape.numPoints || 5;
      const pts: string[] = [];
      for (let i = 0; i < n * 2; i++) {
        const angle = (Math.PI / n) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : ir;
        pts.push(`${shape.x + rad * Math.cos(angle)},${shape.y + rad * Math.sin(angle)}`);
      }
      const fill = shape.fill === 'transparent' ? 'none' : (shape.fill || '#000');
      const stroke = shape.stroke === 'transparent' ? 'none' : shape.stroke;
      return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${shape.strokeWidth || 1}" ${commonAttrs.join(' ')} />`;
    }
    case 'triangle': {
      const r = shape.radius || 50;
      const pts: string[] = [];
      for (let i = 0; i < 3; i++) {
        const angle = (2 * Math.PI / 3) * i - Math.PI / 2;
        pts.push(`${shape.x + r * Math.cos(angle)},${shape.y + r * Math.sin(angle)}`);
      }
      const fill = shape.fill === 'transparent' ? 'none' : (shape.fill || '#000');
      const stroke = shape.stroke === 'transparent' ? 'none' : shape.stroke;
      return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${shape.strokeWidth || 1}" ${commonAttrs.join(' ')} />`;
    }
    case 'path': {
      const d = buildPathD(shape);
      if (!d) return '';
      const fill = shape.fill === 'transparent' || shape.fill === 'none' ? 'none' : (shape.fill || '#000');
      const stroke = shape.stroke === 'transparent' ? 'none' : shape.stroke;
      return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${shape.strokeWidth || 1}" stroke-linecap="round" stroke-linejoin="round" ${commonAttrs.join(' ')} />`;
    }
    case 'image':
    case 'component': {
      if (!shape.src) return '';
      const w = shape.width || 100, h = shape.height || 100;
      const cr = shape.cornerRadius;
      if (cr) {
        const clipId = `img-clip-${idCounter.n++}`;
        defs.push(`<clipPath id="${clipId}"><rect x="${shape.x}" y="${shape.y}" width="${w}" height="${h}" rx="${cr}" /></clipPath>`);
        return `<image x="${shape.x}" y="${shape.y}" width="${w}" height="${h}" href="${shape.src}" clip-path="url(#${clipId})" ${commonAttrs.join(' ')} />`;
      }
      return `<image x="${shape.x}" y="${shape.y}" width="${w}" height="${h}" href="${shape.src}" ${commonAttrs.join(' ')} />`;
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
