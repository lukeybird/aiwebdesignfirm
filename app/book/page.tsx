'use client';

import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UseCasesMarqueeBackdrop } from '@/components/ai-website-pro/UseCasesMarqueeBackdrop';
import { cn } from '@/lib/utils';
import {
  CONTACT_SECTION_THEME,
  FOOTER_PAD_Y,
  FORM_BRAND_SUB,
  FORM_BRAND_TITLE,
  SECTION_GUTTER_X,
  TYPE_BODY,
} from '@/lib/aiwebdf-public-theme';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  subMonths,
} from 'date-fns';

type Slot = { startsAt: string; endsAt: string; label: string; taken?: boolean };
type DaySlots = { date: string; slots: Slot[] };

function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const theme = CONTACT_SECTION_THEME;
const cardRingOffset = 'ring-offset-[#050810]';

function BookSiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full max-w-none bg-[#0a0a0f] text-white overflow-x-clip selection:bg-[#00d4ff]/30 selection:text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className={cn('mx-auto flex h-20 w-full max-w-none items-center justify-between', SECTION_GUTTER_X)}>
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img
              src="/blueBall.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-white">aiWebDF</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Button
              asChild
              className="bg-white text-black hover:bg-gray-200 font-medium text-sm sm:text-base px-5 md:px-6 rounded-full transition-all duration-300 shrink-0"
            >
              <Link href="/#contact" aria-label="Book a Call — go to contact form">
                Book a Call!
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <section
        className={cn(
          'relative overflow-hidden border-t transition-colors duration-500',
          theme.sectionBorder,
          'pt-[calc(5rem+env(safe-area-inset-top,0px))] pb-20 sm:pt-28 sm:pb-24 md:pt-32 md:pb-28',
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
          <div className="absolute inset-0 z-[1] flex min-h-0 flex-col overflow-hidden py-4 sm:py-8">
            <UseCasesMarqueeBackdrop className="min-h-0 flex-1" />
          </div>
        </div>

        <div className={cn('relative z-10 mx-auto w-full max-w-none', SECTION_GUTTER_X)}>{children}</div>
      </section>

      <footer
        className={cn(
          'bg-[#0a0a0f] border-t border-white/5 text-center text-gray-500 text-sm sm:text-base',
          FOOTER_PAD_Y,
        )}
      >
        <div className={cn('mx-auto w-full max-w-none', SECTION_GUTTER_X)}>
          <p>© {new Date().getFullYear()} aiWebDF. All rights reserved.</p>
        </div>
      </footer>
    </div>
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

  if (done) {
    return (
      <BookSiteChrome>
        <div className="mx-auto flex min-h-[min(80dvh,720px)] max-w-lg flex-col items-center justify-center px-4 text-center">
          <div className={cn('mb-6 rounded-full p-4', theme.successRing)}>
            <CheckCircle2 className={cn('h-12 w-12', theme.successIcon)} aria-hidden />
          </div>
          <h1 className={cn('mb-4 text-3xl font-bold font-heading sm:text-4xl', theme.successTitle)}>
            You&apos;re set
          </h1>
          <p className={cn('mb-8 max-w-md', theme.successSub)}>
            We sent a confirmation email with your time (US Eastern). If you don&apos;t see it, check spam.
          </p>
          <Button asChild variant="outline" className={cn('rounded-full px-8', theme.successBtn)}>
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </BookSiteChrome>
    );
  }

  if (alreadyBooked) {
    return (
      <BookSiteChrome>
        <div className="mx-auto flex min-h-[min(80dvh,720px)] max-w-lg flex-col items-center justify-center px-4 text-center">
          <div className={cn('mb-6 rounded-full p-4', theme.successRing)}>
            <CalendarClock className={cn('h-12 w-12', theme.successIcon)} aria-hidden />
          </div>
          <h1 className={cn('mb-4 text-2xl font-bold font-heading sm:text-3xl', theme.successTitle)}>
            You already have a call scheduled
          </h1>
          <p className={cn('mb-8 max-w-md', theme.successSub)}>
            Check your email for the time, or reply to reach us.
          </p>
          <Button asChild className={cn(theme.submit, 'rounded-full')}>
            <Link href="/">Back to aiWebDF</Link>
          </Button>
        </div>
      </BookSiteChrome>
    );
  }

  return (
    <BookSiteChrome>
      <div className="mx-auto max-w-6xl pb-4 pt-2 sm:pt-4">
        <div className="relative mx-auto max-w-4xl rounded-3xl">
          <motion.div
            aria-hidden
            className={cn(
              'pointer-events-none absolute -inset-px -z-10 rounded-3xl blur-2xl transition-colors duration-500',
              theme.formGlowMotion,
            )}
            animate={{ opacity: [0.55, 0.85, 0.55] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 -z-10 rounded-3xl blur-xl transition-colors duration-500',
              theme.formGlowStatic,
            )}
          />
          <div className={cn('relative overflow-hidden rounded-3xl', theme.formCard)}>
            <div
              className={cn(
                'pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full blur-3xl transition-colors duration-500',
                theme.formBlobTL,
              )}
            />
            <div
              className={cn(
                'pointer-events-none absolute bottom-0 left-0 h-32 w-32 rounded-full blur-2xl transition-colors duration-500',
                theme.formBlobBR,
              )}
            />

            <div className="relative flex flex-col gap-0 border-b border-[#0066ff]/25 px-5 py-5 sm:px-6 sm:py-6">
              <div className="relative flex items-center gap-3 pb-4">
                <div
                  className={cn(
                    'pointer-events-none absolute bottom-0 left-0 right-0 h-px rounded-full',
                    theme.divider,
                  )}
                  aria-hidden
                />
                <img
                  src="/blueBall.png"
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 object-contain drop-shadow-[0_0_16px_rgba(59,130,246,0.45)]"
                />
                <div className="min-w-0 flex-1">
                  <p className={FORM_BRAND_TITLE}>aiWebDF</p>
                  <p className={cn(FORM_BRAND_SUB, theme.formHeaderSub)}>Pick a time for your call</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#0066ff]/15 pt-5">
                <div>
                  <p className="text-sm font-bold text-white">
                    {selectedDate
                      ? `Selected: ${format(ymdToDate(selectedDate), 'MMMM do, yyyy')}`
                      : 'Select a day'}
                  </p>
                  <p className={cn(TYPE_BODY, 'mt-0.5 text-sm')}>Then choose a time (US Eastern)</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMonthBase((d) => startOfMonth(subMonths(d, 1)))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#0066ff]/35 bg-black/40 text-lg text-cyan-100/90 transition-colors hover:bg-[#0066ff]/15"
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <div className="min-w-[140px] text-center text-sm font-semibold text-cyan-100/90">
                    {format(monthBase, 'MMMM yyyy')}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMonthBase((d) => startOfMonth(addMonths(d, 1)))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#0066ff]/35 bg-black/40 text-lg text-cyan-100/90 transition-colors hover:bg-[#0066ff]/15"
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            <div className="relative grid gap-0 lg:grid-cols-[1fr_320px]">
              <div className="p-5 sm:p-6">
                {loading ? (
                  <p className={cn(TYPE_BODY, 'text-cyan-200/70')}>Loading availability…</p>
                ) : days.length === 0 && !error ? (
                  <p className={cn(TYPE_BODY, 'text-cyan-200/70')}>
                    No open slots in the next few weeks. We&apos;ll reach out by email.
                  </p>
                ) : (
                  <>
                    <div className="mb-3 grid grid-cols-7 text-[11px] font-bold uppercase tracking-wider text-[#7dd3fc]/55">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <div key={d} className="text-center">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
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
                              className={classNames(
                                'h-11 rounded-2xl border text-sm font-semibold transition-all',
                                available
                                  ? 'border-[#0066ff]/35 bg-black/35 text-cyan-50 hover:border-[#00d4ff]/45 hover:bg-[#0066ff]/12'
                                  : 'cursor-not-allowed border-transparent bg-transparent text-white/20',
                                picked &&
                                  'border-[#0066ff] bg-gradient-to-br from-[#0066ff] to-[#0052cc] text-white shadow-[0_0_20px_-6px_rgba(0,212,255,0.5)] ring-2 ring-[#00d4ff]/60 ring-offset-2 ' +
                                    cardRingOffset,
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

              <div className="border-t border-[#0066ff]/20 p-5 sm:p-6 lg:border-l lg:border-t-0">
                <p className="text-sm font-bold text-white">Available times</p>
                {!selectedDate ? (
                  <p className={cn(TYPE_BODY, 'mt-3 text-sm')}>Pick a day to see times.</p>
                ) : (daysByDate.get(selectedDate)?.some((s) => !s.taken) ?? false) === false ? (
                  <p className={cn(TYPE_BODY, 'mt-3 text-sm')}>No times on this day.</p>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(daysByDate.get(selectedDate) || []).map((s) => {
                      const picked = selected === s.startsAt;
                      return (
                        <button
                          key={s.startsAt}
                          type="button"
                          disabled={Boolean(s.taken)}
                          onClick={() => setSelected(s.startsAt)}
                          className={classNames(
                            'w-full rounded-2xl border px-3 py-2.5 text-center text-sm font-semibold transition-all',
                            picked
                              ? 'border-[#0066ff] bg-gradient-to-br from-[#0066ff] to-[#0052cc] text-white shadow-[0_0_16px_-4px_rgba(0,212,255,0.45)]'
                              : s.taken
                                ? 'cursor-not-allowed border-white/5 bg-transparent text-white/25 line-through'
                                : 'border-[#0066ff]/30 bg-black/35 text-cyan-100/90 hover:border-[#00d4ff]/45 hover:bg-[#0066ff]/12',
                          )}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-[#0066ff]/30 bg-black/40 p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#a5f3fc]/80">Selection</p>
                  <p className="text-sm text-cyan-50/95">
                    {selectedDate ? selectedDate : 'No day selected'}
                    {selected ? (
                      <span className="text-[#7dd3fc]/80">
                        {' '}
                        · {daysByDate.get(selectedDate || '')?.find((x) => x.startsAt === selected)?.label}
                      </span>
                    ) : null}
                  </p>
                </div>

                {error ? <p className={cn('mt-6 text-sm', theme.error)}>{error}</p> : null}

                <Button
                  type="button"
                  disabled={!selected || booking || !nameOk || !emailOk || !phoneOk}
                  onClick={confirm}
                  className={cn('mt-6', theme.submit)}
                >
                  {booking ? 'Booking…' : selected ? 'Confirm booking' : 'Select a time'}
                </Button>

                <p className={cn(TYPE_BODY, 'mt-4 text-xs text-cyan-200/45')}>
                  Slots are {intervalMinutes} minutes each.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BookSiteChrome>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <BookSiteChrome>
          <div className="flex min-h-[50dvh] items-center justify-center">
            <p className={cn(TYPE_BODY, 'text-cyan-200/70')}>Loading…</p>
          </div>
        </BookSiteChrome>
      }
    >
      <BookContent />
    </Suspense>
  );
}
