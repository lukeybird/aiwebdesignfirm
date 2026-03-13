'use client';

import { useState, useEffect } from 'react';

export default function DeviceStatusPage() {
  const [status, setStatus] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/device-status');
        const data = await res.json();
        setStatus(data.status === true || data.status === false ? data.status : null);
      } catch {
        setStatus(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">Loading status...</div>
      </main>
    );
  }

  const isOk = status === true;
  const isBad = status === false;
  const bg = isOk ? 'bg-green-600' : isBad ? 'bg-red-600' : 'bg-gray-700';

  return (
    <main className={`min-h-screen flex items-center justify-center ${bg} transition-colors duration-500`}>
      <div className="text-center text-white">
        {status === null ? (
          <p className="text-xl font-medium opacity-90">Waiting for device status...</p>
        ) : (
          <p className="text-2xl font-bold">
            {isOk ? 'Status: OK' : 'Status: Off'}
          </p>
        )}
      </div>
    </main>
  );
}
