'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export default function LeadProfilePage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params?.id as string;
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [notesText, setNotesText] = useState<string>('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  
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

  // Load lead data
  useEffect(() => {
    if (typeof window !== 'undefined' && leadId) {
      const storedLeads = localStorage.getItem('leads');
      if (storedLeads) {
        try {
          const parsedLeads = JSON.parse(storedLeads);
          const foundLead = parsedLeads.find((l: Lead) => l.id === leadId);
          if (foundLead) {
            setLead(foundLead);
            setNotesText(foundLead.customNotes || '');
          } else {
            // Lead not found, redirect to leads list
            router.push('/developer/leads');
          }
        } catch (error) {
          console.error('Error parsing leads:', error);
          router.push('/developer/leads');
        }
      } else {
        router.push('/developer/leads');
      }
    }
  }, [leadId, router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('devAuth');
      localStorage.removeItem('devAuthTime');
    }
    router.push('/login/developer');
  };

  const handleDeleteLead = () => {
    if (typeof window !== 'undefined' && lead && confirm('Are you sure you want to delete this lead?')) {
      const storedLeads = localStorage.getItem('leads');
      if (storedLeads) {
        const parsedLeads = JSON.parse(storedLeads);
        const updatedLeads = parsedLeads.filter((l: Lead) => l.id !== lead.id);
        localStorage.setItem('leads', JSON.stringify(updatedLeads));
        router.push('/developer/leads');
      }
    }
  };

  const handleSaveNotes = () => {
    if (typeof window !== 'undefined' && lead) {
      const storedLeads = localStorage.getItem('leads');
      if (storedLeads) {
        const parsedLeads = JSON.parse(storedLeads);
        const updatedLeads = parsedLeads.map((l: Lead) => 
          l.id === lead.id 
            ? { ...l, customNotes: notesText }
            : l
        );
        localStorage.setItem('leads', JSON.stringify(updatedLeads));
        setLead({ ...lead, customNotes: notesText });
        setIsEditingNotes(false);
      }
    }
  };

  const handleCancelEdit = () => {
    if (lead) {
      setNotesText(lead.customNotes || '');
      setIsEditingNotes(false);
    }
  };

  if (!lead) {
    return (
      <main className={`min-h-screen transition-colors duration-300 ${isStarkMode ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            <p className={isStarkMode ? 'text-gray-400' : 'text-gray-600'}>Loading lead...</p>
          </div>
        </div>
      </main>
    );
  }

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
          </div>
        </div>
      </nav>

      {/* Lead Profile Content */}
      <section className={`pt-40 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
        isStarkMode 
          ? 'bg-gradient-to-b from-black via-gray-900 to-black' 
          : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
      }`}>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <Link
                href="/developer/leads"
                className={`inline-flex items-center gap-2 mb-4 text-sm font-medium transition-colors hover:opacity-80 ${
                  isStarkMode ? 'text-cyan-400' : 'text-blue-600'
                }`}
              >
                ← Back to Leads
              </Link>
              <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-black mb-2 tracking-tight ${
                isStarkMode 
                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                  : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
              }`}>
                {lead.businessName || 'Unnamed Business'}
              </h1>
              <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Created: {new Date(lead.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={handleDeleteLead}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 ${
                isStarkMode
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40'
                  : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
              }`}
            >
              Delete Lead
            </button>
          </div>

          {/* Lead Information */}
          <div className={`rounded-xl p-6 mb-6 ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60'
          }`}>
            <h2 className={`text-2xl font-black mb-6 ${
              isStarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Lead Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {lead.listingLink && (
                <div>
                  <span className={`font-medium block mb-1 ${
                    isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                  }`}>
                    Listing Link:
                  </span>
                  <a
                    href={lead.listingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`underline hover:opacity-80 ${
                      isStarkMode ? 'text-cyan-300' : 'text-blue-600'
                    }`}
                  >
                    View Link
                  </a>
                </div>
              )}
              {lead.businessPhone && (
                <div>
                  <span className={`font-medium block mb-1 ${
                    isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                  }`}>
                    Business Phone:
                  </span>
                  <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                    {lead.businessPhone}
                  </span>
                </div>
              )}
              {lead.businessEmail && (
                <div>
                  <span className={`font-medium block mb-1 ${
                    isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                  }`}>
                    Business Email:
                  </span>
                  <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                    {lead.businessEmail}
                  </span>
                </div>
              )}
              {lead.businessAddress && (
                <div className="md:col-span-2">
                  <span className={`font-medium block mb-1 ${
                    isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                  }`}>
                    Business Address:
                  </span>
                  <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                    {lead.businessAddress}
                  </span>
                </div>
              )}
              {lead.ownerFirstName && (
                <div>
                  <span className={`font-medium block mb-1 ${
                    isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                  }`}>
                    Owner Name:
                  </span>
                  <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                    {lead.ownerFirstName}
                  </span>
                </div>
              )}
              {lead.ownerPhone && (
                <div>
                  <span className={`font-medium block mb-1 ${
                    isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                  }`}>
                    Owner Phone:
                  </span>
                  <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                    {lead.ownerPhone}
                  </span>
                </div>
              )}
              {lead.hasLogo !== undefined && (
                <div>
                  <span className={`font-medium block mb-1 ${
                    isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                  }`}>
                    Has Logo:
                  </span>
                  <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                    {lead.hasLogo}/5
                  </span>
                </div>
              )}
              {lead.hasGoodPhotos !== undefined && (
                <div>
                  <span className={`font-medium block mb-1 ${
                    isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                  }`}>
                    Has Good Photos:
                  </span>
                  <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                    {lead.hasGoodPhotos}/5
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div className={`rounded-xl p-6 ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-2xl font-black ${
                isStarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Notes
              </h2>
              {!isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 ${
                    isStarkMode
                      ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                      : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                  }`}
                >
                  {lead.customNotes ? 'Edit Notes' : 'Add Notes'}
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-4">
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Add notes about this lead..."
                  rows={8}
                  className={`w-full p-4 rounded-lg border resize-none focus:outline-none focus:ring-2 ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-cyan-500/50'
                  }`}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveNotes}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 ${
                      isStarkMode
                        ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                        : 'bg-cyan-600 text-white hover:bg-cyan-700'
                    }`}
                  >
                    Save Notes
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 ${
                      isStarkMode
                        ? 'bg-gray-700 text-white hover:bg-gray-600 border border-gray-600'
                        : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className={`p-4 rounded-lg ${
                isStarkMode ? 'bg-gray-900' : 'bg-gray-50'
              }`}>
                <p className={`whitespace-pre-wrap ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-900'
                }`}>
                  {lead.customNotes || (
                    <span className={`italic ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      No notes added yet. Click "Add Notes" to add notes about this lead.
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

