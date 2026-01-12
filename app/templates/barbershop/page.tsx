'use client';

import { useEffect } from 'react';

export default function BarbershopTemplates() {
  useEffect(() => {
    // Redirect to the actual HTML file
    window.location.href = '/Barbershop/index.html';
  }, []);

  // Show loading state while redirecting

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading barbershop template...</p>
      </div>
    </div>
  );
}

