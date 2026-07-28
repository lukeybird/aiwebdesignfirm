'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/account/profile', { cache: 'no-store' });
      const data = await res.json();
      setGoogleConfigured(!!data.googleConfigured);
      if (data.authenticated && data.user) {
        setUser(data.user);
        setDisplayName(data.user.displayName || '');
        setBio(data.user.bio || '');
      } else {
        setUser(null);
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
    <main className="min-h-[100dvh] bg-[#0a0a0f] text-[#f5f5f7]">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(45,120,110,0.28), transparent 50%), radial-gradient(ellipse at 90% 10%, rgba(180,120,40,0.18), transparent 45%)',
        }}
      />
      <div className="relative mx-auto max-w-xl px-5 py-16">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-teal-300/80">AiWebDesignFirm</p>
            <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight">
              Account
            </h1>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/leaderboard" className="text-amber-200/90 hover:text-amber-100">
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

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          {loading ? (
            <p className="text-white/60">Loading…</p>
          ) : !user ? (
            <div className="space-y-5">
              <p className="text-white/75 leading-relaxed">
                Connect your Google account to save a Territory Game profile, edit your display name,
                and appear on the leaderboard when you win online matches.
              </p>
              {!googleConfigured && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
                  Google sign-in is not configured yet. Add <code className="text-amber-50">AUTH_SECRET</code>,{' '}
                  <code className="text-amber-50">AUTH_GOOGLE_ID</code>, and{' '}
                  <code className="text-amber-50">AUTH_GOOGLE_SECRET</code> to your environment, then restart
                  the server.
                </div>
              )}
              <button
                type="button"
                disabled={!googleConfigured}
                onClick={() => signIn('google', { callbackUrl: '/account' })}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e8ebe0] px-5 py-3 font-semibold text-[#0a0a0f] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue with Google
              </button>
            </div>
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
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-900/50 text-lg font-semibold text-teal-100">
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
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 outline-none ring-teal-400/40 focus:ring-2"
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
                  className="w-full resize-y rounded-xl border border-white/15 bg-black/40 px-4 py-3 outline-none ring-teal-400/40 focus:ring-2"
                  placeholder="Optional short bio"
                />
              </label>

              {message && <p className="text-sm text-teal-200/90">{message}</p>}
              {error && <p className="text-sm text-red-300">{error}</p>}

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-teal-300 px-5 py-3 font-semibold text-[#06221f] hover:bg-teal-200 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/account' })}
                  className="rounded-xl border border-white/20 px-5 py-3 text-white/80 hover:border-white/40 hover:text-white"
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
