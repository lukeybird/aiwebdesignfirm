'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [hoveredProject, setHoveredProject] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState<Set<number>>(new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Always use dark mode
  const [isStarkMode] = useState(true);

  const triggerVideo = (shouldPlayAudio?: boolean) => {
    const playAudio = shouldPlayAudio !== undefined ? shouldPlayAudio : audioAllowed;
    setShowVideo(true);
    setShowPlayButton(true);
    // Start sliding animation
    setTimeout(() => {
      setVideoSliding(true);
      
      // Play attention.mp3 audio if allowed when video slides in
      if (playAudio && audioRef.current) {
        audioRef.current.play().catch(error => {
          console.log('Audio playback error:', error);
        });
      }
    }, 100);
  };

  const handlePlayVideo = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        console.log('Video playback error:', error);
      });
      setShowPlayButton(false);
    }
  };

  // Set theme to dark mode in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'stark');
      
      // Check if user has already responded to audio prompt
      const audioPreference = localStorage.getItem('audioAllowed');
      if (audioPreference === null) {
        // Show prompt on first visit
        setShowAudioPrompt(true);
      } else {
        setAudioAllowed(audioPreference === 'true');
        // If user has already responded, trigger video after a short delay
        setTimeout(() => {
          triggerVideo();
        }, 1000);
      }
    }
  }, []);

  const handleAllowAudio = () => {
    setAudioAllowed(true);
    setShowAudioPrompt(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('audioAllowed', 'true');
      // Trigger video after prompt closes with audio enabled
      setTimeout(() => {
        triggerVideo(true);
      }, 500);
    }
  };

  const handleDenyAudio = () => {
    setAudioAllowed(false);
    setShowAudioPrompt(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('audioAllowed', 'false');
      // Still show video but without audio
      setTimeout(() => {
        triggerVideo(false);
      }, 500);
    }
  };
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formError, setFormError] = useState('');
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  const [audioAllowed, setAudioAllowed] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoSliding, setVideoSliding] = useState(false);
  const [videoSlidingOut, setVideoSlidingOut] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const projects = [
    { id: 1, name: 'PayNGoSystems', url: 'https://www.payngosystems.com/', thumbnail: '/pay.png' },
    { id: 2, name: 'PixaWorld.io', url: 'https://pixaworld.io', thumbnail: '/pixaworld.png' },
    { id: 3, name: 'Project Three', url: 'https://aiwebdesignfirm.vercel.app/', thumbnail: '/site.png' },
    { id: 4, name: 'Genesis Characters', url: 'https://lukeybird.github.io/GenesisApp/', thumbnail: '/genesis.png' },
    { id: 5, name: 'Project Five', url: 'https://lukeybird.github.io/live-game/', thumbnail: '/live.png' },
    { id: 6, name: 'Project Six', url: 'https://lukeybird.github.io/barbershop/', thumbnail: '/barber.png' },
  ];

  const handlePreview = (projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    if (project?.url) {
      window.open(project.url, '_blank', 'noopener,noreferrer');
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
            <div className="flex items-center gap-3">
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
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsFormOpen(true)}
                className={`px-4 py-2.5 sm:px-6 lg:px-8 lg:py-3 rounded-full text-sm lg:text-base font-bold transition-all duration-200 hover:scale-105 ${
                  isStarkMode
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20 border border-gray-800'
                }`}
              >
                <span className="sm:hidden">Start</span>
                <span className="hidden sm:inline">Start My Project</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={`min-h-screen sm:h-[600px] md:h-[650px] lg:h-[700px] xl:h-[600px] 2xl:h-[550px] flex items-center justify-center pt-32 pb-24 sm:pt-20 sm:pb-0 md:pt-20 lg:pt-20 xl:pt-20 2xl:pt-20 px-2 sm:px-4 md:px-6 lg:px-8 xl:px-12 transition-colors duration-300 relative overflow-hidden ${
        isStarkMode 
          ? 'bg-gradient-to-b from-black via-gray-900 to-black' 
          : 'bg-gradient-to-b from-white via-gray-50/50 to-white'
      }`}>
        <div className="max-w-7xl mx-auto w-full">
          <div className="text-center mb-12 sm:mb-16 md:mb-18 lg:mb-20 xl:mb-16 2xl:mb-12 relative mx-auto w-full flex flex-col items-center">
            {/* Gradient Background */}
            <div className={`absolute inset-0 -z-10 blur-3xl opacity-30 ${
              isStarkMode
                ? 'bg-gradient-to-r from-cyan-500/50 via-blue-500/50 to-cyan-500/50'
                : 'bg-gradient-to-r from-gray-200/40 via-gray-300/40 to-gray-200/40'
            }`} style={{
              top: '10%',
              left: '10%',
              right: '10%',
              bottom: '10%',
            }}></div>
            
            <h1 className={`font-black tracking-[-0.04em] mb-2 sm:mb-3 md:mb-4 lg:mb-3 xl:mb-2 2xl:mb-2 leading-none relative z-10 text-center w-full ${
              isStarkMode 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500' 
                : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]'
            }`} style={{ fontSize: 'clamp(3rem, 12vw, 8rem)' }}>
              BUILD
            </h1>
            <h2 className={`font-black tracking-[-0.04em] mb-2 sm:mb-3 md:mb-4 lg:mb-3 xl:mb-2 2xl:mb-2 leading-none relative z-10 text-center w-full ${
              isStarkMode ? 'text-gray-500' : 'text-gray-400'
            }`} style={{ fontSize: 'clamp(3rem, 12vw, 8rem)' }}>
              LAUNCH
            </h2>
            <h3 className={`font-black tracking-[-0.04em] mb-8 sm:mb-10 md:mb-12 lg:mb-10 xl:mb-8 2xl:mb-6 leading-none relative z-10 text-center w-full ${
              isStarkMode ? 'text-white' : 'text-gray-900'
            }`} style={{ fontSize: 'clamp(3rem, 12vw, 8rem)' }}>
              MAINTAIN
            </h3>
            <p className={`text-xl sm:text-2xl max-w-2xl mx-auto font-light leading-relaxed mb-8 ${
              isStarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Functional websites for specific markets. Fast turnarounds. 
              Detailed and high-quality work. Over 15 years of experience.
            </p>
            <button 
              onClick={() => setIsFormOpen(true)}
              className={`px-12 py-5 rounded-full text-xl font-bold transition-all duration-200 hover:scale-105 ${
                isStarkMode
                  ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                  : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
              }`}
            >
              Start My Project
            </button>
          </div>
        </div>
      </section>

      {/* Barbershop Templates Section */}
      <section className={`py-24 px-4 sm:px-6 lg:px-8 transition-colors duration-300 ${
        isStarkMode ? 'bg-black' : 'bg-gradient-to-b from-white to-gray-50/30'
      }`}>
        <div className="max-w-7xl mx-auto">
          {(() => {
            const barbershopProject = projects.find(p => p.thumbnail === '/barber.png');
            if (!barbershopProject) return null;
            
            return (
              <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
                {/* Left Side - Text Content */}
                <div className="flex-1 lg:pr-8">
                  <h2 className={`text-4xl sm:text-5xl lg:text-6xl font-black mb-6 tracking-tight ${
                    isStarkMode 
                      ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                      : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
                  }`}>
                    Barbershop Templates
                  </h2>
                  <p className={`text-lg sm:text-xl font-light mb-6 leading-relaxed ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Explore the variety of professional barbershop website templates we've created. Each design is crafted to showcase your barbershop's unique style and help you attract more clients.
                  </p>
                  <Link
                    href="/templates/barbershop"
                    className={`inline-block px-8 py-4 rounded-full text-base font-bold transition-all duration-300 hover:scale-105 shadow-lg ${
                      isStarkMode
                        ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/50'
                        : 'bg-gray-900 text-white hover:bg-gray-800 shadow-gray-900/20'
                    }`}
                  >
                    View All Templates →
                  </Link>
                </div>
                
                {/* Right Side - Template Preview */}
                <div className="flex-1 lg:max-w-[600px]">
                  <div
                    className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-2xl ${
                      isStarkMode
                        ? 'bg-gray-800 border-2 border-cyan-500/30 hover:border-cyan-500/60 hover:shadow-cyan-500/30'
                        : 'bg-white border-2 border-gray-300/80 hover:border-gray-400 hover:shadow-2xl hover:shadow-gray-900/20'
                    }`}
                    onMouseEnter={() => setHoveredProject(barbershopProject.id)}
                    onMouseLeave={() => setHoveredProject(null)}
                    onClick={() => window.location.href = '/templates/barbershop'}
                  >
                    {/* Browser Window Chrome */}
                    <div className={`border-b-2 px-4 py-3 ${
                      isStarkMode 
                        ? 'bg-gray-900 border-cyan-500/30' 
                        : 'bg-gray-100/90 border-gray-300/80'
                    }`}>
                      {/* Traffic Lights (macOS style) */}
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm"></div>
                      </div>
                    </div>
                    
                    {/* Website Preview Area */}
                    <div className={`aspect-[16/10] bg-gradient-to-br relative overflow-hidden ${
                      isStarkMode 
                        ? 'from-gray-900 to-gray-800' 
                        : 'from-gray-50 to-gray-100'
                    }`}>
                      {/* Thumbnail image */}
                      {!imageErrors.has(barbershopProject.id) ? (
                        <img 
                          src={barbershopProject.thumbnail} 
                          alt={barbershopProject.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={() => {
                            setImageErrors(prev => new Set(prev).add(barbershopProject.id));
                          }}
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br flex items-center justify-center ${
                          isStarkMode
                            ? 'from-gray-800 to-gray-700'
                            : 'from-gray-200 to-gray-300'
                        }`}>
                          <div className={`text-xs ${
                            isStarkMode ? 'text-gray-500' : 'text-gray-400'
                          }`}>Website Preview</div>
                        </div>
                      )}
                      
                      {/* Overlay with preview button - Always visible but more prominent on hover */}
                      <div
                        className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                          hoveredProject === barbershopProject.id 
                            ? 'bg-black/80 backdrop-blur-sm' 
                            : 'bg-black/40 backdrop-blur-[2px]'
                        }`}
                      >
                        <div className="text-center">
                          <div
                            className={`inline-block px-8 py-3 rounded-full text-base font-bold transition-all duration-300 hover:scale-110 shadow-xl ${
                              isStarkMode
                                ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/60'
                                : 'bg-white text-gray-900 hover:bg-gray-100 shadow-white/40'
                            }`}
                          >
                            {hoveredProject === barbershopProject.id ? 'View Templates →' : 'Click to Preview'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Features Section */}
      <section className={`py-24 px-6 sm:px-8 lg:px-12 transition-colors duration-300 ${
        isStarkMode ? 'bg-gray-900' : 'bg-gradient-to-b from-white via-gray-50/30 to-white'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
            {/* Lightning Fast */}
            <div 
              className={`rounded-xl p-6 lg:p-8 shadow-xl cursor-pointer transition-all duration-300 ${
                isStarkMode 
                  ? 'bg-gray-800 border border-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/20 hover:border-cyan-500/40'
                  : 'bg-white border border-gray-300/60 hover:shadow-2xl hover:shadow-gray-900/15 hover:border-gray-400/80'
              }`}
              onClick={() => {
                setExpandedFeatures(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(1)) {
                    newSet.delete(1);
                  } else {
                    newSet.add(1);
                  }
                  return newSet;
                });
              }}
            >
              <div className="text-center">
                <div className="text-8xl sm:text-9xl lg:text-[10rem] mb-6">⚡</div>
                <h3 className={`text-2xl font-bold tracking-tight mb-3 ${
                  isStarkMode ? 'text-white' : 'text-gray-900'
                }`}>Lightning Fast</h3>
                <p className={`font-light leading-relaxed mb-4 ${
                  isStarkMode ? 'text-gray-400' : 'text-gray-700'
                }`}>
                  Fully built custom website in 1-3 business days.
                </p>
                <div className={`overflow-hidden transition-all duration-300 ${expandedFeatures.has(1) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className={`pt-4 border-t ${
                    isStarkMode ? 'border-cyan-500/20' : 'border-gray-200/80'
                  }`}>
                    <p className={`font-light leading-relaxed text-left ${
                      isStarkMode ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      We deliver a fully built custom website in 1-3 business days. Our streamlined process, efficient workflow, and dedicated resources ensure your project moves from concept to launch at lightning speed without compromising on quality or attention to detail.
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-gray-400 text-sm">
                  {expandedFeatures.has(1) ? 'Click to collapse' : 'Click to learn more'}
                </div>
              </div>
            </div>

            {/* Pixel Perfect */}
            <div 
              className={`rounded-xl p-6 lg:p-8 shadow-xl cursor-pointer transition-all duration-300 ${
                isStarkMode 
                  ? 'bg-gray-800 border border-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/20 hover:border-cyan-500/40'
                  : 'bg-white border border-gray-300/60 hover:shadow-2xl hover:shadow-gray-900/15 hover:border-gray-400/80'
              }`}
              onClick={() => {
                setExpandedFeatures(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(2)) {
                    newSet.delete(2);
                  } else {
                    newSet.add(2);
                  }
                  return newSet;
                });
              }}
            >
              <div className="text-center">
                <div className="text-8xl sm:text-9xl lg:text-[10rem] mb-6">✨</div>
                <h3 className="text-2xl font-bold tracking-tight mb-3">Pixel Perfect</h3>
                <p className="text-gray-600 font-light leading-relaxed mb-4">
                  Industry-specific websites with tools you need.
                </p>
                <div className={`overflow-hidden transition-all duration-300 ${expandedFeatures.has(2) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className={`pt-4 border-t ${
                    isStarkMode ? 'border-cyan-500/20' : 'border-gray-200/80'
                  }`}>
                    <p className={`font-light leading-relaxed text-left ${
                      isStarkMode ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      We create a website specified towards your specific industry. With all the specific desired tools you need to succeed online. Every element is carefully crafted to meet the unique needs of your market, from industry-specific features to custom integrations that drive results.
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-gray-400 text-sm">
                  {expandedFeatures.has(2) ? 'Click to collapse' : 'Click to learn more'}
                </div>
              </div>
            </div>

            {/* 15+ Years Strong */}
            <div 
              className={`rounded-xl p-6 lg:p-8 shadow-xl cursor-pointer transition-all duration-300 ${
                isStarkMode 
                  ? 'bg-gray-800 border border-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/20 hover:border-cyan-500/40'
                  : 'bg-white border border-gray-300/60 hover:shadow-2xl hover:shadow-gray-900/15 hover:border-gray-400/80'
              }`}
              onClick={() => {
                setExpandedFeatures(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(3)) {
                    newSet.delete(3);
                  } else {
                    newSet.add(3);
                  }
                  return newSet;
                });
              }}
            >
              <div className="text-center">
                <div className="text-8xl sm:text-9xl lg:text-[10rem] mb-6">🎯</div>
                <h3 className="text-2xl font-bold tracking-tight mb-3">15+ Years Strong</h3>
                <p className="text-gray-600 font-light leading-relaxed mb-4">
                  Proven expertise across diverse markets.
                </p>
                <div className={`overflow-hidden transition-all duration-300 ${expandedFeatures.has(3) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className={`pt-4 border-t ${
                    isStarkMode ? 'border-cyan-500/20' : 'border-gray-200/80'
                  }`}>
                    <p className={`font-light leading-relaxed text-left ${
                      isStarkMode ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                      With over 15 years of experience, we've built and maintained websites across countless industries and markets. This deep expertise means we understand what works, what doesn't, and how to adapt to the unique needs of each client. We've seen trends come and go, and we know how to build solutions that stand the test of time.
                    </p>
                  </div>
                </div>
                <div className="mt-4 text-gray-400 text-sm">
                  {expandedFeatures.has(3) ? 'Click to collapse' : 'Click to learn more'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Section - Hidden for now */}
      {false && (
      <section className={`py-24 px-4 sm:px-6 lg:px-8 transition-colors duration-300 ${
        isStarkMode ? 'bg-black' : 'bg-gradient-to-b from-white to-gray-50/50'
      }`}>
        <div className="w-full mx-auto">
          <div className="text-center mb-16 px-4">
            <h2 className={`text-6xl sm:text-7xl lg:text-8xl font-black mb-4 tracking-[-0.05em] ${isStarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              Our Work
            </h2>
            <p className={`text-xl font-light ${isStarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Functional websites built for specific markets
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-xl ${
                  isStarkMode
                    ? 'bg-gray-800 border border-cyan-500/20 hover:border-cyan-500/40'
                    : 'bg-white border-2 border-gray-300/60 hover:border-gray-400/80 hover:shadow-2xl hover:shadow-gray-900/15'
                }`}
                onMouseEnter={() => setHoveredProject(project.id)}
                onMouseLeave={() => setHoveredProject(null)}
              >
                {/* Browser Window Chrome */}
                <div className={`border-b-2 px-3 py-2.5 ${
                  isStarkMode 
                    ? 'bg-gray-900 border-cyan-500/20' 
                    : 'bg-gray-100/80 border-gray-300/60'
                }`}>
                  {/* Traffic Lights (macOS style) */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                  </div>
                </div>
                
                {/* Website Preview Area */}
                <div className={`aspect-[16/10] bg-gradient-to-br relative overflow-hidden ${
                  isStarkMode 
                    ? 'from-gray-900 to-gray-800' 
                    : 'from-gray-50 to-gray-100'
                }`}>
                  {/* Thumbnail image */}
                  {!imageErrors.has(project.id) ? (
                    <img 
                      src={project.thumbnail} 
                      alt={project.name}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setImageErrors(prev => new Set(prev).add(project.id));
                      }}
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br flex items-center justify-center ${
                      isStarkMode
                        ? 'from-gray-800 to-gray-700'
                        : 'from-gray-200 to-gray-300'
                    }`}>
                      <div className={`text-xs ${
                        isStarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`}>Website Preview</div>
                    </div>
                  )}
                  
                  {/* Overlay with preview button */}
                  <div
                    className={`absolute inset-0 bg-black/70 flex items-center justify-center transition-all duration-300 ${
                      hoveredProject === project.id ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <button
                      onClick={() => handlePreview(project.id)}
                      className={`px-8 py-3 rounded-full font-bold transition-all duration-200 hover:scale-105 ${
                        isStarkMode
                          ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                          : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                      }`}
                    >
                      Launch Site
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Call to Action Section */}
      <section className={`py-32 px-6 sm:px-8 lg:px-12 transition-colors duration-300 relative ${
        isStarkMode 
          ? 'bg-gradient-to-b from-gray-900 to-black text-white' 
          : 'bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white'
      }`}>
        <div className="max-w-4xl mx-auto text-center">
            <h2 className={`text-5xl sm:text-6xl lg:text-7xl font-black mb-6 tracking-tight ${
              isStarkMode 
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                : 'text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-white'
            }`}>
              Ready to Build Your Site?
            </h2>
            <p className={`text-xl sm:text-2xl mb-12 font-light max-w-2xl mx-auto ${
              isStarkMode ? 'text-gray-400' : 'text-gray-300'
            }`}>
            Let's create a functional, high-quality website that serves your specific market. 
            Fast turnarounds guaranteed.
          </p>
          <button 
            onClick={() => setIsFormOpen(true)}
            className={`px-10 py-4 rounded-full text-lg font-bold transition-all duration-200 hover:scale-105 ${
              isStarkMode
                ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                : 'bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-white/30'
            }`}
          >
            Start Building My Site
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 px-6 sm:px-8 lg:px-12 border-t-2 transition-colors duration-300 ${
        isStarkMode 
          ? 'border-cyan-500/20 bg-black' 
          : 'border-gray-300/60 bg-white'
      }`}>
        <div className={`max-w-7xl mx-auto text-center ${
          isStarkMode ? 'text-gray-400' : 'text-gray-700'
        }`}>
          <p className="font-light">
            © {new Date().getFullYear()} AI Web Design Firm. All rights reserved.
          </p>
        </div>
      </footer>

      {/* TV Video - Lower Right Corner (under header) */}
      {showVideo && (
        <div 
          className={`fixed top-24 right-6 z-40 transition-transform duration-500 ease-out ${
            videoSlidingOut 
              ? 'translate-x-[120%]' 
              : videoSliding 
                ? 'translate-x-0' 
                : 'translate-x-[120%]'
          }`}
          style={{ maxWidth: '300px', width: '90vw' }}
        >
          <div className="relative">
            {/* Video element */}
            <video
              ref={videoRef}
              src="/TV.mp4"
              className="w-full h-auto rounded-lg shadow-2xl border-2 border-cyan-500/30"
              playsInline
              muted={!audioAllowed}
              loop={false}
              onEnded={() => {
                // Start slide-out animation
                setVideoSlidingOut(true);
                // Hide video after slide-out animation completes
                setTimeout(() => {
                  setShowVideo(false);
                  setVideoSliding(false);
                  setVideoSlidingOut(false);
                  setShowPlayButton(true);
                }, 600); // Wait for slide-out animation (500ms) + small buffer
              }}
            />
            
            {/* Play Button Overlay */}
            {showPlayButton && (
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg cursor-pointer transition-all duration-300 hover:bg-black/70"
                onClick={handlePlayVideo}
              >
                <div className="relative">
                  {/* Glowing circle background */}
                  <div className="absolute inset-0 bg-cyan-500/30 blur-2xl rounded-full"></div>
                  
                  {/* Play button */}
                  <button className="relative w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center shadow-2xl shadow-cyan-500/50 border-2 border-cyan-400/50 hover:scale-110 transition-transform duration-200">
                    <svg 
                      className="w-10 h-10 text-black ml-1" 
                      fill="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  
                  {/* Pulse animation */}
                  <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping"></div>
                </div>
              </div>
            )}
            
            {/* Glow effect */}
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl -z-10 rounded-lg"></div>
          </div>
        </div>
      )}

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src="/attention.mp3"
        preload="auto"
      />

      {/* Audio Permission Prompt - Tony Stark Style */}
      {showAudioPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md">
          {/* Animated background grid */}
          <div className="absolute inset-0 opacity-20">
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(34, 211, 238, 0.3) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(34, 211, 238, 0.3) 1px, transparent 1px)
                `,
                backgroundSize: '50px 50px',
                animation: 'gridMove 20s linear infinite'
              }}
            ></div>
          </div>
          
          {/* Main modal */}
          <div className="relative z-10 max-w-2xl mx-4">
            <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 border-2 border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-500/20 p-8 md:p-12 relative overflow-hidden">
              {/* Glowing corner accents */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/10 blur-3xl"></div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl"></div>
              
              {/* Decorative lines */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
              
              <div className="relative z-10">
                {/* Icon/Logo */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full"></div>
                    <div className="relative w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center border-2 border-cyan-400/50">
                      <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Title */}
                <h2 className="text-4xl md:text-5xl font-black text-center mb-4 tracking-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-300 to-blue-400">
                    FULL EXPERIENCE
                  </span>
                </h2>
                
                {/* Subtitle */}
                <p className="text-xl md:text-2xl text-center mb-2 font-bold text-gray-300">
                  Allow Audio?
                </p>
                
                {/* Description */}
                <p className="text-base md:text-lg text-center mb-8 text-gray-400 font-light leading-relaxed">
                  Enable audio for an immersive experience with enhanced interactions and feedback.
                </p>
                
                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleAllowAudio}
                    className="px-8 py-4 rounded-full text-lg font-bold transition-all duration-200 hover:scale-105 bg-gradient-to-r from-cyan-500 to-blue-500 text-black hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/50 border-2 border-cyan-400/50"
                  >
                    ✓ Allow
                  </button>
                  <button
                    onClick={handleDenyAudio}
                    className="px-8 py-4 rounded-full text-lg font-bold transition-all duration-200 hover:scale-105 bg-gray-800 text-gray-300 hover:bg-gray-700 border-2 border-gray-700 hover:border-gray-600"
                  >
                    Continue Without
                  </button>
                </div>
                
                {/* Small note */}
                <p className="text-xs text-center mt-6 text-gray-500">
                  You can change this preference anytime
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme Toggle - Day/Night Switch - Bottom Left - Floating Action Button */}

      {/* Key Icon - Access Portal - Bottom Right - Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Link
          href="/login"
          className={`w-14 h-14 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-2xl hover:scale-110 flex items-center justify-center ${
            isStarkMode 
              ? 'bg-gray-800 border border-cyan-500/20 hover:border-cyan-500/40 focus:ring-cyan-500 shadow-cyan-500/20' 
              : 'bg-white border-2 border-gray-300/60 hover:border-gray-400/80 focus:ring-gray-400 shadow-gray-900/20'
          }`}
          aria-label="Access portal"
        >
          <svg 
            className={`w-6 h-6 ${isStarkMode ? 'text-cyan-400' : 'text-gray-700'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </Link>
      </div>

      {/* Demo Form Modal */}
      {isFormOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setIsFormOpen(false)}
        >
          <div 
            className={`rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto transition-colors duration-300 ${
              isStarkMode 
                ? 'bg-gray-900 border border-cyan-500/20' 
                : 'bg-white border-2 border-gray-300/60 shadow-gray-900/20'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 lg:p-12">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <h2 className={`text-4xl sm:text-5xl font-black tracking-tighter ${
                  isStarkMode 
                    ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500'
                    : 'text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900'
                }`}>
                  Create Your Account
                </h2>
                <button
                  onClick={() => setIsFormOpen(false)}
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

              {/* Form */}
              {formError && (
                <div className={`p-4 rounded-lg mb-6 ${
                  isStarkMode 
                    ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                    : 'bg-red-50 border-2 border-red-200 text-red-600'
                }`}>
                  {formError}
                </div>
              )}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFormError('');
                  
                  // Validation
                  if (!formData.fullName || !formData.email || !formData.password || !formData.confirmPassword || !formData.phone) {
                    setFormError('All fields are required');
                    return;
                  }

                  if (formData.password !== formData.confirmPassword) {
                    setFormError('Passwords do not match');
                    return;
                  }

                  if (formData.password.length < 6) {
                    setFormError('Password must be at least 6 characters');
                    return;
                  }

                  // Validate email format
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(formData.email)) {
                    setFormError('Invalid email format');
                    return;
                  }

                  setIsFormLoading(true);
                  
                  try {
                    const response = await fetch('/api/clients', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        email: formData.email,
                        password: formData.password,
                        fullName: formData.fullName,
                        phone: formData.phone,
                      }),
                    });

                    const data = await response.json();

                    if (response.ok) {
                      // Auto-login after signup
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('clientAuth', 'authenticated');
                        localStorage.setItem('clientAuthEmail', formData.email);
                        localStorage.setItem('clientAuthTime', Date.now().toString());
                        localStorage.setItem('clientId', data.client.id.toString());
                      }
                      
                      // Redirect to client dashboard
                      router.push('/client/dashboard');
                    } else {
                      setFormError(data.error || 'Signup failed. Please try again.');
                      setIsFormLoading(false);
                    }
                  } catch (error) {
                    console.error('Signup error:', error);
                    setFormError('An error occurred. Please try again later.');
                    setIsFormLoading(false);
                  }
                }}
                className="space-y-6"
              >
                {/* Full Name */}
                <div>
                  <label htmlFor="fullName" className={`block text-sm font-medium mb-2 ${
                    isStarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      isStarkMode
                        ? 'bg-gray-800 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                        : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                    }`}
                    placeholder="John Doe"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className={`block text-sm font-medium mb-2 ${
                    isStarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      isStarkMode
                        ? 'bg-gray-800 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                        : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                    }`}
                    placeholder="john@example.com"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="phone" className={`block text-sm font-medium mb-2 ${
                    isStarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      isStarkMode
                        ? 'bg-gray-800 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                        : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                    }`}
                    placeholder="(555) 123-4567"
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className={`block text-sm font-medium mb-2 ${
                    isStarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      isStarkMode
                        ? 'bg-gray-800 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                        : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                    }`}
                    placeholder="At least 6 characters"
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-2 ${
                    isStarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      isStarkMode
                        ? 'bg-gray-800 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                        : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                    }`}
                    placeholder="Confirm your password"
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isFormLoading}
                    className={`w-full px-8 py-4 rounded-full text-lg font-bold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed ${
                      isStarkMode
                        ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                        : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                    }`}
                  >
                    {isFormLoading ? 'Creating Account...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

