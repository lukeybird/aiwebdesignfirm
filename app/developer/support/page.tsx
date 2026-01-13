'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Message {
  id: number;
  sender_type: string;
  message_text: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  clientId: number;
  clientName: string;
  clientEmail: string;
  messages: Message[];
  lastMessageAt: string;
  unreadCount: number;
}

export default function SupportPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
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

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/messages');
      const data = await response.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversationMessages = async (clientId: number) => {
    try {
      const response = await fetch(`/api/messages/${clientId}`);
      const data = await response.json();
      if (data.messages) {
        const conversation = conversations.find(c => c.clientId === clientId);
        if (conversation) {
          // Update messages with proper structure
          conversation.messages = data.messages.map((msg: any) => ({
            id: msg.id,
            sender_type: msg.sender_type,
            message_text: msg.message_text,
            is_read: msg.is_read,
            created_at: msg.created_at
          }));
          conversation.unreadCount = 0;
          setSelectedConversation({ ...conversation });
          setConversations([...conversations]);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;

    setIsSendingMessage(true);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedConversation.clientId,
          senderType: 'developer',
          messageText: newMessage.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Add message to local state
      if (selectedConversation) {
        // Normalize message structure
        const normalizedMessage = {
          id: data.message.id,
          sender_type: data.message.sender_type || data.message.senderType,
          message_text: data.message.message_text || data.message.messageText,
          is_read: data.message.is_read !== undefined ? data.message.is_read : data.message.isRead,
          created_at: data.message.created_at || data.message.createdAt
        };
        selectedConversation.messages.push(normalizedMessage);
        selectedConversation.lastMessageAt = normalizedMessage.created_at;
        setSelectedConversation({ ...selectedConversation });
        setNewMessage('');
        
        // Reload conversations to update order
        loadConversations();
        
        // Scroll to bottom
        setTimeout(() => {
          const chatMessages = document.getElementById('chat-messages');
          if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }, 100);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Error sending message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('devAuth');
      localStorage.removeItem('devAuthTime');
    }
    router.push('/login/developer');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
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
                  ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
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
              Support Inbox
            </h1>
            <p className={`text-xl font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Client messages and support requests
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Conversations List */}
            <div className={`lg:col-span-1 rounded-xl p-6 ${
              isStarkMode 
                ? 'bg-gray-800 border border-cyan-500/20' 
                : 'bg-white border-2 border-gray-300/60'
            }`}>
              <h2 className={`text-2xl font-black mb-4 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                Conversations ({conversations.length})
              </h2>

              {isLoading ? (
                <div className={`text-center py-8 ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Loading...
                </div>
              ) : conversations.length === 0 ? (
                <div className={`text-center py-8 ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <p>No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {conversations.map((conv) => (
                    <button
                      key={conv.clientId}
                      onClick={() => {
                        setSelectedConversation(conv);
                        loadConversationMessages(conv.clientId);
                      }}
                      className={`w-full text-left p-4 rounded-lg transition-all ${
                        selectedConversation?.clientId === conv.clientId
                          ? isStarkMode
                            ? 'bg-cyan-500/20 border border-cyan-500/40'
                            : 'bg-gray-100 border-2 border-gray-300'
                          : isStarkMode
                            ? 'bg-gray-900 hover:bg-gray-800 border border-gray-700'
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-bold ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {conv.clientName}
                        </h3>
                        {conv.unreadCount > 0 && (
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            isStarkMode
                              ? 'bg-cyan-500 text-black'
                              : 'bg-gray-900 text-white'
                          }`}>
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm truncate ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {conv.clientEmail}
                      </p>
                      <p className={`text-xs mt-1 ${isStarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        {formatTime(conv.lastMessageAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Chat View */}
            <div className={`lg:col-span-2 rounded-xl p-6 ${
              isStarkMode 
                ? 'bg-gray-800 border border-cyan-500/20' 
                : 'bg-white border-2 border-gray-300/60'
            }`}>
              {selectedConversation ? (
                <>
                  <div className={`mb-4 pb-4 border-b ${
                    isStarkMode ? 'border-cyan-500/20' : 'border-gray-200'
                  }`}>
                    <h2 className={`text-2xl font-black ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {selectedConversation.clientName}
                    </h2>
                    <p className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedConversation.clientEmail}
                    </p>
                  </div>

                  {/* Messages */}
                  <div
                    id="chat-messages"
                    className="h-[500px] overflow-y-auto p-4 space-y-4 mb-4"
                  >
                    {selectedConversation.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_type === 'developer' ? 'justify-end' : 'justify-start'}`}
                      >
                      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.sender_type === 'developer'
                          ? isStarkMode
                            ? 'bg-cyan-500 text-black'
                            : 'bg-gray-900 text-white'
                          : isStarkMode
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                        <p className={`text-xs mt-1 ${
                          msg.sender_type === 'developer'
                            ? isStarkMode ? 'text-gray-800' : 'text-gray-300'
                            : isStarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      </div>
                    ))}
                  </div>

                  {/* Message Input */}
                  <div className={`p-4 border-t ${
                    isStarkMode ? 'border-cyan-500/20' : 'border-gray-200'
                  }`}>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Type your reply..."
                        className={`flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 ${
                          isStarkMode
                            ? 'bg-gray-900 border-cyan-500/40 text-white focus:ring-cyan-500'
                            : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-gray-900'
                        }`}
                        disabled={isSendingMessage}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={isSendingMessage || !newMessage.trim()}
                        className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isStarkMode
                            ? 'bg-cyan-500 text-black hover:bg-cyan-400'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        {isSendingMessage ? '...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className={`text-center py-12 ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  <div className="text-6xl mb-4">💬</div>
                  <p className="text-lg">Select a conversation to view messages</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

