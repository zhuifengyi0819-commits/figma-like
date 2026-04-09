'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { Send, Trash2, Sparkles } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { Shape, DEFAULT_SHAPE_PROPS } from '@/lib/types';

const SYSTEM_PROMPT = `You are an AI assistant for a canvas design tool. The canvas is 1920x1080 pixels with coordinates starting from top-left (0,0).

You can help users create shapes by outputting a tool call. When the user asks to draw/create/add a shape, respond with a JSON tool call to add_shapes.

Supported shape types:
- rect: needs x, y, width, height
- circle: needs x, y, radius
- text: needs x, y, text, width (fontSize)
- line: needs x, y, points (array of [x1,y1,x2,y2])

Common colors: #4A4A52 (gray), #D4A853 (amber), #7CB77C (green), #C75D5D (red), #5D8DC7 (blue), #A855F7 (purple)

Example: "Draw a blue circle in the center"
Response: {"tool_calls":[{"name":"add_shapes","arguments":{"shapes":[{"type":"circle","x":860,"y":490,"radius":60,"fill":"#5D8DC7","stroke":"#3A3A40","strokeWidth":1}]}}]}

Example: "Add a 200x100 amber rectangle at position 400,300"
Response: {"tool_calls":[{"name":"add_shapes","arguments":{"shapes":[{"type":"rect","x":400,"y":300,"width":200,"height":100,"fill":"#D4A853","stroke":"#3A3A40","strokeWidth":1}]}}]}

If the user wants to modify an existing shape, update its properties directly.
If the user says something that doesn't require a shape, respond naturally in Chinese.`;

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-slide-in`}>
      <div className={`
        max-w-[85%] rounded-2xl px-4 py-2.5
        ${isUser
          ? 'bg-[var(--accent)] text-[var(--bg-deep)] rounded-br-md'
          : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-bl-md'
        }
      `}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        <span className={`
          text-[10px] mt-1 block
          ${isUser ? 'text-[var(--accent-muted)]' : 'text-[var(--text-tertiary)]'}
        `}>
          {new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const { chatHistory, addChatMessage, clearChat, addShape, shapes } = useEditorStore();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const processAiResponse = (text: string) => {
    try {
      // Try to parse as JSON (tool call format)
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Not JSON, treat as regular text response
        return { type: 'text' as const, content: text };
      }

      // Check for tool_calls
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        const shapesToAdd: Omit<Shape, 'id'>[] = [];

        for (const toolCall of parsed.tool_calls) {
          if (toolCall.name === 'add_shapes' && toolCall.arguments?.shapes) {
            for (const shape of toolCall.arguments.shapes) {
              shapesToAdd.push({
                type: shape.type,
                x: shape.x ?? 100,
                y: shape.y ?? 100,
                width: shape.width,
                height: shape.height,
                radius: shape.radius,
                text: shape.text,
                fontSize: shape.fontSize,
                points: shape.points,
                fill: shape.fill || DEFAULT_SHAPE_PROPS.fill,
                stroke: shape.stroke || DEFAULT_SHAPE_PROPS.stroke,
                strokeWidth: shape.strokeWidth ?? 1,
                opacity: 1,
                rotation: 0,
                visible: true,
                locked: false,
                name: `${shape.type}-${uuid().slice(-4)}`,
              });
            }
          }
        }

        if (shapesToAdd.length > 0) {
          for (const shape of shapesToAdd) {
            addShape(shape);
          }
          return {
            type: 'shapes' as const,
            content: `已添加 ${shapesToAdd.length} 个图形到画布`,
            count: shapesToAdd.length,
          };
        }
      }

      return { type: 'text' as const, content: text };
    } catch {
      return { type: 'text' as const, content: text };
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setIsProcessing(true);

    // Add user message
    addChatMessage({ role: 'user', content: userMessage });

    // Handle special commands
    if (userMessage.toLowerCase() === '/clear') {
      clearChat();
      addChatMessage({ role: 'assistant', content: '对话已清空' });
      setIsProcessing(false);
      return;
    }

    // Build context with current shapes
    const shapesContext = shapes.length > 0
      ? `\n当前画布有 ${shapes.length} 个图形:\n${shapes.map(s => `- ${s.name} (${s.type}) at (${Math.round(s.x)}, ${Math.round(s.y)})`).join('\n')}`
      : '\n当前画布为空。';

    // Simulate AI response (in production, this would call Claude API)
    // For now, we'll parse the input and generate appropriate responses
    const prompt = `${SYSTEM_PROMPT}\n\n当前画布信息:${shapesContext}\n\n用户: ${userMessage}`;

    // Simple rule-based response for demo
    let response = '';
    const lowerInput = userMessage.toLowerCase();

    if (lowerInput.includes('画') || lowerInput.includes('添加') || lowerInput.includes('创建') || lowerInput.includes('draw') || lowerInput.includes('add') || lowerInput.includes('create')) {
      // Try to extract shape info from the request
      const shapeMatch = userMessage.match(/(\w+)/);
      let shapeType = 'rect';
      let fill = '#4A4A52';
      let x = 200 + Math.random() * 600;
      let y = 200 + Math.random() * 400;
      let width = 150;
      let height = 100;
      let radius = 50;

      if (lowerInput.includes('圆') || lowerInput.includes('circle')) {
        shapeType = 'circle';
        x = 860 - 50;
        y = 490 - 50;
        radius = 60;
      } else if (lowerInput.includes('文字') || lowerInput.includes('text')) {
        shapeType = 'text';
        x = 400;
        y = 300;
        width = 200;
      } else if (lowerInput.includes('线') || lowerInput.includes('line')) {
        shapeType = 'line';
        x = 0;
        y = 0;
        width = 0;
        height = 0;
      }

      if (lowerInput.includes('蓝') || lowerInput.includes('blue')) fill = '#5D8DC7';
      else if (lowerInput.includes('红') || lowerInput.includes('red')) fill = '#C75D5D';
      else if (lowerInput.includes('绿') || lowerInput.includes('green')) fill = '#7CB77C';
      else if (lowerInput.includes('黄') || lowerInput.includes('amber') || lowerInput.includes('yellow')) fill = '#D4A853';
      else if (lowerInput.includes('紫') || lowerInput.includes('purple')) fill = '#A855F7';

      // Build tool call response
      const toolCall = {
        tool_calls: [{
          name: 'add_shapes',
          arguments: {
            shapes: [{
              type: shapeType,
              x,
              y,
              ...(shapeType === 'rect' ? { width, height, fill } : {}),
              ...(shapeType === 'circle' ? { radius, fill } : {}),
              ...(shapeType === 'text' ? { text: '新文本', fontSize: 24, width: 200, fill } : {}),
              ...(shapeType === 'line' ? { points: [0, 0, 200, 100], stroke: fill, strokeWidth: 2 } : {}),
              stroke: '#3A3A40',
              strokeWidth: 1,
            }]
          }
        }]
      };

      response = JSON.stringify(toolCall);
    } else if (lowerInput.includes('清空') || lowerInput.includes('clear') || lowerInput.includes('删除所有')) {
      response = '好的，已清除画布上的所有内容';
      useEditorStore.getState().clearCanvas();
    } else if (lowerInput.includes('有多少') || lowerInput.includes('几个') || lowerInput.includes('how many')) {
      response = `当前画布上有 ${shapes.length} 个图形`;
    } else {
      response = '我理解你的需求。试着说"画一个蓝色的圆"或"在中间添加一个矩形"';
    }

    const result = processAiResponse(response);

    if (result.type === 'shapes') {
      addChatMessage({
        role: 'assistant',
        content: result.content,
      });
    } else {
      addChatMessage({
        role: 'assistant',
        content: result.content,
      });
    }

    setIsProcessing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--accent)]" />
          <h2 className="text-sm font-medium text-[var(--text-primary)]">AI 助手</h2>
        </div>
        <button
          onClick={clearChat}
          className="p-1.5 hover:bg-[var(--bg-elevated)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          title="清空对话"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br from-[var(--accent-muted)] to-[var(--accent)] flex items-center justify-center">
              <Sparkles size={24} className="text-white" />
            </div>
            <p className="text-sm text-[var(--text-primary)] font-medium mb-1">
              嗨，我是你的 AI 画布助手
            </p>
            <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
              说"画一个蓝色的圆"或"在中间添加矩形"，我来帮你创作
            </p>
          </div>
        ) : (
          <>
            {chatHistory.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
              />
            ))}
            {isProcessing && (
              <div className="flex justify-start animate-fade-slide-in">
                <div className="bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-2xl rounded-bl-md px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-end gap-2 bg-[var(--bg-elevated)] rounded-xl px-3 py-2 border border-[var(--border)] focus-within:border-[var(--accent)] transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="描述你想画的..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none outline-none min-h-[24px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className={`
              p-2 rounded-lg transition-all
              ${input.trim() && !isProcessing
                ? 'bg-[var(--accent)] text-[var(--bg-deep)] hover:bg-[var(--accent-hover)]'
                : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)]'
              }
            `}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-2 text-center">
          按 Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  );
}
