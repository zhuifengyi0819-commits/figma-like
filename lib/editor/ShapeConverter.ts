// lib/editor/ShapeConverter.ts
// Converts between flat Shape objects and hierarchical SGNode objects.
// Provides bidirectional sync between the legacy Shape model and the Scene Graph.

import { nanoid } from 'nanoid';
import type {
  SGNode,
  SGNodeType,
  PageNode,
  FrameNode,
  GroupNode,
  RectangleNode,
  EllipseNode,
  TextNode,
  LineNode,
  PolygonNode,
  StarNode,
  PenNode,
  ImageNode,
  StickyNode,
  BooleanNode,
  ComponentNode,
  InstanceNode,
} from '@/lib/scene-graph/types';
import type { Shape, Fill, Shadow, BlurEffect, LayoutGrid, Constraints, BlendMode } from '@/lib/types';
import type { SceneGraph } from '@/lib/scene-graph/SceneGraph';

// ============================================================
// Shared Helpers
// ============================================================

/** Map Shape.type → SGNodeType */
function shapeTypeToSGType(shapeType: Shape['type']): SGNodeType {
  switch (shapeType) {
    case 'rect':    return 'rectangle';
    case 'circle':  return 'ellipse';
    case 'text':    return 'text';
    case 'line':    return 'line';
    case 'image':   return 'image';
    case 'star':    return 'star';
    case 'triangle':return 'polygon';
    case 'frame':   return 'frame';
    case 'group':   return 'group';
    case 'path':    return 'pen';
    case 'component': return 'component';
    case 'arrow':   return 'line'; // arrows treated as lines in SG
    default:        return 'rectangle';
  }
}

// ---- Fill helpers ----

function shapeFillsToSGFills(fill: string, opacity: number): Fill[] {
  return [{
    type: 'solid',
    color: fill,
    opacity: opacity ?? 1,
    visible: true,
  }];
}

function sgFillsToShapeFill(fills?: Fill[]): string {
  if (!fills || fills.length === 0) return '#4A4A52';
  const first = fills[0];
  if (first.type === 'solid' && first.color) return first.color;
  return '#4A4A52';
}

// ---- Shared base properties ----

interface BaseShapeProps {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  blendMode: BlendMode;
  fills?: Fill[];
  strokes?: Fill[];
  strokeWidth: number;
  strokeDash?: number[];
  shadows?: Shadow[];
  blur?: BlurEffect;
  layoutGrids?: LayoutGrid[];
  clipsContent?: boolean;
  constraints?: Constraints;
  maskSourceId?: string;
  booleanOp?: 'union' | 'subtract' | 'intersect' | 'exclude';
  tokenBindings?: Record<string, string>;
  masterComponentId?: string;
  variantName?: string;
  overrides?: Record<string, unknown>;
  stateOverrides?: Shape['stateOverrides'];
  interactions?: Shape['interactions'];
}

/** Extract shared base properties from a Shape → partial SGNode base */
function shapeToBaseProps(shape: Shape): BaseShapeProps {
  return {
    id: shape.id,
    name: shape.name,
    x: shape.x,
    y: shape.y,
    width: shape.width ?? 100,
    height: shape.height ?? 100,
    rotation: shape.rotation ?? 0,
    opacity: shape.opacity ?? 1,
    visible: shape.visible ?? true,
    locked: shape.locked ?? false,
    blendMode: shape.blendMode ?? 'normal',
    fills: shape.fills,
    strokes: shape.stroke ? [{ type: 'solid' as const, color: shape.stroke, opacity: shape.opacity ?? 1, visible: true }] : [],
    strokeWidth: shape.strokeWidth ?? 1,
    strokeDash: shape.strokeDash,
    shadows: shape.shadows,
    blur: shape.blur,
    layoutGrids: shape.layoutGrids,
    clipsContent: shape.clipContent,
    constraints: shape.constraints,
    maskSourceId: shape.maskSourceId,
    booleanOp: shape.booleanOp,
    tokenBindings: shape.tokenBindings as unknown as Record<string, string> | undefined,
    masterComponentId: shape.masterComponentId,
    variantName: shape.variantName,
    overrides: shape.overrides,
    stateOverrides: shape.stateOverrides,
    interactions: shape.interactions,
  };
}

