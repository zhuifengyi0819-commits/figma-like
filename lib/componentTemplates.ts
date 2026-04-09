import { Shape, ComponentTemplate } from './types';

type ShapeDef = Omit<Shape, 'id' | 'name' | 'visible' | 'locked'>;

function rect(x: number, y: number, w: number, h: number, fill: string, opts: Partial<ShapeDef> = {}): ShapeDef {
  return { type: 'rect', x, y, width: w, height: h, fill, stroke: opts.stroke || 'transparent', strokeWidth: opts.strokeWidth || 0, opacity: 1, rotation: 0, cornerRadius: opts.cornerRadius, shadow: opts.shadow, strokeDash: opts.strokeDash, ...opts };
}

function text(x: number, y: number, content: string, size: number, color: string, opts: Partial<ShapeDef> = {}): ShapeDef {
  return { type: 'text', x, y, text: content, fontSize: size, fill: color, stroke: 'transparent', strokeWidth: 0, opacity: 1, rotation: 0, width: opts.width, fontWeight: opts.fontWeight, textAlign: opts.textAlign, ...opts };
}

function circle(x: number, y: number, r: number, fill: string, opts: Partial<ShapeDef> = {}): ShapeDef {
  return { type: 'circle', x, y, radius: r, fill, stroke: opts.stroke || 'transparent', strokeWidth: opts.strokeWidth || 0, opacity: 1, rotation: 0, ...opts };
}

function line(x1: number, y1: number, x2: number, y2: number, color: string, width = 1): ShapeDef {
  return { type: 'line', x: 0, y: 0, points: [x1, y1, x2, y2], fill: 'transparent', stroke: color, strokeWidth: width, opacity: 1, rotation: 0 };
}

// ======================== Ant Design ========================

