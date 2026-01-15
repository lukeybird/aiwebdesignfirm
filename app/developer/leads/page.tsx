'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Note {
  id: string;
  text: string;
  createdAt: string;
}

interface Lead {
  id: string;
  listingLink: string;
  websiteLink?: string;
  businessPhone?: string;
  businessName?: string;
  businessEmail?: string;
  businessAddress?: string;
  ownerFirstName?: string;
  ownerPhone?: string;
  hasLogo?: number;
  hasGoodPhotos?: number;
  customNotes?: string; // Legacy field
  notes?: Note[]; // New array of notes
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
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const leadsPerPage = 25;

  // Load leads from API
  useEffect(() => {
    const loadLeads = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/leads?page=${currentPage}&limit=${leadsPerPage}`);
        const data = await response.json();
        
        if (data.error) {
          console.error('Error from API:', data.error);
          return;
        }
        
        if (data.leads) {
          setLeads(data.leads);
          if (data.pagination) {
            setTotalPages(data.pagination.totalPages);
            setTotalLeads(data.pagination.total);
          }
        }
      } catch (error) {
        console.error('Error loading leads:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeads();
  }, [currentPage]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('devAuth');
      localStorage.removeItem('devAuthTime');
    }
    router.push('/login/developer');
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
                className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 object-contain"
              />
              <div className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter ${
                isStarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                AI Web Design Firm
              </div>
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
          </div>
        </div>
      </nav>

      {/* Leads List Section */}
      <section className={`pt-40 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
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
              All Leads ({totalLeads})
            </h1>
            <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Showing {leads.length > 0 ? ((currentPage - 1) * leadsPerPage + 1) : 0} - {Math.min(currentPage * leadsPerPage, totalLeads)} of {totalLeads}
            </p>
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
            <div className={`rounded-xl ${
              isStarkMode 
                ? 'bg-gray-800 border border-cyan-500/20' 
                : 'bg-white border-2 border-gray-300/60'
            }`}>
              <div className="divide-y divide-opacity-20 divide-current">
                {leads.map((lead) => {
                  // Get the last note (most recent)
                  const lastNote = lead.notes && lead.notes.length > 0 
                    ? lead.notes.sort((a, b) => 
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )[0]
                    : null;
                  
                  // Fallback to legacy customNotes if no notes array exists
                  const hasLegacyNote = !lastNote && lead.customNotes;
                  
                  return (
                    <div
                      key={lead.id}
                      className={`p-4 transition-all hover:bg-opacity-50 ${
                        isStarkMode
                          ? 'hover:bg-gray-700/50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className={`text-lg font-bold ${
                              isStarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {lead.businessName || 'Unnamed Business'}
                            </h3>
                            {lastNote && (
                              <>
                                <span className={`${isStarkMode ? 'text-gray-600' : 'text-gray-400'}`}>|</span>
                                <span className={`text-sm ${
                                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  {lastNote.text.length > 60 
                                    ? `${lastNote.text.substring(0, 60)}...` 
                                    : lastNote.text}
                                </span>
                                <span className={`text-sm italic ${
                                  isStarkMode ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                  ({new Date(lastNote.createdAt).toLocaleString()})
                                </span>
                              </>
                            )}
                            {hasLegacyNote && (
                              <>
                                <span className={`${isStarkMode ? 'text-gray-600' : 'text-gray-400'}`}>|</span>
                                <span className={`text-sm ${
                                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  {lead.customNotes && lead.customNotes.length > 60
                                    ? `${lead.customNotes.substring(0, 60)}...`
                                    : lead.customNotes}
                                </span>
                                <span className={`text-sm italic ${
                                  isStarkMode ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                  (Legacy note)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/developer/leads/${lead.id}`}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 flex-shrink-0 ${
                            isStarkMode
                              ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                              : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                          }`}
                        >
                          More Info
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={`mt-8 flex items-center justify-center gap-4 ${
              isStarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isStarkMode
                    ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
                }`}
              >
                Previous
              </button>
              
              <span className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isStarkMode
                    ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
                }`}
              >
                Next
              </button>
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

