'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
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

  // Calendar month state defaults to the first available day (or today)
  const firstAvailableYmd = days.find((d) => d.slots.length > 0)?.date;
  const defaultMonthBase = firstAvailableYmd ? ymdToDate(firstAvailableYmd) : new Date();
  const [monthBase, setMonthBase] = useState<Date>(startOfMonth(defaultMonthBase));

  useEffect(() => {
    // When availability loads the first time, auto-select the first available day
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
      <div className="min-h-[100dvh] bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-bold font-heading mb-4">You&apos;re set</h1>
        <p className="text-gray-400 max-w-md mb-8">
          We sent a confirmation email with your time (US Eastern). If you don&apos;t see it, check spam.
        </p>
        <Button asChild variant="outline" className="rounded-full border-white/20 text-white">
          <Link href="/">Return home</Link>
        </Button>
      </div>
    );
  }

  if (alreadyBooked) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a0f] text-white flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold font-heading mb-4">You already have a call scheduled</h1>
        <p className="text-gray-400 max-w-md mb-8">Check your email for the time, or reply to reach us.</p>
        <Button asChild className="rounded-full bg-white text-black">
          <Link href="/">Back to aiWebDF</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-white px-6 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 mb-8 inline-block">
          ← aiWebDF
        </Link>
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-white/10 bg-[#0d0d1a] overflow-hidden">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10">
              <div>
                <p className="text-sm font-bold text-white">
                  {selectedDate
                    ? `Selected: ${format(ymdToDate(selectedDate), 'MMMM do, yyyy')}`
                    : 'Select a day'}
                </p>
                <p className="text-xs text-gray-500">Then choose a time</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMonthBase((d) => startOfMonth(subMonths(d, 1)))}
                  className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <div className="min-w-[140px] text-center text-sm font-semibold text-gray-200">
                  {format(monthBase, 'MMMM yyyy')}
                </div>
                <button
                  type="button"
                  onClick={() => setMonthBase((d) => startOfMonth(addMonths(d, 1)))}
                  className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                  aria-label="Next month"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
              {/* Calendar */}
              <div className="p-5 sm:p-6">
                {loading ? (
                  <p className="text-gray-400">Loading availability…</p>
                ) : days.length === 0 && !error ? (
                  <p className="text-gray-400">No open slots in the next few weeks. We&apos;ll reach out by email.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-7 text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-3">
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
                        const pad = start.getDay(); // 0..6
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
                                  ? 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                                  : 'border-transparent bg-white/0 text-white/20 cursor-not-allowed',
                                picked &&
                                  'bg-[#0066ff] border-[#0066ff] text-white hover:bg-[#0066ff] ring-2 ring-[#00d4ff]/60 ring-offset-2 ring-offset-[#0d0d1a]',
                                isToday && !picked && 'ring-1 ring-[#00d4ff]/30',
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

              {/* Times */}
              <div className="border-t border-white/10 lg:border-t-0 lg:border-l border-white/10 p-5 sm:p-6">
                <p className="text-sm font-bold text-white mb-3">Available times</p>
                {!selectedDate ? (
                  <p className="text-sm text-gray-500">Pick a day to see times.</p>
                ) : (daysByDate.get(selectedDate)?.some((s) => !s.taken) ?? false) === false ? (
                  <p className="text-sm text-gray-500">No times on this day.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
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
                              ? 'bg-[#0066ff] border-[#0066ff] text-white'
                              : s.taken
                                ? 'border-white/5 bg-white/0 text-white/25 cursor-not-allowed line-through'
                                : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-gray-200',
                          )}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Selection</p>
                  <p className="text-sm text-gray-200">
                    {selectedDate ? selectedDate : 'No day selected'}
                    {selected ? (
                      <span className="text-gray-400"> · {daysByDate.get(selectedDate || '')?.find((x) => x.startsAt === selected)?.label}</span>
                    ) : null}
                  </p>
                </div>

                {error ? <p className="text-red-400 text-sm mt-6">{error}</p> : null}

                <Button
                  type="button"
                  disabled={!selected || booking || !nameOk || !emailOk || !phoneOk}
                  onClick={confirm}
                  className="mt-6 w-full rounded-2xl h-12 bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black font-bold"
                >
                  {booking ? 'Booking…' : selected ? 'Confirm booking' : 'Select a time'}
                </Button>

                <p className="text-xs text-gray-600 mt-4">Slots are {intervalMinutes} minutes each.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-[#0a0a0f] text-white flex items-center justify-center">
          <p className="text-gray-400">Loading…</p>
        </div>
      }
    >
      <BookContent />
    </Suspense>
  );
}
