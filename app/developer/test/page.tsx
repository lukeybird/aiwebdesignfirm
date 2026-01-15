'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TestPage() {
  const router = useRouter();
  const [isStarkMode] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check authentication
  if (typeof window !== 'undefined') {
    const auth = localStorage.getItem('devAuth');
    const authTime = localStorage.getItem('devAuthTime');
    
    if (!auth || !authTime || Date.now() - parseInt(authTime) > 24 * 60 * 60 * 1000) {
      router.push('/login/developer');
    }
  }

  const handleSendTestEmail = async () => {
    setIsSending(true);
    setMessage(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email');
      }

      setMessage({ type: 'success', text: `Test email sent successfully to luke@webstarts.com!` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error sending test email. Please try again.' });
    } finally {
      setIsSending(false);
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
        <div className="w-full mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
          {/* First Section: Logo and Logout */}
          <div className="flex items-center justify-between max-w-[2400px] mx-auto py-4 border-b border-opacity-20 border-current">
            <Link href="/" className="flex items-center gap-3 transition-colors hover:opacity-80">
              <img 
                src="/blueBall.png" 
                alt="Logo" 
                className="w-10 h-10"
              />
              <span className={`text-xl font-black ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                AI Web Design Firm
              </span>
            </Link>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('devAuth');
                  localStorage.removeItem('devAuthTime');
                }
                router.push('/login/developer');
              }}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                isStarkMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
              }`}
            >
              Logout
            </button>
          </div>
          
          {/* Second Section: Developer Menu */}
          <div className="flex items-center justify-center max-w-[2400px] mx-auto py-3 gap-4">
            <Link
              href="/developer/dashboard"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                isStarkMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
              }`}
            >
              New Leads
            </Link>
            <Link
              href="/developer/leads"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                isStarkMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
              }`}
            >
              Lead List
            </Link>
            <Link
              href="/developer/clients"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                isStarkMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
              }`}
            >
              Clients
            </Link>
            <Link
              href="/developer/support"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                isStarkMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
              }`}
            >
              Support
            </Link>
            <Link
              href="/developer/test"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                isStarkMode
                  ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
              }`}
            >
              Test
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className={`pt-40 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
        isStarkMode 
          ? 'bg-gradient-to-b from-black via-gray-900 to-black' 
          : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
      }`}>
        <div className="max-w-4xl mx-auto">
          <div className={`rounded-xl p-8 ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60'
          }`}>
            <h1 className={`text-3xl font-black mb-6 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
              Test Section
            </h1>
            
            <div className="space-y-6">
              <div>
                <h2 className={`text-xl font-bold mb-4 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Send Test Welcome Email
                </h2>
                <p className={`mb-4 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Click the button below to send a test welcome email to luke@webstarts.com
                </p>
                <button
                  onClick={handleSendTestEmail}
                  disabled={isSending}
                  className={`px-6 py-3 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                    isStarkMode
                      ? isSending
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                      : isSending
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                  }`}
                >
                  {isSending ? 'Sending...' : 'Send Test Welcome Email'}
                </button>
              </div>

              {message && (
                <div className={`p-4 rounded-lg ${
                  message.type === 'success'
                    ? isStarkMode
                      ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                      : 'bg-green-50 border border-green-200 text-green-600'
                    : isStarkMode
                      ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                      : 'bg-red-50 border border-red-200 text-red-600'
                }`}>
                  {message.text}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

