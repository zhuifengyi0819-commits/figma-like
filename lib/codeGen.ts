import { Shape } from './types';

// ===================== CSS Generation =====================

export function shapeToCss(shape: Shape, _allShapes?: Shape[]): string {
  const props: string[] = [];

  if (shape.type === 'rect' || shape.type === 'image' || shape.type === 'component' || shape.type === 'frame') {
    if (shape.width) props.push(`width: ${Math.round(shape.width)}px`);
    if (shape.height) props.push(`height: ${Math.round(shape.height)}px`);
  }

  if (shape.type === 'circle') {
    const d = (shape.radius || 50) * 2;
    props.push(`width: ${Math.round(d)}px`);
    props.push(`height: ${Math.round(d)}px`);
    props.push(`border-radius: 50%`);
  }

  // Frame → flex container
  if (shape.type === 'frame' && shape.autoLayout) {
    const al = shape.autoLayout;
    props.push(`display: flex`);
    props.push(`flex-direction: ${al.direction === 'horizontal' ? 'row' : 'column'}`);
    props.push(`gap: ${al.gap}px`);
    props.push(`padding: ${al.paddingTop}px ${al.paddingRight}px ${al.paddingBottom}px ${al.paddingLeft}px`);
    const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
    props.push(`align-items: ${alignMap[al.alignItems]}`);
    const justifyMap = { start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between' };
    props.push(`justify-content: ${justifyMap[al.justifyContent]}`);
    if (shape.clipContent !== false) props.push(`overflow: hidden`);
  } else if (shape.type === 'frame') {
    props.push(`position: relative`);
    if (shape.clipContent !== false) props.push(`overflow: hidden`);
  }

  if (shape.type === 'text') {
    if (shape.fontSize) props.push(`font-size: ${shape.fontSize}px`);
    if (shape.fontFamily) props.push(`font-family: ${shape.fontFamily}`);
    if (shape.fontWeight && shape.fontWeight !== 'normal') props.push(`font-weight: ${shape.fontWeight}`);
    if (shape.textAlign && shape.textAlign !== 'left') props.push(`text-align: ${shape.textAlign}`);
    if (shape.lineHeight && shape.lineHeight !== 1.2) props.push(`line-height: ${shape.lineHeight}`);
    if (shape.letterSpacing) props.push(`letter-spacing: ${shape.letterSpacing}px`);
    if (shape.width) props.push(`width: ${Math.round(shape.width)}px`);
    props.push(`color: ${shape.fill}`);
  } else if (shape.type !== 'line' && shape.type !== 'arrow' && shape.type !== 'path') {
    if (shape.gradient) {
      const g = shape.gradient;
      const stopsStr = g.stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ');
      if (g.type === 'linear') props.push(`background: linear-gradient(${g.angle || 0}deg, ${stopsStr})`);
      else props.push(`background: radial-gradient(circle, ${stopsStr})`);
    } else if (shape.fills && shape.fills.length > 0) {
      const solidFills = shape.fills.filter(f => f.type === 'solid' && f.color);
      if (solidFills.length === 1) {
        props.push(`background-color: ${solidFills[0].color}`);
      } else if (solidFills.length > 1) {
        props.push(`background: ${solidFills.map(f => f.color).join(', ')}`);
      }
    } else if (shape.fill && shape.fill !== 'transparent') {
      props.push(`background-color: ${shape.fill}`);
    }
  }

  if ((shape.type === 'rect' || shape.type === 'frame') && shape.cornerRadius) {
    props.push(`border-radius: ${shape.cornerRadius}px`);
  }

  if (shape.stroke && shape.stroke !== 'transparent' && shape.strokeWidth > 0) {
    const style = shape.strokeDash ? 'dashed' : 'solid';
    props.push(`border: ${shape.strokeWidth}px ${style} ${shape.stroke}`);
  }

  if (shape.opacity !== undefined && shape.opacity < 1) {
    props.push(`opacity: ${shape.opacity}`);
  }

  if (shape.rotation) {
    props.push(`transform: rotate(${Math.round(shape.rotation)}deg)`);
  }

  // Multiple shadows
  const shadows = shape.shadows || (shape.shadow ? [shape.shadow] : []);
  if (shadows.length > 0) {
    props.push(`box-shadow: ${shadows.map(s => `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color}`).join(', ')}`);
  }

  if (shape.type !== 'frame') {
    props.push(`position: absolute`);
    props.push(`left: ${Math.round(shape.x)}px`);
    props.push(`top: ${Math.round(shape.y)}px`);
  }

  return `.${sanitizeName(shape.name)} {\n${props.map(p => `  ${p};`).join('\n')}\n}`;
}

