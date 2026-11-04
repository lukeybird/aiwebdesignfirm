'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import BillingPanel from './BillingPanel';
import AccountForm from '@/components/auth/AccountForm';
import { signIn, signOut, useSession } from 'next-auth/react';

type ProfileUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
};

export default function AccountClient() {
  const { status } = useSession();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, healthRes] = await Promise.all([
        fetch('/api/account/profile', { cache: 'no-store' }),
        fetch('/api/account/health', { cache: 'no-store' }),
      ]);
      const health = healthRes.ok ? await healthRes.json() : null;
      if (health) setGoogleConfigured(!!health.googleAuthConfigured);

      const data = await profileRes.json().catch(() => ({}));
      if (data.authenticated && data.user) {
        setUser(data.user);
        setDisplayName(data.user.displayName || '');
        setBio(data.user.bio || '');
      } else {
        setUser(null);
        if (typeof data.googleConfigured === 'boolean') {
          setGoogleConfigured(data.googleConfigured);
        }
      }
    } catch {
      setError('Could not load account.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [status]);

  async function onGoogleSignIn() {
    setSigningIn(true);
    setError(null);
    try {
      await signIn('google', { callbackUrl: window.location.pathname + window.location.search });
    } catch {
      setError('Could not start Google sign-in.');
      setSigningIn(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setUser(data.user);
      setDisplayName(data.user.displayName || '');
      setBio(data.user.bio || '');
      setMessage('Profile saved. Use this display name in Territory Game so wins count on the leaderboard.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="brand-shell">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(102,227,255,0.10), transparent 50%), radial-gradient(ellipse at 90% 10%, rgba(255,107,122,0.08), transparent 45%)',
        }}
      />
      <div className="relative mx-auto max-w-xl px-5 py-16">
        {status === "authenticated" && <BillingPanel />}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#66E3FF]/80">AiWebDesignFirm</p>
            <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight">
              Account
            </h1>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/leaderboard" className="text-[#FF6B7A]/90 hover:text-[#FF6B7A]">
              Leaderboard
            </Link>
            <Link href="/TDG" className="text-white/70 hover:text-white">
              Play TDG
            </Link>
            <Link href="/" className="text-white/50 hover:text-white/80">
              Home
            </Link>
          </div>
        </div>

        <section className="brand-card p-6 sm:p-8">
          {loading ? (
            <p className="text-white/60">Loading…</p>
          ) : !user ? (
            <AccountForm callbackUrl="/account" initialMode="signin" />
          ) : (
            <form onSubmit={onSave} className="space-y-5">
              <div className="flex items-center gap-4">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="h-14 w-14 rounded-full border border-white/15 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#66E3FF]/10 text-lg font-semibold text-[#66E3FF]">
                    {user.displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-sm text-white/50">{user.email}</p>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.14em] text-white/45">Display name</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={40}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 outline-none ring-[#66E3FF]/40 focus:ring-2"
                  placeholder="Shown in TDG and on the leaderboard"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs uppercase tracking-[0.14em] text-white/45">Bio</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  rows={4}
                  className="w-full resize-y rounded-xl border border-white/15 bg-black/40 px-4 py-3 outline-none ring-[#66E3FF]/40 focus:ring-2"
                  placeholder="Optional short bio"
                />
              </label>

              {message && <p className="text-sm text-[#66E3FF]/90">{message}</p>}
              {error && <p className="text-sm text-red-300">{error}</p>}

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="brand-button brand-button-primary"
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: window.location.pathname + window.location.search })}
                  className="brand-button brand-button-secondary"
                >
                  Sign out
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l.1.1 6.2 5.2C39.2 37.3 44 32 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
