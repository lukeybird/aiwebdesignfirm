'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { UseCasesMarqueeBackdrop } from '@/components/ai-website-pro/UseCasesMarqueeBackdrop';
import { ContactFormCard } from '@/components/ai-website-pro/ContactFormCard';
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
        <p className={cn(AI_WEB_FORM_BRAND_SUB, theme.formHeaderSub)}>Book your call</p>
        {plan ? (
          <p className={cn(AI_WEB_TYPE_META, 'text-cyan-200/55 mt-1 normal-case tracking-normal font-medium')}>
            Plan: <span className="text-cyan-100/90">{plan}</span>
          </p>
        ) : null}
      </div>
    </div>
  );

  if (done) {
    return (
      <BookingSectionLayout maxWidthClass="max-w-lg">
        {backLink}
        <ContactFormCard>
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
        </ContactFormCard>
      </BookingSectionLayout>
    );
  }

  if (alreadyBooked) {
    return (
      <BookingSectionLayout maxWidthClass="max-w-lg">
        {backLink}
        <ContactFormCard>
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
        </ContactFormCard>
      </BookingSectionLayout>
    );
  }

  return (
    <BookingSectionLayout maxWidthClass="max-w-lg">
      {backLink}
      <ContactFormCard>
        <div className="space-y-6">
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
            <p className={cn('mt-2', AI_WEB_TYPE_META, 'text-cyan-200/45')}>
              Availability loads for this email. Use the same one you used on the contact form.
            </p>
          </div>
        </div>

        <div>
          <div className="relative flex flex-col gap-3 pb-4 mb-1 sm:flex-row sm:items-center sm:justify-between">
            <div
              className={cn(
                'absolute bottom-0 left-0 right-0 h-px rounded-full pointer-events-none transition-colors duration-500',
                theme.divider,
              )}
              aria-hidden
            />
            <div>
              <label className={cn(AI_WEB_FORM_LABEL, theme.label)}>Pick a date</label>
              <p className="text-sm font-semibold text-white">
                {selectedDate
                  ? format(ymdToDate(selectedDate), 'MMMM do, yyyy')
                  : 'Select a day'}
              </p>
              <p className={cn(AI_WEB_TYPE_META, theme.formHeaderSub, 'mt-0.5')}>
                US Eastern — then choose a time below
              </p>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMonthBase((d) => startOfMonth(subMonths(d, 1)))}
                className={cn(theme.input, 'h-9 w-9 shrink-0 p-0 flex items-center justify-center')}
                aria-label="Previous month"
              >
                ‹
              </button>
              <div className={cn('min-w-[140px] text-center text-sm font-bold', theme.formHeaderSub)}>
                {format(monthBase, 'MMMM yyyy')}
              </div>
              <button
                type="button"
                onClick={() => setMonthBase((d) => startOfMonth(addMonths(d, 1)))}
                className={cn(theme.input, 'h-9 w-9 shrink-0 p-0 flex items-center justify-center')}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </div>

          <div className="pt-2">
              {loading ? (
                <p className={cn(AI_WEB_TYPE_BODY, 'text-cyan-200/60')}>Loading availability…</p>
              ) : days.length === 0 && !error ? (
                <p className={cn(AI_WEB_TYPE_BODY, 'text-cyan-200/60')}>
                  No open slots in the next few weeks. We&apos;ll reach out by email.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-7 text-[11px] font-bold uppercase tracking-wider text-[#a5f3fc]/50 mb-3">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="text-center">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
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
                              theme.input,
                              'min-h-0 p-0 flex items-center justify-center',
                              !available && 'border-transparent bg-transparent text-white/20 cursor-not-allowed shadow-none',
                              available &&
                                'text-gray-100 hover:border-[#00d4ff]/55 hover:bg-black/60',
                              picked &&
                                '!bg-gradient-to-r !from-[#0066ff] !to-[#00d4ff] !border-[#00d4ff]/60 !text-black shadow-[0_0_20px_-6px_rgba(0,212,255,0.55)] ring-2 ring-[#00d4ff]/50 ring-offset-2 ring-offset-[#060d18]',
                              isToday && !picked && 'ring-1 ring-[#00d4ff]/40',
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
        </div>

        <div className={cn('h-px w-full rounded-full shrink-0', theme.divider)} role="presentation" />

        <div>
              <label className={cn(AI_WEB_FORM_LABEL, theme.label)}>Available times</label>
              {!selectedDate ? (
                <p className={cn('text-sm mt-1', AI_WEB_TYPE_BODY, 'text-cyan-200/50')}>Pick a day to see times.</p>
              ) : (daysByDate.get(selectedDate)?.some((s) => !s.taken) ?? false) === false ? (
                <p className={cn('text-sm mt-1', AI_WEB_TYPE_BODY, 'text-cyan-200/50')}>No times on this day.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(daysByDate.get(selectedDate) || []).map((s) => {
                    const picked = selected === s.startsAt;
                    return (
                      <button
                        key={s.startsAt}
                        type="button"
                        disabled={Boolean(s.taken)}
                        onClick={() => setSelected(s.startsAt)}
                        className={cn(
                          'w-full rounded-xl border px-2 sm:px-3 py-2 text-center text-xs sm:text-sm font-semibold transition-all',
                          theme.input,
                          'min-h-0 h-auto',
                          picked &&
                            '!bg-gradient-to-r !from-[#0066ff] !to-[#00d4ff] !border-[#00d4ff]/60 !text-black shadow-[0_0_16px_-4px_rgba(0,212,255,0.5)]',
                          s.taken &&
                            '!border-[#0066ff]/15 !bg-transparent text-white/25 cursor-not-allowed line-through shadow-none',
                          !picked &&
                            !s.taken &&
                            'text-cyan-100/90 hover:border-[#00d4ff]/55 hover:bg-black/60',
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-6">
                <label className={cn(AI_WEB_FORM_LABEL, theme.label)}>Selection</label>
                <div
                  className={cn(
                    'mt-2 rounded-xl p-4',
                    theme.input,
                    'h-auto min-h-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
                  )}
                >
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
              </div>

              {error ? <p className={cn('text-sm sm:text-base mt-4', theme.error)}>{error}</p> : null}

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
                    Booking…
                  </span>
                ) : selected ? (
                  'Confirm booking'
                ) : (
                  'Select a time'
                )}
              </Button>

              <p className={cn('mt-4', AI_WEB_TYPE_META, 'text-cyan-200/45')}>
                Slots are {intervalMinutes} minutes each.
              </p>
        </div>
        </div>
      </ContactFormCard>
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
