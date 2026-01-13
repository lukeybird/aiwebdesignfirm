'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  url: string; // Base64 or blob URL
}

export default function ClientDashboard() {
  const router = useRouter();
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState('');
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [accountInfo, setAccountInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    businessName: '',
    businessAddress: '',
    businessWebsite: '',
  });
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  
  // Always use dark mode
  const [isStarkMode] = useState(true);

  // Set theme to dark mode in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'stark');
    }
  }, []);

  // Check authentication and load client data
  useEffect(() => {
    const loadClientData = async () => {
      if (typeof window !== 'undefined') {
        const auth = localStorage.getItem('clientAuth');
        const authTime = localStorage.getItem('clientAuthTime');
        const email = localStorage.getItem('clientAuthEmail');
        const clientId = localStorage.getItem('clientId');
        
        // Check if authenticated and session is valid (30 days)
        if (!auth || !authTime || !email || !clientId || Date.now() - parseInt(authTime) > 30 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem('clientAuth');
          localStorage.removeItem('clientAuthEmail');
          localStorage.removeItem('clientAuthTime');
          localStorage.removeItem('clientId');
          router.push('/login/client');
          return;
        }

        setClientEmail(email);

        try {
          // Get client info from API
          const clientsResponse = await fetch('/api/clients');
          const clientsData = await clientsResponse.json();
          const client = clientsData.clients.find((c: any) => c.email === email);
          
          if (client) {
            setClientName(client.full_name);
            // Load account info
            setAccountInfo({
              fullName: client.full_name || '',
              email: client.email || '',
              phone: client.phone || '',
              businessName: client.business_name || '',
              businessAddress: client.business_address || '',
              businessWebsite: client.business_website || '',
            });
          }

          // Load files for this client
          await loadFiles(clientId);
        } catch (error) {
          console.error('Error loading client data:', error);
        }
      }
    };

    loadClientData();
  }, [router]);

  const loadFiles = async (clientId: string) => {
    try {
      const response = await fetch(`/api/clients/files?clientId=${clientId}`);
      const data = await response.json();
      
      if (data.files) {
        const formattedFiles = data.files.map((file: any) => ({
          id: file.id.toString(),
          name: file.file_name,
          size: parseInt(file.file_size),
          type: file.file_type,
          uploadedAt: file.uploaded_at,
          url: file.blob_url, // Use blob URL instead of base64
        }));
        setFiles(formattedFiles);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const clientId = localStorage.getItem('clientId');
    if (!clientId) {
      alert('Please log in again');
      router.push('/login/client');
      return;
    }

    setIsUploading(true);

    try {
      // Upload each file to Vercel Blob via API
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('clientId', clientId);

        const response = await fetch('/api/clients/files', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        // Add to files list
        const uploadedFile: UploadedFile = {
          id: data.file.id.toString(),
          name: data.file.file_name,
          size: parseInt(data.file.file_size),
          type: data.file.file_type,
          uploadedAt: data.file.uploaded_at,
          url: data.file.blob_url,
        };

        setFiles(prev => [...prev, uploadedFile]);
      }
      
      // Reset input
      e.target.value = '';
    } catch (error: any) {
      console.error('Error uploading files:', error);
      alert(error.message || 'Error uploading files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    const clientId = localStorage.getItem('clientId');
    if (!clientId) {
      alert('Please log in again');
      router.push('/login/client');
      return;
    }

    try {
      const response = await fetch('/api/clients/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, clientId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed');
      }

      // Update local state
      const updatedFiles = files.filter(f => f.id !== fileId);
      setFiles(updatedFiles);
    } catch (error: any) {
      console.error('Error deleting file:', error);
      alert(error.message || 'Error deleting file. Please try again.');
    }
  };

  const handleStartRename = (file: UploadedFile) => {
    setEditingFileId(file.id);
    setEditingFileName(file.name);
  };

  const handleSaveRename = async (fileId: string) => {
    if (!editingFileName.trim()) {
      alert('File name cannot be empty');
      return;
    }

    const clientId = localStorage.getItem('clientId');
    if (!clientId) {
      alert('Please log in again');
      router.push('/login/client');
      return;
    }

    try {
      const response = await fetch('/api/clients/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, clientId, newName: editingFileName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Rename failed');
      }

      // Update local state
      const updatedFiles = files.map(f => 
        f.id === fileId ? { ...f, name: editingFileName.trim() } : f
      );
      setFiles(updatedFiles);
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

  const isImageFile = (fileType: string) => {
    return fileType.startsWith('image/');
  };

  const handleDownloadFile = (file: UploadedFile) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('clientAuth');
      localStorage.removeItem('clientAuthEmail');
      localStorage.removeItem('clientAuthTime');
    }
    router.push('/login/client');
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
            <div className="flex items-center gap-4">
              <div className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {clientName || clientEmail}
              </div>
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
          ? 'bg-gradient-to-b from-black via-gray-900 to-black' 
          : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
      }`}>
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-black mb-4 tracking-tight ${
                  isStarkMode 
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                    : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
                }`}>
                  Welcome, {clientName || 'Client'}
                </h1>
                <p className={`text-xl font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Manage your project files and assets
                </p>
              </div>
              <button
                onClick={() => setShowAccountSettings(!showAccountSettings)}
                className={`px-6 py-3 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                  isStarkMode
                    ? showAccountSettings
                      ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                      : 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                    : showAccountSettings
                      ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
                }`}
              >
                {showAccountSettings ? 'Hide Settings' : 'Account Settings'}
              </button>
            </div>
          </div>

          {/* Account Settings Section */}
          {showAccountSettings && (
            <div className={`mb-8 rounded-xl p-8 ${
              isStarkMode 
                ? 'bg-gray-800 border border-cyan-500/20' 
                : 'bg-white border-2 border-gray-300/60'
            }`}>
              <h2 className={`text-2xl font-black mb-6 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                Account Information
              </h2>
              
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSavingAccount(true);
                  
                  try {
                    const response = await fetch('/api/clients', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: clientEmail,
                        fullName: accountInfo.fullName,
                        phone: accountInfo.phone,
                        businessName: accountInfo.businessName,
                        businessAddress: accountInfo.businessAddress,
                        businessWebsite: accountInfo.businessWebsite,
                      }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                      throw new Error(data.error || 'Update failed');
                    }

                    setClientName(accountInfo.fullName);
                    setIsSavingAccount(false);
                    alert('Account information updated successfully!');
                  } catch (error: any) {
                    console.error('Error updating account:', error);
                    alert(error.message || 'Error updating account. Please try again.');
                    setIsSavingAccount(false);
                  }
                }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block mb-2 font-medium ${
                      isStarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={accountInfo.fullName}
                      onChange={(e) => setAccountInfo({ ...accountInfo, fullName: e.target.value })}
                      required
                      className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                        isStarkMode
                          ? 'bg-gray-900 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                          : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-cyan-500/50'
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
                      value={accountInfo.email}
                      disabled
                      className={`w-full px-4 py-2 rounded-lg border ${
                        isStarkMode
                          ? 'bg-gray-900/50 border-gray-700 text-gray-500 cursor-not-allowed'
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
                      value={accountInfo.phone}
                      onChange={(e) => setAccountInfo({ ...accountInfo, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                        isStarkMode
                          ? 'bg-gray-900 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                          : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-cyan-500/50'
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
                      value={accountInfo.businessName}
                      onChange={(e) => setAccountInfo({ ...accountInfo, businessName: e.target.value })}
                      placeholder="Your Business Name"
                      className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                        isStarkMode
                          ? 'bg-gray-900 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                          : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-cyan-500/50'
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
                      value={accountInfo.businessAddress}
                      onChange={(e) => setAccountInfo({ ...accountInfo, businessAddress: e.target.value })}
                      placeholder="123 Main St, City, State ZIP"
                      className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                        isStarkMode
                          ? 'bg-gray-900 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                          : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-cyan-500/50'
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
                      value={accountInfo.businessWebsite}
                      onChange={(e) => setAccountInfo({ ...accountInfo, businessWebsite: e.target.value })}
                      placeholder="https://www.example.com"
                      className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                        isStarkMode
                          ? 'bg-gray-900 border-cyan-500/40 text-white focus:ring-cyan-500/50'
                          : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-cyan-500/50'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isSavingAccount}
                    className={`px-6 py-3 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                      isStarkMode
                        ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                        : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                      } ${isSavingAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSavingAccount ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAccountSettings(false)}
                    className={`px-6 py-3 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                      isStarkMode
                        ? 'bg-gray-700 text-white hover:bg-gray-600 border border-gray-600'
                        : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* File Upload Section */}
          <div className={`mb-8 rounded-xl p-8 ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60'
          }`}>
            <h2 className={`text-2xl font-black mb-4 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
              Upload Files
            </h2>
            <div className="flex items-center gap-4">
              <label
                className={`px-6 py-3 rounded-full font-bold transition-all duration-200 hover:scale-105 cursor-pointer ${
                  isStarkMode
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUploading ? 'Uploading...' : 'Choose Files'}
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Select one or multiple files to upload
              </p>
            </div>
          </div>

          {/* Files List */}
          <div className={`rounded-xl p-8 ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60'
          }`}>
            <h2 className={`text-2xl font-black mb-6 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
              Your Files ({files.length})
            </h2>

            {files.length === 0 ? (
              <div className={`text-center py-12 ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <div className="text-6xl mb-4">📁</div>
                <p className="text-lg">No files uploaded yet</p>
                <p className="text-sm mt-2">Upload files to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={`rounded-lg border transition-all hover:scale-[1.02] overflow-hidden ${
                      isStarkMode
                        ? 'bg-gray-900 border-cyan-500/20 hover:border-cyan-500/40'
                        : 'bg-gray-50 border-gray-300/60 hover:border-gray-400/80'
                    }`}
                  >
                    {/* Image Preview or File Icon */}
                    <div 
                      className="aspect-square relative bg-gray-800 cursor-pointer"
                      onClick={() => handleDownloadFile(file)}
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
                      
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
                        <div className={`px-3 py-1 rounded text-xs font-medium ${
                          isStarkMode ? 'bg-cyan-500 text-black' : 'bg-white text-gray-900'
                        }`}>
                          {isImageFile(file.type) ? 'Click to Download' : 'Click to View'}
                        </div>
                      </div>
                    </div>
                    
                    {/* File Name and Actions */}
                    <div className="p-3">
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
                              onClick={() => handleStartRename(file)}
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
                              onClick={() => handleDownloadFile(file)}
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
                              onClick={() => handleDeleteFile(file.id)}
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
      </section>
    </main>
  );
}

