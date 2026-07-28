'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';

export default function SiteAccountBar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const signedIn = status === 'authenticated' && !!session?.user;
  const label = session?.user?.displayName || session?.user?.name || 'Account';

  // Keep game UIs free of overlapping site chrome (top-right clicks).
  if (pathname?.startsWith('/TDG') || pathname?.startsWith('/tdg')) return null;

  return (
    <div className="fixed top-3 right-3 z-[60] flex items-center gap-2 text-sm pointer-events-auto">
      <Link
        href="/leaderboard"
        className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[#e8ebe0] backdrop-blur hover:border-amber-400/50 hover:text-amber-200 transition-colors"
      >
        Leaderboard
      </Link>
      {signedIn ? (
        <>
          <Link
            href="/account"
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[#e8ebe0] backdrop-blur hover:border-teal-400/50 hover:text-teal-200 transition-colors"
          >
            {label}
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-white/70 backdrop-blur hover:border-white/30 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/account' })}
          className="inline-flex items-center gap-2 rounded-lg bg-[#e8ebe0] px-3 py-1.5 font-semibold text-[#0a0a0f] shadow-sm transition hover:bg-white"
        >
          <GoogleMark />
          Sign in with Google
        </button>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l.1.1 6.2 5.2C39.2 37.3 44 32 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
