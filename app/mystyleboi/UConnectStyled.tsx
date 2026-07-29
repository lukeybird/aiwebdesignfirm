'use client';

import Link from 'next/link';
import { FormEvent, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Star } from 'lucide-react';

const AUTH = 'https://uconnected.vercel.app/auth';

/** Instagram brand gradient (login page) */
const IG_GRAD =
  'linear-gradient(90deg, #ffd600 0%, #ff7a00 22%, #ff0069 48%, #d300c5 72%, #7638ff 100%)';

const STORIES = [
  {
    src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80',
    alt: 'Friends hanging out',
  },
  {
    src: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80',
    alt: 'Small group collaborating',
  },
  {
    src: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=600&q=80',
    alt: 'People connecting',
  },
];

function ULogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="igU" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd600" />
          <stop offset="0.35" stopColor="#ff0069" />
          <stop offset="0.7" stopColor="#d300c5" />
          <stop offset="1" stopColor="#7638ff" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="12" stroke="url(#igU)" strokeWidth="3" />
      <path
        d="M15 14v12.5c0 4.97 4.03 9 9 9s9-4.03 9-9V14"
        stroke="url(#igU)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="32" r="2.2" fill="url(#igU)" />
    </svg>
  );
}

function GradientText({ children }: { children: ReactNode }) {
  return (
    <span
      className="bg-clip-text text-transparent"
      style={{ backgroundImage: IG_GRAD }}
    >
      {children}
    </span>
  );
}

function StoryStack() {
  return (
    <div className="relative mx-auto mt-10 h-[340px] w-full max-w-[520px] sm:mt-14 sm:h-[400px]">
      {/* Back card */}
      <motion.div
        className="absolute left-[8%] top-6 z-0 h-[78%] w-[42%] overflow-hidden rounded-[1.75rem] border border-white/10 shadow-2xl sm:left-[10%]"
        style={{ transform: 'rotate(-8deg)' }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={STORIES[0].src} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </motion.div>

      {/* Front-left card */}
      <motion.div
        className="absolute left-[22%] top-0 z-10 h-[88%] w-[46%] overflow-hidden rounded-[1.85rem] border border-white/15 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:left-[26%]"
        style={{ transform: 'rotate(-2deg)' }}
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.65 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={STORIES[1].src} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        {/* Story ring avatar */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <div
            className="rounded-full p-[2px]"
            style={{ backgroundImage: IG_GRAD }}
          >
            <div className="h-8 w-8 overflow-hidden rounded-full border-2 border-black bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <span className="text-xs font-semibold text-white drop-shadow">maya</span>
        </div>
        {/* Floating heart */}
        <motion.div
          className="absolute right-4 top-[38%] flex h-12 w-12 items-center justify-center rounded-full bg-black/35 backdrop-blur-md"
          animate={{ y: [0, -6, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Heart className="h-6 w-6 fill-red-500 text-red-500" />
        </motion.div>
      </motion.div>

      {/* Right card */}
      <motion.div
        className="absolute right-[4%] top-10 z-[5] h-[72%] w-[38%] overflow-hidden rounded-[1.6rem] border border-white/10 shadow-2xl sm:right-[6%]"
        style={{ transform: 'rotate(7deg)' }}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.65 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={STORIES[2].src} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        <motion.div
          className="absolute bottom-16 left-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-md"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          <MessageCircle className="h-4 w-4 text-white" />
          <span className="text-sm">✨</span>
        </motion.div>
        <div className="absolute bottom-4 left-3 flex items-center gap-1.5 rounded-full bg-[#00c853]/90 px-2.5 py-1 text-[11px] font-bold text-black">
          <Star className="h-3.5 w-3.5 fill-black" />
          close friends
        </div>
      </motion.div>
    </div>
  );
}

export default function UConnectStyled() {
  const [busy, setBusy] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    window.location.href = AUTH;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-black text-white antialiased">
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-5 py-8 lg:flex-row lg:items-center lg:gap-10 lg:px-8 lg:py-10">
        {/* Left — brand + stories (Instagram login pattern) */}
        <section className="relative flex-1 lg:max-w-[58%] lg:pr-4">
          <div className="flex items-center gap-3">
            <ULogoMark />
            <span className="text-xl font-semibold tracking-tight">UConnect</span>
          </div>

          <h1 className="mt-10 max-w-xl text-[2rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl md:text-[2.75rem]">
            Find everyday groups with your{' '}
            <GradientText>close friends</GradientText>
            .
          </h1>

          <div className="hidden sm:block">
            <StoryStack />
          </div>
        </section>

        {/* Right — login panel */}
        <section className="mx-auto mt-10 w-full max-w-[400px] lg:mt-0 lg:max-w-[380px] lg:shrink-0">
          <div className="rounded-2xl border border-zinc-800 bg-black px-7 py-9 sm:px-9">
            <h2 className="text-center text-[1.35rem] font-semibold tracking-tight">
              Log into UConnect
            </h2>

            <form className="mt-7 space-y-3" onSubmit={onSubmit}>
              <label className="sr-only" htmlFor="u-user">
                Username or email
              </label>
              <input
                id="u-user"
                name="username"
                autoComplete="username"
                placeholder="Mobile number, username or email"
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-500"
              />
              <label className="sr-only" htmlFor="u-pass">
                Password
              </label>
              <input
                id="u-pass"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                className="h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-zinc-500"
              />
              <button
                type="submit"
                disabled={busy}
                className="mt-1 flex h-11 w-full items-center justify-center rounded-full bg-[#0064e0] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy ? 'Connecting…' : 'Log in'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <a href={AUTH} className="text-sm text-zinc-400 hover:text-zinc-200">
                Forgot password?
              </a>
            </div>

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">or</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            <a
              href={AUTH}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-zinc-600 text-sm font-semibold text-white transition-colors hover:bg-zinc-900"
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-black text-white"
                style={{ backgroundImage: IG_GRAD }}
              >
                U
              </span>
              Continue with UConnect
            </a>

            <a
              href={AUTH}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-zinc-600 text-sm font-semibold text-white transition-colors hover:bg-zinc-900"
            >
              Create new account
            </a>
          </div>

          <p className="mt-8 text-center text-xs text-zinc-500">
            Groups · interests · real meetups
          </p>
        </section>
      </div>

      {/* Mobile story peek */}
      <div className="border-t border-zinc-900 px-5 pb-6 pt-2 sm:hidden">
        <StoryStack />
      </div>

      <footer className="mt-auto border-t border-zinc-900 px-5 py-6">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-zinc-500 sm:justify-between">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <a href="https://uconnected.vercel.app/" className="hover:text-zinc-300">
              About
            </a>
            <a href="https://uconnected.vercel.app/auth" className="hover:text-zinc-300">
              Help
            </a>
            <Link href="/" className="hover:text-zinc-300">
              AiWebDesignFirm
            </Link>
            <a href="/mystyleboi" className="hover:text-zinc-300">
              UConnect
            </a>
          </div>
          <p className="text-zinc-600">© {new Date().getFullYear()} UConnect</p>
        </div>
      </footer>
    </div>
  );
}
