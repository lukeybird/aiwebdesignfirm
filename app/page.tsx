'use client';

import { useState } from 'react';

export default function Home() {
  const [hoveredProject, setHoveredProject] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState<Set<number>>(new Set());

  const projects = [
    { id: 1, name: 'PayNGO Systems', url: 'https://www.payngosystems.com', thumbnail: '/PayNGoSystyems.png' },
    { id: 2, name: 'PixaWorld.io', url: 'https://pixaworld.io', thumbnail: '/pixaworld.png' },
    { id: 3, name: 'Project Three', url: 'https://example.com', thumbnail: '/placeholder-thumbnail.jpg' },
    { id: 4, name: 'Project Four', url: 'https://example.com', thumbnail: '/placeholder-thumbnail.jpg' },
    { id: 5, name: 'Project Five', url: 'https://example.com', thumbnail: '/placeholder-thumbnail.jpg' },
    { id: 6, name: 'Project Six', url: 'https://example.com', thumbnail: '/placeholder-thumbnail.jpg' },
  ];

  const handlePreview = (projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    if (project?.url) {
      window.open(project.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="w-full mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 2xl:px-20 py-4">
          <div className="flex items-center justify-between max-w-[2400px] mx-auto">
            <div className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight">
              Advanced AI Web Design Firm
            </div>
            <button className="px-6 py-2.5 lg:px-8 lg:py-3 bg-black text-white rounded-full text-sm lg:text-base font-medium hover:bg-gray-800 transition-all duration-200 hover:scale-105">
              Start My Project
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen sm:h-[600px] md:h-[650px] lg:h-[700px] xl:h-[600px] 2xl:h-[550px] flex items-center pt-32 pb-24 sm:pt-20 sm:pb-0 md:pt-20 lg:pt-20 xl:pt-20 2xl:pt-20 px-6 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto w-full">
          <div className="text-center mb-12 sm:mb-16 md:mb-18 lg:mb-20 xl:mb-16 2xl:mb-12">
            <h1 className="text-8xl sm:text-9xl lg:text-[12rem] xl:text-[14rem] font-black tracking-[-0.03em] mb-2 sm:mb-3 md:mb-4 lg:mb-3 xl:mb-2 2xl:mb-2 leading-none">
              BUILD
            </h1>
            <h2 className="text-8xl sm:text-9xl lg:text-[12rem] xl:text-[14rem] font-black tracking-[-0.03em] mb-2 sm:mb-3 md:mb-4 lg:mb-3 xl:mb-2 2xl:mb-2 leading-none text-gray-300">
              LAUNCH
            </h2>
            <h3 className="text-8xl sm:text-9xl lg:text-[12rem] xl:text-[14rem] font-black tracking-[-0.03em] mb-8 sm:mb-10 md:mb-12 lg:mb-10 xl:mb-8 2xl:mb-6 leading-none">
              MAINTAIN
            </h3>
            <p className="text-xl sm:text-2xl text-gray-600 max-w-2xl mx-auto font-light leading-relaxed">
              Functional websites for specific markets. Fast turnarounds. 
              Detailed and high-quality work. Over 15 years of experience.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 sm:px-8 lg:px-12 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-start">
            {/* Lightning Fast */}
            <div 
              className="bg-white rounded-2xl p-6 lg:p-8 shadow-lg border border-gray-200 cursor-pointer transition-all duration-300 hover:shadow-xl"
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
                <h3 className="text-2xl font-bold tracking-tight mb-3">Lightning Fast</h3>
                <p className="text-gray-600 font-light leading-relaxed mb-4">
                  Fully built custom website in 1-3 business days.
                </p>
                <div className={`overflow-hidden transition-all duration-300 ${expandedFeatures.has(1) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-gray-600 font-light leading-relaxed text-left">
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
              className="bg-white rounded-2xl p-6 lg:p-8 shadow-lg border border-gray-200 cursor-pointer transition-all duration-300 hover:shadow-xl"
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
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-gray-600 font-light leading-relaxed text-left">
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
              className="bg-white rounded-2xl p-6 lg:p-8 shadow-lg border border-gray-200 cursor-pointer transition-all duration-300 hover:shadow-xl"
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
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-gray-600 font-light leading-relaxed text-left">
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

      {/* Portfolio Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="w-full mx-auto">
          <div className="text-center mb-16 px-4">
            <h2 className="text-5xl sm:text-6xl font-black mb-4 tracking-tight">
              Our Work
            </h2>
            <p className="text-xl text-gray-600 font-light">
              Functional websites built for specific markets
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative bg-white rounded-lg overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-[1.02] shadow-lg border border-gray-200"
                onMouseEnter={() => setHoveredProject(project.id)}
                onMouseLeave={() => setHoveredProject(null)}
              >
                {/* Browser Window Chrome */}
                <div className="bg-gray-50 border-b border-gray-200 px-3 py-2.5">
                  {/* Traffic Lights (macOS style) */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                  </div>
                </div>
                
                {/* Website Preview Area */}
                <div className="aspect-[16/10] bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
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
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                      <div className="text-gray-400 text-xs">Website Preview</div>
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
                      className="px-8 py-3 bg-white text-black rounded-full font-medium hover:bg-gray-100 transition-all duration-200 hover:scale-105"
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

      {/* Call to Action Section */}
      <section className="py-32 px-6 sm:px-8 lg:px-12 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 tracking-tight">
            Ready to Build Your Site?
          </h2>
          <p className="text-xl sm:text-2xl text-gray-300 mb-12 font-light max-w-2xl mx-auto">
            Let's create a functional, high-quality website that serves your specific market. 
            Fast turnarounds guaranteed.
          </p>
          <button className="px-10 py-4 bg-white text-black rounded-full text-lg font-semibold hover:bg-gray-100 transition-all duration-200 hover:scale-105">
            Start Building My Site
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 sm:px-8 lg:px-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto text-center text-gray-600">
          <p className="font-light">
            © {new Date().getFullYear()} Advanced AI Web Design Firm. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

