'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MarineAppHome() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const auth = localStorage.getItem('marineAuth');
    const authTime = localStorage.getItem('marineAuthTime');
    const valid = auth && authTime && Date.now() - parseInt(authTime, 10) < 7 * 24 * 60 * 60 * 1000;
    if (valid) router.replace('/marineApp/dashboard');
    else router.replace('/marineApp/login');
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading…</p>
    </main>
  );
}
