// lib/scene-graph/types.ts
// Core Scene Graph type system for Figma-like editor
// Replaces flat shapes[] with true tree structure

import type { BlendMode, BlurEffect, Constraints, Fill, Shadow, LayoutGrid, Interaction } from '@/lib/types';

// ============================================================
// Node Types
// ============================================================

export type SGNodeType =
  | 'page'
  | 'frame'
  | 'group'
  | 'rectangle'
  | 'ellipse'
  | 'text'
  | 'line'
  | 'polygon'
  | 'star'
  | 'pen'
  | 'image'
  | 'component'
  | 'instance'
  | 'boolean'
  | 'sticky';

// ============================================================
// Base Node (all nodes extend this)
// ============================================================

export interface BaseNode {
  id: string;
  type: SGNodeType;
  name: string;

  // Transform (local, relative to parent)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees

  // Appearance
  opacity: number;       // 0-1
  visible: boolean;
  locked: boolean;
  blendMode: BlendMode;

  // Hierarchy
  parentId: string | null; // null only for root/page nodes
  children: string[];       // child node IDs (empty = leaf node)

  // Visual
  fills?: Fill[];
  strokes?: Fill[];
  strokeWidth?: number;
  strokeDash?: number[];
  shadows?: Shadow[];
  blur?: BlurEffect;

  // Layout grids (for frame)
  layoutGrids?: LayoutGrid[];

  // Clip content (for frame/group)
  clipsContent?: boolean;

  // Constraints (children of frame)
  constraints?: Constraints;

  // Mask source (for mask nodes)
  maskSourceId?: string;

  // Boolean operation (for boolean nodes)
  booleanOp?: 'union' | 'subtract' | 'intersect' | 'exclude';

  // Design tokens
  tokenBindings?: Record<string, string>; // propertyName → tokenId

  // Component/Instance
  masterComponentId?: string;
  variantName?: string;
  overrides?: Record<string, unknown>;

  // Component state overrides
  stateOverrides?: ShapeStateOverrides;

  // Prototype interactions
  interactions?: Interaction[];
}

// ============================================================
// Container Nodes (can have children)
// ============================================================

export interface PageNode extends BaseNode {
  type: 'page';
  // Page is top-level — children are frame/group nodes
}

export interface FrameNode extends BaseNode {
  type: 'frame';
  children: string[];

  // Frame-specific
  backgroundColor: string;
  cornerRadius: number;
  clipsContent: boolean; // whether children are clipped to frame bounds

  // Auto Layout
  layoutMode: 'none' | 'horizontal' | 'vertical';
  layoutGap: number;
  layoutPaddingTop: number;
  layoutPaddingRight: number;
  layoutPaddingBottom: number;
  layoutPaddingLeft: number;
  layoutAlign: LayoutAlign;
  layoutJustify: LayoutJustify;
  layoutWrap: boolean;
}

export interface GroupNode extends BaseNode {
  type: 'group';
  children: string[];
  // Group is a simple container without frame's layout/clip features
}

export interface ComponentNode extends BaseNode {
  type: 'component';
  children: string[];

  description: string;
  variantProperties: Record<string, string>; // e.g. { "size": "small", "color": "primary" }
}

export interface InstanceNode extends BaseNode {
  type: 'instance';

  masterComponentId: string; // points to ComponentNode
  overrides: Record<string, Partial<BaseNode>>; // property overrides
}

export interface BooleanNode extends BaseNode {
  type: 'boolean';
  booleanOperation: 'union' | 'subtract' | 'intersect' | 'exclude';
  children: string[]; // children participating in boolean
}

// ============================================================
// Leaf Nodes (cannot have children)
// ============================================================

export interface RectangleNode extends BaseNode {
  type: 'rectangle';
  cornerRadius: number;
  // width/height already on BaseNode
}

export interface EllipseNode extends BaseNode {
  type: 'ellipse';
  // width/height already on BaseNode
}

