'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Note {
  id: string;
  text: string;
  createdAt: string;
}

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
  customNotes?: string; // Legacy field for migration
  notes?: Note[]; // New array of notes
  createdAt: string;
}

export default function LeadProfilePage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params?.id as string;
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  
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

  // Load lead data from API
  useEffect(() => {
    const loadLead = async () => {
      if (!leadId) return;

      try {
        const response = await fetch(`/api/leads/${leadId}`);
        const data = await response.json();

        if (data.lead) {
          setLead(data.lead);
          setNotes(data.lead.notes || []);
        } else {
          router.push('/developer/leads');
        }
      } catch (error) {
        console.error('Error loading lead:', error);
        router.push('/developer/leads');
      }
    };

    loadLead();
  }, [leadId, router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('devAuth');
      localStorage.removeItem('devAuthTime');
    }
    router.push('/login/developer');
  };

  const handleDeleteLead = async () => {
    if (!lead || !confirm('Are you sure you want to delete this lead?')) return;

    try {
      const response = await fetch(`/api/leads?leadId=${lead.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete lead');
      }

      router.push('/developer/leads');
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Error deleting lead. Please try again.');
    }
  };

  const handleAddNote = async () => {
    if (!lead || !newNoteText.trim()) return;

    try {
      const response = await fetch(`/api/leads/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newNoteText.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add note');
      }

      // Add note to local state
      const newNote = data.note;
      const updatedNotes = [newNote, ...notes];
      setNotes(updatedNotes);
      setLead({ ...lead, notes: updatedNotes });
      
      setNewNoteText('');
      setIsAddingNote(false);
    } catch (error: any) {
      console.error('Error adding note:', error);
      alert(error.message || 'Error adding note. Please try again.');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!lead || !confirm('Are you sure you want to delete this note?')) return;

    try {
      const response = await fetch(`/api/leads/${lead.id}/notes?noteId=${noteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      // Update local state
      const updatedNotes = notes.filter(note => note.id !== noteId);
      setNotes(updatedNotes);
      setLead({ ...lead, notes: updatedNotes });
    } catch (error: any) {
      console.error('Error deleting note:', error);
      alert(error.message || 'Error deleting note. Please try again.');
    }
  };

  const handleCancelAdd = () => {
    setNewNoteText('');
    setIsAddingNote(false);
  };

  // Format phone number: +18139150092 -> +1 (813) 915-0092
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return phone;
    
    // Remove all non-digit characters except the leading +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Check if it starts with +1 (US format)
    if (cleaned.startsWith('+1') && cleaned.length === 12) {
      const areaCode = cleaned.substring(2, 5);
      const firstPart = cleaned.substring(5, 8);
      const secondPart = cleaned.substring(8, 12);
      return `+1 (${areaCode}) ${firstPart}-${secondPart}`;
    }
    
    // If it's 11 digits starting with 1 (without +)
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      const areaCode = cleaned.substring(1, 4);
      const firstPart = cleaned.substring(4, 7);
      const secondPart = cleaned.substring(7, 11);
      return `+1 (${areaCode}) ${firstPart}-${secondPart}`;
    }
    
    // If it's 10 digits (assume US number without country code)
    if (cleaned.length === 10) {
      const areaCode = cleaned.substring(0, 3);
      const firstPart = cleaned.substring(3, 6);
      const secondPart = cleaned.substring(6, 10);
      return `(${areaCode}) ${firstPart}-${secondPart}`;
    }
    
    // Return original if it doesn't match expected formats
    return phone;
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
              className={`px-3 py-2 rounded-full text-lg transition-all hover:scale-105 ${
                isStarkMode
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40'
                  : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
              }`}
              aria-label="Delete Lead"
              title="Delete Lead"
            >
              🗑️
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
                    {formatPhoneNumber(lead.businessPhone)}
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
                    {formatPhoneNumber(lead.ownerPhone)}
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
                Notes ({notes.length})
              </h2>
              {!isAddingNote && (
                <button
                  onClick={() => setIsAddingNote(true)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 ${
                    isStarkMode
                      ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                      : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                  }`}
                >
                  Add Note
                </button>
              )}
            </div>

            {isAddingNote && (
              <div className="mb-6 space-y-3">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Add a new note..."
                  rows={4}
                  className={`w-full p-4 rounded-lg border resize-none focus:outline-none focus:ring-2 ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                      : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-cyan-500/50'
                  }`}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleAddNote}
                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 ${
                      isStarkMode
                        ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                        : 'bg-cyan-600 text-white hover:bg-cyan-700'
                    }`}
                  >
                    Add Note
                  </button>
                  <button
                    onClick={handleCancelAdd}
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
            )}

            {/* Notes List */}
            {notes.length === 0 ? (
              <div className={`p-4 rounded-lg text-center ${
                isStarkMode ? 'bg-gray-900' : 'bg-gray-50'
              }`}>
                <p className={`italic ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  No notes added yet. Click "Add Note" to add your first note.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-4 rounded-lg border ${
                      isStarkMode
                        ? 'bg-gray-900 border-cyan-500/20'
                        : 'bg-gray-50 border-gray-300/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className={`whitespace-pre-wrap ${
                          isStarkMode ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {note.text}
                        </p>
                        <p className={`text-xs mt-2 ${
                          isStarkMode ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          {new Date(note.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-all hover:scale-105 flex-shrink-0 ${
                          isStarkMode
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40'
                            : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

