export type ShapeType = 'rect' | 'circle' | 'text' | 'line' | 'image' | 'star' | 'arrow' | 'triangle' | 'component' | 'frame' | 'group' | 'path';
export type ToolType = 'select' | 'rect' | 'circle' | 'text' | 'line' | 'hand' | 'star' | 'triangle' | 'image' | 'frame' | 'pen' | 'measure' | 'eyedropper';

export interface Shadow {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface Fill {
  type: 'solid' | 'linear' | 'radial';
  color?: string;
  gradient?: Gradient;
  opacity?: number;
  visible?: boolean;
}

export interface AutoLayout {
  direction: 'horizontal' | 'vertical';
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  alignItems: 'start' | 'center' | 'end' | 'stretch';
  justifyContent: 'start' | 'center' | 'end' | 'space-between';
  wrap?: boolean; // Auto Layout wrap (Figma only supports horizontal direction for wrap)
}

export interface PathPoint {
  x: number;
  y: number;
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
}

/** Re-exported PenPoint for use in editor store */
export type { PenPoint } from './penTool';

// Constraint axis values (Figma-style 9-point grid)
export type ConstraintAxis = 'min' | 'center' | 'max' | 'stretch';

// Constraints for child shapes relative to parent frame
export interface Constraints {
  horizontal: ConstraintAxis;
  vertical: ConstraintAxis;
}

// Min/Max dimension constraints
export interface MinMaxDimensions {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export type TextSizing = 'fixed' | 'autoWidth' | 'autoHeight';

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten'
  | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

export interface BlurEffect {
  type: 'layer' | 'background';
  radius: number;
}

export interface LayoutGrid {
  type: 'columns' | 'rows' | 'grid';
  count: number;
  gutterSize: number;
  margin: number;
  color: string;
  visible: boolean;
}

export interface VersionSnapshot {
  id: string;
  name: string;
  timestamp: number;
  shapes: Shape[];
}

// Prototype interaction attached to a shape
export interface Interaction {
  trigger: 'click' | 'hover' | 'drag';
  action: 'navigateTo' | 'back' | 'openUrl' | 'swap' | 'scrollTo';
  targetFrameId?: string;
  url?: string;
  transition?: 'auto' | 'instant' | 'dissolve' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' | 'scale';
  duration?: number;
}

// Token bindings (key = property name, value = token id) — resolved at render time
export interface TokenBindings {
  fill?: string;
  stroke?: string;
  opacity?: string;
  cornerRadius?: string;
  fontSize?: string;
}

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: string;
  points?: number[];
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDash?: number[];
  opacity: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
  name: string;
  cornerRadius?: number;
  shadow?: Shadow;
  src?: string;
  innerRadius?: number;
  numPoints?: number;
  componentId?: string;
  groupId?: string;
  scaleX?: number;
  scaleY?: number;
  gradient?: Gradient;
  lineHeight?: number;
  letterSpacing?: number;

  parentId?: string;
  clipContent?: boolean;
  autoLayout?: AutoLayout;

  pathData?: string;
  pathPoints?: PathPoint[];
  closePath?: boolean;

  // Constraints (children of frames)
  constraints?: Constraints;

  // Min/Max dimension constraints
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;

  // Text sizing mode
  textSizing?: TextSizing;

  // Visual effects
  blendMode?: BlendMode;
  blur?: BlurEffect;

  // Layout grid (frames only)
  layoutGrids?: LayoutGrid[];

  /** 预留：蒙版 / 布尔（尚无渲染逻辑） */
  maskSourceId?: string;
  booleanOp?: 'union' | 'subtract' | 'intersect' | 'exclude';
  booleanSourceIds?: [string, string]; // [基准图形ID, 操作图形ID] (布尔运算结果专用)

  fills?: Fill[];
  shadows?: Shadow[];

  // Component/Instance system
  masterComponentId?: string;
  isMainComponent?: boolean;
  variantName?: string;
  overrides?: Record<string, unknown>;

  // Prototype interactions
  interactions?: Interaction[];

  // Design token references (key = property name, value = token id)
  tokenRefs?: Record<string, string>;

  // Token bindings (key = property name, value = token id) — resolved at render time
  tokenBindings?: TokenBindings;


  // Text style reference (applied from global text styles)
  textStyleId?: string;
}

// ==================== Multi-page ====================

export interface Page {
  id: string;
  name: string;
  shapes: Shape[];
}

// ==================== Component System ====================

export interface ComponentDef {
  id: string;
  name: string;
  shapes: Shape[];
  variants: VariantDef[];
  createdAt: number;
}

export interface VariantDef {
  id: string;
  name: string;
  overrides: Record<string, Partial<Shape>>;
}

// ==================== Design Tokens ====================

export interface DesignToken {
  id: string;
  name: string;
  category: 'color' | 'fontSize' | 'spacing' | 'borderRadius' | 'fontFamily' | 'shadow';
  value: string;
}

export interface DesignTheme {
  id: string;
  name: string;
  tokens: DesignToken[];
}

// ==================== Existing types ====================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: {
    name: string;
    arguments: Record<string, unknown>;
  }[];
}

