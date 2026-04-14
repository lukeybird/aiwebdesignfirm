'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ApiMessage = { id: number; role: string; content: string; created_at: string };
type ApiArtifact = {
  id: number;
  title: string;
  body: string;
  kind: string;
  created_at: string;
  external_id: string | null;
};

const SESSION_STORAGE_KEY = 'ceo_coach_session_id';

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'I am your CEO strategy advisor. Tell me your current growth goal, bottleneck, and timeline, and I will give you a focused operator plan.',
};

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ceo_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

function startNewSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.location.reload();
  }
}

export function CeoAdvisorPanel() {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [artifacts, setArtifacts] = useState<ApiArtifact[]>([]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const hydrate = useCallback(async () => {
    setIsHydrating(true);
    setError(null);
    try {
      const sessionId = getSessionId();
      const res = await fetch(`/api/ceo-coach?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load session');

      const rows: ApiMessage[] = data.messages ?? [];
      if (rows.length > 0) {
        setMessages(
          rows
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({
              id: `db-${m.id}`,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
        );
      } else {
        setMessages([WELCOME]);
      }

      setArtifacts(data.artifacts ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load conversation';
      setError(msg);
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isSending) return;

    setInput('');
    setError(null);

    const userMessage: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    try {
      const response = await fetch('/api/ceo-coach', {
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
        throw new Error(payload?.error || 'Failed to get CEO advisor response');
      }

      setMessages((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', content: payload.reply }]);

      if (Array.isArray(payload.artifacts) && payload.artifacts.length > 0) {
        const sessionId = getSessionId();
        const res = await fetch(`/api/ceo-coach?sessionId=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.artifacts)) {
          setArtifacts(data.artifacts);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setError(msg);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="min-h-[100dvh] bg-[#05070c] text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-8 lg:px-10">
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-cyan-400/20 bg-[#081326]/70 p-6 backdrop-blur sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">CEO Strategy Advisor</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Run your business like a tech CEO</h1>
            <p className="mt-3 max-w-3xl text-sm text-cyan-100/75 sm:text-base">
              This custom Claude assistant keeps a consistent executive operating style inspired by Mark
              Zuckerberg&apos;s decision framework: mission, velocity, leverage, and long-term compounding. Each reply
              can add structured cards on the right — your conversation and build log persist on the server.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-cyan-400/40 bg-transparent text-cyan-100 hover:bg-white/10"
              onClick={() => void hydrate()}
              disabled={isHydrating}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload session
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-cyan-400/40 bg-transparent text-cyan-100 hover:bg-white/10"
              onClick={startNewSession}
            >
              New session
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-cyan-300/20 bg-[#071325]/85 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.85)]">
            <div className="border-b border-cyan-300/15 px-4 py-3 sm:px-5">
              <p className="text-sm font-bold text-white">Conversation</p>
              <p className="text-xs text-cyan-200/60">Full thread is stored in Postgres for this session.</p>
            </div>
            <div className="max-h-[58vh] space-y-4 overflow-y-auto p-5 sm:p-6">
              {isHydrating ? (
                <p className="text-xs text-cyan-200/70">Loading conversation…</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={
                        msg.role === 'user'
                          ? 'max-w-[88%] rounded-2xl rounded-br-md bg-cyan-500 px-4 py-3 text-sm font-medium text-black'
                          : 'max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 text-sm text-white'
                      }
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {isSending ? <p className="text-xs text-cyan-200/70">Thinking like your operator...</p> : null}
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 border-t border-cyan-300/15 p-4 sm:p-5">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Example: We do $50k/mo. I want $150k/mo in 12 months. What should I prioritize first?"
                className="min-h-[104px] border-cyan-300/30 bg-[#091a31] text-sm text-white placeholder:text-cyan-200/45 focus-visible:ring-cyan-400/70"
                maxLength={3000}
              />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-cyan-200/55">Replies include page artifacts when relevant.</p>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50"
                  disabled={!canSend || isHydrating}
                >
                  <Send className="h-3.5 w-3.5" />
                  Ask Advisor
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-cyan-300/20 bg-[#071325]/85 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.85)]">
            <div className="border-b border-cyan-300/15 px-4 py-3 sm:px-5">
              <p className="text-sm font-bold text-white">Built on this page</p>
              <p className="text-xs text-cyan-200/60">
                Cards are appended from each advisor reply (plans, metrics, risks, next steps).
              </p>
            </div>
            <div className="max-h-[72vh] space-y-3 overflow-y-auto p-4 sm:p-5">
              {artifacts.length === 0 ? (
                <p className="text-sm text-cyan-200/55">
                  No artifacts yet. After you get a reply with structured output, cards appear here automatically.
                </p>
              ) : (
                artifacts.map((a) => (
                  <article
                    key={a.id}
                    className="rounded-xl border border-cyan-400/20 bg-[#091a31]/80 p-4 shadow-inner shadow-black/20"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h2 className="text-sm font-bold text-white">{a.title}</h2>
                      <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                        {a.kind}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-cyan-50/90">{a.body}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
