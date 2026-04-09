export type ShapeType = 'rect' | 'circle' | 'text' | 'line' | 'image' | 'star' | 'arrow' | 'triangle' | 'component' | 'frame' | 'path';
export type ToolType = 'select' | 'rect' | 'circle' | 'text' | 'line' | 'hand' | 'star' | 'triangle' | 'image' | 'frame' | 'pen';

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
}

export interface PathPoint {
  x: number;
  y: number;
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
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

  // Frame hierarchy
  parentId?: string;
  clipContent?: boolean;

  // Auto Layout (frames only)
  autoLayout?: AutoLayout;

  // Pen tool paths
  pathData?: string;
  pathPoints?: PathPoint[];
  closePath?: boolean;

  // Multiple effects stack
  fills?: Fill[];
  shadows?: Shadow[];
}

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