export interface Material {
  id: string;
  name: string;
  shape: Omit<Shape, 'id' | 'x' | 'y' | 'name'>;
  createdAt: number;
}

export interface Gradient {
  type: 'linear' | 'radial';
  angle?: number;
  stops: { offset: number; color: string }[];
}

export interface ComponentTemplate {
  id: string;
  name: string;
  category: string;
  library: 'antd' | 'element' | 'layout' | 'custom';
  width: number;
  height: number;
  shapes: Omit<Shape, 'id' | 'name' | 'visible' | 'locked'>[];
}

export interface TextStyle {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fill: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export const DEFAULT_SHAPE_PROPS: Omit<Shape, 'id' | 'type' | 'x' | 'y' | 'name'> = {
  fill: '#4A4A52',
  stroke: '#3A3A40',
  strokeWidth: 1,
  opacity: 1,
  rotation: 0,
  visible: true,
  locked: false,
};

export const DEFAULT_AUTO_LAYOUT: AutoLayout = {
  direction: 'vertical',
  gap: 8,
  paddingTop: 16,
  paddingRight: 16,
  paddingBottom: 16,
  paddingLeft: 16,
  alignItems: 'start',
  justifyContent: 'start',
};

export const PRESET_TOKENS: DesignToken[] = [
  { id: 'tok-primary', name: 'Primary', category: 'color', value: '#1677FF' },
  { id: 'tok-secondary', name: 'Secondary', category: 'color', value: '#722ED1' },
  { id: 'tok-success', name: 'Success', category: 'color', value: '#52C41A' },
  { id: 'tok-warning', name: 'Warning', category: 'color', value: '#FADB14' },
  { id: 'tok-danger', name: 'Danger', category: 'color', value: '#F5222D' },
  { id: 'tok-bg', name: 'Background', category: 'color', value: '#141414' },
  { id: 'tok-surface', name: 'Surface', category: 'color', value: '#1C1C21' },
  { id: 'tok-text', name: 'Text', category: 'color', value: '#E8E4DF' },
  { id: 'tok-text-dim', name: 'Text Dim', category: 'color', value: '#8C8C8C' },
  { id: 'tok-border', name: 'Border', category: 'color', value: '#303036' },
  { id: 'tok-fs-xs', name: 'Font XS', category: 'fontSize', value: '12' },
  { id: 'tok-fs-sm', name: 'Font SM', category: 'fontSize', value: '14' },
  { id: 'tok-fs-md', name: 'Font MD', category: 'fontSize', value: '16' },
  { id: 'tok-fs-lg', name: 'Font LG', category: 'fontSize', value: '24' },
  { id: 'tok-fs-xl', name: 'Font XL', category: 'fontSize', value: '32' },
  { id: 'tok-sp-xs', name: 'Space XS', category: 'spacing', value: '4' },
  { id: 'tok-sp-sm', name: 'Space SM', category: 'spacing', value: '8' },
  { id: 'tok-sp-md', name: 'Space MD', category: 'spacing', value: '16' },
  { id: 'tok-sp-lg', name: 'Space LG', category: 'spacing', value: '24' },
  { id: 'tok-sp-xl', name: 'Space XL', category: 'spacing', value: '32' },
  { id: 'tok-rad-sm', name: 'Radius SM', category: 'borderRadius', value: '4' },
  { id: 'tok-rad-md', name: 'Radius MD', category: 'borderRadius', value: '8' },
  { id: 'tok-rad-lg', name: 'Radius LG', category: 'borderRadius', value: '16' },
  { id: 'tok-rad-full', name: 'Radius Full', category: 'borderRadius', value: '9999' },
];

export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

export const PRESET_COLORS = [
  '#FFFFFF', '#F5F5F5', '#D9D9D9', '#BFBFBF', '#8C8C8C', '#595959', '#434343', '#262626', '#1F1F1F', '#000000',
  '#F5222D', '#FA541C', '#FA8C16', '#FADB14', '#52C41A', '#13C2C2', '#1677FF', '#2F54EB', '#722ED1', '#EB2F96',
  '#FFE7E6', '#FFF2E8', '#FFF7E6', '#FFFBE6', '#F6FFED', '#E6FFFB', '#E6F4FF', '#F0F0FF', '#F9F0FF', '#FFF0F6',
  '#FFA39E', '#FFBB96', '#FFD591', '#FFF1B8', '#B7EB8F', '#87E8DE', '#91CAFF', '#ADC6FF', '#D3ADF7', '#FFADD2',
  '#FF4D4F', '#FF7A45', '#FFA940', '#FFEC3D', '#73D13D', '#36CFC9', '#4096FF', '#597EF7', '#9254DE', '#F759AB',
  '#CF1322', '#D4380D', '#D46B08', '#D4B106', '#389E0D', '#08979C', '#0958D9', '#1D39C4', '#531DAB', '#C41D7F',
];
