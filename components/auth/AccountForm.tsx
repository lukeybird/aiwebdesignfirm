'use client';
import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';

export default function AccountForm({ callbackUrl, initialMode = 'signup' }: { callbackUrl: string; initialMode?: 'signup' | 'signin' }) {
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '');
    const password = String(data.get('password') || '');
    try {
      if (mode === 'signup') {
        const response = await fetch('/api/account/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: data.get('name'), email, password }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not create account.');
      }
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error || !result?.ok) throw new Error('Unable to sign in. Check your email and password, or try again in 15 minutes.');
      window.location.assign(callbackUrl);
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); setBusy(false); }
  }
  const field = 'mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-3 text-white';
  return <div className="mt-6">
    <div className="mb-5 flex gap-4 text-sm">
      <button type="button" onClick={() => { setMode('signup'); setError(''); }} aria-pressed={mode === 'signup'} className={mode === 'signup' ? 'font-bold text-emerald-300' : 'text-slate-400'}>Create account</button>
      <button type="button" onClick={() => { setMode('signin'); setError(''); }} aria-pressed={mode === 'signin'} className={mode === 'signin' ? 'font-bold text-emerald-300' : 'text-slate-400'}>Sign in</button>
    </div>
    <form onSubmit={submit} className="space-y-4">
      {mode === 'signup' && <label className="block text-sm">Name<input name="name" autoComplete="name" required maxLength={100} className={field} /></label>}
      <label className="block text-sm">Email<input name="email" type="email" autoComplete="email" required maxLength={254} className={field} /></label>
      <label className="block text-sm">Password<input key={mode} name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 12 : undefined} required className={field} /></label>
      {mode === 'signup' && <p className="text-xs text-slate-400">Use at least 12 characters. Keep your password somewhere safe.</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-emerald-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account & continue' : 'Sign in & continue'}</button>
    </form>
    <div className="my-5 text-center text-sm text-slate-500">or</div>
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); await signIn('google', { callbackUrl }); }} className="w-full rounded-lg border border-slate-600 px-5 py-3 font-semibold hover:bg-slate-800 disabled:opacity-50">Continue with Google</button>
  </div>;
}
