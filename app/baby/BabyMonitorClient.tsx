'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';

type Mode = 'home' | 'host-setup' | 'viewer-setup' | 'host' | 'viewer';
type Role = 'host' | 'viewer';

type MonitorSession = {
  roomCode: string;
  channelName: string;
  token: string;
  clientId: string;
  role: Role;
  iceServers?: RTCIceServer[];
};

type SignalMessage = {
  type: 'viewer-ready' | 'offer' | 'answer' | 'ice' | 'viewer-left' | 'host-stopped';
  fromId: string;
  fromRole: Role;
  targetId: string | null;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
};

async function api(body: Record<string, unknown>) {
  const response = await fetch('/api/baby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}

export default function BabyMonitorClient() {
  const [mode, setMode] = useState<Mode>('home');
  const [pin, setPin] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [session, setSession] = useState<MonitorSession | null>(null);
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  // Start muted so mobile Safari/Chrome will autoplay the incoming camera.
  // The viewer can enable sound with a direct tap once video is visible.
  const [viewerMuted, setViewerMuted] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [copied, setCopied] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pusherRef = useRef<Pusher | null>(null);
  const hostPeersRef = useRef(new Map<string, RTCPeerConnection>());
  const viewerPeerRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const sessionRef = useRef<MonitorSession | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('room');
    if (fromUrl) {
      setRoomCode(fromUrl.toUpperCase().slice(0, 12));
      setMode('viewer-setup');
    }
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [mode]);

  const sendSignal = useCallback(
    async (type: SignalMessage['type'], targetId: string | null, payload: SignalMessage['payload'] = null) => {
      const active = sessionRef.current;
      if (!active) return;
      await api({ action: 'signal', token: active.token, type, targetId, payload });
    },
    [],
  );

  const closePeer = useCallback((clientId: string) => {
    const peer = hostPeersRef.current.get(clientId);
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.close();
      hostPeersRef.current.delete(clientId);
      setViewerCount(hostPeersRef.current.size);
    }
    pendingIceRef.current.delete(clientId);
  }, []);

  const flushIce = useCallback(async (key: string, peer: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(key) || [];
    pendingIceRef.current.delete(key);
    for (const candidate of queued) {
      await peer.addIceCandidate(candidate).catch(() => {});
    }
  }, []);

  const createHostOffer = useCallback(
    async (viewerId: string) => {
      const active = sessionRef.current;
      const stream = localStreamRef.current;
      if (!active || active.role !== 'host' || !stream) return;
      const existing = hostPeersRef.current.get(viewerId);
      if (
        existing &&
        (existing.connectionState === 'new' ||
          existing.connectionState === 'connecting' ||
          existing.connectionState === 'connected')
      ) {
        if (existing.connectionState !== 'connected' && existing.localDescription) {
          await sendSignal('offer', viewerId, existing.localDescription.toJSON());
        }
        return;
      }
      closePeer(viewerId);

      const peer = new RTCPeerConnection({
        iceServers: active.iceServers?.length
          ? active.iceServers
          : [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      hostPeersRef.current.set(viewerId, peer);
      setViewerCount(hostPeersRef.current.size);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal('ice', viewerId, event.candidate.toJSON()).catch(() => {});
        }
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') setStatus('Live');
        if (peer.connectionState === 'failed' || peer.connectionState === 'closed') closePeer(viewerId);
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal('offer', viewerId, offer);
    },
    [closePeer, sendSignal],
  );

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      const active = sessionRef.current;
      if (!active || message.fromId === active.clientId) return;
      if (message.targetId && message.targetId !== active.clientId) return;

      if (message.type === 'host-stopped' && active.role === 'viewer') {
        viewerPeerRef.current?.close();
        viewerPeerRef.current = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setStatus('Camera stopped');
        setError('The camera device ended this monitor session.');
        return;
      }

      if (active.role === 'host') {
        if (message.type === 'viewer-ready') {
          await createHostOffer(message.fromId);
          return;
        }
        if (message.type === 'viewer-left') {
          closePeer(message.fromId);
          return;
        }
        const peer = hostPeersRef.current.get(message.fromId);
        if (!peer) return;
        if (message.type === 'answer' && message.payload) {
          await peer.setRemoteDescription(message.payload as RTCSessionDescriptionInit);
          await flushIce(message.fromId, peer);
        } else if (message.type === 'ice' && message.payload) {
          const candidate = message.payload as RTCIceCandidateInit;
          if (peer.remoteDescription) await peer.addIceCandidate(candidate).catch(() => {});
          else pendingIceRef.current.set(message.fromId, [...(pendingIceRef.current.get(message.fromId) || []), candidate]);
        }
        return;
      }

      if (message.type === 'offer' && message.payload) {
        viewerPeerRef.current?.close();
        const peer = new RTCPeerConnection({
          iceServers: active.iceServers?.length
            ? active.iceServers
            : [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        viewerPeerRef.current = peer;
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            void sendSignal('ice', message.fromId, event.candidate.toJSON()).catch(() => {});
          }
        };
        peer.ontrack = (event) => {
          const stream = event.streams[0];
          if (remoteVideoRef.current && stream) {
            remoteVideoRef.current.srcObject = stream;
            void remoteVideoRef.current.play().catch(() => {});
          }
          setStatus('Live');
          setError('');
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'connected') setStatus('Live');
          if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
            setStatus('Reconnecting…');
            void sendSignal('viewer-ready', null).catch(() => {});
          }
        };
        await peer.setRemoteDescription(message.payload as RTCSessionDescriptionInit);
        await flushIce('viewer', peer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        await sendSignal('answer', message.fromId, answer);
      } else if (message.type === 'ice' && message.payload) {
        const peer = viewerPeerRef.current;
        const candidate = message.payload as RTCIceCandidateInit;
        if (peer?.remoteDescription) await peer.addIceCandidate(candidate).catch(() => {});
        else pendingIceRef.current.set('viewer', [...(pendingIceRef.current.get('viewer') || []), candidate]);
      }
    },
    [closePeer, createHostOffer, flushIce, sendSignal],
  );

  useEffect(() => {
    if (!session) return;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!key) {
      setError('Real-time signaling is not configured on this deployment.');
      return;
    }

    const pusher = new Pusher(key, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
      forceTLS: true,
      channelAuthorization: {
        endpoint: '/api/baby/auth',
        transport: 'ajax',
        params: { monitorToken: session.token },
      },
    });
    pusherRef.current = pusher;
    const channel = pusher.subscribe(session.channelName);
    channel.bind('pusher:subscription_succeeded', () => {
      setStatus(session.role === 'host' ? 'Camera live — waiting for viewers' : 'Connecting to camera…');
      if (session.role === 'viewer') void sendSignal('viewer-ready', null).catch((err) => setError(err.message));
    });
    channel.bind('pusher:subscription_error', () => setError('Could not enter the private monitor channel.'));
    channel.bind('signal', (message: SignalMessage) => {
      void handleSignal(message).catch((err) => setError(err instanceof Error ? err.message : 'Connection error.'));
    });

    const heartbeat = window.setInterval(() => {
      void api({ action: 'heartbeat', token: session.token })
        .then((data) => {
          if (session.role === 'host') setViewerCount(Number(data.viewerCount) || 0);
        })
        .catch((err) => setError(err.message));
    }, 15_000);
    void api({ action: 'heartbeat', token: session.token }).catch(() => {});

    const retry =
      session.role === 'viewer'
        ? window.setInterval(() => {
            if (viewerPeerRef.current?.connectionState !== 'connected') {
              void sendSignal('viewer-ready', null).catch(() => {});
            }
          }, 5_000)
        : 0;

    return () => {
      window.clearInterval(heartbeat);
      if (retry) window.clearInterval(retry);
      channel.unbind_all();
      pusher.unsubscribe(session.channelName);
      pusher.disconnect();
      if (pusherRef.current === pusher) pusherRef.current = null;
    };
  }, [handleSignal, sendSignal, session]);

  useEffect(() => {
    if (mode !== 'host' && mode !== 'viewer') return;
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      const wakeLock = (navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      }).wakeLock;
      if (wakeLock) lock = await wakeLock.request('screen').catch(() => null);
    };
    void request();
    return () => {
      void lock?.release();
    };
  }, [mode]);

  const startCamera = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        });
        setMicOn(false);
      }
      localStreamRef.current = stream;
      const created = (await api({ action: 'create', pin })) as MonitorSession;
      setSession(created);
      setRoomCode(created.roomCode);
      setMode('host');
      setStatus('Starting secure room…');
    } catch (err) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setError(err instanceof Error ? err.message : 'Camera access failed.');
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const joined = (await api({ action: 'join', roomCode, pin })) as MonitorSession;
      setSession(joined);
      setRoomCode(joined.roomCode);
      setMode('viewer');
      setStatus('Entering private room…');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join room.');
    } finally {
      setBusy(false);
    }
  };

  const leaveMonitor = async () => {
    const active = sessionRef.current;
    if (active?.role === 'host') {
      await fetch('/api/baby', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: active.token }),
        keepalive: true,
      }).catch(() => {});
    } else if (active) {
      await sendSignal('viewer-left', null).catch(() => {});
    }
    hostPeersRef.current.forEach((peer) => peer.close());
    hostPeersRef.current.clear();
    viewerPeerRef.current?.close();
    viewerPeerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setSession(null);
    setViewerCount(0);
    setPin('');
    setError('');
    setStatus('Ready');
    setMode('home');
  };

  const switchCamera = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setBusy(true);
    try {
      const replacement = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false,
      });
      const nextTrack = replacement.getVideoTracks()[0];
      const oldTrack = stream.getVideoTracks()[0];
      if (oldTrack) {
        stream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      stream.addTrack(nextTrack);
      for (const peer of hostPeersRef.current.values()) {
        const sender = peer.getSenders().find((item) => item.track?.kind === 'video');
        if (sender) await sender.replaceTrack(nextTrack);
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setFacingMode(nextFacing);
      setCameraOn(true);
    } catch {
      setError('Could not switch cameras on this device.');
    } finally {
      setBusy(false);
    }
  };

  const toggleTrack = (kind: 'audio' | 'video') => {
    const tracks = kind === 'audio' ? localStreamRef.current?.getAudioTracks() : localStreamRef.current?.getVideoTracks();
    const track = tracks?.[0];
    if (!track) return;
    track.enabled = !track.enabled;
    if (kind === 'audio') setMicOn(track.enabled);
    else setCameraOn(track.enabled);
  };

  const shareUrl =
    typeof window === 'undefined' ? '' : `${window.location.origin}/baby?room=${encodeURIComponent(roomCode)}`;

  const copyInvite = async () => {
    await navigator.clipboard.writeText(`Baby monitor room ${roomCode}: ${shareUrl}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (mode === 'home') {
    return (
      <main className="baby-shell">
        <section className="baby-hero">
          <span className="baby-eyebrow">Private live video</span>
          <h1>Baby monitor</h1>
          <p>Turn one phone, tablet, or computer into a camera and watch it securely from another device anywhere.</p>
          <div className="baby-role-grid">
            <button className="baby-role-card baby-role-primary" onClick={() => setMode('host-setup')}>
              <span className="baby-role-icon">●</span>
              <strong>Start camera</strong>
              <small>Use this device beside the baby</small>
            </button>
            <button className="baby-role-card" onClick={() => setMode('viewer-setup')}>
              <span className="baby-role-icon">◉</span>
              <strong>View camera</strong>
              <small>Watch from this device</small>
            </button>
          </div>
          <div className="baby-privacy-note">
            Video and audio are encrypted in transit, sent peer-to-peer when possible, and securely relayed when required. They are not recorded or stored.
          </div>
          <p className="baby-safety">This convenience monitor is not a medical device and is not a substitute for direct adult supervision.</p>
        </section>
      </main>
    );
  }

  if (mode === 'host-setup' || mode === 'viewer-setup') {
    const hosting = mode === 'host-setup';
    return (
      <main className="baby-shell">
        <section className="baby-setup-card">
          <button className="baby-back" onClick={() => { setMode('home'); setError(''); }}>← Back</button>
          <span className="baby-eyebrow">{hosting ? 'Camera device' : 'Viewer device'}</span>
          <h1>{hosting ? 'Start a private camera' : 'Join a monitor'}</h1>
          <p>
            {hosting
              ? 'Choose a PIN that viewers must enter. Camera and microphone permission will be requested next.'
              : 'Enter the code shown on the camera device and its private PIN.'}
          </p>
          <form onSubmit={hosting ? startCamera : joinRoom} className="baby-form">
            {!hosting && (
              <label>
                Room code
                <input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                  placeholder="ABC234"
                  autoCapitalize="characters"
                  autoComplete="off"
                  required
                />
              </label>
            )}
            <label>
              Viewer PIN
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="4–8 digits"
                inputMode="numeric"
                autoComplete="off"
                minLength={4}
                maxLength={8}
                required
              />
            </label>
            {error && <div className="baby-error" role="alert">{error}</div>}
            <button className="baby-action" disabled={busy || pin.length < 4 || (!hosting && roomCode.length < 4)}>
              {busy ? 'Please wait…' : hosting ? 'Allow camera and start' : 'View live camera'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const hosting = mode === 'host';
  return (
    <main className="baby-monitor">
      <header className="baby-monitor-header">
        <div>
          <span className={`baby-live-dot ${status === 'Live' || hosting ? 'is-live' : ''}`} />
          <strong>{status}</strong>
        </div>
        <div className="baby-room-badge">Room <b>{roomCode}</b></div>
      </header>

      <section className="baby-video-stage">
        {hosting ? (
          <video ref={localVideoRef} autoPlay playsInline muted className="baby-video" />
        ) : (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline muted={viewerMuted} className="baby-video" />
            {status !== 'Live' && (
              <div className="baby-video-waiting">
                <span className="baby-spinner" />
                <strong>{status}</strong>
                <small>Keep the camera device on this page and connected to the internet.</small>
              </div>
            )}
          </>
        )}
        <div className="baby-video-overlay">
          <span>{hosting ? `${viewerCount} viewer${viewerCount === 1 ? '' : 's'}` : 'Live monitor'}</span>
          <time>{new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
        </div>
      </section>

      {error && <div className="baby-error baby-monitor-error" role="alert">{error}</div>}

      {hosting && (
        <section className="baby-invite">
          <div>
            <small>Viewer room code</small>
            <strong>{roomCode}</strong>
          </div>
          <button onClick={copyInvite}>{copied ? 'Copied' : 'Copy invite link'}</button>
        </section>
      )}

      <nav className="baby-controls" aria-label="Monitor controls">
        {hosting ? (
          <>
            <button onClick={() => toggleTrack('audio')} className={!micOn ? 'is-off' : ''}>
              <span>{micOn ? 'Mic on' : 'Mic off'}</span>
            </button>
            <button onClick={() => toggleTrack('video')} className={!cameraOn ? 'is-off' : ''}>
              <span>{cameraOn ? 'Camera on' : 'Camera off'}</span>
            </button>
            <button onClick={switchCamera} disabled={busy}>
              <span>Flip camera</span>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setViewerMuted((value) => !value)} className={viewerMuted ? 'is-off' : ''}>
              <span>{viewerMuted ? 'Sound off' : 'Sound on'}</span>
            </button>
            <button onClick={() => remoteVideoRef.current?.requestFullscreen?.()}>
              <span>Fullscreen</span>
            </button>
            <button onClick={() => sendSignal('viewer-ready', null).catch(() => {})}>
              <span>Reconnect</span>
            </button>
          </>
        )}
        <button className="baby-end" onClick={leaveMonitor}>
          <span>{hosting ? 'Stop camera' : 'Leave'}</span>
        </button>
      </nav>
    </main>
  );
}
