import type { Shape, ShapeType } from './types';

const VALID_TYPES = new Set<ShapeType>([
  'rect', 'circle', 'text', 'line', 'image', 'star', 'arrow', 'triangle', 'component', 'frame', 'group', 'path',
]);

/** Drop malformed entries; require finite coordinates so bad JSON can't wipe the canvas with NaN. */
export function sanitizeImportedShapes(data: unknown): Shape[] | null {
  if (!Array.isArray(data)) return null;
  const out: Shape[] = [];
  const seen = new Set<string>();
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Partial<Shape>;
    if (typeof o.id !== 'string' || o.id.length === 0) continue;
    if (seen.has(o.id)) continue;
    if (typeof o.type !== 'string' || !VALID_TYPES.has(o.type as ShapeType)) continue;
    if (typeof o.x !== 'number' || !Number.isFinite(o.x)) continue;
    if (typeof o.y !== 'number' || !Number.isFinite(o.y)) continue;
    seen.add(o.id);
    out.push(raw as Shape);
  }
  return out.length > 0 ? out : null;
}
