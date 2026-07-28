'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function SiteAccountBar() {
  const { data: session, status } = useSession();
  const signedIn = status === 'authenticated' && !!session?.user;

  return (
    <div className="fixed top-3 right-3 z-[60] flex items-center gap-2 text-sm">
      <Link
        href="/leaderboard"
        className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[#e8ebe0] backdrop-blur hover:border-amber-400/50 hover:text-amber-200 transition-colors"
      >
        Leaderboard
      </Link>
      <Link
        href="/account"
        className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[#e8ebe0] backdrop-blur hover:border-teal-400/50 hover:text-teal-200 transition-colors"
      >
        {signedIn
          ? (session.user.displayName || session.user.name || 'Account')
          : 'Sign in'}
      </Link>
    </div>
  );
}
