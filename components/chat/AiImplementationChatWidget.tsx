'use client';

import { FormEvent, useMemo, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const SESSION_STORAGE_KEY = 'ai_chat_session_id';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

export function AiImplementationChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I can help with implementing AI in your business (automation, tools, integrations, roadmap, and costs). What are you trying to improve first?",
    },
  ]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isSending) return;

    setInput('');
    setError(null);

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getSessionId(),
          message: content,
          sourcePage: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to get assistant response');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: payload.reply,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setError(msg);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[120] flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[min(92vw,24rem)] rounded-2xl border border-cyan-400/25 bg-[#071325]/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-cyan-300/15 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-white">AiWebDesignFirm AI Assistant</p>
              <p className="text-xs text-cyan-200/70">AI implementation help</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-cyan-100/80 hover:bg-white/10 hover:text-white"
              aria-label="Close AI assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[22rem] space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((msg) => (
              <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    msg.role === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500 px-3 py-2 text-sm font-medium text-black'
                      : 'max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-3 py-2 text-sm text-white whitespace-pre-wrap'
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isSending ? <p className="text-xs text-cyan-200/70">Thinking…</p> : null}
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
          </div>

          <form onSubmit={sendMessage} className="space-y-2 border-t border-cyan-300/15 p-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about implementing AI for your business..."
              className="min-h-[86px] border-cyan-300/30 bg-[#081a31] text-sm text-white placeholder:text-cyan-200/40 focus-visible:ring-cyan-400/60"
              maxLength={2000}
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-cyan-200/55">Logs are saved for follow-up.</p>
              <Button
                type="submit"
                size="sm"
                className="bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50"
                disabled={!canSend}
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        size="icon"
        className="h-14 w-14 rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black shadow-[0_12px_32px_-12px_rgba(0,212,255,0.9)] hover:from-[#1b7bff] hover:to-[#27dcff]"
        aria-label={open ? 'Close AI implementation chat' : 'Open AI implementation chat'}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </div>
  );
}
