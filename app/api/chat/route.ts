import { NextRequest, NextResponse } from 'next/server';
import {
  ADD_SHAPES_FUNCTION_NAME,
  ADD_SHAPES_FUNCTION_DEF,
  buildSystemPrompt,
} from '@/lib/ai-schema';
// buildShapePositions is kept for potential future server-side use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Shape } from '@/lib/types';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const MINIMAX_BASE_URL = 'https://api.minimaxi.com/anthropic/v1';

export async function POST(request: NextRequest) {
  if (!MINIMAX_API_KEY) {
    return NextResponse.json(
      { error: 'MINIMAX_API_KEY is not configured. Please add it to .env.local.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { messages, shapesCount, shapePositions } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(shapesCount || 0, shapePositions);

    // Build messages in block format for MiniMax
    const allMessages = [
      {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: systemPrompt }],
      },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: [{ type: 'text' as const, text: m.content }],
      })),
    ];

    const minimaxResponse = await fetch(`${MINIMAX_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': MINIMAX_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        max_tokens: 1024,
        messages: allMessages,
        // MiniMax Anthropic 兼容端点使用 functions（OpenAI SDK 格式）
        functions: [ADD_SHAPES_FUNCTION_DEF],
      }),
    });

    if (!minimaxResponse.ok) {
      const errText = await minimaxResponse.text();
      let errMsg = `MiniMax API error: ${minimaxResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) errMsg = errJson.error.message;
        else if (errJson.message) errMsg = errJson.message;
      } catch { /* ignore */ }
      return NextResponse.json({ error: errMsg }, { status: minimaxResponse.status });
    }

    const data = await minimaxResponse.json();

    // Extract text and tool_use blocks
    let text = '';
    const toolCalls: { name: string; args: Record<string, unknown> }[] = [];

    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'text') {
          text += block.text || '';
        } else if (block.type === 'tool_use') {
          const name = block.name;
          if (name === ADD_SHAPES_FUNCTION_NAME) {
            const inputRaw = block.input;
            let args: Record<string, unknown> = {};
            if (typeof inputRaw === 'string') {
              try { args = JSON.parse(inputRaw); } catch { /* keep empty */ }
            } else if (typeof inputRaw === 'object' && inputRaw !== null) {
              args = inputRaw as Record<string, unknown>;
            }
            toolCalls.push({ name, args });
          }
        }
      }
    }

    if (toolCalls.length > 0) {
      return NextResponse.json({ text: text.trim() || '收到', toolCalls });
    }

    return NextResponse.json({ text: text.trim() || '收到' });
  } catch (err) {
    console.error('[api/chat] error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
