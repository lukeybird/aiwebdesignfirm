'use client';

import { useState, useEffect, useRef } from 'react';
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

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export default function BuildWebsitePage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.clientId as string;

  const [client, setClient] = useState<Client | null>(null);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentHtml, setCurrentHtml] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

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

  // Load client data and existing website
  useEffect(() => {
    const loadClientData = async () => {
      try {
        // Load client info
        const clientResponse = await fetch(`/api/clients?clientId=${clientId}`);
        const clientData = await clientResponse.json();
        if (clientData.client) {
          setClient(clientData.client);
        }

        // Load client files
        const filesResponse = await fetch(`/api/clients/files?clientId=${clientId}`);
        const filesData = await filesResponse.json();
        if (filesData.files) {
          setFiles(filesData.files);
        }

        // Load existing website if it exists
        const websiteResponse = await fetch(`/api/websites/${clientId}`);
        if (websiteResponse.ok) {
          const websiteData = await websiteResponse.json();
          if (websiteData.website) {
            const siteData = websiteData.website.site_data;
            if (siteData && siteData.html) {
              setCurrentHtml(siteData.html);
              // Create blob URL for preview
              const blob = new Blob([siteData.html], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              setPreviewUrl(url);
            }
            // Load conversation history
            if (websiteData.website.conversation_history) {
              setMessages(websiteData.website.conversation_history);
            }
          }
        }
      } catch (error) {
        console.error('Error loading client data:', error);
      }
    };

    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update preview iframe when HTML changes
  useEffect(() => {
    if (previewIframeRef.current && currentHtml) {
      const iframe = previewIframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(currentHtml);
        doc.close();
      }
    }
  }, [currentHtml]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isGenerating) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/websites/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: parseInt(clientId),
          prompt: inputMessage,
          clientInfo: client,
          files: files,
          websiteNotes: client?.website_notes,
          conversationHistory: messages,
          currentHtml: currentHtml
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || data.details?.error?.message || data.details?.message || 'Failed to generate website';
        throw new Error(errorMessage);
      }

      // Update HTML and preview
      if (data.website && data.website.code) {
        setCurrentHtml(data.website.code);
        const blob = new Blob([data.website.code], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        // Revoke old URL to prevent memory leaks
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(url);
      }

      // Update conversation history
      if (data.conversationHistory) {
        setMessages(data.conversationHistory);
      }

    } catch (error: any) {
      console.error('Error generating website:', error);
      setError(error.message || 'Failed to generate website');
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
              <a
                href={`/sites/${clientId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                  isStarkMode
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                }`}
              >
                View Live Site
              </a>
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

      {/* Main Content - Split View */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Side - Chat Interface */}
        <div className={`w-full md:w-1/2 flex flex-col border-r ${
          isStarkMode ? 'border-cyan-500/20 bg-black' : 'border-gray-300 bg-white'
        }`}>
          {/* Chat Header */}
          <div className={`p-4 border-b ${
            isStarkMode ? 'border-cyan-500/20' : 'border-gray-300'
          }`}>
            <h2 className={`text-xl font-bold ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
              Building Website for {client?.full_name || 'Client'}
            </h2>
            <p className={`text-sm mt-1 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {client?.business_name || 'No business name'}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className={`text-center py-8 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <p className="mb-2">Start building the website by sending a message.</p>
                <p className="text-sm">For example: "Create a modern barbershop website with a hero section, image gallery, services section, and contact form."</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? isStarkMode
                      ? 'bg-cyan-500 text-black'
                      : 'bg-gray-900 text-white'
                    : isStarkMode
                      ? 'bg-gray-800 text-gray-300'
                      : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex justify-start">
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  isStarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    <span className="ml-2">Generating website...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error Message */}
          {error && (
            <div className={`mx-4 mb-2 p-3 rounded-lg ${
              isStarkMode
                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                : 'bg-red-50 border-2 border-red-200 text-red-600'
            }`}>
              {error}
            </div>
          )}

          {/* Input */}
          <div className={`p-4 border-t ${
            isStarkMode ? 'border-cyan-500/20' : 'border-gray-300'
          }`}>
            <div className="flex gap-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe changes or additions to the website..."
                rows={3}
                disabled={isGenerating}
                className={`flex-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 resize-none ${
                  isStarkMode
                    ? 'bg-gray-800 border-cyan-500/40 text-white focus:ring-cyan-500/50 placeholder-gray-500 disabled:opacity-50'
                    : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-cyan-500/50 placeholder-gray-400 disabled:opacity-50'
                }`}
              />
              <button
                onClick={handleSendMessage}
                disabled={isGenerating || !inputMessage.trim()}
                className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isStarkMode
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right Side - Live Preview */}
        <div className={`hidden md:flex md:w-1/2 flex-col ${
          isStarkMode ? 'bg-gray-900' : 'bg-gray-100'
        }`}>
          <div className={`p-4 border-b ${
            isStarkMode ? 'border-cyan-500/20' : 'border-gray-300'
          }`}>
            <h2 className={`text-xl font-bold ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
              Live Preview
            </h2>
          </div>
          <div className="flex-1 relative">
            {currentHtml ? (
              <iframe
                ref={previewIframeRef}
                src={previewUrl}
                className="w-full h-full border-0"
                title="Website Preview"
              />
            ) : (
              <div className={`flex items-center justify-center h-full ${
                isStarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <p>Start a conversation to see the website preview here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
