'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function BookContent() {
  const searchParams = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plan, setPlan] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadyBooked, setAlreadyBooked] = useState(false);

  const [days, setDays] = useState<
    { date: string; slots: { startsAt: string; endsAt: string; label: string }[] }[]
  >([]);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [selected, setSelected] = useState<string | null>(null);
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
    const r = await fetch(`/api/booking/slots?days=21${q}`);
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
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-white px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 mb-10 inline-block">
          ← aiWebDF
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black font-heading mb-2">Schedule your call</h1>
        <p className="text-[#00d4ff] text-sm font-semibold mb-6">All times are US Eastern (ET).</p>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-8 space-y-3 text-sm">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="bg-[#1c1c1e] border-white/10 text-white"
          />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="bg-[#1c1c1e] border-white/10 text-white"
          />
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            className="bg-[#1c1c1e] border-white/10 text-white"
          />
        </div>

        {error ? <p className="text-red-400 text-sm mb-6">{error}</p> : null}

        {loading ? (
          <p className="text-gray-400">Loading times…</p>
        ) : days.length === 0 && !error ? (
          <p className="text-gray-400">No open slots in the next few weeks. We&apos;ll reach out by email.</p>
        ) : (
          <div className="space-y-8">
            {days.map((d) => (
              <div key={d.date}>
                <h2 className="text-lg font-bold text-gray-300 mb-3">{d.date}</h2>
                <div className="flex flex-wrap gap-2">
                  {d.slots.map((s) => (
                    <button
                      key={s.startsAt}
                      type="button"
                      onClick={() => setSelected(s.startsAt)}
                      className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                        selected === s.startsAt
                          ? 'bg-[#0066ff] border-[#0066ff] text-white'
                          : 'border-white/15 bg-white/5 hover:border-white/30'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-600 mt-8">Slots are {intervalMinutes} minutes each.</p>

        <Button
          type="button"
          disabled={!selected || booking || !name.trim() || !email.trim() || !phoneOk}
          onClick={confirm}
          className="mt-8 w-full rounded-full h-12 bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black font-bold"
        >
          {booking ? 'Booking…' : 'Book'}
        </Button>
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
