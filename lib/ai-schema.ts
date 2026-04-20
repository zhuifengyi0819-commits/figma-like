/**
 * AI Function Calling Schema — 统一管理 add_shapes tool definition
 * 供 lib/ai.ts（客户端）和 app/api/chat/route.ts（服务端）共用
 */

export const ADD_SHAPES_FUNCTION_NAME = 'add_shapes';

export const ADD_SHAPES_FUNCTION_DEF = {
  name: ADD_SHAPES_FUNCTION_NAME,
  description: '在画布上添加图形。可添加一个或多个图形（矩形、圆形、文字、线条等）。',
  parameters: {
    type: 'object',
    properties: {
      shapes: {
        type: 'array',
        description: '要添加的图形数组',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: "图形类型：'rect' | 'circle' | 'text' | 'line' | 'star' | 'triangle'",
              enum: ['rect', 'circle', 'text', 'line', 'star', 'triangle'],
            },
            x: { type: 'number', description: 'X 坐标（画布左上角为原点）' },
            y: { type: 'number', description: 'Y 坐标（画布左上角为原点）' },
            width: { type: 'number', description: '宽度（rect/text 建议填）' },
            height: { type: 'number', description: '高度（rect/text 建议填）' },
            radius: { type: 'number', description: '圆的半径，或星形/多边形的尺寸' },
            text: { type: 'string', description: '文本内容（text 类型必填）' },
            fontSize: { type: 'number', description: '字体大小，默认 16' },
            points: {
              type: 'array',
              description: '线条/箭头点坐标 [x1,y1,x2,y2,…]',
              items: { type: 'number' },
            },
            fill: { type: 'string', description: '填充颜色，HEX 如 #FF5500 或颜色名' },
            stroke: { type: 'string', description: '边框颜色，HEX' },
            strokeWidth: { type: 'number', description: '边框宽度' },
            cornerRadius: { type: 'number', description: '矩形圆角半径' },
            opacity: { type: 'number', description: '透明度 0-1，默认 1' },
            rotation: { type: 'number', description: '旋转角度（度），默认 0' },
          },
          required: ['type', 'x', 'y'],
        },
      },
    },
    required: ['shapes'],
  },
};

/**
 * 构建给 MiniMax 的 system prompt
 */
export function buildSystemPrompt(shapesCount: number, shapePositions?: string): string {
  return `你是一个 AI 画布助手，帮助用户在画布上创建图形。

**画布规格**：宽度 1920px，高度 1080px，坐标从左上角 (0,0) 开始，右下角 (1920, 1080)。

**当前画布状态**：有 ${shapesCount || 0} 个图形${shapesCount > 0 && shapePositions ? `\n${shapePositions}` : shapesCount > 0 ? '（可参考其位置避免重叠）' : '（空白画布）'}。

**支持的图形类型**：
- rect（矩形）：必填 x, y, width, height；可选 fill, stroke, strokeWidth, cornerRadius, opacity, rotation
- circle（圆形）：必填 x, y, radius；可选 fill, stroke, strokeWidth, opacity, rotation
- text（文字）：必填 x, y, text, width, fontSize；可选 fill, opacity, rotation
- line（线条）：必填 x, y, points=[x1,y1,x2,y2]；必填 stroke, strokeWidth
- star（星形）：必填 x, y, radius；可选 fill, opacity, rotation
- triangle（三角形）：必填 x, y, radius；可选 fill, opacity, rotation

**颜色格式**：HEX（如 #FF5500）。常用颜色名自动映射：
  蓝色→#5D8DC7，红色→#C75D5D，绿色→#7CB77C，黄色/amber→#D4A853，紫色→#A855F7
  白色→#FFFFFF，黑色→#000000，灰色→#4A4A52，橙色→#FF7A45

**放置建议**：
- 优先放在画布中央区域（x: 600-1200, y: 300-700）
- 多个图形时分散排列，避免重叠
- 单个图形建议尺寸：矩形 120×80，圆形 radius:50，文字 width:200

**指令规则**：
1. 当用户要求画/添加/创建/生成形状时，调用 add_shapes 工具
2. 即使只画一个形状，也放在 shapes 数组中
3. 所有坐标和尺寸必须是数字，禁止写变量或表达式
4. 回复语言：用户用中文则用中文回复`;
}
