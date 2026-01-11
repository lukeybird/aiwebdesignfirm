'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Lead {
  id: string;
  businessPhone: string;
  businessName: string;
  businessEmail: string;
  businessAddress?: string;
  ownerFirstName?: string;
  ownerPhone?: string;
  hasLogo?: number;
  hasGoodPhotos?: number;
  customNotes?: string;
  createdAt: string;
}

export default function DeveloperDashboard() {
  const router = useRouter();
  const [isStarkMode, setIsStarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved !== null) {
        return saved === 'stark';
      }
    }
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6;
  });

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

  // Form state
  const [formData, setFormData] = useState({
    businessPhone: '',
    businessName: '',
    businessEmail: '',
  });

  // Additional fields state
  const [showOwnerName, setShowOwnerName] = useState(false);
  const [showOwnerPhone, setShowOwnerPhone] = useState(false);
  const [showLogoRating, setShowLogoRating] = useState(false);
  const [showPhotosRating, setShowPhotosRating] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [additionalFields, setAdditionalFields] = useState({
    businessAddress: '',
    ownerFirstName: '',
    ownerPhone: '',
    hasLogo: 1,
    hasGoodPhotos: 1,
    customNotes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isLoadingPlace, setIsLoadingPlace] = useState(false);
  const [placeError, setPlaceError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);

    // Create lead object
    const newLead: Lead = {
      id: Date.now().toString(),
      businessPhone: formData.businessPhone,
      businessName: formData.businessName,
      businessEmail: formData.businessEmail,
      businessAddress: additionalFields.businessAddress,
      ownerFirstName: showOwnerName ? additionalFields.ownerFirstName : undefined,
      ownerPhone: showOwnerPhone ? additionalFields.ownerPhone : undefined,
      hasLogo: showLogoRating ? additionalFields.hasLogo : undefined,
      hasGoodPhotos: showPhotosRating ? additionalFields.hasGoodPhotos : undefined,
      customNotes: showNotes ? additionalFields.customNotes : undefined,
      createdAt: new Date().toISOString(),
    };

    // Save to localStorage
    if (typeof window !== 'undefined') {
      const existingLeads = localStorage.getItem('leads');
      const leads: Lead[] = existingLeads ? JSON.parse(existingLeads) : [];
      leads.push(newLead);
      localStorage.setItem('leads', JSON.stringify(leads));
    }

    // Reset form
    setFormData({
      businessPhone: '',
      businessName: '',
      businessEmail: '',
    });
    setAdditionalFields({
      businessAddress: '',
      ownerFirstName: '',
      ownerPhone: '',
      hasLogo: 1,
      hasGoodPhotos: 1,
      customNotes: '',
    });
    setShowOwnerName(false);
    setShowOwnerPhone(false);
    setShowLogoRating(false);
    setShowPhotosRating(false);
    setShowNotes(false);

    setIsSubmitting(false);
    setSubmitSuccess(true);

    // Hide success message after 3 seconds
    setTimeout(() => setSubmitSuccess(false), 3000);
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('devAuth');
      localStorage.removeItem('devAuthTime');
    }
    router.push('/login/developer');
  };

  // Check if URL is a Google Maps link
  const isGoogleMapsUrl = (url: string): boolean => {
    return /google\.com\/maps|maps\.google\.com/.test(url);
  };

  // Fetch place details from Google Maps URL
  const fetchPlaceDetails = async (url: string) => {
    setIsLoadingPlace(true);
    setPlaceError('');

    try {
      const response = await fetch('/api/google-places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPlaceError(data.error || 'Failed to fetch place details');
        setIsLoadingPlace(false);
        return;
      }

      // Auto-fill form fields
      if (data.businessName) {
        setFormData(prev => ({ ...prev, businessName: data.businessName }));
      }
      if (data.businessPhone) {
        setFormData(prev => ({ ...prev, businessPhone: data.businessPhone }));
      }
      if (data.businessEmail) {
        setFormData(prev => ({ ...prev, businessEmail: data.businessEmail }));
      }
      if (data.businessAddress) {
        setAdditionalFields(prev => ({ ...prev, businessAddress: data.businessAddress }));
      }

      setIsLoadingPlace(false);
    } catch (error) {
      console.error('Error fetching place details:', error);
      setPlaceError('Failed to fetch place details. Please check your API key configuration.');
      setIsLoadingPlace(false);
    }
  };

  // Handle address field change - detect Google Maps URL
  const handleAddressChange = (value: string) => {
    setAdditionalFields({ ...additionalFields, businessAddress: value });
    setPlaceError('');

    // Check if it's a Google Maps URL and auto-fill
    if (isGoogleMapsUrl(value) && value.length > 20) {
      fetchPlaceDetails(value);
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
            <Link href="/" className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter transition-colors hover:opacity-80 ${
              isStarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              AI Web Design Firm
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
      </nav>

      {/* Dashboard Content */}
      <section className={`pt-32 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
        isStarkMode 
          ? 'bg-gradient-to-b from-black via-gray-900 to-black' 
          : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
      }`}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-black mb-4 tracking-tight ${
              isStarkMode 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
            }`}>
              Create New Lead
            </h1>
            <p className={`text-lg font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Add a new lead to the database
            </p>
          </div>

          {/* Success Message */}
          {submitSuccess && (
            <div className={`mb-6 p-4 rounded-lg ${
              isStarkMode 
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400'
                : 'bg-green-50 border-2 border-green-200 text-green-600'
            }`}>
              Lead created successfully!
            </div>
          )}

          {/* Info Message about Google Maps */}
          <div className={`mb-6 p-4 rounded-lg ${
            isStarkMode 
              ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300'
              : 'bg-blue-50 border-2 border-blue-200 text-blue-700'
          }`}>
            <p className="text-sm">
              💡 <strong>Tip:</strong> Paste a Google Maps link in the Business Address field to automatically fill in business name, phone, and email!
            </p>
          </div>

          {/* Lead Creation Form */}
          <form onSubmit={handleSubmit} className={`rounded-xl p-8 lg:p-12 shadow-2xl ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60 shadow-gray-900/20'
          }`}>
            <div className="space-y-6">
              {/* Business Address - Google Maps Link (First Field) */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Business Address (Google Maps Link) *
                  <span className={`ml-2 text-xs font-normal ${isStarkMode ? 'text-cyan-400' : 'text-gray-500'}`}>
                    Paste a Google Maps link to auto-fill
                  </span>
                </label>
                {isLoadingPlace && (
                  <div className={`mb-2 text-sm ${isStarkMode ? 'text-cyan-400' : 'text-gray-600'}`}>
                    🔄 Fetching business details...
                  </div>
                )}
                {placeError && (
                  <div className={`mb-2 p-2 rounded text-sm ${
                    isStarkMode 
                      ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                      : 'bg-red-50 border-2 border-red-200 text-red-600'
                  }`}>
                    {placeError}
                  </div>
                )}
                <input
                  type="url"
                  required
                  value={additionalFields.businessAddress}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  disabled={isLoadingPlace}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                      : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  placeholder="https://maps.google.com/..."
                />
              </div>

              {/* Required Fields */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Business Phone *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.businessPhone}
                  onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                      : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                      : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  placeholder="Acme Corporation"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Business Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.businessEmail}
                  onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                      : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  placeholder="contact@business.com"
                />
              </div>

              {/* Additional Fields Section */}
              <div className="pt-6 border-t-2 border-dashed" style={{
                borderColor: isStarkMode ? 'rgba(6, 182, 212, 0.2)' : 'rgba(0, 0, 0, 0.1)'
              }}>
                <p className={`text-sm font-medium mb-4 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Additional Information (Optional)
                </p>
                <div className="space-y-4">
                  {/* Owner First Name */}
                  {!showOwnerName ? (
                    <button
                      type="button"
                      onClick={() => setShowOwnerName(true)}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed transition-all hover:scale-[1.02] ${
                        isStarkMode
                          ? 'border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400'
                          : 'border-gray-300/60 hover:border-gray-400/80 text-gray-600'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Owner's First Name</span>
                    </button>
                  ) : (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isStarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Owner's First Name
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={additionalFields.ownerFirstName}
                          onChange={(e) => setAdditionalFields({ ...additionalFields, ownerFirstName: e.target.value })}
                          className={`flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                            isStarkMode
                              ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                              : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                          }`}
                          placeholder="John"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowOwnerName(false);
                            setAdditionalFields({ ...additionalFields, ownerFirstName: '' });
                          }}
                          className={`px-4 py-3 rounded-lg transition-all ${
                            isStarkMode
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Owner Phone */}
                  {!showOwnerPhone ? (
                    <button
                      type="button"
                      onClick={() => setShowOwnerPhone(true)}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed transition-all hover:scale-[1.02] ${
                        isStarkMode
                          ? 'border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400'
                          : 'border-gray-300/60 hover:border-gray-400/80 text-gray-600'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Owner's Phone</span>
                    </button>
                  ) : (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isStarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Owner's Phone
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="tel"
                          value={additionalFields.ownerPhone}
                          onChange={(e) => setAdditionalFields({ ...additionalFields, ownerPhone: e.target.value })}
                          className={`flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                            isStarkMode
                              ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                              : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                          }`}
                          placeholder="(555) 123-4567"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowOwnerPhone(false);
                            setAdditionalFields({ ...additionalFields, ownerPhone: '' });
                          }}
                          className={`px-4 py-3 rounded-lg transition-all ${
                            isStarkMode
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Has Logo Rating */}
                  {!showLogoRating ? (
                    <button
                      type="button"
                      onClick={() => setShowLogoRating(true)}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed transition-all hover:scale-[1.02] ${
                        isStarkMode
                          ? 'border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400'
                          : 'border-gray-300/60 hover:border-gray-400/80 text-gray-600'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Logo Rating (1-5)</span>
                    </button>
                  ) : (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isStarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Has a logo? (1-5)
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={additionalFields.hasLogo}
                          onChange={(e) => setAdditionalFields({ ...additionalFields, hasLogo: parseInt(e.target.value) })}
                          className={`flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                            isStarkMode
                              ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                              : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                          }`}
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                          <option value={5}>5</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setShowLogoRating(false);
                            setAdditionalFields({ ...additionalFields, hasLogo: 1 });
                          }}
                          className={`px-4 py-3 rounded-lg transition-all ${
                            isStarkMode
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Has Good Photos Rating */}
                  {!showPhotosRating ? (
                    <button
                      type="button"
                      onClick={() => setShowPhotosRating(true)}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed transition-all hover:scale-[1.02] ${
                        isStarkMode
                          ? 'border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400'
                          : 'border-gray-300/60 hover:border-gray-400/80 text-gray-600'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Photos Rating (1-5)</span>
                    </button>
                  ) : (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isStarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Has good photos? (1-5)
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={additionalFields.hasGoodPhotos}
                          onChange={(e) => setAdditionalFields({ ...additionalFields, hasGoodPhotos: parseInt(e.target.value) })}
                          className={`flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                            isStarkMode
                              ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                              : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                          }`}
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                          <option value={5}>5</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPhotosRating(false);
                            setAdditionalFields({ ...additionalFields, hasGoodPhotos: 1 });
                          }}
                          className={`px-4 py-3 rounded-lg transition-all ${
                            isStarkMode
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom Notes */}
                  {!showNotes ? (
                    <button
                      type="button"
                      onClick={() => setShowNotes(true)}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed transition-all hover:scale-[1.02] ${
                        isStarkMode
                          ? 'border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400'
                          : 'border-gray-300/60 hover:border-gray-400/80 text-gray-600'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Custom Notes</span>
                    </button>
                  ) : (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isStarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Custom Notes
                      </label>
                      <div className="flex gap-2">
                        <textarea
                          value={additionalFields.customNotes}
                          onChange={(e) => setAdditionalFields({ ...additionalFields, customNotes: e.target.value })}
                          rows={4}
                          className={`flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all resize-none ${
                            isStarkMode
                              ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                              : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                          }`}
                          placeholder="Add any additional notes about this lead..."
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowNotes(false);
                            setAdditionalFields({ ...additionalFields, customNotes: '' });
                          }}
                          className={`px-4 py-3 rounded-lg transition-all ${
                            isStarkMode
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full px-8 py-4 rounded-full text-lg font-bold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed ${
                    isStarkMode
                      ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                      : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                  }`}
                >
                  {isSubmitting ? 'Creating Lead...' : 'Create Lead'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Theme Toggle */}
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

