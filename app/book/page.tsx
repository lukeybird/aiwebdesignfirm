'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bot, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { UseCasesMarqueeBackdrop } from '@/components/ai-website-pro/UseCasesMarqueeBackdrop';
import {
  CONTACT_SECTION_THEME,
  AI_WEB_SECTION_GUTTER_X,
  AI_WEB_SECTION_PAD_Y,
  AI_WEB_FORM_LABEL,
  AI_WEB_FORM_BRAND_TITLE,
  AI_WEB_FORM_BRAND_SUB,
  AI_WEB_TYPE_META,
  AI_WEB_TYPE_BODY,
} from '@/lib/ai-website-pro-contact-theme';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  subMonths,
} from 'date-fns';

const theme = CONTACT_SECTION_THEME;

type Slot = { startsAt: string; endsAt: string; label: string; taken?: boolean };
type DaySlots = { date: string; slots: Slot[] };

function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function FormGlowCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-3xl">
      <motion.div
        className={cn(
          'absolute -inset-px rounded-3xl blur-2xl -z-10 pointer-events-none transition-colors duration-500',
          theme.formGlowMotion,
        )}
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className={cn(
          'absolute inset-0 rounded-3xl blur-xl -z-10 pointer-events-none transition-colors duration-500',
          theme.formGlowStatic,
        )}
      />
      <div
        className={cn(
          'relative rounded-3xl p-8 md:p-9 overflow-hidden transition-all duration-500',
          theme.formCard,
        )}
      >
        <div
          className={cn(
            'absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none transition-colors duration-500',
            theme.formBlobTL,
          )}
        />
        <div
          className={cn(
            'absolute bottom-0 left-0 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-colors duration-500',
            theme.formBlobBR,
          )}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function BookingSectionLayout({
  maxWidthClass,
  children,
}: {
  maxWidthClass: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'relative min-h-[100dvh] overflow-hidden border-t transition-colors duration-500',
        AI_WEB_SECTION_PAD_Y,
        theme.sectionBorder,
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0.88 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.38, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <div className={cn('absolute inset-0', theme.sectionBg)} />
          <div className={cn('absolute inset-0', theme.radial)} />
          <motion.div
            className={cn(
              'absolute -top-32 right-0 w-[min(90vw,520px)] h-[520px] rounded-full blur-[100px]',
              theme.blurTop,
            )}
            animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.08, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className={cn(
              'absolute bottom-0 left-0 w-[min(85vw,480px)] h-[480px] rounded-full blur-[110px]',
              theme.blurBottom,
            )}
            animate={{ opacity: [0.3, 0.55, 0.3] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
        </motion.div>
      </div>
      <div className="absolute inset-0 z-[1] flex min-h-0 flex-col overflow-hidden py-4 sm:py-8">
        <UseCasesMarqueeBackdrop className="min-h-0 flex-1" />
      </div>
      <div className={cn('relative z-10 mx-auto w-full max-w-none', AI_WEB_SECTION_GUTTER_X)}>
        <div className={cn('mx-auto w-full', maxWidthClass)}>{children}</div>
      </div>
    </section>
  );
}

function BookContent() {
  const searchParams = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plan, setPlan] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadyBooked, setAlreadyBooked] = useState(false);

  const [days, setDays] = useState<DaySlots[]>([]);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setName(searchParams.get('name')?.trim() || '');
    setEmail(searchParams.get('email')?.trim() || '');
    setPhone(searchParams.get('phone')?.trim() || '');
    setPlan(searchParams.get('plan')?.trim() || '');
  }, [searchParams]);

  const loadSlots = useCallback(async () => {
    const em = email.trim().toLowerCase();
    const q = em ? `&email=${encodeURIComponent(em)}` : '';
    const r = await fetch(`/api/booking/slots?days=45${q}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if ((j as { error?: string }).error === 'Already booked') {
        setAlreadyBooked(true);
        setDays([]);
        return;
      }
      setError((j as { error?: string }).error || 'Could not load availability.');
      setDays([]);
      return;
    }
    setError(null);
    setAlreadyBooked(false);
    setDays((j as { days?: typeof days }).days || []);
    setIntervalMinutes((j as { intervalMinutes?: number }).intervalMinutes ?? 30);
  }, [email]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      await loadSlots();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSlots]);

  const phoneDigits = phone.replace(/\D/g, '');
  const phoneOk = phoneDigits.length >= 10;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nameOk = name.trim().length >= 2;

  const daysByDate = new Map<string, Slot[]>();
  for (const d of days) daysByDate.set(d.date, d.slots);

  const firstAvailableYmd = days.find((d) => d.slots.length > 0)?.date;
  const defaultMonthBase = firstAvailableYmd ? ymdToDate(firstAvailableYmd) : new Date();
  const [monthBase, setMonthBase] = useState<Date>(startOfMonth(defaultMonthBase));

  useEffect(() => {
    if (!selectedDate && firstAvailableYmd) {
      setSelectedDate(firstAvailableYmd);
      setSelected(null);
      setMonthBase(startOfMonth(ymdToDate(firstAvailableYmd)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstAvailableYmd]);

  async function confirm() {
    if (!selected || !phoneOk) return;
    setBooking(true);
    setError(null);
    try {
      const r = await fetch('/api/booking/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          plan: plan.trim() || null,
          startsAt: selected,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((j as { error?: string }).error || 'Booking failed.');
        return;
      }
      setDone(true);
      setSelected(null);
    } finally {
      setBooking(false);
    }
  }

  const backLink = (
    <Link
      href="/"
      className={cn(
        AI_WEB_TYPE_META,
        'text-cyan-200/50 hover:text-cyan-100/90 mb-8 inline-block transition-colors',
      )}
    >
      ← aiWebDF
    </Link>
  );

  const brandHeader = (
    <div className="flex items-center gap-3 pb-4 mb-1 relative">
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 h-px rounded-full pointer-events-none transition-colors duration-500',
          theme.divider,
        )}
        aria-hidden
      />
      <img
        src="/blueBall.png"
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 object-contain shrink-0 drop-shadow-[0_0_16px_rgba(59,130,246,0.45)]"
      />
      <div className="min-w-0">
        <p className={AI_WEB_FORM_BRAND_TITLE}>aiWebDF</p>
        <p className={cn(AI_WEB_FORM_BRAND_SUB, theme.formHeaderSub)}>Book a call</p>
        {plan ? (
          <p className={cn(AI_WEB_FORM_LABEL, theme.label, 'mt-2')}>
            Plan <span className="opacity-60 font-normal normal-case tracking-normal">({plan})</span>
          </p>
        ) : null}
      </div>
    </div>
  );

  if (done) {
    return (
      <BookingSectionLayout maxWidthClass="max-w-lg">
        {backLink}
        <FormGlowCard>
          <div className="text-center space-y-6">
            <div
              className={cn(
                'mx-auto flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-500',
                theme.successRing,
              )}
            >
              <CheckCircle2 className={cn('h-9 w-9', theme.successIcon)} aria-hidden />
            </div>
            <div>
              <h1 className={cn('text-2xl sm:text-3xl font-black font-heading', theme.successTitle)}>
                You&apos;re set
              </h1>
              <p className={cn('mt-3', AI_WEB_TYPE_BODY, theme.successSub)}>
                We sent a confirmation email with your time (US Eastern). If you don&apos;t see it, check spam.
              </p>
            </div>
            <Button asChild className={cn('rounded-xl', theme.successBtn)}>
              <Link href="/">Return home</Link>
            </Button>
          </div>
        </FormGlowCard>
      </BookingSectionLayout>
    );
  }

  if (alreadyBooked) {
    return (
      <BookingSectionLayout maxWidthClass="max-w-lg">
        {backLink}
        <FormGlowCard>
          <div className="text-center space-y-6">
            <div
              className={cn(
                'mx-auto flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-500',
                theme.successRing,
              )}
            >
              <CheckCircle2 className={cn('h-9 w-9', theme.successIcon)} aria-hidden />
            </div>
            <div>
              <h1 className={cn('text-xl sm:text-2xl font-black font-heading', theme.successTitle)}>
                You already have a call scheduled
              </h1>
              <p className={cn('mt-3', AI_WEB_TYPE_BODY, theme.successSub)}>
                Check your email for the time, or reply to reach us.
              </p>
            </div>
            <Button asChild className={cn('rounded-xl', theme.successBtn)}>
              <Link href="/">Back to aiWebDF</Link>
            </Button>
          </div>
        </FormGlowCard>
      </BookingSectionLayout>
    );
  }

  return (
    <BookingSectionLayout maxWidthClass="max-w-lg">
      {backLink}
      <FormGlowCard>
        <div className="relative space-y-6">
          {brandHeader}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={cn(AI_WEB_FORM_LABEL, theme.label)} htmlFor="book-name">
                Name
              </label>
              <Input
                id="book-name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(theme.input)}
              />
            </div>
            <div>
              <label className={cn(AI_WEB_FORM_LABEL, theme.label)} htmlFor="book-phone">
                Phone
              </label>
              <Input
                id="book-phone"
                placeholder="(555) 555-0123"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={cn(theme.input)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={cn(AI_WEB_FORM_LABEL, theme.label)} htmlFor="book-email">
                Email
              </label>
              <Input
                id="book-email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(theme.input)}
              />
              <p className={cn('mt-2', AI_WEB_TYPE_META, 'text-cyan-200/45 normal-case tracking-normal')}>
                Availability loads for this email — use the same one as on the contact form.
              </p>
            </div>
          </div>

          <div className="relative pt-2">
            <div
              className={cn(
                'absolute top-0 left-0 right-0 h-px rounded-full pointer-events-none transition-colors duration-500',
                theme.divider,
              )}
              aria-hidden
            />
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pt-4">
              <div>
                <p className={cn(AI_WEB_FORM_LABEL, theme.label)}>Pick a day</p>
                <p className="text-sm font-semibold text-white">
                  {selectedDate
                    ? format(ymdToDate(selectedDate), 'MMMM do, yyyy')
                    : 'Select a day'}
                </p>
                <p className={cn(AI_WEB_TYPE_META, theme.formHeaderSub, 'mt-0.5 normal-case tracking-normal')}>
                  Times are US Eastern
                </p>
              </div>
              <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMonthBase((d) => startOfMonth(subMonths(d, 1)))}
                  className={cn(theme.input, 'h-9 w-9 p-0 flex items-center justify-center shrink-0')}
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <div className={cn('min-w-[132px] text-center text-sm font-bold', theme.formHeaderSub)}>
                  {format(monthBase, 'MMMM yyyy')}
                </div>
                <button
                  type="button"
                  onClick={() => setMonthBase((d) => startOfMonth(addMonths(d, 1)))}
                  className={cn(theme.input, 'h-9 w-9 p-0 flex items-center justify-center shrink-0')}
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,200px)] lg:gap-5">
            <div>
              {loading ? (
                <p className={cn(AI_WEB_TYPE_BODY, 'text-cyan-200/60')}>Loading availability…</p>
              ) : days.length === 0 && !error ? (
                <p className={cn(AI_WEB_TYPE_BODY, 'text-cyan-200/60')}>
                  No open slots in the next few weeks. We&apos;ll reach out by email.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-7 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-cyan-200/40 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="text-center">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {(() => {
                      const start = startOfMonth(monthBase);
                      const end = endOfMonth(monthBase);
                      const daysInMonth = eachDayOfInterval({ start, end });
                      const pad = start.getDay();
                      const cells: Array<{ date?: Date; ymd?: string }> = [
                        ...Array.from({ length: pad }).map(() => ({})),
                        ...daysInMonth.map((date) => ({ date, ymd: format(date, 'yyyy-MM-dd') })),
                      ];

                      const today = new Date();

                      return cells.map((c, idx) => {
                        if (!c.date || !c.ymd) {
                          return <div key={`pad-${idx}`} />;
                        }
                        const ymd = c.ymd;
                        const daySlots = daysByDate.get(ymd) || [];
                        const available = daySlots.some((s) => !s.taken);
                        const picked = selectedDate === ymd;
                        const isToday = isSameDay(c.date, today);

                        return (
                          <button
                            key={ymd}
                            type="button"
                            disabled={!available}
                            onClick={() => {
                              setSelectedDate(ymd);
                              setSelected(null);
                            }}
                            className={cn(
                              'h-9 sm:h-10 rounded-xl border text-xs sm:text-sm font-semibold transition-all',
                              available
                                ? 'border-[#0066ff]/30 bg-black/40 text-gray-100 hover:border-[#00d4ff]/45 hover:bg-[#061428]/90'
                                : 'border-transparent bg-transparent text-white/20 cursor-not-allowed',
                              picked &&
                                'bg-gradient-to-br from-[#0066ff] to-[#0052cc] border-[#00d4ff]/70 text-white shadow-[0_0_20px_-6px_rgba(0,212,255,0.55)] ring-2 ring-[#00d4ff]/50 ring-offset-2 ring-offset-[#050810]',
                              isToday && !picked && 'ring-1 ring-[#00d4ff]/35',
                            )}
                            aria-label={`${ymd}${available ? '' : ' (unavailable)'}`}
                          >
                            {c.date.getDate()}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </>
              )}
            </div>

            <div className="relative border-t border-[#0066ff]/20 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5 lg:border-l-[#0066ff]/20">
              <p className={cn(AI_WEB_FORM_LABEL, theme.label)}>Available times</p>
              {!selectedDate ? (
                <p className={cn('text-sm', AI_WEB_TYPE_BODY, 'text-cyan-200/50')}>Pick a day to see times.</p>
              ) : (daysByDate.get(selectedDate)?.some((s) => !s.taken) ?? false) === false ? (
                <p className={cn('text-sm', AI_WEB_TYPE_BODY, 'text-cyan-200/50')}>No times on this day.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(daysByDate.get(selectedDate) || []).map((s) => {
                    const picked = selected === s.startsAt;
                    return (
                      <button
                        key={s.startsAt}
                        type="button"
                        disabled={Boolean(s.taken)}
                        onClick={() => setSelected(s.startsAt)}
                        className={cn(
                          'w-full rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition-all',
                          picked
                            ? 'bg-gradient-to-r from-[#0066ff] to-[#00d4ff] border-[#00d4ff]/60 text-black shadow-[0_0_16px_-4px_rgba(0,212,255,0.5)]'
                            : s.taken
                              ? 'border-[#0066ff]/10 bg-transparent text-white/25 cursor-not-allowed line-through'
                              : 'border-[#0066ff]/30 bg-black/40 text-cyan-100/90 hover:border-[#00d4ff]/50 hover:bg-[#061428]/80',
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={cn('mt-6 rounded-xl p-4', theme.input, 'h-auto min-h-0 shadow-none')}>
                <p className={cn(AI_WEB_FORM_LABEL, theme.label, 'mb-2')}>Selection</p>
                <p className="text-sm text-cyan-100/90">
                  {selectedDate ? selectedDate : 'No day selected'}
                  {selected ? (
                    <span className="text-cyan-200/55">
                      {' '}
                      ·{' '}
                      {daysByDate.get(selectedDate || '')?.find((x) => x.startsAt === selected)?.label}
                    </span>
                  ) : null}
                </p>
              </div>

              {error ? <p className={cn('text-sm sm:text-base mt-6', theme.error)}>{error}</p> : null}

              <Button
                type="button"
                disabled={!selected || booking || !nameOk || !emailOk || !phoneOk}
                onClick={confirm}
                className={cn(
                  'mt-6 inline-flex items-center justify-center gap-2 transition-all duration-500',
                  theme.submit,
                )}
              >
                {booking ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 rounded-full animate-spin border-black/25 border-t-black" />
                    Sending…
                  </span>
                ) : selected ? (
                  <>
                    <Bot className="w-5 h-5 shrink-0" />
                    Book A Call!
                  </>
                ) : (
                  'Select a time'
                )}
              </Button>

              <p className={cn('mt-4', AI_WEB_TYPE_META, 'text-cyan-200/45')}>
                Slots are {intervalMinutes} minutes each.
              </p>
            </div>
          </div>
        </div>
      </FormGlowCard>
    </BookingSectionLayout>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            'min-h-[100dvh] text-white flex items-center justify-center',
            theme.sectionBg,
          )}
        >
          <p className={cn(AI_WEB_TYPE_BODY, 'text-cyan-200/60')}>Loading…</p>
        </div>
      }
    >
      <BookContent />
    </Suspense>
  );
}
