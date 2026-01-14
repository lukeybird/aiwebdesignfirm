'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [hoveredProject, setHoveredProject] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState<Set<number>>(new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Always use dark mode
  const [isStarkMode] = useState(true);

  // Set theme to dark mode in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', 'stark');
    }
  }, []);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    competitorSites: '',
    notes: '',
  });

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
            }`} style={{ fontSize: 'clamp(3rem, 18vw, 14rem)' }}>
              BUILD
            </h1>
            <h2 className={`font-black tracking-[-0.04em] mb-2 sm:mb-3 md:mb-4 lg:mb-3 xl:mb-2 2xl:mb-2 leading-none relative z-10 text-center w-full ${
              isStarkMode ? 'text-gray-500' : 'text-gray-400'
            }`} style={{ fontSize: 'clamp(3rem, 18vw, 14rem)' }}>
              LAUNCH
            </h2>
            <h3 className={`font-black tracking-[-0.04em] mb-8 sm:mb-10 md:mb-12 lg:mb-10 xl:mb-8 2xl:mb-6 leading-none relative z-10 text-center w-full ${
              isStarkMode ? 'text-white' : 'text-gray-900'
            }`} style={{ fontSize: 'clamp(3rem, 18vw, 14rem)' }}>
              MAINTAIN
            </h3>
            <p className={`text-xl sm:text-2xl max-w-2xl mx-auto font-light leading-relaxed ${
              isStarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Functional websites for specific markets. Fast turnarounds. 
              Detailed and high-quality work. Over 15 years of experience.
            </p>
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
                  Schedule a Demo
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
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  
                  try {
                    const response = await fetch('/api/contact', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(formData),
                    });

                    const data = await response.json();

                    if (response.ok) {
                      // Success - show success message and reset form
                      alert('Thank you! Your demo request has been submitted successfully. We\'ll be in touch soon!');
                      setFormData({
                        fullName: '',
                        phone: '',
                        email: '',
                        competitorSites: '',
                        notes: '',
                      });
                      setIsFormOpen(false);
                    } else {
                      // Error - show detailed error message
                      const errorMsg = data.error || 'Failed to submit form. Please try again.';
                      const details = data.details ? `\n\n${data.details}` : '';
                      alert(`${errorMsg}${details}`);
                      console.error('Form submission error:', data);
                    }
                  } catch (error) {
                    console.error('Form submission error:', error);
                    alert('An error occurred. Please try again later.');
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

                {/* Competitor Sites */}
                <div>
                  <label htmlFor="competitorSites" className={`block text-sm font-medium mb-2 ${
                    isStarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Competitor Sites You Like
                  </label>
                  <textarea
                    id="competitorSites"
                    value={formData.competitorSites}
                    onChange={(e) => setFormData({ ...formData, competitorSites: e.target.value })}
                    rows={3}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all resize-none ${
                      isStarkMode
                        ? 'bg-gray-800 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                        : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                    }`}
                    placeholder="List any competitor websites you admire or want to emulate..."
                  />
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className={`block text-sm font-medium mb-2 ${
                    isStarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all resize-none ${
                      isStarkMode
                        ? 'bg-gray-800 border-cyan-500/20 text-white focus:ring-cyan-500 focus:border-cyan-500'
                        : 'bg-white border-gray-300/60 text-black focus:ring-gray-900 focus:border-gray-900'
                    }`}
                    placeholder="Any additional information you'd like to share..."
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    className={`w-full px-8 py-4 rounded-full text-lg font-bold transition-all duration-200 hover:scale-[1.02] ${
                      isStarkMode
                        ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/50'
                        : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20'
                    }`}
                  >
                    Schedule Demo
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

// Deployment test
