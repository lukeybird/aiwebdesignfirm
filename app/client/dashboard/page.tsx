'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Pusher from 'pusher-js';
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
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [instructions, setInstructions] = useState({
    instruction1: false,
    instruction2: false,
    instruction3: false,
  });
  const [websiteNotes, setWebsiteNotes] = useState('');
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionTime, setCompletionTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  
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
            
            // Load instructions and notes
            const clientResponse = await fetch(`/api/clients?clientId=${clientId}`);
            const clientData = await clientResponse.json();
            if (clientData.client) {
              const loadedInstructions = {
                instruction1: clientData.client.instruction_1_completed || false,
                instruction2: clientData.client.instruction_2_completed || false,
                instruction3: clientData.client.instruction_3_completed || false,
              };
              setInstructions(loadedInstructions);
              setWebsiteNotes(clientData.client.website_notes || '');
              
              // Load completion time if all instructions are completed
              const allCompleted = loadedInstructions.instruction1 && 
                                   loadedInstructions.instruction2 && 
                                   loadedInstructions.instruction3;
              if (allCompleted && typeof window !== 'undefined') {
                const storedCompletionTime = localStorage.getItem('instructionsCompletionTime');
                if (storedCompletionTime) {
                  const completionTime = parseInt(storedCompletionTime);
                  const now = Date.now();
                  const twentyFourHours = 24 * 60 * 60 * 1000;
                  
                  // Check if 24 hours have passed - if so, reset the timer
                  if (now - completionTime >= twentyFourHours) {
                    localStorage.removeItem('instructionsCompletionTime');
                    setCompletionTime(null);
                  } else {
                    // Use existing completion time
                    setCompletionTime(completionTime);
                  }
                }
              } else if (typeof window !== 'undefined') {
                // Not all completed - clear completion time
                localStorage.removeItem('instructionsCompletionTime');
                setCompletionTime(null);
              }
            } else {
              // Fallback: try to get from the client object if it has the fields
              const loadedInstructions = {
                instruction1: (client as any).instruction_1_completed || false,
                instruction2: (client as any).instruction_2_completed || false,
                instruction3: (client as any).instruction_3_completed || false,
              };
              setInstructions(loadedInstructions);
              setWebsiteNotes((client as any).website_notes || '');
              
              // Load completion time if all instructions are completed
              const allCompleted = loadedInstructions.instruction1 && 
                                   loadedInstructions.instruction2 && 
                                   loadedInstructions.instruction3;
              if (allCompleted && typeof window !== 'undefined') {
                const storedCompletionTime = localStorage.getItem('instructionsCompletionTime');
                if (storedCompletionTime) {
                  const completionTime = parseInt(storedCompletionTime);
                  const now = Date.now();
                  const twentyFourHours = 24 * 60 * 60 * 1000;
                  
                  // Check if 24 hours have passed - if so, reset the timer
                  if (now - completionTime >= twentyFourHours) {
                    localStorage.removeItem('instructionsCompletionTime');
                    setCompletionTime(null);
                  } else {
                    // Use existing completion time
                    setCompletionTime(completionTime);
                  }
                }
              } else if (typeof window !== 'undefined') {
                // Not all completed - clear completion time
                localStorage.removeItem('instructionsCompletionTime');
                setCompletionTime(null);
              }
            }
          }

          // Load files for this client
          await loadFiles(clientId);
          
          // Load messages for this client
          await loadMessages(clientId);
        } catch (error) {
          console.error('Error loading client data:', error);
        }
      }
    };

    loadClientData();
  }, [router]);

  const loadMessages = async (clientId: string) => {
    try {
      const response = await fetch(`/api/messages?clientId=${clientId}`);
      const data = await response.json();
      if (data.messages) {
        // Normalize message structure
        const normalizedMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          sender_type: msg.sender_type || msg.senderType,
          message_text: msg.message_text || msg.messageText,
          is_read: msg.is_read !== undefined ? msg.is_read : msg.isRead,
          created_at: msg.created_at || msg.createdAt
        }));
        setMessages(normalizedMessages);
        
        // Auto-scroll to bottom when new messages arrive
        setTimeout(() => {
          const chatMessages = document.getElementById('chat-messages');
          if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const clientId = localStorage.getItem('clientId');
    if (!clientId) {
      alert('Please log in again');
      router.push('/login/client');
      return;
    }

    setIsSendingMessage(true);

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          senderType: 'client',
          messageText: newMessage.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // Normalize message structure
      const normalizedMessage = {
        id: data.message.id,
        sender_type: data.message.sender_type || data.message.senderType,
        message_text: data.message.message_text || data.message.messageText,
        is_read: data.message.is_read !== undefined ? data.message.is_read : data.message.isRead,
        created_at: data.message.created_at || data.message.createdAt
      };

      // Add message to local state (Pusher will also send it, but duplicate check will prevent it)
      setMessages(prev => {
        // Check if message already exists (avoid duplicates from Pusher)
        if (prev.some(msg => msg.id === normalizedMessage.id)) {
          return prev;
        }
        return [...prev, normalizedMessage];
      });
      setNewMessage('');
      
      // Scroll to bottom
      setTimeout(() => {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }, 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Error sending message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Set up Pusher for real-time updates
  useEffect(() => {
    if (!chatOpen) return;

    const clientId = localStorage.getItem('clientId');
    if (!clientId) return;

    // Load messages immediately
    loadMessages(clientId);

    // Initialize Pusher
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';

    if (!pusherKey) {
      console.error('Pusher key not configured');
      return;
    }

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
    });

    // Subscribe to client-specific channel
    const channel = pusher.subscribe(`client-${clientId}`);
    
    // Listen for new messages
    channel.bind('new-message', (data: any) => {
      if (data.message) {
        const normalizedMessage = {
          id: data.message.id,
          sender_type: data.message.sender_type || data.message.senderType,
          message_text: data.message.message_text || data.message.messageText,
          is_read: data.message.is_read !== undefined ? data.message.is_read : data.message.isRead,
          created_at: data.message.created_at || data.message.createdAt
        };
        
        setMessages(prev => {
          // Check if message already exists (avoid duplicates)
          if (prev.some(msg => msg.id === normalizedMessage.id)) {
            return prev;
          }
          return [...prev, normalizedMessage];
        });
        
        // Auto-scroll to bottom
        setTimeout(() => {
          const chatMessages = document.getElementById('chat-messages');
          if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }, 100);
      }
    });

    // Cleanup
    return () => {
      channel.unbind_all();
      channel.unsubscribe();
      pusher.disconnect();
    };
  }, [chatOpen, clientEmail]);

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

    // Calculate total size of files to upload
    let totalNewSize = 0;
    for (let i = 0; i < fileList.length; i++) {
      totalNewSize += fileList[i].size;
    }

    // Check if upload would exceed storage limit
    if (totalStorageUsed + totalNewSize > STORAGE_LIMIT) {
      const remainingMB = (storageRemaining / (1024 * 1024)).toFixed(2);
      alert(`Upload would exceed storage limit. You have ${remainingMB} MB remaining. Maximum storage is 100 MB (0.1 GB).`);
      e.target.value = '';
      return;
    }

    setIsUploading(true);

    try {
      // Upload each file to Vercel Blob via API
      for (let i = 0; i < fileList.length; i++) {
        let file = fileList[i];
        let fileName = file.name;
        
        // Convert HEIC files to JPEG (only on client side)
        if (typeof window !== 'undefined' && (file.type === 'image/heic' || file.type === 'image/heif' || fileName.toLowerCase().endsWith('.heic') || fileName.toLowerCase().endsWith('.heif'))) {
          try {
            // Dynamically import heic2any only when needed and only on client
            const heic2any = (await import('heic2any')).default;
            
            const convertedBlob = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.92
            });
            
            // heic2any returns an array, get the first item
            const convertedFile = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            
            // Create a new File object from the converted blob
            const newFileName = fileName.replace(/\.(heic|heif)$/i, '.jpg');
            file = new File([convertedFile as Blob], newFileName, {
              type: 'image/jpeg',
              lastModified: file.lastModified
            });
            
            // Update the file name
            fileName = newFileName;
          } catch (conversionError) {
            console.error('Error converting HEIC file:', conversionError);
            alert(`Failed to convert HEIC file "${file.name}". Please convert it to JPEG/PNG first.`);
            continue;
          }
        }
        
        // Double-check each file individually
        if (totalStorageUsed + file.size > STORAGE_LIMIT) {
          alert(`File "${fileName}" would exceed storage limit. Skipping.`);
          continue;
        }
        
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

  // Get only image files for gallery
  const imageFiles = files.filter(file => isImageFile(file.type));

  const openGallery = (fileId: string) => {
    // Find the index in the imageFiles array
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


  // Check if all instructions are completed and show modal/set timer
  // Only activates when user manually checks all three boxes
  useEffect(() => {
    const allCompleted = instructions.instruction1 && instructions.instruction2 && instructions.instruction3;
    
    if (allCompleted && typeof window !== 'undefined') {
      const storedCompletionTime = localStorage.getItem('instructionsCompletionTime');
      
      if (!storedCompletionTime) {
        // First time all completed - set completion time and show modal
        const now = Date.now();
        localStorage.setItem('instructionsCompletionTime', now.toString());
        setCompletionTime(now);
        setShowCompletionModal(true);
      } else {
        // Check if 24 hours have passed
        const completionTime = parseInt(storedCompletionTime);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (now - completionTime >= twentyFourHours) {
          // 24 hours have passed - reset timer
          localStorage.removeItem('instructionsCompletionTime');
          const newTime = Date.now();
          localStorage.setItem('instructionsCompletionTime', newTime.toString());
          setCompletionTime(newTime);
        } else {
          // Still within 24 hours - use existing time
          setCompletionTime(completionTime);
        }
      }
    } else if (!allCompleted && typeof window !== 'undefined') {
      // If instructions are manually unchecked, clear the completion time
      localStorage.removeItem('instructionsCompletionTime');
      setCompletionTime(null);
      setShowCompletionModal(false);
    }
  }, [instructions.instruction1, instructions.instruction2, instructions.instruction3]);

  // Countdown timer effect
  useEffect(() => {
    if (!completionTime) {
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - completionTime;
      const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const remaining = Math.max(0, twentyFourHours - elapsed);
      setTimeRemaining(remaining);
    };

    // Update immediately
    updateTimer();

    // Update every second for smooth countdown
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [completionTime]);

  // Format time remaining as hours, minutes, and seconds
  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownloadFile = async (file: UploadedFile) => {
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Storage limit: 0.1GB = 100MB
  const STORAGE_LIMIT = 100 * 1024 * 1024; // 100MB in bytes

  // Calculate total storage used
  const totalStorageUsed = files.reduce((sum, file) => sum + file.size, 0);
  const storageUsedMB = totalStorageUsed / (1024 * 1024);
  const storageLimitMB = STORAGE_LIMIT / (1024 * 1024);
  const storagePercentage = (totalStorageUsed / STORAGE_LIMIT) * 100;
  const storageRemaining = STORAGE_LIMIT - totalStorageUsed;

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

          {/* Instructions Checklist Section */}
          <div className={`mb-8 rounded-xl p-8 ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60'
          }`}>
            <div className="flex items-center gap-3 mb-6">
              <h2 className={`text-2xl font-black ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                Instructions Checklist
              </h2>
              {instructions.instruction1 && instructions.instruction2 && instructions.instruction3 ? (
                <button
                  onClick={() => setShowCompletionModal(true)}
                  className="relative cursor-pointer transition-transform hover:scale-110"
                  title="View countdown"
                >
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </button>
              ) : (
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-5">
              <label className={`flex items-start gap-4 cursor-pointer group p-4 rounded-lg transition-all ${
                isStarkMode 
                  ? instructions.instruction1
                    ? 'bg-cyan-500/10 border border-cyan-500/30'
                    : 'bg-gray-900/50 border border-cyan-500/20 hover:border-cyan-500/40'
                  : instructions.instruction1
                    ? 'bg-cyan-50 border border-cyan-200'
                    : 'bg-gray-50 border border-gray-300 hover:border-gray-400'
              }`}>
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={instructions.instruction1}
                    onChange={async (e) => {
                      const newInstructions = { ...instructions, instruction1: e.target.checked };
                      setInstructions(newInstructions);
                      setIsSavingInstructions(true);
                      try {
                        const response = await fetch('/api/clients', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: clientEmail,
                            instruction1Completed: e.target.checked,
                          }),
                        });
                        const data = await response.json();
                        if (!response.ok) {
                          throw new Error(data.error || 'Failed to save');
                        }
                      } catch (error) {
                        console.error('Error saving instruction:', error);
                        alert('Failed to save. Please try again.');
                        // Revert on error
                        setInstructions({ ...instructions, instruction1: !e.target.checked });
                      } finally {
                        setIsSavingInstructions(false);
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`w-7 h-7 rounded border-2 transition-all flex items-center justify-center ${
                    instructions.instruction1
                      ? isStarkMode
                        ? 'bg-cyan-500 border-cyan-500 shadow-lg shadow-cyan-500/50'
                        : 'bg-gray-900 border-gray-900'
                      : isStarkMode
                        ? 'border-cyan-500/40 bg-transparent group-hover:border-cyan-500/60'
                        : 'border-gray-400 bg-transparent group-hover:border-gray-500'
                  }`}>
                    {instructions.instruction1 && (
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className={`text-lg flex-1 pt-0.5 ${instructions.instruction1 ? 'line-through opacity-60' : isStarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                  Upload your best pictures you want to see on your website.
                </span>
              </label>
              
              <label className={`flex items-start gap-4 cursor-pointer group p-4 rounded-lg transition-all ${
                isStarkMode 
                  ? instructions.instruction2
                    ? 'bg-cyan-500/10 border border-cyan-500/30'
                    : 'bg-gray-900/50 border border-cyan-500/20 hover:border-cyan-500/40'
                  : instructions.instruction2
                    ? 'bg-cyan-50 border border-cyan-200'
                    : 'bg-gray-50 border border-gray-300 hover:border-gray-400'
              }`}>
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={instructions.instruction2}
                    onChange={async (e) => {
                      const newInstructions = { ...instructions, instruction2: e.target.checked };
                      setInstructions(newInstructions);
                      setIsSavingInstructions(true);
                      try {
                        const response = await fetch('/api/clients', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: clientEmail,
                            instruction2Completed: e.target.checked,
                          }),
                        });
                        const data = await response.json();
                        if (!response.ok) {
                          throw new Error(data.error || 'Failed to save');
                        }
                      } catch (error) {
                        console.error('Error saving instruction:', error);
                        alert('Failed to save. Please try again.');
                        // Revert on error
                        setInstructions({ ...instructions, instruction2: !e.target.checked });
                      } finally {
                        setIsSavingInstructions(false);
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`w-7 h-7 rounded border-2 transition-all flex items-center justify-center ${
                    instructions.instruction2
                      ? isStarkMode
                        ? 'bg-cyan-500 border-cyan-500 shadow-lg shadow-cyan-500/50'
                        : 'bg-gray-900 border-gray-900'
                      : isStarkMode
                        ? 'border-cyan-500/40 bg-transparent group-hover:border-cyan-500/60'
                        : 'border-gray-400 bg-transparent group-hover:border-gray-500'
                  }`}>
                    {instructions.instruction2 && (
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className={`text-lg flex-1 pt-0.5 ${instructions.instruction2 ? 'line-through opacity-60' : isStarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                  Upload info pertaining to your website. Pamphlets etc... The more info and menu prices the better.
                </span>
              </label>
              
              <label className={`flex items-start gap-4 cursor-pointer group p-4 rounded-lg transition-all ${
                isStarkMode 
                  ? instructions.instruction3
                    ? 'bg-cyan-500/10 border border-cyan-500/30'
                    : 'bg-gray-900/50 border border-cyan-500/20 hover:border-cyan-500/40'
                  : instructions.instruction3
                    ? 'bg-cyan-50 border border-cyan-200'
                    : 'bg-gray-50 border border-gray-300 hover:border-gray-400'
              }`}>
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={instructions.instruction3}
                    onChange={async (e) => {
                      const newInstructions = { ...instructions, instruction3: e.target.checked };
                      setInstructions(newInstructions);
                      setIsSavingInstructions(true);
                      try {
                        const response = await fetch('/api/clients', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: clientEmail,
                            instruction3Completed: e.target.checked,
                          }),
                        });
                        const data = await response.json();
                        if (!response.ok) {
                          throw new Error(data.error || 'Failed to save');
                        }
                      } catch (error) {
                        console.error('Error saving instruction:', error);
                        alert('Failed to save. Please try again.');
                        // Revert on error
                        setInstructions({ ...instructions, instruction3: !e.target.checked });
                      } finally {
                        setIsSavingInstructions(false);
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`w-7 h-7 rounded border-2 transition-all flex items-center justify-center ${
                    instructions.instruction3
                      ? isStarkMode
                        ? 'bg-cyan-500 border-cyan-500 shadow-lg shadow-cyan-500/50'
                        : 'bg-gray-900 border-gray-900'
                      : isStarkMode
                        ? 'border-cyan-500/40 bg-transparent group-hover:border-cyan-500/60'
                        : 'border-gray-400 bg-transparent group-hover:border-gray-500'
                  }`}>
                    {instructions.instruction3 && (
                      <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className={`text-lg flex-1 pt-0.5 ${instructions.instruction3 ? 'line-through opacity-60' : isStarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                  Fill in all the info for account settings.
                </span>
              </label>
            </div>
          </div>

          {/* Website Notes Section */}
          <div className={`mb-8 rounded-xl p-8 ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60'
          }`}>
            <h2 className={`text-2xl font-black mb-4 ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
              Website Notes
            </h2>
            <p className={`text-sm mb-4 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Here you can explain your prices, how you want the site to be designed, or whatever it is you want on your website. You can be as detailed as you want. Keep in mind if you have a pdf or file with your prices you can upload that to the file manager.
            </p>
            <textarea
              value={websiteNotes}
              onChange={(e) => setWebsiteNotes(e.target.value)}
              onBlur={async () => {
                try {
                  await fetch('/api/clients', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: clientEmail,
                      websiteNotes: websiteNotes,
                    }),
                  });
                } catch (error) {
                  console.error('Error saving notes:', error);
                }
              }}
              placeholder="Describe your vision for your website... (e.g., colors, style, layout, features, etc.)"
              rows={6}
              className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 ${
                isStarkMode
                  ? 'bg-gray-900 border-cyan-500/40 text-white focus:ring-cyan-500/50 placeholder-gray-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-cyan-500/50 placeholder-gray-400'
              }`}
            />
          </div>

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
                  accept="*/*"
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
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-black ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                Your Files ({files.length})
              </h2>
              {/* Storage Usage */}
              <div className={`text-sm ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <div className="flex items-center gap-2">
                  <span>Storage:</span>
                  <span className={`font-medium ${
                    storagePercentage >= 90 
                      ? 'text-red-400' 
                      : storagePercentage >= 75 
                        ? 'text-yellow-400' 
                        : isStarkMode 
                          ? 'text-cyan-400' 
                          : 'text-gray-900'
                  }`}>
                    {storageUsedMB.toFixed(2)} MB / {storageLimitMB} MB
                  </span>
                  <span className="text-xs">
                    ({storagePercentage.toFixed(1)}%)
                  </span>
                </div>
                {/* Storage Bar */}
                <div className={`w-48 h-2 rounded-full mt-1 ${
                  isStarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                  <div 
                    className={`h-full rounded-full transition-all ${
                      storagePercentage >= 90 
                        ? 'bg-red-500' 
                        : storagePercentage >= 75 
                          ? 'bg-yellow-500' 
                          : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            
            {storagePercentage >= 100 && (
              <div className={`mb-4 p-3 rounded-lg ${
                isStarkMode 
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400' 
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                <p className="text-sm font-medium">
                  ⚠️ Storage limit reached. Please delete some files to upload new ones.
                </p>
              </div>
            )}
            
            {storagePercentage >= 90 && storagePercentage < 100 && (
              <div className={`mb-4 p-3 rounded-lg ${
                isStarkMode 
                  ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400' 
                  : 'bg-yellow-50 border border-yellow-200 text-yellow-600'
              }`}>
                <p className="text-sm font-medium">
                  ⚠️ Storage almost full ({storagePercentage.toFixed(1)}%). Consider deleting unused files.
                </p>
              </div>
            )}

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
            className="w-full h-full flex items-center justify-center p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageFiles[galleryIndex].url}
              alt={imageFiles[galleryIndex].name}
              className="max-w-[98vw] max-h-[98vh] w-auto h-auto object-contain"
            />
            {/* File Type Badge - Bottom Right */}
            <div className={`absolute bottom-8 right-8 px-3 py-1.5 rounded text-sm font-medium ${
              isStarkMode
                ? 'bg-black/70 text-white backdrop-blur-sm'
                : 'bg-white/90 text-gray-900 backdrop-blur-sm'
            }`}>
              {getFileType(imageFiles[galleryIndex].name, imageFiles[galleryIndex].type)}
            </div>
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

      {/* Chat Button */}
      <button
        onClick={() => setChatOpen(true)}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 ${
          isStarkMode
            ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/50'
            : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/20'
        }`}
        title="Open Support Chat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* Chat Box */}
      {chatOpen && (
        <div className={`fixed inset-0 sm:bottom-6 sm:right-6 sm:inset-auto sm:w-96 sm:h-[600px] sm:rounded-lg z-50 shadow-2xl flex flex-col ${
          isStarkMode
            ? 'bg-gray-800 border-0 sm:border border-cyan-500/40'
            : 'bg-white border-0 sm:border-2 border-gray-300'
        }`}>
          {/* Chat Header */}
          <div className={`flex items-center justify-between p-4 border-b ${
            isStarkMode ? 'border-cyan-500/20' : 'border-gray-200'
          }`}>
            <div>
              <h3 className={`font-bold ${isStarkMode ? 'text-white' : 'text-gray-900'}`}>
                Support Chat
              </h3>
              <p className={`text-xs ${isStarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                We'll respond as soon as possible
              </p>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className={`px-2 py-1 rounded text-sm font-medium transition-all ${
                isStarkMode
                  ? 'bg-gray-700 text-white hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            id="chat-messages"
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.length === 0 ? (
              <div className={`text-center py-8 ${isStarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <p>No messages yet. Start a conversation!</p>
              </div>
            ) : (
              messages.map((msg: any) => {
                const senderType = msg.sender_type || msg.senderType || 'client';
                const messageText = msg.message_text || msg.messageText || '';
                const createdAt = msg.created_at || msg.createdAt || new Date().toISOString();
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${senderType === 'client' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      senderType === 'client'
                        ? isStarkMode
                          ? 'bg-cyan-500 text-black'
                          : 'bg-gray-900 text-white'
                        : isStarkMode
                          ? 'bg-gray-700 text-white'
                          : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{messageText}</p>
                      <p className={`text-xs mt-1 ${
                        senderType === 'client'
                          ? isStarkMode ? 'text-gray-800' : 'text-gray-300'
                          : isStarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
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
                placeholder="Type your message..."
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
        </div>
      )}

      {/* Completion Modal */}
      {showCompletionModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowCompletionModal(false)}
        >
          <div 
            className={`rounded-xl shadow-2xl w-full max-w-md mx-4 transition-colors duration-300 ${
              isStarkMode 
                ? 'bg-gray-900 border border-cyan-500/20' 
                : 'bg-white border-2 border-gray-300/60 shadow-gray-900/20'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-3xl font-black tracking-tighter ${
                  isStarkMode 
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                    : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
                }`}>
                  Site In Progress
                </h2>
                <button
                  onClick={() => setShowCompletionModal(false)}
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

              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className={`text-xl mb-4 ${isStarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                  All instructions completed!
                </p>
                <p className={`text-lg mb-6 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Come back in 24 hours to see the result.
                </p>
                <div className={`p-4 rounded-lg ${
                  isStarkMode 
                    ? 'bg-gray-800 border border-cyan-500/30' 
                    : 'bg-gray-100 border border-gray-300'
                }`}>
                  <p className={`text-sm mb-2 ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Time remaining:
                  </p>
                  <p className={`text-3xl font-bold ${isStarkMode ? 'text-cyan-400' : 'text-gray-900'}`}>
                    {formatTimeRemaining(timeRemaining)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCompletionModal(false)}
                className={`w-full px-6 py-3 rounded-full text-base font-bold transition-all duration-200 hover:scale-105 ${
                  isStarkMode
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                }`}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Left Countdown Timer */}
      {completionTime && timeRemaining > 0 && (
        <button
          onClick={() => setShowCompletionModal(true)}
          className="fixed bottom-6 left-6 z-40 cursor-pointer transition-transform hover:scale-105"
          title="View countdown details"
        >
          <div className={`rounded-lg p-4 shadow-2xl border ${
            isStarkMode
              ? 'bg-gray-900 border-cyan-500/30 shadow-cyan-500/20'
              : 'bg-white border-gray-300 shadow-gray-900/20'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className={`text-xs ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Site ready in:
                </p>
                <p className={`text-lg font-bold ${isStarkMode ? 'text-cyan-400' : 'text-gray-900'}`}>
                  {formatTimeRemaining(timeRemaining)}
                </p>
              </div>
            </div>
          </div>
        </button>
      )}
    </main>
  );
}

