'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  // Determine initial theme based on time of day
  const getInitialTheme = () => {
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6;
  };
  
  const [isStarkMode, setIsStarkMode] = useState(getInitialTheme);

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
            <Link href="/" className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter transition-colors hover:opacity-80 ${
              isStarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              AI Web Design Firm
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

      {/* Theme Toggle - Day/Night Switch - Bottom Left */}
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setIsStarkMode(!isStarkMode)}
          className={`relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-2xl hover:scale-110 ${
            isStarkMode 
              ? 'bg-cyan-500 focus:ring-cyan-500 shadow-cyan-500/50' 
              : 'bg-white focus:ring-gray-400 shadow-gray-900/20 border border-gray-300/50'
          }`}
          aria-label="Toggle day/night mode"
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-300 flex items-center justify-center ${
              isStarkMode ? 'translate-x-7' : 'translate-x-0'
            }`}
          >
            {isStarkMode ? (
              <svg className="w-3 h-3 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            )}
          </span>
        </button>
      </div>
    </main>
  );
}