/** Apply shared base properties from an SGNode back to a Shape */
function applyBasePropsToShape(node: SGNode, shape: Shape): void {
  shape.name = node.name;
  shape.x = node.x;
  shape.y = node.y;
  shape.width = node.width;
  shape.height = node.height;
  shape.rotation = node.rotation;
  shape.opacity = node.opacity;
  shape.visible = node.visible;
  shape.locked = node.locked;
  if (node.blendMode) shape.blendMode = node.blendMode;
  if (node.fills) shape.fills = node.fills;
  // strokes not on Shape — skip
  if (node.strokeWidth !== undefined) shape.strokeWidth = node.strokeWidth;
  if (node.strokeDash) shape.strokeDash = node.strokeDash;
  if (node.shadows) shape.shadows = node.shadows;
  if (node.blur) shape.blur = node.blur;
  if (node.layoutGrids) shape.layoutGrids = node.layoutGrids;
  if (node.clipsContent !== undefined) shape.clipContent = node.clipsContent;
  if (node.constraints) shape.constraints = node.constraints;
  if (node.maskSourceId) shape.maskSourceId = node.maskSourceId;
  if (node.booleanOp) shape.booleanOp = node.booleanOp;
  if (node.masterComponentId) shape.masterComponentId = node.masterComponentId;
  if (node.variantName) shape.variantName = node.variantName;
  if (node.overrides) shape.overrides = node.overrides;
  // stateOverrides and interactions handled separately if needed
}

// ============================================================
// shapeToSGNode
// ============================================================

/**
 * Convert a flat Shape into the corresponding SGNode type.
 * The returned node has no parentId/children set — those are
 * established by the caller via sceneGraph.addNode().
 */
