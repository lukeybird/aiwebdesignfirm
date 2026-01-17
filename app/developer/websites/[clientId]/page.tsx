'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Client {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  business_name?: string;
  business_address?: string;
  website_notes?: string;
}

interface ClientFile {
  blob_url: string;
  file_name: string;
  file_type: string;
}

export default function BuildWebsitePage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.clientId as string;

  const [client, setClient] = useState<Client | null>(null);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWebsite, setGeneratedWebsite] = useState<any>(null);
  const [error, setError] = useState('');

  const [isStarkMode] = useState(true);

  // Check authentication
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = localStorage.getItem('devAuth');
      const authTime = localStorage.getItem('devAuthTime');
      
      if (!auth || !authTime || Date.now() - parseInt(authTime) > 24 * 60 * 60 * 1000) {
        router.push('/login/developer');
      }
    }
  }, [router]);

  // Load client data
  useEffect(() => {
    const loadClientData = async () => {
      try {
        // Load client info
        const clientResponse = await fetch(`/api/clients?clientId=${clientId}`);
        const clientData = await clientResponse.json();
        if (clientData.client) {
          setClient(clientData.client);
          console.log('Loaded client:', clientData.client);
        }

        // Load client files
        const filesResponse = await fetch(`/api/clients/files?clientId=${clientId}`);
        const filesData = await filesResponse.json();
        if (filesData.files) {
          setFiles(filesData.files);
          console.log('Loaded files:', filesData.files.length, filesData.files);
        } else {
          console.log('No files found for client');
        }
      } catch (error) {
        console.error('Error loading client data:', error);
      }
    };

    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError('');
    setGeneratedWebsite(null);

    console.log('Generating website with:', {
      clientId,
      prompt,
      client,
      filesCount: files.length,
      files,
      websiteNotes: client?.website_notes
    });

    try {
      const response = await fetch('/api/websites/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: parseInt(clientId),
          prompt,
          clientInfo: client,
          files: files, // Explicitly pass files array
          websiteNotes: client?.website_notes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || data.details?.error?.message || data.details?.message || 'Failed to generate website';
        throw new Error(errorMessage);
      }

      setGeneratedWebsite(data.website);
      alert('Website generated successfully! The URL has been automatically updated in the client\'s account.');
    } catch (error: any) {
      console.error('Error generating website:', error);
      setError(error.message || 'Failed to generate website');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewSite = () => {
    if (generatedWebsite?.url) {
      window.open(generatedWebsite.url, '_blank');
    }
  };

  return (
    <main className={`min-h-screen ${isStarkMode ? 'bg-black text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className={`border-b ${isStarkMode ? 'border-cyan-500/20 bg-black/90' : 'border-gray-300 bg-white'}`}>
        <div className="w-full mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div className="flex items-center justify-between max-w-[2400px] mx-auto py-4">
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
              <Link
                href="/developer/clients"
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                  isStarkMode
                    ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
                }`}
              >
                Back to Clients
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className={`text-4xl font-black mb-8 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
          Build Website for {client?.full_name || 'Client'}
        </h1>

        {/* Client Info Summary */}
        {client && (
          <div className={`mb-8 p-6 rounded-xl ${
            isStarkMode 
              ? 'bg-gray-900 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60'
          }`}>
            <h2 className={`text-2xl font-bold mb-4 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
              Client Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Business Name</p>
                <p className={`font-medium ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {client.business_name || 'Not specified'}
                </p>
              </div>
              <div>
                <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Address</p>
                <p className={`font-medium ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {client.business_address || 'Not specified'}
                </p>
              </div>
              <div>
                <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Email</p>
                <p className={`font-medium ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {client.email}
                </p>
              </div>
              <div>
                <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Phone</p>
                <p className={`font-medium ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {client.phone || 'Not specified'}
                </p>
              </div>
            </div>
            {client.website_notes && (
              <div className="mt-4">
                <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Website Notes</p>
                <p className={`mt-1 ${isStarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                  {client.website_notes}
                </p>
              </div>
            )}
            <div className="mt-4">
              <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Uploaded Files</p>
              <p className={`mt-1 ${isStarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                {files.length} file{files.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
        )}

        {/* Prompt Input */}
        <div className={`mb-8 p-6 rounded-xl ${
          isStarkMode 
            ? 'bg-gray-900 border border-cyan-500/20' 
            : 'bg-white border-2 border-gray-300/60'
        }`}>
          <h2 className={`text-2xl font-bold mb-4 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
            Website Generation Prompt
          </h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the website you want to create. For example: 'Create a modern barbershop website with a hero section, image gallery, services section, and contact form. Use the uploaded images in the gallery.'"
            rows={8}
            className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 ${
              isStarkMode
                ? 'bg-gray-800 border-cyan-500/40 text-white focus:ring-cyan-500/50 placeholder-gray-500'
                : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-cyan-500/50 placeholder-gray-400'
            }`}
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`mt-4 px-8 py-4 rounded-full text-lg font-bold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
              isStarkMode
                ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
            }`}
          >
            {isGenerating ? 'Generating Website...' : 'Generate Website with Claude'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mb-8 p-4 rounded-lg ${
            isStarkMode
              ? 'bg-red-500/20 border border-red-500/40 text-red-400'
              : 'bg-red-50 border-2 border-red-200 text-red-600'
          }`}>
            {error}
          </div>
        )}

        {/* Generated Website Info */}
        {generatedWebsite && (
          <div className={`mb-8 p-6 rounded-xl ${
            isStarkMode 
              ? 'bg-gray-900 border border-green-500/20' 
              : 'bg-white border-2 border-green-300/60'
          }`}>
            <h2 className={`text-2xl font-bold mb-4 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
              Website Generated Successfully!
            </h2>
            <p className={`mb-4 ${isStarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
              The website has been created and the URL has been automatically updated in the client's account.
            </p>
            <div className="flex gap-4">
              <a
                href={generatedWebsite.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-6 py-3 rounded-full font-bold transition-all duration-200 hover:scale-105 ${
                  isStarkMode
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                }`}
              >
                View Website
              </a>
              <button
                onClick={() => router.push(`/developer/clients`)}
                className={`px-6 py-3 rounded-full font-bold transition-all duration-200 hover:scale-105 ${
                  isStarkMode
                    ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
                }`}
              >
                Back to Clients
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

