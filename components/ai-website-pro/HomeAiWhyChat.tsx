'use client';

import { useCallback, useState } from 'react';
import { MessageCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChatLine = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};

const INITIAL_MESSAGES: ChatLine[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Tap a question below — these are quick answers about why bringing AI into your business matters. (Demo only; nothing is sent to a server.)',
  },
];

/** Short label for the chip + full answer shown in the thread */
const FAQ_ITEMS: { id: string; label: string; question: string; answer: string }[] = [
  {
    id: 'why-now',
    label: 'Why care about AI now?',
    question: 'Why should my business care about AI right now?',
    answer:
      'Customers already expect instant answers, smart routing, and personalized follow-up. Competitors that adopt AI earlier capture more leads, respond faster, and run leaner operations. Waiting usually means paying more for ads and labor to get the same outcomes AI can help automate or amplify.',
  },
  {
    id: 'if-wait',
    label: 'What if we wait?',
    question: 'What happens if we keep putting AI off?',
    answer:
      'Nothing breaks overnight — but the gap widens. Search and buying behavior keep shifting toward AI-assisted discovery, and manual workflows become the bottleneck. The cost of “catching up” later is often bigger than experimenting with one high-impact workflow now.',
  },
  {
    id: 'cost-time',
    label: 'AI and costs / time',
    question: 'How can AI help with costs and time?',
    answer:
      'AI shines at repetitive work: drafting replies, qualifying leads, scheduling, data entry, and first-line support. That frees your team for revenue work and relationships. Even modest automation often returns hours per week per person — time that compounds across the year.',
  },
  {
    id: 'jobs',
    label: 'Will AI replace our staff?',
    question: 'Will AI replace our employees?',
    answer:
      'Used well, AI is a copilot: it handles volume and speed so people can focus on judgment, trust, and exceptions. Most small and mid-size wins come from augmenting staff — fewer dropped balls, faster responses — not from eliminating roles overnight.',
  },
  {
    id: 'start',
    label: 'Where do we start?',
    question: "We're not technical — where do we even start?",
    answer:
      "Start with one painful process: missed calls, slow quotes, inbox overload, or scheduling chaos. Prove value there, then expand. You don't need a giant roadmap on day one — you need a clear first workflow and a way to measure \"before vs after.\"",
  },
  {
    id: 'vs-software',
    label: 'AI vs normal software',
    question: 'How is AI different from regular software we already use?',
    answer:
      'Traditional software follows fixed rules. AI can interpret messy inputs (emails, voicemails, notes), adapt phrasing, and prioritize next steps from context. Together, they’re stronger: your systems hold the data; AI helps act on it faster and more consistently.',
  },
];

export function HomeAiWhyChat() {
  const [messages, setMessages] = useState<ChatLine[]>(INITIAL_MESSAGES);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());

  const pickFaq = useCallback((item: (typeof FAQ_ITEMS)[number]) => {
    const stamp = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    setMessages((prev) => [
      ...prev,
      { id: `u_${stamp}`, role: 'user', content: item.question },
      { id: `a_${stamp}`, role: 'assistant', content: item.answer },
    ]);
    setUsedIds((prev) => new Set(prev).add(item.id));
  }, []);

  const reset = useCallback(() => {
    setMessages(INITIAL_MESSAGES);
    setUsedIds(new Set());
  }, []);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 border-b border-[#0066ff]/25 pb-3">
        <div className="flex items-center gap-2 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0066ff]/40 to-[#00d4ff]/25 text-[#7dd3fc] ring-1 ring-[#00d4ff]/30">
            <MessageCircle className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-white">Why AI for your business?</p>
            <p className="text-xs text-gray-500">Sample Q&amp;A — runs only in your browser</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-cyan-400/30 hover:bg-white/10 hover:text-white"
          aria-label="Reset chat"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset
        </button>
      </div>

      <div className="max-h-[220px] space-y-3 overflow-y-auto border-x border-b border-[#0066ff]/20 border-t-0 bg-[#080c14] px-3 py-3 sm:max-h-[260px] sm:px-4">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'rounded-br-md bg-gradient-to-r from-[#0066ff] to-[#0052cc] text-white'
                  : 'rounded-bl-md border border-white/10 bg-[#0a1525] text-gray-200',
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-b-xl border border-t-0 border-[#0066ff]/20 bg-[#060a10] p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Common questions</p>
        <div className="flex flex-wrap gap-2">
          {FAQ_ITEMS.map((item) => {
            const dim = usedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => pickFaq(item)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors sm:text-[13px]',
                  dim
                    ? 'border-white/10 bg-white/[0.04] text-gray-500 hover:text-gray-400'
                    : 'border-[#00d4ff]/35 bg-[#0066ff]/15 text-cyan-100 hover:border-[#00d4ff]/55 hover:bg-[#0066ff]/25',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
