'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Brand from './Brand';
import homeStyles from '@/app/home.module.css';
import { signOut, useSession } from 'next-auth/react';

export default function SiteAccountBar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const signedIn = status === 'authenticated' && !!session?.user;
  const label = session?.user?.displayName || session?.user?.name || 'Account';

  // TDG serves static public/TDG HTML with its own account overlay (account-overlay.js).
  if (pathname?.startsWith('/TDG') || pathname?.startsWith('/tdg')) return null;

  if (pathname === '/') return <header className={homeStyles.navShell}><nav aria-label="Main" className={homeStyles.nav}>
    <Link href="/" className={homeStyles.wordmark} aria-label="AI Web Design Firm home"><span className={homeStyles.mark} aria-hidden="true"><i/><i/><i/></span><span>AI Web Design Firm</span></Link>
    <div className={homeStyles.navLinks}><Link href="/#how-it-works" className={homeStyles.desktopLink}>How it works</Link><Link href="/#plans">Plans</Link><Link className={homeStyles.navAction} href={signedIn?'/product':'/login'}>{signedIn?'Your workspace':'Sign in'} <span aria-hidden="true">↗</span></Link></div>
  </nav></header>;

  if (['/', '/book', '/account'].includes(pathname)) return (
    <header className="brand-header"><nav aria-label="Main" className="brand-container brand-navigation">
      <Brand /><div className="brand-nav-links"><Link href="/#plans">Plans</Link>
      {signedIn ? <Link className="brand-button brand-button-secondary" href="/product">Open workspace <span aria-hidden="true">↗</span></Link> : <Link className="brand-button brand-button-secondary" href="/login">Sign in <span aria-hidden="true">↗</span></Link>}
      </div>
    </nav></header>
  );

  return (
    <div className="fixed top-3 right-3 z-[60] flex items-center gap-2 text-sm pointer-events-auto">
      <Link
        href="/leaderboard"
        className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[#66E3FF] backdrop-blur hover:border-[#FF6B7A]/50 hover:text-[#FF6B7A] transition-colors"
      >
        Leaderboard
      </Link>
      {signedIn ? (
        <>
          <Link
            href="/product"
            className="rounded-lg border border-white/15 bg-black/50 px-3 py-1.5 text-[#66E3FF] backdrop-blur hover:border-[#66E3FF]/50 hover:text-[#66E3FF] transition-colors"
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
        <Link href="/login" className="rounded-lg bg-[#66E3FF] px-3 py-1.5 font-semibold text-[#080D1B]">Sign in</Link>
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