export function shapeToSGNode(shape: Shape): SGNode {
  const base = shapeToBaseProps(shape);
  const fill = shape.fill ?? '#4A4A52';
  const stroke = shape.stroke ?? '#3A3A40';
  const opacity = shape.opacity ?? 1;

  const fills: Fill[] = shape.fills ?? shapeFillsToSGFills(fill, opacity);
  const strokes: Fill[] = shape.stroke ? [{ type: 'solid', color: stroke, opacity }] : [];

  switch (shape.type) {
    case 'rect':
    case 'triangle': {
      return {
        ...base,
        type: 'rectangle',
        parentId: null,
        children: [],
        fills,
        strokes,
        strokeWidth: shape.strokeWidth ?? 1,
        cornerRadius: shape.cornerRadius ?? 0,
      } as RectangleNode;
    }

    case 'circle': {
      return {
        ...base,
        type: 'ellipse',
        parentId: null,
        children: [],
        fills,
        strokes,
        strokeWidth: shape.strokeWidth ?? 1,
      } as EllipseNode;
    }

    case 'text': {
      return {
        ...base,
        type: 'text',
        parentId: null,
        children: [],
        text: shape.text ?? 'Text',
        fontSize: shape.fontSize ?? 16,
        fontFamily: shape.fontFamily ?? 'Inter',
        fontWeight: Number(shape.fontWeight) || 400,
        textAlign: (shape.textAlign as TextNode['textAlign']) ?? 'left',
        lineHeight: shape.lineHeight ?? 1.5,
        letterSpacing: shape.letterSpacing ?? 0,
        textSizing: (shape.textSizing ?? 'fixed') as TextNode['textSizing'],
        variableRefs: [],
        fills,
        strokes,
        strokeWidth: shape.strokeWidth ?? 1,
      } as TextNode;
    }

    case 'line':
    case 'arrow': {
      return {
        ...base,
        type: 'line',
        parentId: null,
        children: [],
        fills: [],
        strokes,
        strokeWidth: shape.strokeWidth ?? 1,
      } as LineNode;
    }

    case 'star': {
      return {
        ...base,
        type: 'star',
        parentId: null,
        children: [],
        numPoints: shape.numPoints ?? 5,
        innerRadius: shape.innerRadius ?? 0.5,
        fills,
        strokes,
        strokeWidth: shape.strokeWidth ?? 1,
      } as StarNode;
    }

    case 'image': {
      return {
        ...base,
        type: 'image',
        parentId: null,
        children: [],
        src: shape.src ?? '',
        fills: [],
        strokes: [],
        strokeWidth: 0,
      } as ImageNode;
    }

    case 'frame': {
      return {
        ...base,
        type: 'frame',
        parentId: null,
        children: [],
        backgroundColor: fill,
        cornerRadius: shape.cornerRadius ?? 0,
        clipsContent: shape.clipContent ?? true,
        layoutMode: (shape.autoLayout?.direction === 'horizontal'
          ? 'horizontal'
          : shape.autoLayout?.direction === 'vertical'
            ? 'vertical'
            : 'none') as FrameNode['layoutMode'],
        layoutGap: shape.autoLayout?.gap ?? 0,
        layoutPaddingTop: shape.autoLayout?.paddingTop ?? 0,
        layoutPaddingRight: shape.autoLayout?.paddingRight ?? 0,
        layoutPaddingBottom: shape.autoLayout?.paddingBottom ?? 0,
        layoutPaddingLeft: shape.autoLayout?.paddingLeft ?? 0,
        layoutAlign: (shape.autoLayout?.alignItems ?? 'start') as FrameNode['layoutAlign'],
        layoutJustify: (shape.autoLayout?.justifyContent ?? 'start') as FrameNode['layoutJustify'],
        layoutWrap: shape.autoLayout?.wrap ?? false,
        fills: [],
        strokes: [],
        strokeWidth: 0,
      } as FrameNode;
    }

    case 'group': {
      return {
        ...base,
        type: 'group',
        parentId: null,
        children: [],
        fills,
        strokes,
        strokeWidth: shape.strokeWidth ?? 1,
      } as GroupNode;
    }

    case 'path': {
      return {
        ...base,
        type: 'pen',
        parentId: null,
        children: [],
        points: (shape.pathPoints ?? []) as PenNode['points'],
        closed: shape.closePath ?? false,
        fillRule: 'nonzero',
        fills,
        strokes,
        strokeWidth: shape.strokeWidth ?? 1,
      } as PenNode;
    }

    case 'component': {
      return {
        ...base,
        type: 'component',
        parentId: null,
        children: [],
        description: shape.text ?? '',
        variantProperties: {},
        fills,
        strokes,
        strokeWidth: shape.strokeWidth ?? 1,
      } as ComponentNode;
    }

    default: {
      // Fallback for any unhandled type — return as generic rectangle
      return {
        ...base,
        type: 'rectangle',
        parentId: null,
        children: [],
        fills,
        strokes,
        strokeWidth: shape.strokeWidth ?? 1,
        cornerRadius: 0,
      } as RectangleNode;
    }
  }
}

// ============================================================
// syncShapesToSceneGraph
// ============================================================

/**
 * Sync an array of flat Shape objects into a SceneGraph.
 *
 * - For each shape, convert it to an SGNode and add it under the
 *   current page (for top-level shapes) or under the shape's parentId
 *   (for nested shapes).
 * - If a node with the same ID already exists in the scene graph, skip it
 *   (incremental update — use syncNodeToShape for forced updates).
 * - Returns the number of nodes added.
 */
