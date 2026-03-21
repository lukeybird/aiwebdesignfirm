'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Device = {
  id: number;
  device_id: string;
  name: string;
  last_float_status: string | null;
  last_activity_at: string | null;
  created_at: string;
};

export default function MarineDashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const auth = localStorage.getItem('marineAuth');
    const authTime = localStorage.getItem('marineAuthTime');
    const userId = localStorage.getItem('marineUserId');
    const valid = auth && authTime && userId && Date.now() - parseInt(authTime, 10) < 7 * 24 * 60 * 60 * 1000;
    if (!valid) {
      router.replace('/marineApp/login');
      return;
    }
    fetch('/api/marine/devices', {
      headers: { 'X-Marine-User-Id': userId! },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.devices) setDevices(data.devices);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mounted, router]);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = localStorage.getItem('marineUserId');
    if (!userId) return;
    setAdding(true);
    try {
      const res = await fetch('/api/marine/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Marine-User-Id': userId },
        body: JSON.stringify({ name: newName || 'My Boat' }),
      });
      const data = await res.json();
      if (data.device) {
        setNewName('');
        setDevices((prev) => [{ ...data.device, last_float_status: null, last_activity_at: null }, ...prev]);
        router.push(`/marineApp/setup?device_id=${data.device.device_id}&token=${data.device.auth_token}&name=${encodeURIComponent(data.device.name)}`);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('marineAuth');
      localStorage.removeItem('marineUserId');
      localStorage.removeItem('marineAuthTime');
    }
    router.replace('/marineApp/login');
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex-shrink-0 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-gray-200">Marine Monitor</span>
        <div className="flex items-center gap-3">
          <Link href="/marineApp/dashboard" className="text-sm text-gray-400 hover:text-white">
            Dashboard
          </Link>
          <button type="button" onClick={handleLogout} className="text-sm text-gray-400 hover:text-white">
            Log out
          </button>
        </div>
      </nav>

      <section className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <h1 className="text-xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400 text-sm mb-6">Your devices and float switch status.</p>

        <form onSubmit={handleAddDevice} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Device name (e.g. Luke's Boat)"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add device'}
          </button>
        </form>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading devices…</p>
        ) : devices.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6 text-gray-500 text-sm">
            <p>No devices yet. Add a device, then set it up with your phone via Bluetooth.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {devices.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-white">{d.name}</p>
                  <p className="text-gray-500 text-sm font-mono">{d.device_id}</p>
                  {d.last_activity_at && (
                    <p className="text-gray-500 text-xs mt-1">
                      Last activity: {new Date(d.last_activity_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    d.last_float_status === 'closed' || d.last_float_status === 'activated'
                      ? 'bg-amber-500/20 text-amber-400'
                      : d.last_float_status === 'open'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {d.last_float_status === 'closed' || d.last_float_status === 'activated'
                    ? 'Float: closed'
                    : d.last_float_status === 'open'
                      ? 'Float: open'
                      : 'No data yet'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
