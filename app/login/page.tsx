'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  
  // Always use dark mode
  const [isStarkMode] = useState(true);

  // Set theme to dark mode in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'stark');
    }
  }, []);

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
          </div>
        </div>
      </nav>

      {/* Login Section */}
      <section className={`min-h-screen flex items-center justify-center pt-32 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
        isStarkMode 
          ? 'bg-gradient-to-b from-black via-gray-900 to-black' 
          : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
      }`}>
        <div className="max-w-2xl w-full mx-auto">
          <div className="text-center mb-16">
            <h1 className={`text-5xl sm:text-6xl lg:text-7xl font-black mb-6 tracking-tight ${
              isStarkMode 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
            }`}>
              Access Portal
            </h1>
            <p className={`text-xl font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Select your login type
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* Developer Login Button */}
            <button
              onClick={() => router.push('/login/developer')}
              className={`rounded-xl p-12 shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
                isStarkMode 
                  ? 'bg-gray-800 border border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-cyan-500/20'
                  : 'bg-white border-2 border-gray-300/60 hover:border-gray-400/80 hover:shadow-gray-900/15'
              }`}
            >
              <div className="text-center">
                <div className="text-6xl mb-6">👨‍💻</div>
                <h2 className={`text-3xl font-black mb-4 tracking-tight ${
                  isStarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Developer Login
                </h2>
                <p className={`text-lg font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Access developer tools and resources
                </p>
              </div>
            </button>

            {/* Client Login Button */}
            <button
              onClick={() => router.push('/login/client')}
              className={`rounded-xl p-12 shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
                isStarkMode 
                  ? 'bg-gray-800 border border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-cyan-500/20'
                  : 'bg-white border-2 border-gray-300/60 hover:border-gray-400/80 hover:shadow-gray-900/15'
              }`}
            >
              <div className="text-center">
                <div className="text-6xl mb-6">👤</div>
                <h2 className={`text-3xl font-black mb-4 tracking-tight ${
                  isStarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Client Login
                </h2>
                <p className={`text-lg font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  View your project status and updates
                </p>
              </div>
            </button>
          </div>
        </div>
      </section>

    </main>
  );
}

