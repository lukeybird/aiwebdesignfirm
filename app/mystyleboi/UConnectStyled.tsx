'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users, MessageCircle, Calendar } from 'lucide-react';

const ORIGIN = 'https://uconnected.vercel.app';
const AUTH = `${ORIGIN}/auth`;

/** Palette from the UConnect / Instagram vibe reference */
const GRAD =
  'linear-gradient(115deg, #4c1d95 0%, #7c3aed 28%, #c026d3 62%, #db2777 88%, #f43f5e 100%)';
const GRAD_SOFT =
  'linear-gradient(135deg, #5b21b6 0%, #a21caf 45%, #e11d48 100%)';

function ULogo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <linearGradient id="uGrad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="0.55" stopColor="#e879f9" />
          <stop offset="1" stopColor="#fb7185" />
        </linearGradient>
      </defs>
      <path
        d="M10 8v14c0 5.523 4.477 10 10 10s10-4.477 10-10V8"
        stroke="url(#uGrad)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="28" r="2.4" fill="url(#uGrad)" />
    </svg>
  );
}

function ConnectButton({
  href = AUTH,
  variant = 'white',
  className = '',
  children = 'Connect',
}: {
  href?: string;
  variant?: 'white' | 'glass' | 'grad';
  className?: string;
  children?: string;
}) {
  const styles =
    variant === 'white'
      ? 'bg-white text-[#6d28d9] hover:bg-white/95'
      : variant === 'grad'
        ? 'text-white shadow-[0_0_40px_-8px_rgba(232,121,249,0.55)]'
        : 'border border-white/35 bg-white/10 text-white backdrop-blur-md hover:bg-white/18';

  return (
    <motion.a
      href={href}
      className={`inline-flex h-12 items-center justify-center rounded-full px-8 text-[15px] font-semibold tracking-tight transition-transform hover:scale-[1.03] active:scale-[0.98] sm:h-14 sm:px-10 sm:text-base ${styles} ${className}`}
      style={variant === 'grad' ? { backgroundImage: GRAD_SOFT } : undefined}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.a>
  );
}

const moments = [
  { kicker: 'Small groups', line: 'Not a feed.' },
  { kicker: 'Shared interests', line: 'Not strangers.' },
  { kicker: 'Real meetups', line: 'Not just DMs.' },
];

export default function UConnectStyled() {
  return (
    <div className="min-h-[100dvh] bg-[#050510] text-white antialiased selection:bg-fuchsia-400/30">
      {/* Nav — Instagram-clean */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#050510]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:h-[4.25rem] sm:px-8">
          <Link href="/mystyleboi" className="flex items-center gap-2.5" aria-label="UConnect">
            <ULogo />
            <span className="text-lg font-semibold tracking-tight sm:text-xl">UConnect</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <a
              href={AUTH}
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline"
            >
              Sign in
            </a>
            <a
              href={AUTH}
              className="inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold text-white sm:h-11"
              style={{ backgroundImage: GRAD_SOFT }}
            >
              Connect
            </a>
          </nav>
        </div>
      </header>

      <main className="pt-16 sm:pt-[4.25rem]">
        {/* Story 1 — the gradient “post” */}
        <section className="px-4 pb-6 pt-6 sm:px-8 sm:pb-10 sm:pt-10">
          <motion.div
            className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-7 py-14 text-white shadow-[0_40px_100px_-40px_rgba(192,38,211,0.55)] sm:rounded-[2.5rem] sm:px-14 sm:py-20"
            style={{ backgroundImage: GRAD }}
            initial={{ opacity: 0, y: 24, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-orange-400/40 blur-3xl"
              animate={{ opacity: [0.35, 0.55, 0.35] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-indigo-400/35 blur-3xl"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            />

            <div className="relative max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75 sm:text-xs">
                Your people
              </p>
              <h1 className="mt-4 text-[2.35rem] font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
                Find your vibe.
              </h1>
              <p className="mt-4 max-w-md text-base text-white/85 sm:text-lg">
                Small groups. Shared interests. IRL.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ConnectButton variant="white" />
                <ConnectButton variant="glass" href="#vibe">
                  Peek
                </ConnectButton>
              </div>
            </div>

            <div className="relative mt-14 grid grid-cols-1 gap-5 border-t border-white/15 pt-8 sm:mt-16 sm:grid-cols-3 sm:gap-6">
              {[
                { Icon: Users, label: 'Right-sized', sub: 'Small groups' },
                { Icon: MessageCircle, label: 'Matched', sub: 'Shared interests' },
                { Icon: Calendar, label: 'In-person', sub: 'Real meetups' },
              ].map(({ Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                    <Icon className="h-5 w-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-none tracking-tight">{label}</p>
                    <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">
                      {sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Story 2 — three punchy beats */}
        <section id="vibe" className="scroll-mt-24 px-4 py-10 sm:px-8 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-3 sm:gap-5">
            {moments.map((m, i) => (
              <motion.div
                key={m.kicker}
                className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] px-6 py-8 sm:px-7 sm:py-10"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-300/80">
                  {m.kicker}
                </p>
                <p className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{m.line}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Story 3 — one question, one action */}
        <section className="px-4 py-8 sm:px-8 sm:py-12">
          <motion.div
            className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 overflow-hidden rounded-[2rem] px-7 py-12 sm:flex-row sm:items-center sm:rounded-[2.5rem] sm:px-12 sm:py-14"
            style={{ backgroundImage: GRAD_SOFT }}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55 }}
          >
            <div className="pointer-events-none absolute -right-10 top-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">One ask</p>
              <h2 className="mt-3 max-w-md text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                Who are you looking for?
              </h2>
            </div>
            <ConnectButton variant="white" className="relative shrink-0" />
          </motion.div>
        </section>

        {/* Story 4 — how it works in four words × four taps */}
        <section className="px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-white/40">
              The whole app
            </p>
            <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
              {[
                { n: '1', t: 'Profile' },
                { n: '2', t: 'Seeking' },
                { n: '3', t: 'Match' },
                { n: '4', t: 'Meet' },
              ].map((s, i) => (
                <motion.li
                  key={s.n}
                  className="flex items-center gap-4 rounded-[1.5rem] border border-white/[0.07] bg-[#0a0a14] px-5 py-5"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundImage: GRAD_SOFT }}
                  >
                    {s.n}
                  </span>
                  <span className="text-xl font-bold tracking-tight">{s.t}</span>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* Story 5 — closing post */}
        <section className="px-4 pb-16 pt-4 sm:px-8 sm:pb-24">
          <motion.div
            className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-7 py-16 text-center sm:rounded-[2.5rem] sm:px-12 sm:py-20"
            style={{ backgroundImage: GRAD }}
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.55 }}
          >
            <motion.div
              className="pointer-events-none absolute inset-0"
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                background:
                  'radial-gradient(circle at 70% 30%, rgba(251,113,133,0.45), transparent 50%)',
              }}
            />
            <div className="relative">
              <ULogo className="mx-auto h-12 w-12" />
              <h2 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Your people are waiting.
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-white/80">Say hi.</p>
              <div className="mt-9 flex justify-center">
                <ConnectButton variant="white" />
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <ULogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight">UConnect</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-white/35">
            <a href={ORIGIN} className="hover:text-white/60">
              Live app
            </a>
            <Link href="/" className="hover:text-white/60">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
