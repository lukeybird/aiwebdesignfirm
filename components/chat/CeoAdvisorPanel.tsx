'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Send, Volume2, VolumeX } from 'lucide-react';
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
const LENGTH_STORAGE_KEY = 'ceo_coach_response_length';

const LENGTH_HINTS: Record<number, string> = {
  1: '1 word',
  2: '1 sentence (15–20 words)',
  3: '2–3 sentences (20–60 words)',
  4: '1 paragraph (120–180 words)',
  5: '2 paragraphs (350–600 words)',
  6: 'Small report (600–800 words)',
  7: 'Medium report (750–1500 words)',
  8: 'Detailed (up to ~3000 words)',
  9: 'Very long (up to ~6000 words, continue in chat)',
  10: 'Maximum depth (up to ~15k words, continue in chat)',
};

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Use the length slider above, then ask anything about running your business. I will match that depth every time.',
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

function readStoredLength(): number {
  if (typeof window === 'undefined') return 4;
  const raw = window.localStorage.getItem(LENGTH_STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 4;
  if (!Number.isFinite(n)) return 4;
  return Math.min(10, Math.max(1, n));
}

function startNewSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.location.reload();
  }
}

export function CeoAdvisorPanel() {
  const [input, setInput] = useState('');
  const [responseLength, setResponseLength] = useState(4);
  const [readAloud, setReadAloud] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [artifacts, setArtifacts] = useState<ApiArtifact[]>([]);
  const lastSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    setResponseLength(readStoredLength());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LENGTH_STORAGE_KEY, String(responseLength));
  }, [responseLength]);

  useEffect(() => {
    if (readAloud || typeof window === 'undefined') return;
    window.speechSynthesis?.cancel();
  }, [readAloud]);

  useEffect(() => {
    if (!readAloud || typeof window === 'undefined' || !window.speechSynthesis) return;
    const last = messages.at(-1);
    if (!last || last.role !== 'assistant') return;
    if (last.id === 'welcome') return;
    if (lastSpokenIdRef.current === last.id) return;
    lastSpokenIdRef.current = last.id;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(last.content);
    utter.rate = 0.92;
    window.speechSynthesis.speak(utter);
  }, [messages, readAloud]);

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
          responseLength,
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
    <section className="min-h-[100dvh] bg-[#03050a] text-white">
      <div className="mx-auto w-full max-w-[min(100%,88rem)] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        {/* Length slider — top of page */}
        <div className="mb-8 rounded-2xl border border-cyan-400/25 bg-[#0a1528]/90 p-6 shadow-[0_24px_80px_-40px_rgba(0,102,255,0.45)] backdrop-blur-md sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300/90">Response length</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Level {responseLength}{' '}
                <span className="text-lg font-semibold text-cyan-200/80 sm:text-xl">
                  — {LENGTH_HINTS[responseLength]}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="border-cyan-400/50 bg-black/30 px-5 text-base text-cyan-50 hover:bg-white/10"
                onClick={() => setReadAloud((v) => !v)}
              >
                {readAloud ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                {readAloud ? 'Voice on' : 'Voice off'}
              </Button>
            </div>
          </div>
          <div className="mt-6">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={responseLength}
              onChange={(e) => setResponseLength(Number(e.target.value))}
              className="h-4 w-full cursor-pointer accent-cyan-400"
              aria-valuemin={1}
              aria-valuemax={10}
              aria-valuenow={responseLength}
              aria-label="Response length from 1 shortest to 10 longest"
            />
            <div className="mt-2 flex justify-between text-lg font-semibold text-cyan-100/70">
              <span>1</span>
              <span>10</span>
            </div>
          </div>
        </div>

        <div className="mb-10 flex flex-col gap-6 rounded-2xl border border-cyan-400/20 bg-[#081326]/75 p-8 backdrop-blur-lg sm:flex-row sm:items-start sm:justify-between lg:p-10">
          <div className="max-w-4xl">
            <p className="text-base font-bold uppercase tracking-[0.18em] text-cyan-300/85">CEO Strategy Advisor</p>
            <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Run your business like a tech CEO
            </h1>
            <p className="mt-5 text-xl leading-relaxed text-cyan-50/90 sm:text-2xl lg:text-[1.35rem] lg:leading-8">
              Large-screen layout, easy to read. Mark Zuckerberg-style operating lens: mission, speed, leverage,
              metrics. Conversation and cards persist on the server.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="border-cyan-400/45 bg-black/25 px-6 text-lg text-cyan-50 hover:bg-white/10"
              onClick={() => void hydrate()}
              disabled={isHydrating}
            >
              <RefreshCw className="h-5 w-5" />
              Reload
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="border-cyan-400/45 bg-black/25 px-6 text-lg text-cyan-50 hover:bg-white/10"
              onClick={startNewSession}
            >
              New session
            </Button>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-2 xl:gap-10">
          <div className="rounded-3xl border-2 border-cyan-300/25 bg-[#071325]/90 shadow-[0_28px_90px_-36px_rgba(0,0,0,0.9)]">
            <div className="border-b border-cyan-300/20 px-6 py-5 sm:px-8">
              <p className="text-2xl font-black text-white">Conversation</p>
              <p className="mt-1 text-lg text-cyan-200/70">Full thread saved for this session.</p>
            </div>
            <div className="max-h-[min(72vh,52rem)] space-y-5 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
              {isHydrating ? (
                <p className="text-xl text-cyan-200/75">Loading…</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={
                        msg.role === 'user'
                          ? 'max-w-[92%] rounded-3xl rounded-br-lg bg-cyan-400 px-6 py-5 text-xl font-semibold leading-relaxed text-black sm:text-2xl'
                          : 'max-w-[92%] whitespace-pre-wrap rounded-3xl rounded-bl-lg bg-white/12 px-6 py-5 text-xl leading-relaxed text-white sm:text-2xl'
                      }
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {isSending ? <p className="text-xl text-cyan-200/80">…</p> : null}
              {error ? <p className="text-xl text-red-300">{error}</p> : null}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 border-t border-cyan-300/20 p-6 sm:p-8">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What decision are you stuck on?"
                className="min-h-[140px] rounded-2xl border-2 border-cyan-300/35 bg-[#091a31] p-5 text-xl leading-relaxed text-white placeholder:text-cyan-200/45 focus-visible:ring-2 focus-visible:ring-cyan-400/80 sm:text-2xl"
                maxLength={3000}
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-base text-cyan-200/60">Shorter levels return faster.</p>
                <Button
                  type="submit"
                  size="lg"
                  className="h-14 min-w-[10rem] rounded-full bg-cyan-400 px-8 text-lg font-black text-black hover:bg-cyan-300 disabled:opacity-50 sm:h-16 sm:text-xl"
                  disabled={!canSend || isHydrating}
                >
                  <Send className="h-6 w-6" />
                  Send
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-3xl border-2 border-cyan-300/25 bg-[#071325]/90 shadow-[0_28px_90px_-36px_rgba(0,0,0,0.9)]">
            <div className="border-b border-cyan-300/20 px-6 py-5 sm:px-8">
              <p className="text-2xl font-black text-white">Built on this page</p>
              <p className="mt-1 text-lg text-cyan-200/70">Live cards from each reply.</p>
            </div>
            <div className="max-h-[min(78vh,56rem)] space-y-5 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
              {artifacts.length === 0 ? (
                <p className="text-xl leading-relaxed text-cyan-200/65 sm:text-2xl">
                  No cards yet. Turn the length up for richer artifacts, or ask a strategic question.
                </p>
              ) : (
                artifacts.map((a) => (
                  <article
                    key={a.id}
                    className="rounded-2xl border border-cyan-400/25 bg-[#091a31]/90 p-6 shadow-inner shadow-black/30 sm:p-8"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-2xl font-black text-white sm:text-3xl">{a.title}</h2>
                      <span className="rounded-full bg-cyan-500/20 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-cyan-100">
                        {a.kind}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-xl leading-relaxed text-cyan-50/95 sm:text-2xl">{a.body}</p>
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
