'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Client {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

interface ClientFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  url: string;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]); // Store all clients for filtering
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editedAccountInfo, setEditedAccountInfo] = useState({
    fullName: '',
    phone: '',
    businessName: '',
    businessAddress: '',
    businessWebsite: '',
  });
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
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

  // Load clients from API
  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await fetch('/api/clients');
        const data = await response.json();
        
        if (data.clients) {
          const formattedClients = data.clients.map((c: any) => ({
            id: c.id.toString(),
            email: c.email,
            fullName: c.full_name,
            phone: c.phone,
            businessName: c.business_name,
            businessAddress: c.business_address,
            businessWebsite: c.business_website,
            createdAt: c.created_at,
          }));
          
          setAllClients(formattedClients);
          setClients(formattedClients);
        }
      } catch (error) {
        console.error('Error loading clients:', error);
      }
    };

    loadClients();
  }, []);

  // Filter clients based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setClients(allClients);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = allClients.filter((client) => {
      const nameMatch = client.fullName.toLowerCase().includes(query);
      const emailMatch = client.email.toLowerCase().includes(query);
      return nameMatch || emailMatch;
    });
    setClients(filtered);
  }, [searchQuery, allClients]);

  // Load files for selected client
  useEffect(() => {
    const loadClientFiles = async () => {
      if (!selectedClient) {
        setClientFiles([]);
        return;
      }

      try {
        const response = await fetch(`/api/clients/files?clientId=${selectedClient.id}`);
        const data = await response.json();
        
        if (data.files) {
          const formattedFiles = data.files.map((file: any) => ({
            id: file.id.toString(),
            name: file.file_name,
            size: parseInt(file.file_size),
            type: file.file_type,
            uploadedAt: file.uploaded_at,
            url: file.blob_url,
          }));
          setClientFiles(formattedFiles);
        } else {
          setClientFiles([]);
        }
      } catch (error) {
        console.error('Error loading client files:', error);
        setClientFiles([]);
      }

      // Load account info for editing
      setEditedAccountInfo({
        fullName: selectedClient.fullName || '',
        phone: (selectedClient as any).phone || '',
        businessName: (selectedClient as any).businessName || '',
        businessAddress: (selectedClient as any).businessAddress || '',
        businessWebsite: (selectedClient as any).businessWebsite || '',
      });
      setIsEditingAccount(false);
    };

    loadClientFiles();
  }, [selectedClient]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('devAuth');
      localStorage.removeItem('devAuthTime');
    }
    router.push('/login/developer');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format phone number: +18137877458 -> +1 (813) 787-7458
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

  // Get clean phone number for tel: link (remove formatting)
  const getCleanPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    // If it doesn't start with +, add +1 for US numbers
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        return `+1${cleaned}`;
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+${cleaned}`;
      }
    }
    return cleaned;
  };

  const isImageFile = (fileType: string) => {
    return fileType.startsWith('image/');
  };

  // Get file extension/type for display
  const getFileType = (fileName: string, fileType: string) => {
    // Try to get extension from filename first
    const extension = fileName.split('.').pop()?.toUpperCase() || '';
    // If no extension, try to extract from MIME type
    if (!extension && fileType) {
      const mimeParts = fileType.split('/');
      if (mimeParts.length > 1) {
        return mimeParts[1].toUpperCase();
      }
      return fileType.toUpperCase();
    }
    return extension || 'FILE';
  };

  const handleDownloadFile = async (file: ClientFile) => {
    try {
      // Fetch the file as a blob
      const response = await fetch(file.url);
      const blob = await response.blob();
      
      // Create a temporary object URL
      const objectUrl = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  // Get only image files for gallery
  const imageFiles = clientFiles.filter(file => isImageFile(file.type));

  const openGallery = (fileId: string) => {
    const imageIndex = imageFiles.findIndex(f => f.id === fileId);
    if (imageIndex !== -1) {
      setGalleryIndex(imageIndex);
      setGalleryOpen(true);
    }
  };

  const closeGallery = () => {
    setGalleryOpen(false);
  };

  const nextImage = () => {
    setGalleryIndex((prev) => (prev + 1) % imageFiles.length);
  };

  const prevImage = () => {
    setGalleryIndex((prev) => (prev - 1 + imageFiles.length) % imageFiles.length);
  };

  const handleStartRename = (file: ClientFile) => {
    setEditingFileId(file.id);
    setEditingFileName(file.name);
  };

  const handleSaveRename = async (fileId: string) => {
    if (!editingFileName.trim() || !selectedClient) {
      alert('File name cannot be empty');
      return;
    }

    try {
      const response = await fetch('/api/clients/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, clientId: selectedClient.id, newName: editingFileName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Rename failed');
      }

      // Update local state
      const updatedFiles = clientFiles.map(f => 
        f.id === fileId ? { ...f, name: editingFileName.trim() } : f
      );
      setClientFiles(updatedFiles);
      setEditingFileId(null);
      setEditingFileName('');
    } catch (error: any) {
      console.error('Error renaming file:', error);
      alert(error.message || 'Error renaming file. Please try again.');
    }
  };

  const handleCancelRename = () => {
    setEditingFileId(null);
    setEditingFileName('');
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!selectedClient || !confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch('/api/clients/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, clientId: selectedClient.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed');
      }

      // Update local state
      const updatedFiles = clientFiles.filter(f => f.id !== fileId);
      setClientFiles(updatedFiles);
    } catch (error: any) {
      console.error('Error deleting file:', error);
      alert(error.message || 'Error deleting file. Please try again.');
    }
  };

  // Keyboard navigation for gallery
  useEffect(() => {
    if (!galleryOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        nextImage();
      } else if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'Escape') {
        closeGallery();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryOpen, galleryIndex, imageFiles.length]);

  // Toast notification handler
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
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
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className={`pt-40 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
        isStarkMode 
          ? 'bg-gradient-to-b from-black via-gray-900 to-black' 
          : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-black mb-4 tracking-tight ${
              isStarkMode 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
            }`}>
              Clients
            </h1>
            <p className={`text-xl font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              View and manage client accounts and their files
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Clients List */}
            <div className={`rounded-xl p-6 ${
              isStarkMode 
                ? 'bg-gray-800 border border-cyan-500/20' 
                : 'bg-white border-2 border-gray-300/60'
            }`}>
              <h2 className={`text-2xl font-black mb-4 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                Client Accounts ({clients.length})
              </h2>

              {/* Search Bar */}
              <div className="mb-6">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all ${
                    isStarkMode
                      ? 'bg-gray-900 border-cyan-500/40 text-white placeholder-gray-500 focus:ring-cyan-500/50'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-cyan-500/50'
                  }`}
                />
              </div>

              {clients.length === 0 ? (
                <div className={`text-center py-12 ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <div className="text-6xl mb-4">👤</div>
                  <p className="text-lg">No client accounts yet</p>
                  <p className="text-sm mt-2">Clients will appear here after they create accounts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={`w-full p-4 rounded-lg border text-left transition-all hover:scale-[1.02] ${
                        selectedClient?.id === client.id
                          ? isStarkMode
                            ? 'bg-cyan-500/20 border-cyan-500/40'
                            : 'bg-cyan-50 border-cyan-500/40'
                          : isStarkMode
                            ? 'bg-gray-900 border-cyan-500/20 hover:border-cyan-500/40'
                            : 'bg-gray-50 border-gray-300/60 hover:border-gray-400/80'
                      }`}
                    >
                      <h3 className={`font-bold text-lg mb-1 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {client.fullName}
                      </h3>
                      <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {client.email}
                      </p>
                      <p className={`text-xs mt-1 ${isStarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        Joined: {new Date(client.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Client Files View */}
            <div className={`rounded-xl p-6 ${
              isStarkMode 
                ? 'bg-gray-800 border border-cyan-500/20' 
                : 'bg-white border-2 border-gray-300/60'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-black ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {selectedClient ? `${selectedClient.fullName}'s Files` : 'Select a Client'}
                </h2>
                {selectedClient && (
                  <button
                    onClick={() => setShowAccountInfo(!showAccountInfo)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                      isStarkMode
                        ? showAccountInfo
                          ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                          : 'bg-gray-700 text-white hover:bg-gray-600 border border-cyan-500/20'
                        : showAccountInfo
                          ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                          : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border border-gray-300/60'
                    }`}
                  >
                    {showAccountInfo ? 'Hide Info' : 'View Account Info'}
                  </button>
                )}
              </div>

              {/* Account Information Section */}
              {selectedClient && showAccountInfo && (
                <div className={`mb-6 p-6 rounded-lg border ${
                  isStarkMode
                    ? 'bg-gray-900 border-cyan-500/30'
                    : 'bg-gray-50 border-gray-300/60'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xl font-black ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Account Information
                    </h3>
                    {!isEditingAccount && (
                      <button
                        onClick={() => setIsEditingAccount(true)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                          isStarkMode
                            ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                            : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                        }`}
                      >
                        Edit Info
                      </button>
                    )}
                  </div>

                  {isEditingAccount ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!selectedClient) return;

                        try {
                          const response = await fetch('/api/clients', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              email: selectedClient.email,
                              fullName: editedAccountInfo.fullName,
                              phone: editedAccountInfo.phone,
                              businessName: editedAccountInfo.businessName,
                              businessAddress: editedAccountInfo.businessAddress,
                              businessWebsite: editedAccountInfo.businessWebsite,
                            }),
                          });

                          const data = await response.json();

                          if (!response.ok) {
                            throw new Error(data.error || 'Update failed');
                          }

                          // Update the selected client and all clients lists
                          const updatedClient = {
                            ...selectedClient,
                            fullName: editedAccountInfo.fullName,
                            phone: editedAccountInfo.phone,
                            businessName: editedAccountInfo.businessName,
                            businessAddress: editedAccountInfo.businessAddress,
                            businessWebsite: editedAccountInfo.businessWebsite,
                          };
                          
                          setSelectedClient(updatedClient);
                          const updatedAllClients = allClients.map((c: Client) => 
                            c.id === selectedClient.id ? updatedClient : c
                          );
                          setAllClients(updatedAllClients);
                          setClients(updatedAllClients);
                          
                          setIsEditingAccount(false);
                          alert('Account information updated successfully!');
                        } catch (error: any) {
                          console.error('Error updating account:', error);
                          alert(error.message || 'Error updating account. Please try again.');
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`block mb-2 font-medium ${
                            isStarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Full Name *
                          </label>
                          <input
                            type="text"
                            value={editedAccountInfo.fullName}
                            onChange={(e) => setEditedAccountInfo({ ...editedAccountInfo, fullName: e.target.value })}
                            required
                            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                              isStarkMode
                                ? 'bg-gray-800 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                                : 'bg-white border-gray-300 text-gray-900 focus:ring-cyan-500/50'
                            }`}
                          />
                        </div>

                        <div>
                          <label className={`block mb-2 font-medium ${
                            isStarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Email
                          </label>
                          <input
                            type="email"
                            value={selectedClient.email}
                            disabled
                            className={`w-full px-4 py-2 rounded-lg border ${
                              isStarkMode
                                ? 'bg-gray-800/50 border-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          />
                          <p className={`text-xs mt-1 ${isStarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Email cannot be changed
                          </p>
                        </div>

                        <div>
                          <label className={`block mb-2 font-medium ${
                            isStarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={editedAccountInfo.phone}
                            onChange={(e) => setEditedAccountInfo({ ...editedAccountInfo, phone: e.target.value })}
                            placeholder="+1 (555) 123-4567"
                            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                              isStarkMode
                                ? 'bg-gray-800 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                                : 'bg-white border-gray-300 text-gray-900 focus:ring-cyan-500/50'
                            }`}
                          />
                        </div>

                        <div>
                          <label className={`block mb-2 font-medium ${
                            isStarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Business Name
                          </label>
                          <input
                            type="text"
                            value={editedAccountInfo.businessName}
                            onChange={(e) => setEditedAccountInfo({ ...editedAccountInfo, businessName: e.target.value })}
                            placeholder="Business Name"
                            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                              isStarkMode
                                ? 'bg-gray-800 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                                : 'bg-white border-gray-300 text-gray-900 focus:ring-cyan-500/50'
                            }`}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className={`block mb-2 font-medium ${
                            isStarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Business Address
                          </label>
                          <input
                            type="text"
                            value={editedAccountInfo.businessAddress}
                            onChange={(e) => setEditedAccountInfo({ ...editedAccountInfo, businessAddress: e.target.value })}
                            placeholder="123 Main St, City, State ZIP"
                            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                              isStarkMode
                                ? 'bg-gray-800 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                                : 'bg-white border-gray-300 text-gray-900 focus:ring-cyan-500/50'
                            }`}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className={`block mb-2 font-medium ${
                            isStarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Business Website
                          </label>
                          <input
                            type="url"
                            value={editedAccountInfo.businessWebsite}
                            onChange={(e) => setEditedAccountInfo({ ...editedAccountInfo, businessWebsite: e.target.value })}
                            placeholder="https://www.example.com"
                            className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                              isStarkMode
                                ? 'bg-gray-800 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                                : 'bg-white border-gray-300 text-gray-900 focus:ring-cyan-500/50'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4">
                        <button
                          type="submit"
                          className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                            isStarkMode
                              ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                              : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                          }`}
                        >
                          Save Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingAccount(false);
                            // Reset to original values
                            if (selectedClient) {
                              setEditedAccountInfo({
                                fullName: selectedClient.fullName || '',
                                phone: (selectedClient as any).phone || '',
                                businessName: (selectedClient as any).businessName || '',
                                businessAddress: (selectedClient as any).businessAddress || '',
                                businessWebsite: (selectedClient as any).businessWebsite || '',
                              });
                            }
                          }}
                          className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                            isStarkMode
                              ? 'bg-gray-700 text-white hover:bg-gray-600 border border-gray-600'
                              : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`font-medium block mb-1 ${
                            isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                          }`}>
                            Full Name:
                          </span>
                          <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                            {selectedClient.fullName || 'Not provided'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            const text = selectedClient.fullName || 'Not provided';
                            navigator.clipboard.writeText(text);
                            showToast('Copied to clipboard');
                          }}
                          className={`ml-4 px-2 py-1 rounded text-xs font-medium transition-all ${
                            isStarkMode
                              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                              : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border border-gray-300'
                          }`}
                          title="Copy"
                        >
                          📋
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`font-medium block mb-1 ${
                            isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                          }`}>
                            Email:
                          </span>
                          <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                            {selectedClient.email}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedClient.email);
                            showToast('Copied to clipboard');
                          }}
                          className={`ml-4 px-2 py-1 rounded text-xs font-medium transition-all ${
                            isStarkMode
                              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                              : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border border-gray-300'
                          }`}
                          title="Copy"
                        >
                          📋
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`font-medium block mb-1 ${
                            isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                          }`}>
                            Phone Number:
                          </span>
                          {(selectedClient as any).phone ? (
                            <a
                              href={`tel:${getCleanPhoneNumber((selectedClient as any).phone)}`}
                              className={`underline hover:opacity-80 ${
                                isStarkMode ? 'text-cyan-300' : 'text-blue-600'
                              }`}
                            >
                              {formatPhoneNumber((selectedClient as any).phone)}
                            </a>
                          ) : (
                            <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                              Not provided
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const text = (selectedClient as any).phone 
                              ? formatPhoneNumber((selectedClient as any).phone)
                              : 'Not provided';
                            navigator.clipboard.writeText(text);
                            showToast('Copied to clipboard');
                          }}
                          className={`ml-4 px-2 py-1 rounded text-xs font-medium transition-all ${
                            isStarkMode
                              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                              : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border border-gray-300'
                          }`}
                          title="Copy"
                        >
                          📋
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`font-medium block mb-1 ${
                            isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                          }`}>
                            Business Name:
                          </span>
                          <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                            {(selectedClient as any).businessName || 'Not provided'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            const text = (selectedClient as any).businessName || 'Not provided';
                            navigator.clipboard.writeText(text);
                            showToast('Copied to clipboard');
                          }}
                          className={`ml-4 px-2 py-1 rounded text-xs font-medium transition-all ${
                            isStarkMode
                              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                              : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border border-gray-300'
                          }`}
                          title="Copy"
                        >
                          📋
                        </button>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between">
                        <div>
                          <span className={`font-medium block mb-1 ${
                            isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                          }`}>
                            Business Address:
                          </span>
                          <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                            {(selectedClient as any).businessAddress || 'Not provided'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            const text = (selectedClient as any).businessAddress || 'Not provided';
                            navigator.clipboard.writeText(text);
                            showToast('Copied to clipboard');
                          }}
                          className={`ml-4 px-2 py-1 rounded text-xs font-medium transition-all ${
                            isStarkMode
                              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                              : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border border-gray-300'
                          }`}
                          title="Copy"
                        >
                          📋
                        </button>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between">
                        <div>
                          <span className={`font-medium block mb-1 ${
                            isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                          }`}>
                            Business Website:
                          </span>
                          {(selectedClient as any).businessWebsite ? (
                            <a
                              href={(selectedClient as any).businessWebsite}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`underline hover:opacity-80 ${
                                isStarkMode ? 'text-cyan-300' : 'text-blue-600'
                              }`}
                            >
                              {(selectedClient as any).businessWebsite}
                            </a>
                          ) : (
                            <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                              Not provided
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            const text = (selectedClient as any).businessWebsite || 'Not provided';
                            navigator.clipboard.writeText(text);
                            showToast('Copied to clipboard');
                          }}
                          className={`ml-4 px-2 py-1 rounded text-xs font-medium transition-all ${
                            isStarkMode
                              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                              : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border border-gray-300'
                          }`}
                          title="Copy"
                        >
                          📋
                        </button>
                      </div>
                      <div>
                        <span className={`font-medium block mb-1 ${
                          isStarkMode ? 'text-cyan-400' : 'text-gray-700'
                        }`}>
                          Account Created:
                        </span>
                        <span className={isStarkMode ? 'text-gray-300' : 'text-gray-900'}>
                          {new Date(selectedClient.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!selectedClient ? (
                <div className={`text-center py-12 ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <div className="text-6xl mb-4">📁</div>
                  <p className="text-lg">Select a client to view their files</p>
                </div>
              ) : clientFiles.length === 0 ? (
                <div className={`text-center py-12 ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-lg">No files uploaded</p>
                  <p className="text-sm mt-2">This client hasn't uploaded any files yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {clientFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`rounded-lg border transition-all hover:scale-[1.02] overflow-hidden ${
                        isStarkMode
                          ? 'bg-gray-900 border-cyan-500/20 hover:border-cyan-500/40'
                          : 'bg-gray-50 border-gray-300/60 hover:border-gray-400/80'
                      }`}
                    >
                      {/* File Preview */}
                      <div 
                        className={`aspect-square relative bg-gray-800 ${
                          isImageFile(file.type) ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => {
                          if (isImageFile(file.type)) {
                            openGallery(file.id);
                          }
                        }}
                      >
                        {isImageFile(file.type) ? (
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="text-4xl">📄</div>
                          </div>
                        )}
                        {/* File Type Badge - Bottom Right */}
                        <div className={`absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                          isStarkMode
                            ? 'bg-black/70 text-white backdrop-blur-sm'
                            : 'bg-white/90 text-gray-900 backdrop-blur-sm'
                        }`}>
                          {getFileType(file.name, file.type)}
                        </div>
                      </div>
                      
                      {/* File Info */}
                      <div className="p-2">
                        {editingFileId === file.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingFileName}
                              onChange={(e) => setEditingFileName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(file.id);
                                if (e.key === 'Escape') handleCancelRename();
                              }}
                              autoFocus
                              className={`w-full px-2 py-1 text-xs rounded border-2 focus:outline-none ${
                                isStarkMode
                                  ? 'bg-gray-800 border-cyan-500/40 text-white focus:border-cyan-500'
                                  : 'bg-white border-gray-400 text-gray-900 focus:border-gray-900'
                              }`}
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleSaveRename(file.id)}
                                className={`flex-1 px-2 py-1 text-xs rounded font-medium ${
                                  isStarkMode
                                    ? 'bg-cyan-500 text-black hover:bg-cyan-400'
                                    : 'bg-gray-900 text-white hover:bg-gray-800'
                                }`}
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelRename}
                                className={`px-2 py-1 text-xs rounded font-medium ${
                                  isStarkMode
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 
                              className={`font-medium text-xs truncate mb-1 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}
                              title={file.name}
                            >
                              {file.name}
                            </h3>
                            <p className={`text-xs mb-2 ${isStarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              {formatFileSize(file.size)}
                            </p>
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartRename(file);
                                }}
                                className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                                  isStarkMode
                                    ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border border-gray-300'
                                }`}
                                title="Rename"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFile(file);
                                }}
                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                  isStarkMode
                                    ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300 border border-gray-300'
                                }`}
                                title="Download"
                              >
                                ⬇️
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFile(file.id);
                                }}
                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                  isStarkMode
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                                    : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                }`}
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Modal */}
      {galleryOpen && imageFiles.length > 0 && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
              linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
              linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
            `,
            backgroundSize: '40px 40px',
            backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0px',
            backgroundColor: '#1f1f1f'
          }}
          onClick={closeGallery}
        >
          {/* Close Button */}
          <button
            onClick={closeGallery}
            className={`absolute top-4 right-4 z-10 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isStarkMode
                ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
            }`}
          >
            ✕ Close
          </button>

          {/* Previous Button */}
          {imageFiles.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isStarkMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
              }`}
            >
              ← Previous
            </button>
          )}

          {/* Next Button */}
          {imageFiles.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isStarkMode
                  ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
              }`}
            >
              Next →
            </button>
          )}

          {/* Image Display - Made larger */}
          <div 
            className="w-full h-full flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageFiles[galleryIndex].url}
              alt={imageFiles[galleryIndex].name}
              className="max-w-[98vw] max-h-[98vh] w-auto h-auto object-contain"
            />
          </div>

          {/* Image Counter */}
          {imageFiles.length > 1 && (
            <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium ${
              isStarkMode
                ? 'bg-gray-800 text-white border border-cyan-500/20'
                : 'bg-gray-100 text-gray-900 border border-gray-300/60'
            }`}>
              {galleryIndex + 1} / {imageFiles.length}
            </div>
          )}

          {/* Image Name */}
          <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm ${
            isStarkMode
              ? 'bg-gray-800/80 text-white'
              : 'bg-gray-100/80 text-gray-900'
          }`}>
            {imageFiles[galleryIndex].name}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-x-0 ${
            isStarkMode
              ? 'bg-gray-800 border border-cyan-500/40 text-white'
              : 'bg-white border-2 border-gray-300 text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        </div>
      )}
    </main>
  );
}