// ===================== React/JSX Generation =====================

export function shapeToReact(shape: Shape): string {
  if (shape.type === 'text') return textToReact(shape);
  if (shape.type === 'image') return imageToReact(shape);
  if (shape.type === 'line' || shape.type === 'arrow') return svgLineToReact(shape);
  if (shape.type === 'path') return pathToReact(shape);

  const style = buildReactStyle(shape);
  const styleStr = formatReactStyle(style);
  const tag = shape.type === 'frame' ? 'div' : 'div';

  return `<${tag}\n  className="${sanitizeName(shape.name)}"\n  style={${styleStr}}\n/>`;
}

function textToReact(shape: Shape): string {
  const style: Record<string, string | number> = {};
  if (shape.fontSize) style.fontSize = shape.fontSize;
  if (shape.fontFamily) style.fontFamily = shape.fontFamily;
  if (shape.fontWeight && shape.fontWeight !== 'normal') style.fontWeight = shape.fontWeight;
  if (shape.textAlign && shape.textAlign !== 'left') style.textAlign = shape.textAlign;
  if (shape.width) style.width = shape.width;
  style.color = shape.fill;
  if (shape.opacity < 1) style.opacity = shape.opacity;
  if (shape.rotation) style.transform = `rotate(${Math.round(shape.rotation)}deg)`;

  const styleStr = formatReactStyle(style);
  return `<span\n  style={${styleStr}}\n>\n  ${shape.text || 'Text'}\n</span>`;
}

function imageToReact(shape: Shape): string {
  const style: Record<string, string | number> = {};
  if (shape.width) style.width = shape.width;
  if (shape.height) style.height = shape.height;
  if (shape.cornerRadius) style.borderRadius = shape.cornerRadius;
  if (shape.opacity < 1) style.opacity = shape.opacity;
  style.objectFit = 'cover';

  const styleStr = formatReactStyle(style);
  return `<img\n  src="${shape.src?.substring(0, 50)}..."\n  alt="${shape.name}"\n  style={${styleStr}}\n/>`;
}

function svgLineToReact(shape: Shape): string {
  const pts = shape.points || [0, 0, 100, 100];
  if (shape.type === 'arrow') {
    return `<svg width="100%" height="100%">\n  <defs>\n    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"\n      markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n      <path d="M 0 0 L 10 5 L 0 10 z" fill="${shape.stroke}" />\n    </marker>\n  </defs>\n  <line x1="${pts[0]}" y1="${pts[1]}" x2="${pts[2]}" y2="${pts[3]}"\n    stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"\n    marker-end="url(#arrow)" />\n</svg>`;
  }
  return `<svg width="100%" height="100%">\n  <line x1="${pts[0]}" y1="${pts[1]}" x2="${pts[2]}" y2="${pts[3]}"\n    stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" />\n</svg>`;
}

function pathToReact(shape: Shape): string {
  const d = shape.pathData || buildPathData(shape);
  return `<svg width="100%" height="100%">\n  <path d="${d}"\n    fill="${shape.fill === 'transparent' ? 'none' : shape.fill}"\n    stroke="${shape.stroke}"\n    stroke-width="${shape.strokeWidth}"\n    stroke-linecap="round"\n    stroke-linejoin="round" />\n</svg>`;
}

