/**
 * AI API 集成（客户端 → Next.js API Route → MiniMax）
 * 解决浏览器端跨域问题
 */

import { Shape, DEFAULT_SHAPE_PROPS } from './types';

/**
 * 检测 AI 服务是否可用（.env.local 中是否配置了 MINIMAX_API_KEY）
 * 调用 /api/chat 的 HEAD 请求来探测
 */
export async function checkAiConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/chat', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return res.ok || res.status !== 500;
  } catch {
    return false;
  }
}

export function getAiUnconfiguredMessage(): string {
  return '🤖 AI 助手暂不可用，请联系管理员配置 MINIMAX_API_KEY。\n\n如需快速体验，可手动在 .env.local 中添加：\nMINIMAX_API_KEY=your_key_here';
}


export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AiResponse {
  text: string;
  toolCalls: AiToolCall[];
}

/**
 * 调用本地 Next.js API Route（/api/chat），由服务端代理到 MiniMax
 */
export async function chatWithAi(
  messages: ChatMessage[],
  shapesCount: number,
  shapePositions?: string,
): Promise<AiResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, shapesCount, shapePositions }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `API error: ${response.status}`);
  }

  return response.json();
}

export interface ParseResult {
  shapes: Omit<Shape, 'id'>[];
  errors: string[];
}

/**
 * 解析 add_shapes 工具调用的参数
 * — 返回解析出的图形列表和错误信息
 * — 部分解析失败不会导致整体失败（容错）
 */
export function parseAddShapesToolCall(args: Record<string, unknown>): ParseResult {
  if (!args || typeof args !== 'object') {
    return { shapes: [], errors: ['工具调用参数格式错误'] };
  }
  const rawShapes = (args as Record<string, unknown>).shapes;
  if (!Array.isArray(rawShapes)) {
    return { shapes: [], errors: [`shapes 应该是数组，实际收到: ${typeof rawShapes}`] };
  }
  const errors: string[] = [];
  const shapes: Omit<Shape, 'id'>[] = [];

  for (let i = 0; i < rawShapes.length; i++) {
    const item = rawShapes[i];
    if (typeof item !== 'object' || item === null) {
      errors.push(`第 ${i + 1} 个图形：格式错误，已跳过`);
      continue;
    }
    const raw = item as Record<string, unknown>;
    const type = raw.type as string | undefined;
    if (!type) {
      errors.push(`第 ${i + 1} 个图形：缺少 type 字段，已跳过`);
      continue;
    }
    if (!['rect', 'circle', 'text', 'line', 'star', 'triangle', 'path'].includes(type)) {
      errors.push(`第 ${i + 1} 个图形：不支持的类型 "${type}"，已跳过`);
      continue;
    }
    const x = raw.x as number | undefined;
    const y = raw.y as number | undefined;
    if (x === undefined || y === undefined) {
      errors.push(`第 ${i + 1} 个图形（${type}）：缺少 x 或 y 坐标，已跳过`);
      continue;
    }
    shapes.push(...normalizeShapes([raw]));
  }

  return { shapes, errors };
}

/**
 * 规范化 AI 返回的 shapes 数据
 * — AI 明确返回的字段以 AI 为准（不被覆盖）
 * — 未返回的字段补充 DEFAULT_SHAPE_PROPS
 */
export function normalizeShapes(
  rawShapes: Array<Record<string, unknown>>,
): Omit<Shape, 'id'>[] {
  const defaults = DEFAULT_SHAPE_PROPS;

  return rawShapes.map((shape, index) => {
    const type = (shape.type as Shape['type']) || 'rect';

    // 位置与尺寸 — AI 可指定，默认给定
    const x = (shape.x as number) ?? (100 + index * 30);
    const y = (shape.y as number) ?? (100 + index * 30);

    // 样式 — AI 返回的优先，不存在才用默认值
    const fill = (shape.fill as string) || defaults.fill;
    const stroke = (shape.stroke as string) || defaults.stroke;
    const strokeWidth = (shape.strokeWidth as number) ?? defaults.strokeWidth;
    const opacity = (shape.opacity as number) ?? defaults.opacity;
    const rotation = (shape.rotation as number) ?? defaults.rotation;
    const visible = (shape.visible as boolean) ?? defaults.visible;
    const locked = (shape.locked as boolean) ?? defaults.locked;
    const cornerRadius = (shape.cornerRadius as number) ?? defaults.cornerRadius;

    // 文本专项
    const fontSize = (shape.fontSize as number) ?? 16;
    const text = shape.text as string | undefined;
    const fontFamily = (shape.fontFamily as string) || 'sans-serif';
    const fontWeight = (shape.fontWeight as string) || 'normal';
    const textAlign = (shape.textAlign as string) || 'left';
    const lineHeight = (shape.lineHeight as number) ?? 1.2;
    const letterSpacing = (shape.letterSpacing as number) ?? 0;

    // 形状专项
    const radius = shape.radius as number | undefined;
    const width = shape.width as number | undefined;
    const height = shape.height as number | undefined;
    const points = shape.points as number[] | undefined;
    const innerRadius = shape.innerRadius as number | undefined;
    const numPoints = shape.numPoints as number | undefined;
    const gradient = shape.gradient as Shape['gradient'] | undefined;
    const src = shape.src as string | undefined;

    return {
      type,
      x,
      y,
      width,
      height,
      radius,
      text,
      fontSize,
      fontFamily,
      fontWeight,
      textAlign,
      lineHeight,
      letterSpacing,
      points,
      fill,
      stroke,
      strokeWidth,
      strokeDash: shape.strokeDash as number[] | undefined,
      opacity,
      rotation,
      visible,
      locked,
      cornerRadius,
      innerRadius,
      numPoints,
      gradient,
      src,
      scaleX: (shape.scaleX as number) ?? 1,
      scaleY: (shape.scaleY as number) ?? 1,
      name: `${type}-${Date.now().toString(36).slice(-4)}-${index}`,
    };
  });
}
