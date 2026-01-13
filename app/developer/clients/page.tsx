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
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);
  
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

  // Load clients from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedClients = localStorage.getItem('clients');
      if (storedClients) {
        try {
          const parsedClients = JSON.parse(storedClients);
          // Sort by creation date, newest first
          parsedClients.sort((a: Client, b: Client) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setClients(parsedClients);
        } catch (error) {
          console.error('Error parsing clients:', error);
        }
      }
    }
  }, []);

  // Load files for selected client
  useEffect(() => {
    if (selectedClient && typeof window !== 'undefined') {
      const files = localStorage.getItem(`clientFiles_${selectedClient.email}`);
      if (files) {
        try {
          setClientFiles(JSON.parse(files));
        } catch (error) {
          console.error('Error parsing client files:', error);
          setClientFiles([]);
        }
      } else {
        setClientFiles([]);
      }
    }
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

  const isImageFile = (fileType: string) => {
    return fileType.startsWith('image/');
  };

  const handleDownloadFile = (file: ClientFile) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                }`}
              >
                Clients
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className={`pt-32 pb-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
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
              <h2 className={`text-2xl font-black mb-6 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                Client Accounts ({clients.length})
              </h2>

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
              <h2 className={`text-2xl font-black mb-6 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                {selectedClient ? `${selectedClient.fullName}'s Files` : 'Select a Client'}
              </h2>

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
                            View
                          </div>
                        </div>
                      </div>
                      
                      {/* File Info */}
                      <div className="p-2">
                        <h3 
                          className={`font-medium text-xs truncate mb-1 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}
                          title={file.name}
                        >
                          {file.name}
                        </h3>
                        <p className={`text-xs ${isStarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

