'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DeveloperLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simple authentication check
    if (username === 'luke@webstarts.com' && password === 'Dev74589900!') {
      // Store authentication in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('devAuth', 'authenticated');
        localStorage.setItem('devAuthTime', Date.now().toString());
      }
      router.push('/developer/dashboard');
    } else {
      setError('Invalid username or password');
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
              className={`text-sm font-medium transition-colors hover:opacity-80 ${
                isStarkMode ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ← Back
            </Link>
          </div>
        </div>
      </nav>

      {/* Login Form */}
      <section className={`min-h-screen flex items-center justify-center pt-32 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
        isStarkMode 
          ? 'bg-gradient-to-b from-black via-gray-900 to-black' 
          : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
      }`}>
        <div className="max-w-md w-full">
          <div className={`rounded-xl p-8 lg:p-12 shadow-2xl ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60 shadow-gray-900/20'
          }`}>
            <div className="text-center mb-8">
              <h1 className={`text-4xl sm:text-5xl font-black mb-4 tracking-tight ${
                isStarkMode 
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                  : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
              }`}>
                Developer Login
              </h1>
              <p className={`text-lg font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Enter your credentials to access the dashboard
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className={`p-4 rounded-lg ${
                  isStarkMode 
                    ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                    : 'bg-red-50 border-2 border-red-200 text-red-600'
                }`}>
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="username" className={`block text-sm font-medium mb-2 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                      : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  placeholder="luke@webstarts.com"
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
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full px-8 py-4 rounded-full text-lg font-bold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed ${
                  isStarkMode
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                }`}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </section>

    </main>
  );
}

