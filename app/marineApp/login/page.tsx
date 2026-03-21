'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MarineLoginPage() {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/marine/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('marineAuth', 'authenticated');
        localStorage.setItem('marineUserId', String(data.user.id));
        localStorage.setItem('marineAuthTime', Date.now().toString());
      }
      router.push('/marineApp/dashboard');
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/marine/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sign up failed');
        setLoading(false);
        return;
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('marineAuth', 'authenticated');
        localStorage.setItem('marineUserId', String(data.user.id));
        localStorage.setItem('marineAuthTime', Date.now().toString());
      }
      router.push('/marineApp/dashboard');
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex-shrink-0 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-200">Marine Monitor</span>
        <Link href="/" className="text-sm text-gray-400 hover:text-white">
          Back to site
        </Link>
      </nav>

      <section className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-2 text-white">
            {isLoginMode ? 'Log in' : 'Create account'}
          </h1>
          <p className="text-gray-400 text-center text-sm mb-6">
            {isLoginMode
              ? 'Access your boat dashboard'
              : 'Subscribe to monitor your boat remotely'}
          </p>

          <div className="flex p-1 rounded-lg bg-gray-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(true);
                setError('');
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium ${
                isLoginMode ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLoginMode(false);
                setError('');
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium ${
                !isLoginMode ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign up
            </button>
          </div>

          <form
            onSubmit={isLoginMode ? handleLogin : handleSignUp}
            className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 space-y-4"
          >
            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm">
                {error}
              </div>
            )}

            {!isLoginMode && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-1">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Jane Doe"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Please wait…' : isLoginMode ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
