'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ClientLogin() {
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Always use dark mode
  const [isStarkMode] = useState(true);

  // Set theme to dark mode in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'stark');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/clients/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      // Store authentication in localStorage (session management)
      if (typeof window !== 'undefined') {
        localStorage.setItem('clientAuth', 'authenticated');
        localStorage.setItem('clientAuthEmail', email);
        localStorage.setItem('clientAuthTime', Date.now().toString());
        localStorage.setItem('clientId', data.client.id.toString());
      }
      
      router.push('/client/dashboard');
    } catch (error: any) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!fullName || !email || !password || !confirmPassword || !phone) {
      setError('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Invalid email format');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Signup failed');
        setIsLoading(false);
        return;
      }

      // Auto-login after signup
      if (typeof window !== 'undefined') {
        localStorage.setItem('clientAuth', 'authenticated');
        localStorage.setItem('clientAuthEmail', email);
        localStorage.setItem('clientAuthTime', Date.now().toString());
        localStorage.setItem('clientId', data.client.id.toString());
      }

      router.push('/client/dashboard');
    } catch (error: any) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <main className={`min-h-screen transition-colors duration-300 ${isStarkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b transition-colors duration-300 ${
        isStarkMode 
          ? 'bg-black/90 border-cyan-500/20' 
          : 'bg-white/98 border-gray-300/60 shadow-lg shadow-gray-900/5'
      }`}>
        <div className="w-full mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-4">
          <div className="flex items-center justify-between max-w-[2400px] mx-auto">
            <Link href="/" className="flex items-center gap-3 transition-colors hover:opacity-80">
              <img 
                src="/blueBall.png" 
                alt="Logo" 
                className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 object-contain"
              />
              <div className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter ${
                isStarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                AI Web Design Firm
              </div>
            </Link>
            <Link
              href="/login"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                isStarkMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
              }`}
            >
              Back
            </Link>
          </div>
        </div>
      </nav>

      {/* Login/Signup Section */}
      <section className={`min-h-screen flex items-center justify-center pt-32 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
        isStarkMode 
          ? 'bg-gradient-to-b from-black via-gray-900 to-black' 
          : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
      }`}>
        <div className="max-w-md w-full mx-auto">
          <div className="text-center mb-8">
            <h1 className={`text-4xl sm:text-5xl font-black mb-4 tracking-tight ${
              isStarkMode 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
            }`}>
              {isLoginMode ? 'Client Login' : 'Create Account'}
            </h1>
            <p className={`text-lg font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {isLoginMode 
                ? 'Access your project dashboard' 
                : 'Create your client account to get started'}
            </p>
          </div>

          {/* Toggle between Login and Signup */}
          <div className={`mb-8 p-1 rounded-lg flex gap-2 ${
            isStarkMode ? 'bg-gray-800' : 'bg-gray-100'
          }`}>
            <button
              onClick={() => {
                setIsLoginMode(true);
                setError('');
                setEmail('');
                setPassword('');
                setFullName('');
                setPhone('');
                setConfirmPassword('');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                isLoginMode
                  ? isStarkMode
                    ? 'bg-cyan-500 text-black'
                    : 'bg-gray-900 text-white'
                  : isStarkMode
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setIsLoginMode(false);
                setError('');
                setEmail('');
                setPassword('');
                setFullName('');
                setPhone('');
                setConfirmPassword('');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                !isLoginMode
                  ? isStarkMode
                    ? 'bg-cyan-500 text-black'
                    : 'bg-gray-900 text-white'
                  : isStarkMode
                    ? 'text-gray-400 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          <div className={`rounded-xl p-8 shadow-xl ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60'
          }`}>
            <form onSubmit={isLoginMode ? handleLogin : handleSignUp} className="space-y-6">
              {error && (
                <div className={`p-4 rounded-lg ${
                  isStarkMode 
                    ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                    : 'bg-red-50 border-2 border-red-200 text-red-600'
                }`}>
                  {error}
                </div>
              )}

              {!isLoginMode && (
                <div>
                  <label htmlFor="fullName" className={`block text-sm font-medium mb-2 ${
                    isStarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      isStarkMode
                        ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                        : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                    }`}
                    placeholder="John Doe"
                  />
                </div>
              )}

              {!isLoginMode && (
                <div>
                  <label htmlFor="phone" className={`block text-sm font-medium mb-2 ${
                    isStarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      isStarkMode
                        ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                        : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                    }`}
                    placeholder="(555) 123-4567"
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-2 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                      : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  placeholder="example@aiwebdesignfirm.com"
                />
              </div>

              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-2 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                      : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  placeholder={isLoginMode ? "Enter your password" : "At least 6 characters"}
                />
              </div>

              {!isLoginMode && (
                <div>
                  <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-2 ${
                    isStarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      isStarkMode
                        ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                        : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                    }`}
                    placeholder="Confirm your password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full px-8 py-4 rounded-full text-lg font-bold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed ${
                  isStarkMode
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                }`}
              >
                {isLoading ? 'Processing...' : (isLoginMode ? 'Login' : 'Create Account')}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

