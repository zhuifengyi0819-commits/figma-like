'use client';

import { useState, useRef, useEffect, useId, KeyboardEvent } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { Send, Trash2, Sparkles } from 'lucide-react';
import { chatWithAi, parseAddShapesToolCall, type ParseResult, checkAiConfigured } from '@/lib/ai';

// ─── Toast 系统 ───────────────────────────────────────────────────────────

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  shapeIds?: string[]; // 新添加的图形 ID，选中高亮用
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl
            animate-toast-in
            ${toast.type === 'success' ? 'bg-[var(--accent)] text-[var(--bg-deep)]' : ''}
            ${toast.type === 'error'   ? 'bg-[var(--danger)] text-white' : ''}
            ${toast.type === 'info'    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)]' : ''}
          `}
          style={{ minWidth: 240, maxWidth: 360 }}
        >
          <span className="text-sm leading-relaxed flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-current opacity-50 hover:opacity-100 transition-opacity text-xs"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Chat Message ──────────────────────────────────────────────────────────

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
        <span className={`text-[10px] mt-1 block ${isUser ? 'text-[var(--accent-muted)]' : 'text-[var(--text-tertiary)]'}`}>
          {new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── AI 命令列表（/help 显示）──────────────────────────────────────────────

const AI_COMMANDS = [
  { cmd: '/clear-chat', desc: '清空对话' },
  { cmd: '/clear-canvas', desc: '清空画布' },
  { cmd: '/help', desc: '查看 AI 助手支持的功能' },
  { cmd: '画一个蓝色的圆', desc: '在画布上添加一个蓝色圆形' },
  { cmd: '在中间画个矩形', desc: '在画布中央添加矩形' },
  { cmd: '添加文字标题', desc: '在画布上添加文本' },
];

// ─── 提取画布位置摘要（传给 AI）────────────────────────────────────────────

function summarizeShapePositions(shapes: ReturnType<typeof useEditorStore.getState>['shapes']): string {
  if (!shapes || shapes.length === 0) return '';
  const visible = shapes.filter(s => s.visible && s.x !== undefined && s.y !== undefined).slice(0, 15);
  if (visible.length === 0) return '';
  const centers = visible.map(s => {
    if (s.type === 'circle' || s.type === 'star' || s.type === 'triangle') {
      return { x: s.x, y: s.y };
    }
    return { x: s.x + (s.width || 100) / 2, y: s.y + (s.height || 100) / 2 };
  });
  const minX = Math.min(...centers.map(c => c.x));
  const maxX = Math.max(...centers.map(c => c.x));
  const minY = Math.min(...centers.map(c => c.y));
  const maxY = Math.max(...centers.map(c => c.y));
  return `现有图形位置范围：左${Math.round(minX)} 上${Math.round(minY)} 右${Math.round(maxX)} 下${Math.round(maxY)}，画布中央 (960, 540)`;
}

// ─── ChatPanel 主组件 ───────────────────────────────────────────────────────

export default function ChatPanel() {
  const { chatHistory, addChatMessage, clearChat, addShape, shapes, clearCanvas, setSelectedIds, panToShapeIds } = useEditorStore();
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [aiConfigured, setAiConfigured] = useState(true); // 默认 true，避免闪烁
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isProcessing]);

  // '/' 全局快捷键聚焦输入框
  useEffect(() => {
    const handleFocus = () => textareaRef.current?.focus();
    window.addEventListener('focus-chat-input', handleFocus);
    return () => window.removeEventListener('focus-chat-input', handleFocus);
  }, []);

  // 检测 AI 是否配置（挂载时）
  useEffect(() => {
    setMounted(true);
    checkAiConfigured().then(ok => setAiConfigured(ok));
  }, []);

  // Toast 管理
  const toastIdPrefix = useId();
  let toastSeq = 0;
  const addToast = (type: Toast['type'], message: string, shapeIds?: string[]) => {
    const id = `${toastIdPrefix}-${++toastSeq}`;
    setToasts(prev => [...prev, { id, type, message, shapeIds }]);
    // 自动3秒后消失
    setTimeout(() => dismissToast(id), 3500);
    // 选中 AI 新增的图形
    if (shapeIds && shapeIds.length > 0) {
      setTimeout(() => setSelectedIds(shapeIds), 80);
    }
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    if (!aiConfigured) {
      addToast('error', 'AI 助手暂未配置，请联系管理员配置 MINIMAX_API_KEY');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setIsProcessing(true);
    setError(null);

    // 重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    addChatMessage({ role: 'user', content: userMessage });

    // 内置命令：/clear-chat
    if (userMessage.toLowerCase() === '/clear-chat') {
      clearChat();
      addChatMessage({ role: 'assistant', content: '💬 对话已清空，可以开始新的对话！' });
      setIsProcessing(false);
      return;
    }

    // 内置命令：/clear-canvas（含旧 /clear 别名）
    if (userMessage.toLowerCase() === '/clear-canvas' || userMessage.toLowerCase() === '/clear') {
      clearCanvas();
      addChatMessage({ role: 'assistant', content: '🗑️ 画布已清空，可以开始新的创作！' });
      setIsProcessing(false);
      return;
    }

    // 内置命令：/help
    if (userMessage.toLowerCase() === '/help') {
      const helpText = '🤖 **AI 画布助手**\n\n支持以下操作：\n' +
        AI_COMMANDS.map(c => `• **${c.cmd}** — ${c.desc}`).join('\n') +
        '\n\n直接描述你想要的内容即可，例如："画一个红色圆形"';
      addChatMessage({ role: 'assistant', content: helpText });
      setIsProcessing(false);
      return;
    }

    // 构建 AI 消息历史（最近20条）
    const aiMessages = chatHistory.slice(-20).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 提取画布位置摘要
    const shapePositions = summarizeShapePositions(shapes);

    try {
      const result = await chatWithAi(aiMessages, shapes.length, shapePositions);

      // 执行 tool calls
      let shapesAddedCount = 0;
      const addedShapeIds: string[] = [];

      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const toolCall of result.toolCalls) {
          if (toolCall.name === 'add_shapes') {
            try {
              const result = parseAddShapesToolCall(toolCall.args) as ParseResult;
              if (result.errors && result.errors.length > 0) {
                const errMsg = result.errors.join('；');
                addToast('error', `解析警告：${errMsg}`);
                addChatMessage({ role: 'assistant', content: `⚠️ ${errMsg}` });
              }
              for (const shape of result.shapes) {
                const id = addShape(shape);
                addedShapeIds.push(id);
                shapesAddedCount++;
              }
            } catch (shapeErr) {
              const msg = shapeErr instanceof Error ? shapeErr.message : String(shapeErr);
              addToast('error', `图形解析失败：${msg}`);
              addChatMessage({ role: 'assistant', content: `⚠️ 图形解析失败：${msg}` });
            }
          }
        }
      }

      // 构建 AI 回复
      let responseText = result.text.trim();

      if (shapesAddedCount > 0) {
        const shapeWord = shapesAddedCount === 1 ? '图形' : `${shapesAddedCount} 个图形`;
        responseText += `\n\n✅ 已添加 ${shapesAddedCount} 个图形到画布`;
        addToast('success', `✅ 添加了 ${shapeWord}`, addedShapeIds);
        // 自动将新图形滚入视野
        panToShapeIds(addedShapeIds);
      }

      if (!responseText) {
        responseText = '收到指令，但我没有执行操作。可以试着说"画一个蓝色的圆"来开始创作！';
      }

      addChatMessage({ role: 'assistant', content: responseText });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 服务暂时不可用，请稍后重试。';
      setError(msg);
      addToast('error', `出错了：${msg}`);
      addChatMessage({
        role: 'assistant',
        content: `❌ 出错了：${msg}`,
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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  const placeholder = chatHistory.length === 0
    ? '描述你想画的，比如"画一个蓝色的圆形"…'
    : '再说点什么…';

  return (
    <div className="h-full flex flex-col bg-[var(--bg-surface)] relative">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

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
              说&quot;画一个蓝色的圆&quot;或&quot;在中间添加矩形&quot;，我来帮你创作
            </p>
            <div className="mt-4 flex flex-col gap-1 text-left w-full max-w-[220px]">
              <p className="text-[10px] text-[var(--text-tertiary)] mb-1">试试说：</p>
              {AI_COMMANDS.slice(2, 5).map(c => (
                <button
                  key={c.cmd}
                  onClick={() => setInput(c.cmd)}
                  className="text-xs text-left text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors truncate"
                >
                  → {c.cmd}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {chatHistory.map((msg) => (
              <ChatMessage key={msg.id} role={msg.role} content={msg.content} timestamp={msg.timestamp} />
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
        {mounted && !aiConfigured && (
          <div className="mb-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] rounded-lg px-3 py-2 border border-[var(--border)]">
            🤖 AI 助手暂不可用，请在 <code className="text-[var(--accent)] font-mono text-[10px]">.env.local</code> 中配置 <code className="text-[var(--accent)] font-mono text-[10px]">MINIMAX_API_KEY</code> 后重试
          </div>
        )}
        {error && (
          <div className="mb-2 text-xs text-[var(--danger)] bg-[var(--danger)]/10 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex items-end gap-2 bg-[var(--bg-elevated)] rounded-xl px-3 py-2 border border-[var(--border)] focus-within:border-[var(--accent)] transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none outline-none min-h-[24px] max-h-[120px]"
            rows={1}
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className={`
              p-2 rounded-lg transition-all flex-shrink-0
              ${input.trim() && !isProcessing
                ? 'bg-[var(--accent)] text-[var(--bg-deep)] hover:bg-[var(--accent-hover)] cursor-pointer'
                : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)] cursor-not-allowed'
              }
            `}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-2 text-center">
          Enter 发送 · Shift+Enter 换行 · /clear-canvas 清空画布 · /help 查看帮助
        </p>
      </div>
    </div>
  );
}
