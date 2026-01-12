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
    listingLink: '', // Google Maps link (required)
    businessPhone: '',
    businessName: '',
    businessEmail: '',
    businessAddress: '',
  });

  // Additional fields state
  const [showOwnerName, setShowOwnerName] = useState(false);
  const [showOwnerPhone, setShowOwnerPhone] = useState(false);
  const [showLogoRating, setShowLogoRating] = useState(false);
  const [showPhotosRating, setShowPhotosRating] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [additionalFields, setAdditionalFields] = useState({
    ownerFirstName: '',
    ownerPhone: '',
    hasLogo: 1,
    hasGoodPhotos: 1,
    customNotes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  // Auto-fill disabled - manual entry only
  // const [isLoadingPlace, setIsLoadingPlace] = useState(false);
  // const [placeError, setPlaceError] = useState('');
  // const [lastFetchedUrl, setLastFetchedUrl] = useState('');
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');

  // Available fields to add
  const availableFields = [
    { id: 'ownerFirstName', label: "Owner's First Name", type: 'text', placeholder: 'John' },
    { id: 'ownerPhone', label: "Owner's Phone", type: 'tel', placeholder: '(555) 123-4567' },
    { id: 'hasLogo', label: 'Has a logo? (1-5)', type: 'select', options: [1, 2, 3, 4, 5] },
    { id: 'hasGoodPhotos', label: 'Has good photos? (1-5)', type: 'select', options: [1, 2, 3, 4, 5] },
    { id: 'customNotes', label: 'Custom Notes', type: 'textarea', placeholder: 'Add any additional notes...' },
  ];

  // Filter available fields based on search and what's already shown
  const filteredFields = availableFields.filter(field => {
    const matchesSearch = field.label.toLowerCase().includes(fieldSearchQuery.toLowerCase());
    const isAlreadyAdded = 
      (field.id === 'ownerFirstName' && showOwnerName) ||
      (field.id === 'ownerPhone' && showOwnerPhone) ||
      (field.id === 'hasLogo' && showLogoRating) ||
      (field.id === 'hasGoodPhotos' && showPhotosRating) ||
      (field.id === 'customNotes' && showNotes);
    return matchesSearch && !isAlreadyAdded;
  });

  const handleAddField = (fieldId: string) => {
    switch (fieldId) {
      case 'ownerFirstName':
        setShowOwnerName(true);
        break;
      case 'ownerPhone':
        setShowOwnerPhone(true);
        break;
      case 'hasLogo':
        setShowLogoRating(true);
        break;
      case 'hasGoodPhotos':
        setShowPhotosRating(true);
        break;
      case 'customNotes':
        setShowNotes(true);
        break;
    }
    setShowAddFieldModal(false);
    setFieldSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);

    // Create lead object
    const newLead: Lead = {
      id: Date.now().toString(),
      listingLink: formData.listingLink,
      businessPhone: formData.businessPhone || undefined,
      businessName: formData.businessName || undefined,
      businessEmail: formData.businessEmail || undefined,
      businessAddress: formData.businessAddress || undefined,
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
      listingLink: '',
      businessPhone: '',
      businessName: '',
      businessEmail: '',
      businessAddress: '',
    });
    setAdditionalFields({
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

  // Auto-fill functionality disabled - manual entry only
  // Check if URL is a Google Maps link (including short links)
  // const isGoogleMapsUrl = (url: string): boolean => {
  //   return /google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl|goo\.gl\/maps/.test(url);
  // };

  // Fetch place details from Google Maps URL - DISABLED
  // const fetchPlaceDetails = async (url: string) => {
  //   // Auto-fill code removed - manual entry only
  // };

  // Handle listing link field change - manual entry only
  const handleListingLinkChange = (value: string) => {
    setFormData({ ...formData, listingLink: value });
    // Auto-fill disabled - no API calls
  };

  // Handle paste events - manual entry only
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Auto-fill disabled - just allow normal paste behavior
    // The onChange handler will update the field value
  };

  return (
    <main className={`min-h-screen transition-colors duration-300 ${isStarkMode ? 'bg-red-900 text-white' : 'bg-red-50 text-black'}`}>
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
            <div className="flex items-center gap-3">
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

      {/* Dashboard Content */}
      <section className={`pt-32 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
        isStarkMode 
          ? 'bg-gradient-to-b from-red-900 via-red-800 to-red-900' 
          : 'bg-gradient-to-b from-red-50 via-red-100/50 to-red-50'
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
              💡 <strong>Tip:</strong> Paste a Google Maps link in the Listing Link field to automatically fill in business phone, name, email, and address!
            </p>
          </div>

          {/* Lead Creation Form */}
          <form onSubmit={handleSubmit} className={`rounded-xl p-8 lg:p-12 shadow-2xl ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60 shadow-gray-900/20'
          }`}>
            <div className="space-y-6">
              {/* Listing Link - Google Maps Link (First Field - Required) */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Listing Link *
                  <span className={`ml-2 text-xs font-normal ${isStarkMode ? 'text-cyan-400' : 'text-gray-500'}`}>
                    Enter the Google Maps listing link
                  </span>
                </label>
                {/* Auto-fill disabled - loading and error states removed */}
                <input
                  type="url"
                  required
                  value={formData.listingLink}
                  onChange={(e) => handleListingLinkChange(e.target.value)}
                  onPaste={handlePaste}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                      : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  placeholder="https://maps.google.com/..."
                />
              </div>

              {/* Business Phone */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Business Phone
                </label>
                <input
                  type="tel"
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

              {/* Business Name */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Business Name
                </label>
                <input
                  type="text"
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

              {/* Business Email */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Business Email
                </label>
                <input
                  type="email"
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

              {/* Business Address */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${
                  isStarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Business Address
                </label>
                <input
                  type="text"
                  value={formData.businessAddress}
                  onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                      : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  placeholder="123 Main St, City, State 12345"
                />
              </div>

              {/* Additional Fields Section */}
              <div className="pt-6 border-t-2 border-dashed" style={{
                borderColor: isStarkMode ? 'rgba(6, 182, 212, 0.2)' : 'rgba(0, 0, 0, 0.1)'
              }}>
                <div className="flex items-center justify-between mb-4">
                  <p className={`text-sm font-medium ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Additional Information (Optional)
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddFieldModal(true)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 ${
                      isStarkMode
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30'
                        : 'bg-gray-100 border border-gray-300/60 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    + Add Field
                  </button>
                </div>
                <div className="space-y-4">
                  {/* Owner First Name */}
                  {showOwnerName && (
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
                  {showOwnerPhone && (
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
                  {showLogoRating && (
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
                  {showPhotosRating && (
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
                  {showNotes && (
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
                <div className="flex items-center justify-between mb-8">
                  <h2 className={`text-3xl sm:text-4xl font-black tracking-tight ${
                    isStarkMode 
                      ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                      : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
                  }`}>
                    All Leads ({leads.length})
                  </h2>
                  <button
                    onClick={() => setShowLeadsList(false)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                      isStarkMode
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Close
                  </button>
                </div>

                {leads.length === 0 ? (
                  <div className={`text-center py-12 ${
                    isStarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <p className="text-lg">No leads created yet.</p>
                    <p className="text-sm mt-2">Create your first lead using the form above.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {leads.map((lead) => (
                      <div
                        key={lead.id}
                        className={`p-6 rounded-lg border transition-all hover:shadow-lg ${
                          isStarkMode
                            ? 'bg-gray-900/50 border-cyan-500/20 hover:border-cyan-500/40'
                            : 'bg-gray-50 border-gray-300/60 hover:border-gray-400/80'
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
            </div>
          )}
        </div>
      </section>

      {/* Floating Leads Button - Bottom Right */}
      <Link
        href="/developer/leads"
        className={`fixed bottom-6 right-6 z-50 px-6 py-3 rounded-full text-sm font-bold transition-all duration-200 hover:scale-110 shadow-2xl ${
          isStarkMode
            ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/50'
            : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/20'
        }`}
        aria-label="View leads"
      >
        Leads
      </Link>

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

      {/* Add Field Modal */}
      {showAddFieldModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setShowAddFieldModal(false);
            setFieldSearchQuery('');
          }}
        >
          <div 
            className={`rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden transition-colors duration-300 ${
              isStarkMode 
                ? 'bg-gray-800 border border-cyan-500/20' 
                : 'bg-white border-2 border-gray-300/60 shadow-gray-900/20'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-2xl font-black tracking-tight ${
                  isStarkMode 
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                    : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
                }`}>
                  Add Field
                </h3>
                <button
                  onClick={() => {
                    setShowAddFieldModal(false);
                    setFieldSearchQuery('');
                  }}
                  className={`transition-colors ${
                    isStarkMode 
                      ? 'text-gray-400 hover:text-cyan-400' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search Box */}
              <div className="mb-4">
                <input
                  type="text"
                  value={fieldSearchQuery}
                  onChange={(e) => setFieldSearchQuery(e.target.value)}
                  placeholder="Search fields..."
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                      : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  autoFocus
                />
              </div>

              {/* Field List */}
              <div className="max-h-[50vh] overflow-y-auto space-y-2">
                {filteredFields.length > 0 ? (
                  filteredFields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => handleAddField(field.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all hover:scale-[1.02] ${
                        isStarkMode
                          ? 'bg-gray-700/50 hover:bg-gray-700 border border-cyan-500/20 hover:border-cyan-500/40 text-white'
                          : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-900'
                      }`}
                    >
                      <div className="font-medium">{field.label}</div>
                    </button>
                  ))
                ) : (
                  <div className={`text-center py-8 ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {fieldSearchQuery ? 'No fields found matching your search' : 'All fields have been added'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

