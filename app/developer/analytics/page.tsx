'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GA4_REPORTS_URL } from '@/lib/ga-reports-url';
import { logoutDeveloperClient } from '@/lib/developer-auth-client';

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-C8ZNJX36W8';

export default function DeveloperAnalyticsPage() {
  const router = useRouter();
  const [isStarkMode] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const auth = localStorage.getItem('devAuth');
    const authTime = localStorage.getItem('devAuthTime');
    if (!auth || !authTime || Date.now() - parseInt(authTime, 10) > 24 * 60 * 60 * 1000) {
      void logoutDeveloperClient().then(() => router.replace('/login/developer'));
      return;
    }
    setReady(true);
  }, [router]);

  const inactive = `px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
    isStarkMode
      ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
      : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
  }`;
  const active = `px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
    isStarkMode
      ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
      : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
  }`;

  if (!ready) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main
      className={`min-h-screen transition-colors duration-300 ${isStarkMode ? 'bg-black text-white' : 'bg-white text-black'}`}
    >
      <nav
        className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b transition-colors duration-300 ${
          isStarkMode ? 'bg-black/90 border-cyan-500/20' : 'bg-white/98 border-gray-300/60 shadow-lg shadow-gray-900/5'
        }`}
      >
        <div className="w-full mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="flex items-center justify-between max-w-[2400px] mx-auto py-4 border-b border-opacity-20 border-current">
            <Link href="/" className="flex items-center gap-3 transition-colors hover:opacity-80">
              <img src="/blueBall.png" alt="Logo" className="w-10 h-10" />
              <span className={`text-xl font-black ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                AiWebDesignFirm
              </span>
            </Link>
            <button
              type="button"
              onClick={() => {
                void logoutDeveloperClient().then(() => router.push('/login/developer'));
              }}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                isStarkMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
              }`}
            >
              Logout
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center max-w-[2400px] mx-auto py-3 gap-4">
            <Link href="/developer/dashboard" className={inactive}>
              New Leads
            </Link>
            <Link href="/developer/leads" className={inactive}>
              Lead List
            </Link>
            <Link href="/developer/clients" className={inactive}>
              Clients
            </Link>
            <Link href="/developer/support" className={inactive}>
              Support
            </Link>
            <Link href="/book/admin" className={inactive}>
              Booking app
            </Link>
            <Link href="/developer/analytics" className={active}>
              Analytics
            </Link>
            <Link href="/developer/test" className={inactive}>
              Test
            </Link>
          </div>
        </div>
      </nav>

      <section
        className={`pt-40 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
          isStarkMode
            ? 'bg-gradient-to-b from-black via-gray-900 to-black'
            : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
        }`}
      >
        <div className="max-w-2xl mx-auto">
          <h1
            className={`text-3xl sm:text-4xl font-black mb-4 tracking-tight ${
              isStarkMode
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                : 'text-gray-900'
            }`}
          >
            Google Analytics
          </h1>
          <p className={`text-sm sm:text-base leading-relaxed mb-6 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            GA4 is loaded from the site root layout, so page views are sent for the public site and for developer
            pages (e.g. <span className="font-mono text-cyan-400/90">/developer/*</span>), using measurement ID{' '}
            <span className="font-mono text-cyan-400/90">{GA_MEASUREMENT_ID}</span>. Use{' '}
            <strong className="text-gray-200">Realtime</strong> in GA to confirm hits while you browse here.
          </p>
          <p className={`text-sm sm:text-base leading-relaxed mb-8 ${isStarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
            Google does not allow embedding the full GA console in an iframe, so reports open in a new tab.
          </p>
          <a
            href={GA4_REPORTS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-bold transition-all duration-200 hover:scale-[1.02] ${
              isStarkMode
                ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/40'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            Open Google Analytics
          </a>
          <p className={`mt-8 text-xs ${isStarkMode ? 'text-gray-600' : 'text-gray-500'}`}>
            Optional: set <span className="font-mono">NEXT_PUBLIC_GA_REPORTS_URL</span> in{' '}
            <span className="font-mono">.env.local</span> (or Vercel env) to your property’s reports URL so this button
            lands on the right property.
          </p>
        </div>
      </section>
    </main>
  );
}
