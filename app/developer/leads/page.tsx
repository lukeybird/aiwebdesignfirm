'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Lead {
  id: string;
  listingLink: string;
  businessPhone?: string;
  businessName?: string;
  businessEmail?: string;
  businessAddress?: string;
  ownerFirstName?: string;
  ownerPhone?: string;
  hasLogo?: number;
  hasGoodPhotos?: number;
  customNotes?: string;
  createdAt: string;
}

export default function LeadsPage() {
  const router = useRouter();
  // Always use dark mode
  const [isStarkMode] = useState(true);

  // Set theme to dark mode in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'stark');
    }
  }, []);

  // Check authentication
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = localStorage.getItem('devAuth');
      const authTime = localStorage.getItem('devAuthTime');
      
      // Check if authenticated and session is valid (24 hours)
      if (!auth || !authTime || Date.now() - parseInt(authTime) > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('devAuth');
        localStorage.removeItem('devAuthTime');
        router.push('/login/developer');
      }
    }
  }, [router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', isStarkMode ? 'stark' : 'day');
    }
  }, [isStarkMode]);

  const [leads, setLeads] = useState<Lead[]>([]);

  // Load leads from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLeads = localStorage.getItem('leads');
      if (storedLeads) {
        try {
          const parsedLeads = JSON.parse(storedLeads);
          // Sort by creation date, newest first
          parsedLeads.sort((a: Lead, b: Lead) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setLeads(parsedLeads);
        } catch (error) {
          console.error('Error parsing leads:', error);
        }
      }
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('devAuth');
      localStorage.removeItem('devAuthTime');
    }
    router.push('/login/developer');
  };

  const handleDeleteLead = (leadId: string) => {
    if (typeof window !== 'undefined' && confirm('Are you sure you want to delete this lead?')) {
      const updatedLeads = leads.filter(lead => lead.id !== leadId);
      localStorage.setItem('leads', JSON.stringify(updatedLeads));
      setLeads(updatedLeads);
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
            
            {/* Developer Menu */}
            <div className="flex items-center gap-4">
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
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
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
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/developer/dashboard"
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                  isStarkMode
                    ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
                }`}
              >
                Create Lead
              </Link>
              <button
                onClick={handleLogout}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                  isStarkMode
                    ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
                }`}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Leads List Section */}
      <section className={`pt-32 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
        isStarkMode 
          ? 'bg-gradient-to-b from-black via-gray-900 to-black' 
          : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
      }`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-black mb-4 tracking-tight ${
              isStarkMode 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
            }`}>
              All Leads ({leads.length})
            </h1>
            <p className={`text-lg font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              View and manage all your leads
            </p>
          </div>

          {leads.length === 0 ? (
            <div className={`text-center py-12 rounded-xl ${
              isStarkMode 
                ? 'bg-gray-800 border border-cyan-500/20' 
                : 'bg-white border-2 border-gray-300/60 shadow-gray-900/20'
            }`}>
              <p className={`text-lg mb-2 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                No leads created yet.
              </p>
              <p className={`text-sm ${isStarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                Create your first lead using the form.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className={`p-6 rounded-lg border transition-all hover:shadow-lg ${
                    isStarkMode
                      ? 'bg-gray-800/50 border-cyan-500/20 hover:border-cyan-500/40'
                      : 'bg-white border-gray-300/60 hover:border-gray-400/80 shadow-lg'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className={`text-xl font-bold mb-2 ${
                        isStarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {lead.businessName || 'Unnamed Business'}
                      </h3>
                      <p className={`text-xs mb-3 ${
                        isStarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Created: {new Date(lead.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteLead(lead.id)}
                      className={`ml-4 px-3 py-1.5 rounded text-sm font-medium transition-all hover:scale-105 ${
                        isStarkMode
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      }`}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {lead.listingLink && (
                      <div>
                        <span className={`font-medium ${
                          isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                        }`}>
                          Listing Link:
                        </span>
                        <a
                          href={lead.listingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`ml-2 underline hover:opacity-80 ${
                            isStarkMode ? 'text-cyan-300' : 'text-blue-600'
                          }`}
                        >
                          View Link
                        </a>
                      </div>
                    )}
                    {lead.businessPhone && (
                      <div>
                        <span className={`font-medium ${
                          isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                        }`}>
                          Phone:
                        </span>
                        <span className={`ml-2 ${
                          isStarkMode ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {lead.businessPhone}
                        </span>
                      </div>
                    )}
                    {lead.businessEmail && (
                      <div>
                        <span className={`font-medium ${
                          isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                        }`}>
                          Email:
                        </span>
                        <span className={`ml-2 ${
                          isStarkMode ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {lead.businessEmail}
                        </span>
                      </div>
                    )}
                    {lead.businessAddress && (
                      <div className="md:col-span-2">
                        <span className={`font-medium ${
                          isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                        }`}>
                          Address:
                        </span>
                        <span className={`ml-2 ${
                          isStarkMode ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {lead.businessAddress}
                        </span>
                      </div>
                    )}
                    {lead.ownerFirstName && (
                      <div>
                        <span className={`font-medium ${
                          isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                        }`}>
                          Owner Name:
                        </span>
                        <span className={`ml-2 ${
                          isStarkMode ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {lead.ownerFirstName}
                        </span>
                      </div>
                    )}
                    {lead.ownerPhone && (
                      <div>
                        <span className={`font-medium ${
                          isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                        }`}>
                          Owner Phone:
                        </span>
                        <span className={`ml-2 ${
                          isStarkMode ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {lead.ownerPhone}
                        </span>
                      </div>
                    )}
                    {lead.hasLogo !== undefined && (
                      <div>
                        <span className={`font-medium ${
                          isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                        }`}>
                          Has Logo:
                        </span>
                        <span className={`ml-2 ${
                          isStarkMode ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {lead.hasLogo}/5
                        </span>
                      </div>
                    )}
                    {lead.hasGoodPhotos !== undefined && (
                      <div>
                        <span className={`font-medium ${
                          isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                        }`}>
                          Has Good Photos:
                        </span>
                        <span className={`ml-2 ${
                          isStarkMode ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {lead.hasGoodPhotos}/5
                        </span>
                      </div>
                    )}
                    {lead.customNotes && (
                      <div className="md:col-span-2">
                        <span className={`font-medium ${
                          isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                        }`}>
                          Notes:
                        </span>
                        <p className={`mt-1 ${
                          isStarkMode ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {lead.customNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Floating Create Lead Button - Bottom Right */}
      <Link
        href="/developer/dashboard"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-200 hover:scale-110 shadow-2xl ${
          isStarkMode
            ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/50'
            : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/20'
        }`}
        aria-label="Create new lead"
      >
        +
      </Link>

    </main>
  );
}