function buildPathData(shape: Shape): string {
  const pts = shape.pathPoints;
  if (!pts || pts.length === 0) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const pt = pts[i];
    if (prev.cp2 || pt.cp1) {
      const c1 = prev.cp2 || prev;
      const c2 = pt.cp1 || pt;
      d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${pt.x} ${pt.y}`;
    } else {
      d += ` L ${pt.x} ${pt.y}`;
    }
  }
  if (shape.closePath) d += ' Z';
  return d;
}

function buildReactStyle(shape: Shape): Record<string, string | number> {
  const s: Record<string, string | number> = {};

  if (shape.width) s.width = shape.width;
  if (shape.height) s.height = shape.height;

  if (shape.type === 'circle') {
    const d = (shape.radius || 50) * 2;
    s.width = d; s.height = d; s.borderRadius = '50%';
  }

  if (shape.type === 'frame' && shape.autoLayout) {
    const al = shape.autoLayout;
    s.display = 'flex';
    s.flexDirection = al.direction === 'horizontal' ? 'row' : 'column';
    s.gap = al.gap;
    s.padding = `${al.paddingTop}px ${al.paddingRight}px ${al.paddingBottom}px ${al.paddingLeft}px`;
    const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
    s.alignItems = alignMap[al.alignItems];
    if (shape.clipContent !== false) s.overflow = 'hidden';
  }

  if (shape.fill && shape.fill !== 'transparent') {
    if (shape.fill.includes('gradient')) { s.background = shape.fill; }
    else { s.backgroundColor = shape.fill; }
  }

  if ((shape.type === 'rect' || shape.type === 'frame') && shape.cornerRadius) {
    s.borderRadius = shape.cornerRadius;
  }

  if (shape.stroke && shape.stroke !== 'transparent' && shape.strokeWidth > 0) {
    const style = shape.strokeDash ? 'dashed' : 'solid';
    s.border = `${shape.strokeWidth}px ${style} ${shape.stroke}`;
  }

  if (shape.opacity < 1) s.opacity = shape.opacity;
  if (shape.rotation) s.transform = `rotate(${Math.round(shape.rotation)}deg)`;

  const shadows = shape.shadows || (shape.shadow ? [shape.shadow] : []);
  if (shadows.length > 0) {
    s.boxShadow = shadows.map(sh => `${sh.offsetX}px ${sh.offsetY}px ${sh.blur}px ${sh.color}`).join(', ');
  }

  return s;
}

// ===================== Tailwind Generation =====================

export function shapeToTailwind(shape: Shape): string {
  const cls: string[] = [];

  if (shape.type === 'rect' || shape.type === 'image' || shape.type === 'component' || shape.type === 'frame') {
    if (shape.width) cls.push(`w-[${Math.round(shape.width)}px]`);
    if (shape.height) cls.push(`h-[${Math.round(shape.height)}px]`);
  }

  if (shape.type === 'circle') {
    const d = (shape.radius || 50) * 2;
    cls.push(`w-[${Math.round(d)}px]`); cls.push(`h-[${Math.round(d)}px]`); cls.push(`rounded-full`);
  }

  if (shape.type === 'frame' && shape.autoLayout) {
    cls.push('flex');
    cls.push(shape.autoLayout.direction === 'horizontal' ? 'flex-row' : 'flex-col');
    cls.push(`gap-[${shape.autoLayout.gap}px]`);
    const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = shape.autoLayout;
    if (pt === pr && pr === pb && pb === pl) cls.push(`p-[${pt}px]`);
    else cls.push(`pt-[${pt}px] pr-[${pr}px] pb-[${pb}px] pl-[${pl}px]`);
    const alignMap = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' };
    cls.push(alignMap[shape.autoLayout.alignItems]);
    if (shape.clipContent !== false) cls.push('overflow-hidden');
  }

  if (shape.type === 'text') {
    if (shape.fontSize) cls.push(`text-[${shape.fontSize}px]`);
    if (shape.fontWeight === 'bold' || shape.fontWeight === '700') cls.push('font-bold');
    else if (shape.fontWeight === '600') cls.push('font-semibold');
    else if (shape.fontWeight === '500') cls.push('font-medium');
    if (shape.textAlign === 'center') cls.push('text-center');
    if (shape.textAlign === 'right') cls.push('text-right');
    if (shape.width) cls.push(`w-[${Math.round(shape.width)}px]`);
    cls.push(`text-[${shape.fill}]`);
  } else {
    if (shape.fill && shape.fill !== 'transparent' && !shape.fill.includes('gradient')) {
      cls.push(`bg-[${shape.fill}]`);
    }
  }

  if ((shape.type === 'rect' || shape.type === 'frame') && shape.cornerRadius) {
    const r = shape.cornerRadius;
    if (r <= 2) cls.push('rounded-sm');
    else if (r <= 4) cls.push('rounded');
    else if (r <= 6) cls.push('rounded-md');
    else if (r <= 8) cls.push('rounded-lg');
    else if (r <= 12) cls.push('rounded-xl');
    else if (r <= 16) cls.push('rounded-2xl');
    else if (r >= 9999) cls.push('rounded-full');
    else cls.push(`rounded-[${r}px]`);
  }

  if (shape.stroke && shape.stroke !== 'transparent' && shape.strokeWidth > 0) {
    if (shape.strokeWidth === 1) cls.push('border');
    else cls.push(`border-[${shape.strokeWidth}px]`);
    cls.push(`border-[${shape.stroke}]`);
    if (shape.strokeDash) cls.push('border-dashed');
  }

  if (shape.opacity !== undefined && shape.opacity < 1) {
    cls.push(`opacity-${Math.round(shape.opacity * 100)}`);
  }

  if (shape.rotation) {
    cls.push(`rotate-[${Math.round(shape.rotation)}deg]`);
  }

  const shadows = shape.shadows || (shape.shadow ? [shape.shadow] : []);
  if (shadows.length > 0) {
    cls.push(`shadow-[${shadows.map(s => `${s.offsetX}px_${s.offsetY}px_${s.blur}px_${s.color}`).join(',_')}]`);
  }

  const tag = shape.type === 'text' ? 'span' : shape.type === 'image' ? 'img' : 'div';
  const classStr = cls.join(' ');

  if (shape.type === 'text') {
    return `<${tag} className="${classStr}">\n  ${shape.text || 'Text'}\n</${tag}>`;
  }
  if (shape.type === 'image') {
    return `<${tag}\n  src="..."\n  alt="${shape.name}"\n  className="${classStr} object-cover"\n/>`;
  }
  return `<${tag} className="${classStr}" />`;
}

// ===================== HTML Generation =====================

export function shapeToHtml(shape: Shape): string {
  const style = shapeToCssInline(shape);
  if (shape.type === 'text') return `<span style="${style}">${shape.text || 'Text'}</span>`;
  if (shape.type === 'image') return `<img src="..." alt="${shape.name}" style="${style}" />`;
  if (shape.type === 'path') {
    const d = shape.pathData || buildPathData(shape);
    return `<svg><path d="${d}" fill="${shape.fill === 'transparent' ? 'none' : shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" /></svg>`;
  }
  return `<div style="${style}"></div>`;
}

function shapeToCssInline(shape: Shape): string {
  const props: string[] = [];
  if (shape.type === 'rect' || shape.type === 'image' || shape.type === 'component' || shape.type === 'frame') {
    if (shape.width) props.push(`width:${Math.round(shape.width)}px`);
    if (shape.height) props.push(`height:${Math.round(shape.height)}px`);
  }
  if (shape.type === 'circle') {
    const d = (shape.radius || 50) * 2;
    props.push(`width:${d}px`); props.push(`height:${d}px`); props.push(`border-radius:50%`);
  }
  if (shape.type === 'frame' && shape.autoLayout) {
    props.push(`display:flex`);
    props.push(`flex-direction:${shape.autoLayout.direction === 'horizontal' ? 'row' : 'column'}`);
    props.push(`gap:${shape.autoLayout.gap}px`);
  }
  if (shape.type === 'text') {
    if (shape.fontSize) props.push(`font-size:${shape.fontSize}px`);
    props.push(`color:${shape.fill}`);
  } else if (shape.fill && shape.fill !== 'transparent') {
    props.push(`background:${shape.fill}`);
  }
  if ((shape.type === 'rect' || shape.type === 'frame') && shape.cornerRadius) props.push(`border-radius:${shape.cornerRadius}px`);
  if (shape.stroke && shape.stroke !== 'transparent' && shape.strokeWidth > 0) {
    props.push(`border:${shape.strokeWidth}px ${shape.strokeDash ? 'dashed' : 'solid'} ${shape.stroke}`);
  }
  if (shape.opacity < 1) props.push(`opacity:${shape.opacity}`);
  const shadows = shape.shadows || (shape.shadow ? [shape.shadow] : []);
  if (shadows.length > 0) props.push(`box-shadow:${shadows.map(s => `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.color}`).join(', ')}`);
  return props.join('; ');
}

// ===================== Multi-shape page generation =====================

export function shapesToFullReact(shapes: Shape[], componentName = 'Design'): string {
  const lines: string[] = [];
  lines.push(`export default function ${componentName}() {`);
  lines.push(`  return (`);
  lines.push(`    <div className="relative" style={{ width: 1920, height: 1080 }}>`);

  const topLevel = shapes.filter(s => s.visible && !s.parentId);
  for (const shape of topLevel) {
    renderShapeReact(shape, shapes, '      ', lines);
  }

  lines.push(`    </div>`);
  lines.push(`  );`);
  lines.push(`}`);
  return lines.join('\n');
}

function renderShapeReact(shape: Shape, allShapes: Shape[], indent: string, lines: string[]) {
  const style = buildReactStyle(shape);
  if (shape.type !== 'frame') {
    style.position = 'absolute';
    style.left = Math.round(shape.x);
    style.top = Math.round(shape.y);
  }
  const styleStr = formatReactStyle(style);

  if (shape.type === 'text') {
    lines.push(`${indent}<span style={${styleStr}}>${shape.text || ''}</span>`);
  } else if (shape.type === 'image') {
    lines.push(`${indent}<img src="..." alt="${shape.name}" style={${styleStr}} />`);
  } else if (shape.type === 'frame') {
    const children = allShapes.filter(s => s.parentId === shape.id && s.visible);
    if (children.length > 0) {
      lines.push(`${indent}<div style={${styleStr}}>`);
      for (const child of children) {
        renderShapeReact(child, allShapes, indent + '  ', lines);
      }
      lines.push(`${indent}</div>`);
    } else {
      lines.push(`${indent}<div style={${styleStr}} />`);
    }
  } else {
    lines.push(`${indent}<div style={${styleStr}} />`);
  }
}

export function shapesToFullHtml(shapes: Shape[]): string {
  const lines: string[] = [];
  lines.push(`<!DOCTYPE html>`);
  lines.push(`<html lang="zh">`);
  lines.push(`<head>`);
  lines.push(`  <meta charset="UTF-8" />`);
  lines.push(`  <meta name="viewport" content="width=device-width, initial-scale=1.0" />`);
  lines.push(`  <title>Design Export</title>`);
  lines.push(`  <style>`);
  lines.push(`    * { margin: 0; padding: 0; box-sizing: border-box; }`);
  lines.push(`    body { font-family: -apple-system, system-ui, sans-serif; }`);
  lines.push(`    .canvas { position: relative; width: 1920px; height: 1080px; }`);

  for (const shape of shapes.filter(s => s.visible)) {
    lines.push(`    ${shapeToCss(shape, shapes)}`);
  }

  lines.push(`  </style>`);
  lines.push(`</head>`);
  lines.push(`<body>`);
  lines.push(`  <div class="canvas">`);

  for (const shape of shapes.filter(s => s.visible && !s.parentId)) {
    renderShapeHtml(shape, shapes, '    ', lines);
  }

  lines.push(`  </div>`);
  lines.push(`</body>`);
  lines.push(`</html>`);
  return lines.join('\n');
}

function renderShapeHtml(shape: Shape, allShapes: Shape[], indent: string, lines: string[]) {
  const cls = sanitizeName(shape.name);
  if (shape.type === 'text') {
    lines.push(`${indent}<span class="${cls}">${shape.text || ''}</span>`);
  } else if (shape.type === 'image') {
    lines.push(`${indent}<img class="${cls}" src="..." alt="${shape.name}" />`);
  } else if (shape.type === 'frame') {
    const children = allShapes.filter(s => s.parentId === shape.id && s.visible);
    lines.push(`${indent}<div class="${cls}">`);
    for (const child of children) {
      renderShapeHtml(child, allShapes, indent + '  ', lines);
    }
    lines.push(`${indent}</div>`);
  } else {
    lines.push(`${indent}<div class="${cls}"></div>`);
  }
}

// ===================== Helpers =====================

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'element';
}

function formatReactStyle(style: Record<string, string | number>): string {
  const entries = Object.entries(style);
  if (entries.length === 0) return '{}';
  if (entries.length <= 3) {
    const inner = entries.map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : v}`).join(', ');
    return `{ ${inner} }`;
  }
  const inner = entries.map(([k, v]) => `  ${k}: ${typeof v === 'string' ? `'${v}'` : v},`).join('\n');
  return `{\n${inner}\n}`;
}
