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
  const field = 'brand-input';
  return <div className="mt-6">
    <div className="brand-tabs mb-6">
      <button type="button" onClick={() => { setMode('signup'); setError(''); }} aria-pressed={mode === 'signup'} >Create account</button>
      <button type="button" onClick={() => { setMode('signin'); setError(''); }} aria-pressed={mode === 'signin'} >Sign in</button>
    </div>
    <form onSubmit={submit} className="space-y-4">
      {mode === 'signup' && <label className="block text-sm">Name<input name="name" autoComplete="name" required maxLength={100} className={field} /></label>}
      <label className="block text-sm">Email<input name="email" type="email" autoComplete="email" required maxLength={254} className={field} /></label>
      <label className="block text-sm">Password<input key={mode} name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 12 : undefined} required className={field} /></label>
      {mode === 'signup' && <p className="text-xs text-[#9AAAC0]">Use at least 12 characters. Keep your password somewhere safe.</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={busy} className="brand-button brand-button-primary w-full">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account & continue' : 'Sign in & continue'}</button>
    </form>
    <div className="my-5 flex items-center gap-4 text-center text-xs text-[#9AAAC0]"><span className="brand-rule flex-1" />or<span className="brand-rule flex-1" /></div>
    <button type="button" disabled={busy} onClick={async () => { setBusy(true); await signIn('google', { callbackUrl }); }} className="brand-button brand-button-secondary w-full">Continue with Google</button>
  </div>;
}