export const componentTemplates: ComponentTemplate[] = [
  // --- Buttons ---
  {
    id: 'antd-btn-primary', name: 'Primary Button', category: '通用', library: 'antd', width: 90, height: 32,
    shapes: [
      rect(0, 0, 90, 32, '#1677ff', { cornerRadius: 6 }),
      text(0, 7, 'Button', 14, '#ffffff', { width: 90, textAlign: 'center' }),
    ],
  },
  {
    id: 'antd-btn-default', name: 'Default Button', category: '通用', library: 'antd', width: 90, height: 32,
    shapes: [
      rect(0, 0, 90, 32, '#ffffff', { cornerRadius: 6, stroke: '#d9d9d9', strokeWidth: 1 }),
      text(0, 7, 'Button', 14, '#000000', { width: 90, textAlign: 'center' }),
    ],
  },
  {
    id: 'antd-btn-danger', name: 'Danger Button', category: '通用', library: 'antd', width: 90, height: 32,
    shapes: [
      rect(0, 0, 90, 32, '#ff4d4f', { cornerRadius: 6 }),
      text(0, 7, 'Delete', 14, '#ffffff', { width: 90, textAlign: 'center' }),
    ],
  },
  {
    id: 'antd-btn-success', name: 'Success Button', category: '通用', library: 'antd', width: 90, height: 32,
    shapes: [
      rect(0, 0, 90, 32, '#52c41a', { cornerRadius: 6 }),
      text(0, 7, 'Success', 14, '#ffffff', { width: 90, textAlign: 'center' }),
    ],
  },

  // --- Form ---
  {
    id: 'antd-input', name: 'Input', category: '数据录入', library: 'antd', width: 240, height: 32,
    shapes: [
      rect(0, 0, 240, 32, '#ffffff', { cornerRadius: 6, stroke: '#d9d9d9', strokeWidth: 1 }),
      text(12, 8, 'Please input', 14, '#bfbfbf'),
    ],
  },
  {
    id: 'antd-select', name: 'Select', category: '数据录入', library: 'antd', width: 240, height: 32,
    shapes: [
      rect(0, 0, 240, 32, '#ffffff', { cornerRadius: 6, stroke: '#d9d9d9', strokeWidth: 1 }),
      text(12, 8, 'Select', 14, '#bfbfbf'),
      text(218, 10, '▾', 12, '#bfbfbf'),
    ],
  },
  {
    id: 'antd-checkbox', name: 'Checkbox', category: '数据录入', library: 'antd', width: 120, height: 20,
    shapes: [
      rect(0, 2, 16, 16, '#1677ff', { cornerRadius: 2 }),
      text(1, 2, '✓', 12, '#ffffff', { width: 16, textAlign: 'center' }),
      text(24, 2, 'Checkbox', 14, '#000000'),
    ],
  },
  {
    id: 'antd-radio', name: 'Radio', category: '数据录入', library: 'antd', width: 100, height: 20,
    shapes: [
      circle(8, 10, 7, '#ffffff', { stroke: '#1677ff', strokeWidth: 1 }),
      circle(8, 10, 4, '#1677ff'),
      text(24, 2, 'Radio', 14, '#000000'),
    ],
  },
  {
    id: 'antd-switch', name: 'Switch', category: '数据录入', library: 'antd', width: 44, height: 22,
    shapes: [
      rect(0, 0, 44, 22, '#1677ff', { cornerRadius: 11 }),
      circle(31, 11, 8, '#ffffff'),
    ],
  },

  // --- Data Display ---
  {
    id: 'antd-card', name: 'Card', category: '数据展示', library: 'antd', width: 300, height: 180,
    shapes: [
      rect(0, 0, 300, 180, '#ffffff', { cornerRadius: 8, stroke: '#f0f0f0', strokeWidth: 1 }),
      line(0, 48, 300, 48, '#f0f0f0'),
      text(20, 16, 'Card Title', 16, '#000000', { fontWeight: '600' }),
      text(20, 64, 'Card content here', 14, '#00000073'),
      text(20, 88, 'Supporting text below as needed.', 14, '#00000073'),
      text(20, 112, 'More content in the card body.', 14, '#00000073'),
    ],
  },
  {
    id: 'antd-table', name: 'Table', category: '数据展示', library: 'antd', width: 420, height: 160,
    shapes: [
      rect(0, 0, 420, 160, '#ffffff', { cornerRadius: 8, stroke: '#f0f0f0', strokeWidth: 1 }),
      rect(0, 0, 420, 40, '#fafafa', { cornerRadius: 8 }),
      text(20, 12, 'Name', 14, '#000000', { fontWeight: '600' }),
      text(150, 12, 'Age', 14, '#000000', { fontWeight: '600' }),
      text(250, 12, 'Address', 14, '#000000', { fontWeight: '600' }),
      line(0, 40, 420, 40, '#f0f0f0'),
      text(20, 52, 'John Brown', 14, '#000000'),
      text(150, 52, '32', 14, '#000000'),
      text(250, 52, 'New York No.1', 14, '#000000'),
      line(0, 80, 420, 80, '#f0f0f0'),
      text(20, 92, 'Jim Green', 14, '#000000'),
      text(150, 92, '42', 14, '#000000'),
      text(250, 92, 'London No.1', 14, '#000000'),
      line(0, 120, 420, 120, '#f0f0f0'),
      text(20, 132, 'Joe Black', 14, '#000000'),
      text(150, 132, '28', 14, '#000000'),
      text(250, 132, 'Sydney No.1', 14, '#000000'),
    ],
  },
  {
    id: 'antd-tag-blue', name: 'Tag (Blue)', category: '数据展示', library: 'antd', width: 52, height: 22,
    shapes: [
      rect(0, 0, 52, 22, '#e6f4ff', { cornerRadius: 4, stroke: '#91caff', strokeWidth: 1 }),
      text(0, 3, 'Tag', 12, '#1677ff', { width: 52, textAlign: 'center' }),
    ],
  },
  {
    id: 'antd-tag-green', name: 'Tag (Green)', category: '数据展示', library: 'antd', width: 52, height: 22,
    shapes: [
      rect(0, 0, 52, 22, '#f6ffed', { cornerRadius: 4, stroke: '#b7eb8f', strokeWidth: 1 }),
      text(0, 3, 'Tag', 12, '#52c41a', { width: 52, textAlign: 'center' }),
    ],
  },
  {
    id: 'antd-tag-red', name: 'Tag (Error)', category: '数据展示', library: 'antd', width: 52, height: 22,
    shapes: [
      rect(0, 0, 52, 22, '#fff2f0', { cornerRadius: 4, stroke: '#ffccc7', strokeWidth: 1 }),
      text(0, 3, 'Error', 12, '#ff4d4f', { width: 52, textAlign: 'center' }),
    ],
  },
  {
    id: 'antd-avatar', name: 'Avatar', category: '数据展示', library: 'antd', width: 40, height: 40,
    shapes: [
      circle(20, 20, 20, '#1677ff'),
      text(0, 10, 'U', 18, '#ffffff', { width: 40, textAlign: 'center' }),
    ],
  },
  {
    id: 'antd-progress', name: 'Progress', category: '数据展示', library: 'antd', width: 240, height: 16,
    shapes: [
      rect(0, 4, 200, 8, '#f5f5f5', { cornerRadius: 4 }),
      rect(0, 4, 144, 8, '#1677ff', { cornerRadius: 4 }),
      text(208, 0, '72%', 14, '#000000'),
    ],
  },

  // --- Feedback ---
  {
    id: 'antd-alert-success', name: 'Alert (Success)', category: '反馈', library: 'antd', width: 340, height: 40,
    shapes: [
      rect(0, 0, 340, 40, '#f6ffed', { cornerRadius: 8, stroke: '#b7eb8f', strokeWidth: 1 }),
      circle(20, 20, 8, '#52c41a'),
      text(10, 11, '✓', 12, '#ffffff', { width: 20, textAlign: 'center' }),
      text(38, 11, 'Success Tips: Operation completed.', 14, '#000000'),
    ],
  },
  {
    id: 'antd-alert-error', name: 'Alert (Error)', category: '反馈', library: 'antd', width: 340, height: 40,
    shapes: [
      rect(0, 0, 340, 40, '#fff2f0', { cornerRadius: 8, stroke: '#ffccc7', strokeWidth: 1 }),
      circle(20, 20, 8, '#ff4d4f'),
      text(10, 11, '✕', 12, '#ffffff', { width: 20, textAlign: 'center' }),
      text(38, 11, 'Error: Something went wrong.', 14, '#000000'),
    ],
  },
  {
    id: 'antd-modal', name: 'Modal', category: '反馈', library: 'antd', width: 420, height: 200,
    shapes: [
      rect(0, 0, 420, 200, '#ffffff', { cornerRadius: 8, shadow: { color: '#00000014', blur: 16, offsetX: 0, offsetY: 6 } }),
      text(24, 18, 'Modal Title', 16, '#000000', { fontWeight: '600' }),
      line(0, 50, 420, 50, '#f0f0f0'),
      text(24, 68, 'Some contents...', 14, '#00000073'),
      text(24, 92, 'Some contents...', 14, '#00000073'),
      line(0, 148, 420, 148, '#f0f0f0'),
      rect(250, 160, 68, 32, '#ffffff', { cornerRadius: 6, stroke: '#d9d9d9', strokeWidth: 1 }),
      text(250, 168, 'Cancel', 14, '#000000', { width: 68, textAlign: 'center' }),
      rect(328, 160, 68, 32, '#1677ff', { cornerRadius: 6 }),
      text(328, 168, 'OK', 14, '#ffffff', { width: 68, textAlign: 'center' }),
    ],
  },

  // --- Nav ---
  {
    id: 'antd-tabs', name: 'Tabs', category: '导航', library: 'antd', width: 300, height: 40,
    shapes: [
      rect(0, 0, 300, 40, '#ffffff'),
      text(16, 12, 'Tab 1', 14, '#1677ff', { fontWeight: '500' }),
      rect(16, 36, 44, 2, '#1677ff', { cornerRadius: 1 }),
      text(80, 12, 'Tab 2', 14, '#00000073'),
      text(140, 12, 'Tab 3', 14, '#00000073'),
      line(0, 39, 300, 39, '#f0f0f0'),
    ],
  },
  {
    id: 'antd-breadcrumb', name: 'Breadcrumb', category: '导航', library: 'antd', width: 260, height: 22,
    shapes: [
      text(0, 2, 'Home', 14, '#1677ff'),
      text(48, 2, '/', 14, '#00000040'),
      text(60, 2, 'Application', 14, '#1677ff'),
      text(150, 2, '/', 14, '#00000040'),
      text(162, 2, 'Current Page', 14, '#000000'),
    ],
  },

  // ======================== Element Plus ========================
  {
    id: 'el-btn-primary', name: '主要按钮', category: '基础', library: 'element', width: 80, height: 32,
    shapes: [
      rect(0, 0, 80, 32, '#409eff', { cornerRadius: 4 }),
      text(0, 7, 'Primary', 14, '#ffffff', { width: 80, textAlign: 'center' }),
    ],
  },
  {
    id: 'el-btn-success', name: '成功按钮', category: '基础', library: 'element', width: 80, height: 32,
    shapes: [
      rect(0, 0, 80, 32, '#67c23a', { cornerRadius: 4 }),
      text(0, 7, 'Success', 14, '#ffffff', { width: 80, textAlign: 'center' }),
    ],
  },
  {
    id: 'el-btn-danger', name: '危险按钮', category: '基础', library: 'element', width: 80, height: 32,
    shapes: [
      rect(0, 0, 80, 32, '#f56c6c', { cornerRadius: 4 }),
      text(0, 7, 'Danger', 14, '#ffffff', { width: 80, textAlign: 'center' }),
    ],
  },
  {
    id: 'el-btn-default', name: '默认按钮', category: '基础', library: 'element', width: 80, height: 32,
    shapes: [
      rect(0, 0, 80, 32, '#ffffff', { cornerRadius: 4, stroke: '#dcdfe6', strokeWidth: 1 }),
      text(0, 7, 'Default', 14, '#606266', { width: 80, textAlign: 'center' }),
    ],
  },
  {
    id: 'el-input', name: 'Input', category: '表单', library: 'element', width: 240, height: 32,
    shapes: [
      rect(0, 0, 240, 32, '#ffffff', { cornerRadius: 4, stroke: '#dcdfe6', strokeWidth: 1 }),
      text(15, 8, 'Please input', 14, '#a8abb2'),
    ],
  },
  {
    id: 'el-card', name: 'Card', category: '数据展示', library: 'element', width: 300, height: 180,
    shapes: [
      rect(0, 0, 300, 180, '#ffffff', { cornerRadius: 4, stroke: '#e4e7ed', strokeWidth: 1, shadow: { color: '#0000000f', blur: 12, offsetX: 0, offsetY: 1 } }),
      line(0, 48, 300, 48, '#e4e7ed'),
      text(20, 16, 'Card Title', 16, '#303133', { fontWeight: '600' }),
      text(20, 64, 'Card content area', 14, '#606266'),
      text(20, 88, 'Supporting text below', 14, '#909399'),
    ],
  },
  {
    id: 'el-dialog', name: 'Dialog', category: '反馈', library: 'element', width: 420, height: 200,
    shapes: [
      rect(0, 0, 420, 200, '#ffffff', { cornerRadius: 4, shadow: { color: '#0000001f', blur: 12, offsetX: 0, offsetY: 2 } }),
      text(20, 14, 'Dialog Title', 18, '#303133', { fontWeight: '600' }),
      text(396, 10, '×', 20, '#909399'),
      line(0, 48, 420, 48, '#e4e7ed'),
      text(20, 70, 'This is a message', 14, '#606266'),
      line(0, 148, 420, 148, '#e4e7ed'),
      rect(250, 160, 68, 32, '#ffffff', { cornerRadius: 4, stroke: '#dcdfe6', strokeWidth: 1 }),
      text(250, 168, '取消', 14, '#606266', { width: 68, textAlign: 'center' }),
      rect(328, 160, 68, 32, '#409eff', { cornerRadius: 4 }),
      text(328, 168, '确定', 14, '#ffffff', { width: 68, textAlign: 'center' }),
    ],
  },
  {
    id: 'el-tag', name: 'Tag', category: '数据展示', library: 'element', width: 52, height: 24,
    shapes: [
      rect(0, 0, 52, 24, '#ecf5ff', { cornerRadius: 4, stroke: '#d9ecff', strokeWidth: 1 }),
      text(0, 4, 'Tag', 12, '#409eff', { width: 52, textAlign: 'center' }),
    ],
  },

  // ======================== Layout Templates ========================
  {
    id: 'layout-navbar', name: '导航栏', category: '导航', library: 'layout', width: 600, height: 56,
    shapes: [
      rect(0, 0, 600, 56, '#001529'),
      circle(28, 28, 14, '#1677ff'),
      text(18, 18, 'L', 14, '#ffffff', { width: 20, textAlign: 'center', fontWeight: 'bold' }),
      text(54, 18, 'App Name', 14, '#ffffffd9', { fontWeight: '600' }),
      text(160, 18, 'Home', 14, '#ffffffa6'),
      text(220, 18, 'Products', 14, '#ffffffa6'),
      text(300, 18, 'About', 14, '#ffffffa6'),
      circle(572, 28, 16, '#87d068'),
      text(562, 18, 'U', 14, '#ffffff', { width: 20, textAlign: 'center', fontWeight: '600' }),
    ],
  },
  {
    id: 'layout-sidebar', name: '侧边栏', category: '导航', library: 'layout', width: 200, height: 360,
    shapes: [
      rect(0, 0, 200, 360, '#001529'),
      circle(100, 40, 24, '#1677ff30'),
      text(88, 30, 'L', 18, '#1677ff', { fontWeight: 'bold', width: 24, textAlign: 'center' }),
      rect(0, 84, 200, 40, '#1677ff'),
      text(48, 96, 'Dashboard', 14, '#ffffff'),
      text(48, 140, 'Analytics', 14, '#ffffffa6'),
      text(48, 176, 'Settings', 14, '#ffffffa6'),
      text(48, 212, 'Users', 14, '#ffffffa6'),
      text(48, 248, 'Reports', 14, '#ffffffa6'),
    ],
  },
  {
    id: 'layout-login', name: '登录表单', category: '页面', library: 'layout', width: 360, height: 380,
    shapes: [
      rect(0, 0, 360, 380, '#ffffff', { cornerRadius: 12, shadow: { color: '#00000014', blur: 24, offsetX: 0, offsetY: 4 } }),
      text(0, 28, 'Welcome Back', 24, '#000000', { width: 360, textAlign: 'center', fontWeight: '700' }),
      text(0, 58, 'Sign in to your account', 14, '#00000073', { width: 360, textAlign: 'center' }),
      text(32, 100, 'Email', 14, '#000000'),
      rect(32, 118, 296, 40, '#ffffff', { cornerRadius: 6, stroke: '#d9d9d9', strokeWidth: 1 }),
      text(44, 128, 'Enter your email', 14, '#bfbfbf'),
      text(32, 176, 'Password', 14, '#000000'),
      rect(32, 194, 296, 40, '#ffffff', { cornerRadius: 6, stroke: '#d9d9d9', strokeWidth: 1 }),
      text(44, 204, 'Enter your password', 14, '#bfbfbf'),
      rect(32, 254, 296, 40, '#1677ff', { cornerRadius: 8 }),
      text(32, 264, 'Sign In', 15, '#ffffff', { width: 296, textAlign: 'center', fontWeight: '500' }),
      text(0, 310, 'Forgot password?', 13, '#1677ff', { width: 360, textAlign: 'center' }),
      text(0, 340, "Don't have an account? Sign up", 13, '#00000073', { width: 360, textAlign: 'center' }),
    ],
  },
  {
    id: 'layout-hero', name: 'Hero Section', category: '页面', library: 'layout', width: 600, height: 300,
    shapes: [
      rect(0, 0, 600, 300, '#667eea', { cornerRadius: 12 }),
      text(0, 60, 'Build Something', 36, '#ffffff', { width: 600, textAlign: 'center', fontWeight: '700' }),
      text(0, 100, 'Amazing', 36, '#ffffff', { width: 600, textAlign: 'center', fontWeight: '700' }),
      text(0, 148, 'The fastest way to design and ship beautiful products', 16, '#ffffffcc', { width: 600, textAlign: 'center' }),
      rect(225, 190, 150, 44, '#ffffff', { cornerRadius: 22 }),
      text(225, 202, 'Get Started →', 15, '#667eea', { width: 150, textAlign: 'center', fontWeight: '600' }),
    ],
  },
  {
    id: 'layout-pricing', name: '定价卡 (Pro)', category: '页面', library: 'layout', width: 260, height: 320,
    shapes: [
      rect(0, 0, 260, 320, '#ffffff', { cornerRadius: 12, stroke: '#1677ff', strokeWidth: 2, shadow: { color: '#0000000f', blur: 8, offsetX: 0, offsetY: 2 } }),
      rect(0, 0, 260, 4, '#1677ff', { cornerRadius: 2 }),
      text(0, 32, 'Pro', 18, '#1677ff', { width: 260, textAlign: 'center', fontWeight: '600' }),
      text(0, 66, '$29', 36, '#000000', { width: 260, textAlign: 'center', fontWeight: '700' }),
      text(0, 106, 'per month', 13, '#00000073', { width: 260, textAlign: 'center' }),
      line(20, 128, 240, 128, '#f0f0f0'),
      text(0, 144, '✓ Unlimited Projects', 14, '#000000a6', { width: 260, textAlign: 'center' }),
      text(0, 172, '✓ 100GB Storage', 14, '#000000a6', { width: 260, textAlign: 'center' }),
      text(0, 200, '✓ Priority Support', 14, '#000000a6', { width: 260, textAlign: 'center' }),
      rect(30, 244, 200, 40, '#1677ff', { cornerRadius: 8 }),
      text(30, 254, 'Choose Plan', 14, '#ffffff', { width: 200, textAlign: 'center', fontWeight: '500' }),
    ],
  },
];

export function getTemplatesByLibrary(library: ComponentTemplate['library']): ComponentTemplate[] {
  return componentTemplates.filter(t => t.library === library);
}