export interface TextNode extends BaseNode {
  type: 'text';

  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle?: string;         // 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  letterSpacing: number;
  textSizing: TextSizing;    // 'fixed' | 'autoWidth' | 'autoHeight'

  variableRefs: string[];     // referenced variable names for interpolation
}

export interface LineNode extends BaseNode {
  type: 'line';
  // Line from (x,y) to (x+width, y+height)
  // rotation determines direction
}

export interface PolygonNode extends BaseNode {
  type: 'polygon';
  numPoints: number;
  innerRadius?: number; // for star-like polygons
}

export interface StarNode extends BaseNode {
  type: 'star';
  numPoints: number;
  innerRadius: number;
}

export interface PenNode extends BaseNode {
  type: 'pen';
  points: PenPoint[];  // path points
  closed: boolean;
  fillRule: 'nonzero' | 'evenodd';
}

export interface ImageNode extends BaseNode {
  type: 'image';
  src: string; // image URL or data URI
  cropRect?: { x: number; y: number; width: number; height: number };
}

export interface StickyNode extends BaseNode {
  type: 'sticky';
  text: string;
  backgroundColor: string;
}

// ============================================================
// Union type for all nodes
// ============================================================

export type SGNode =
  | PageNode
  | FrameNode
  | GroupNode
  | ComponentNode
  | InstanceNode
  | BooleanNode
  | RectangleNode
  | EllipseNode
  | TextNode
  | LineNode
  | PolygonNode
  | StarNode
  | PenNode
  | ImageNode
  | StickyNode;

// ============================================================
// Shape State Overrides
// ============================================================

export type ComponentStateType = 'default' | 'hover' | 'active' | 'pressed' | 'focused' | 'disabled';

export interface StateOverride {
  fill?: string;
  stroke?: string;
  opacity?: number;
  fontSize?: number;
  cornerRadius?: number;
  scaleX?: number;
  scaleY?: number;
  text?: string;
}

export interface ShapeStateOverrides {
  hover?: Partial<BaseNode>;
  active?: Partial<BaseNode>;
  pressed?: Partial<BaseNode>;
  focused?: Partial<BaseNode>;
  disabled?: Partial<BaseNode>;
}

// ============================================================
// Interaction (from lib/types, re-exported)
// ============================================================

export type { Interaction, TriggerType, ActionType, EasingType, TransitionType } from '@/lib/types';

// ============================================================
// Pen Point
// ============================================================

export interface PenPoint {
  x: number;
  y: number;
  cp1x?: number;
  cp1y?: number;
  cp2x?: number;
  cp2y?: number;
  type?: 'corner' | 'smooth' | 'symmetric';
}

// ============================================================
// Layout Enums
// ============================================================

export type LayoutAlign = 'min' | 'center' | 'max' | 'stretch';
export type LayoutJustify = 'min' | 'center' | 'max' | 'space-between';
export type TextSizing = 'fixed' | 'autoWidth' | 'autoHeight';
export type ConstraintAxis = 'min' | 'center' | 'max' | 'stretch';

// ============================================================
// Absolute Transform (computed, not stored)
// ============================================================

export interface AbsoluteTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

// ============================================================
// Document (root of Scene Graph)
// ============================================================

export interface SgDocument {
  id: string;
  name: string;
  lastModified: string;
  schemaVersion: number;
  pages: string[];        // page node IDs (in order)
  // Note: all nodes live in NodeMap, not inline in document
}

// ============================================================
// Selection State
// ============================================================

export interface SelectionState {
  selectedIds: string[];
  selectionContextId: string | null; // current frame/group we're "inside" (double-clicked into)
  marqueeRect: MarqueeRect | null;
}

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================
// Viewport / Camera
// ============================================================

export interface Viewport {
  x: number;      // pan offset X
  y: number;      // pan offset Y
  zoom: number;   // 0.1 to 10
}

// ============================================================
// Transform Handles
// ============================================================

export type HandlePosition =
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right'
  | 'rotation';

export interface TransformHandle {
  position: HandlePosition;
  x: number;  // screen position
  y: number;
}