export function syncShapesToSceneGraph(shapes: Shape[], sceneGraph: SceneGraph): number {
  const page = sceneGraph.getCurrentPage();
  if (!page) return 0;

  let added = 0;

  for (const shape of shapes) {
    if (sceneGraph.hasNode(shape.id)) {
      // Node already exists — skip (caller can use syncNodeToShape for updates)
      continue;
    }

    const node = shapeToSGNode(shape);
    const parentId = shape.parentId && sceneGraph.hasNode(shape.parentId)
      ? shape.parentId
      : page.id;

    sceneGraph.addNode(node, parentId);
    added++;
  }

  return added;
}

// ============================================================
// applySGNodeToShape
// ============================================================

/**
 * Apply all relevant properties from an SGNode back into a flat Shape.
 * Returns the updated Shape (mutates the input shape as well).
 *
 * Note: Shape is a less expressive model than SGNode, so some SGNode
 * properties (e.g. layoutMode, clipsContent) cannot be represented in Shape
 * and are silently dropped.
 */
export function applySGNodeToShape(node: SGNode, shape: Shape): Shape {
  applyBasePropsToShape(node, shape);

  switch (node.type) {
    case 'rectangle':
      shape.type = 'rect';
      shape.cornerRadius = node.cornerRadius;
      break;

    case 'ellipse':
      shape.type = 'circle';
      break;

    case 'text':
      shape.type = 'text';
      shape.text = node.text;
      shape.fontSize = node.fontSize;
      shape.fontFamily = node.fontFamily;
      shape.fontWeight = String(node.fontWeight);
      shape.textAlign = node.textAlign;
      shape.lineHeight = node.lineHeight;
      shape.letterSpacing = node.letterSpacing;
      shape.textSizing = node.textSizing;
      break;

    case 'line':
      shape.type = 'line';
      break;

    case 'star':
      shape.type = 'star';
      shape.numPoints = node.numPoints;
      shape.innerRadius = node.innerRadius;
      break;

    case 'polygon':
      shape.type = 'triangle';
      break;

    case 'image':
      shape.type = 'image';
      shape.src = node.src;
      break;

    case 'frame':
      shape.type = 'frame';
      shape.cornerRadius = node.cornerRadius;
      shape.clipContent = node.clipsContent;
      shape.fill = (node.fills?.[0]?.type === 'solid' ? node.fills[0].color : undefined) ?? shape.fill;
      shape.autoLayout = {
        direction: (node.layoutMode === 'horizontal' ? 'horizontal'
          : node.layoutMode === 'vertical' ? 'vertical'
            : ('horizontal' as const)) as 'horizontal' | 'vertical',
        gap: node.layoutGap,
        paddingTop: node.layoutPaddingTop,
        paddingRight: node.layoutPaddingRight,
        paddingBottom: node.layoutPaddingBottom,
        paddingLeft: node.layoutPaddingLeft,
        alignItems: node.layoutAlign as 'start' | 'center' | 'end' | 'stretch',
        justifyContent: node.layoutJustify as 'start' | 'center' | 'end' | 'space-between',
        wrap: node.layoutWrap,
      };
      break;

    case 'group':
      shape.type = 'group';
      break;

    case 'pen':
      shape.type = 'path';
      shape.pathPoints = node.points as unknown as Shape['pathPoints'];
      shape.closePath = node.closed;
      break;

    case 'component':
      shape.type = 'component';
      break;
  }

  return shape;
}

// ============================================================
// syncNodeToShape
// ============================================================

/**
 * Bidirectionally sync a single SGNode's changes back into its
 * corresponding Shape in a shapes array.
 *
 * - If the Shape is found in `shapes` by ID, applySGNodeToShape is called.
 * - If the Shape is not found, no action is taken.
 * - Returns true if the shape was found and updated.
 */
export function syncNodeToShape(node: SGNode, shapes: Shape[]): boolean {
  const idx = shapes.findIndex(s => s.id === node.id);
  if (idx === -1) return false;

  applySGNodeToShape(node, shapes[idx]);
  return true;
}
