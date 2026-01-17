'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Editor from '@monaco-editor/react';

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-400">Loading editor...</div>
});

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
  const [editorHtml, setEditorHtml] = useState<string>('');
  const [error, setError] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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
              setEditorHtml(siteData.html);
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
    if (previewIframeRef.current && editorHtml) {
      const iframe = previewIframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(editorHtml);
        doc.close();
      }
    }
  }, [editorHtml]);

  // Track changes in editor
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditorHtml(value);
      setHasUnsavedChanges(value !== currentHtml);
    }
  };

  // Save code changes
  const handleSaveCode = async () => {
    if (!editorHtml.trim()) {
      setError('Code cannot be empty');
      return;
    }

    try {
      const response = await fetch('/api/websites/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: parseInt(clientId),
          prompt: 'Update website with manually edited code',
          clientInfo: client,
          files: files,
          websiteNotes: client?.website_notes,
          conversationHistory: messages,
          currentHtml: editorHtml,
          isManualEdit: true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save website');
      }

      setCurrentHtml(editorHtml);
      setHasUnsavedChanges(false);
      alert('Website saved successfully!');
    } catch (error: any) {
      console.error('Error saving website:', error);
      setError(error.message || 'Failed to save website');
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isGenerating) return;

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsGenerating(true);
    setError('');

    try {
      // Use current editor content as the base
      const htmlToUse = editorHtml || currentHtml;

      const response = await fetch('/api/websites/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: parseInt(clientId),
          prompt: currentInput,
          clientInfo: client,
          files: files,
          websiteNotes: client?.website_notes,
          conversationHistory: messages,
          currentHtml: htmlToUse
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || data.details?.error?.message || data.details?.message || 'Failed to generate website';
        throw new Error(errorMessage);
      }

      // Update HTML in editor and preview
      if (data.website && data.website.code) {
        setCurrentHtml(data.website.code);
        setEditorHtml(data.website.code);
        setHasUnsavedChanges(false);
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
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
              {hasUnsavedChanges && (
                <span className={`text-sm ${isStarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  Unsaved changes
                </span>
              )}
              <button
                onClick={handleSaveCode}
                disabled={!hasUnsavedChanges}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isStarkMode
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                }`}
              >
                Save Code
              </button>
              <a
                href={`/sites/${clientId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                  isStarkMode
                    ? 'bg-gray-800 text-white hover:bg-gray-700 border border-cyan-500/20'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300/60'
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

      {/* Main Content - Cursor-like Split View */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Side - Code Editor */}
        <div className={`w-1/3 flex flex-col border-r ${
          isStarkMode ? 'border-cyan-500/20 bg-[#1e1e1e]' : 'border-gray-300 bg-white'
        }`}>
          <div className={`p-3 border-b flex items-center justify-between ${
            isStarkMode ? 'border-cyan-500/20 bg-[#252526]' : 'border-gray-300 bg-gray-50'
          }`}>
            <h2 className={`text-sm font-semibold ${isStarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
              index.html
            </h2>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isStarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                {editorHtml.length} chars
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              height="100%"
              language="html"
              theme={isStarkMode ? "vs-dark" : "vs-light"}
              value={editorHtml}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          </div>
        </div>

        {/* Middle - Chat Interface */}
        <div className={`w-1/3 flex flex-col border-r ${
          isStarkMode ? 'border-cyan-500/20 bg-black' : 'border-gray-300 bg-white'
        }`}>
          {/* Chat Header */}
          <div className={`p-4 border-b ${
            isStarkMode ? 'border-cyan-500/20 bg-[#252526]' : 'border-gray-300 bg-gray-50'
          }`}>
            <h2 className={`text-lg font-bold ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
              AI Assistant
            </h2>
            <p className={`text-xs mt-1 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {client?.business_name || 'No business name'}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className={`text-center py-8 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <p className="mb-2">Start building the website by sending a message.</p>
                <p className="text-sm">I can see your code and help you modify it.</p>
                <p className="text-xs mt-2 text-gray-500">
                  Press Cmd/Ctrl + Enter to send
                </p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? isStarkMode
                      ? 'bg-cyan-500 text-black'
                      : 'bg-gray-900 text-white'
                    : isStarkMode
                      ? 'bg-gray-800 text-gray-300'
                      : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {isGenerating && (
              <div className="flex justify-start">
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  isStarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    <span className="ml-2 text-sm">Thinking...</span>
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
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Input */}
          <div className={`p-4 border-t ${
            isStarkMode ? 'border-cyan-500/20 bg-[#252526]' : 'border-gray-300 bg-gray-50'
          }`}>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me to modify the code... (Cmd/Ctrl + Enter to send)"
              rows={3}
              disabled={isGenerating}
              className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 resize-none text-sm ${
                isStarkMode
                  ? 'bg-gray-800 border-cyan-500/40 text-white focus:ring-cyan-500/50 placeholder-gray-500 disabled:opacity-50'
                  : 'bg-white border-gray-300 text-gray-900 focus:ring-cyan-500/50 placeholder-gray-400 disabled:opacity-50'
              }`}
            />
            <div className="flex items-center justify-between mt-2">
              <p className={`text-xs ${isStarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                I can see your code and will modify it based on your requests
              </p>
              <button
                onClick={handleSendMessage}
                disabled={isGenerating || !inputMessage.trim()}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
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
        <div className={`w-1/3 flex flex-col ${
          isStarkMode ? 'bg-gray-900' : 'bg-gray-100'
        }`}>
          <div className={`p-3 border-b flex items-center justify-between ${
            isStarkMode ? 'border-cyan-500/20 bg-[#252526]' : 'border-gray-300 bg-gray-50'
          }`}>
            <h2 className={`text-sm font-semibold ${isStarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
              Live Preview
            </h2>
            <button
              onClick={() => {
                if (previewIframeRef.current) {
                  const iframe = previewIframeRef.current;
                  const doc = iframe.contentDocument || iframe.contentWindow?.document;
                  if (doc) {
                    doc.open();
                    doc.write(editorHtml);
                    doc.close();
                  }
                }
              }}
              className={`text-xs px-2 py-1 rounded ${
                isStarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Refresh
            </button>
          </div>
          <div className="flex-1 relative">
            {editorHtml ? (
              <iframe
                ref={previewIframeRef}
                srcDoc={editorHtml}
                className="w-full h-full border-0"
                title="Website Preview"
                sandbox="allow-same-origin allow-scripts"
              />
            ) : (
              <div className={`flex items-center justify-center h-full ${
                isStarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                <p className="text-sm">Start editing code or send a message to see preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
