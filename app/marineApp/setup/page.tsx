'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';

const CONFIG_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CONFIG_CHAR_UUID = '4fafc202-1fb5-459e-8fcc-c5c9c331914b';

function SetupContent() {
  const searchParams = useSearchParams();
  const deviceId = searchParams.get('device_id') || '';
  const token = searchParams.get('token') || '';
  const name = searchParams.get('name') || 'My Boat';

  const [wifiSsid, setWifiSsid] = useState('ORBI38');
  const [wifiPassword, setWifiPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const serverUrl = typeof window !== 'undefined' ? `${window.location.origin}` : '';

  useEffect(() => {
    if (!deviceId || !token) setStatus('error');
  }, [deviceId, token]);

  const sendConfigToDevice = async () => {
    if (!deviceId || !token || !wifiSsid.trim()) {
      setMessage('Device ID, token, and WiFi SSID are required.');
      setStatus('error');
      return;
    }
    setStatus('connecting');
    setMessage('');

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [CONFIG_SERVICE_UUID] }],
        optionalServices: [CONFIG_SERVICE_UUID],
      });

      setStatus('sending');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(CONFIG_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CONFIG_CHAR_UUID);

      const config = {
        device_id: deviceId,
        token,
        server_url: serverUrl,
        wifi_ssid: wifiSsid.trim(),
        wifi_password: wifiPassword,
      };
      const encoded = new TextEncoder().encode(JSON.stringify(config));
      await characteristic.writeValue(encoded);

      setStatus('done');
      setMessage('Config sent. Your device should connect to WiFi and start reporting.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || 'Could not connect to device. Make sure the device is in setup mode (blue LED blinking).');
    }
  };

  if (!deviceId || !token) {
    return (
      <main className="min-h-screen flex flex-col p-6">
        <nav className="flex items-center gap-4 mb-6">
          <Link href="/marineApp/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm">
            ← Dashboard
          </Link>
        </nav>
        <p className="text-gray-400">Missing device_id or token. Add a device from the dashboard first.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col p-6 max-w-md mx-auto">
      <nav className="flex items-center gap-4 mb-6">
        <Link href="/marineApp/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm">
          ← Dashboard
        </Link>
      </nav>
      <h1 className="text-xl font-bold text-white mb-2">Set up device</h1>
      <p className="text-gray-400 text-sm mb-6">
        Put your device in setup mode (blue LED blinking). Then connect with your phone and send the config below.
      </p>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-4 mb-6">
        <p className="text-gray-500 text-xs">Device: <span className="text-gray-300 font-mono">{name}</span></p>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">WiFi network (SSID)</label>
          <input
            type="text"
            value={wifiSsid}
            onChange={(e) => setWifiSsid(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
            placeholder="ORBI38"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">WiFi password</label>
          <input
            type="password"
            value={wifiPassword}
            onChange={(e) => setWifiPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
            placeholder="••••••••"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={sendConfigToDevice}
        disabled={status === 'connecting' || status === 'sending'}
        className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium disabled:opacity-50"
      >
        {status === 'idle' && 'Connect to device and send config'}
        {(status === 'connecting' || status === 'sending') && 'Connecting…'}
        {status === 'done' && 'Done'}
        {status === 'error' && 'Try again'}
      </button>

      {message && (
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      )}
    </main>
  );
}

export default function MarineSetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-6 text-gray-500">Loading…</div>}>
      <SetupContent />
    </Suspense>
  );
}
