'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Video, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: {
      new (): SpeechRecognition;
    };
    SpeechRecognition?: {
      new (): SpeechRecognition;
    };
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    length: number;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    transcript: string;
  }
}

const SESSION_KEY = 'talk_to_ai_session_id';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `talk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(SESSION_KEY, id);
  return id;
}

function buildFaceDots() {
  const dots: Array<{ left: string; top: string; opacity: number; size: number }> = [];
  const cols = 22;
  const rows = 26;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = (x / (cols - 1)) * 2 - 1;
      const ny = (y / (rows - 1)) * 2 - 1;
      const ellipse = (nx * nx) / 0.88 + (ny * ny) / 1.08;
      if (ellipse > 1) continue;

      const wave = 0.5 + 0.5 * Math.sin((x + 1) * 0.9 + y * 0.35);
      const size = 3 + wave * 2.6;
      const opacity = 0.35 + wave * 0.55;
      dots.push({
        left: `${(x / (cols - 1)) * 100}%`,
        top: `${(y / (rows - 1)) * 100}%`,
        opacity,
        size,
      });
    }
  }
  return dots;
}

const FACE_DOTS = buildFaceDots();

export function TalkToAiExperience() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [history, setHistory] = useState<ChatTurn[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const supportsSpeechRec = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1.02;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }, []);

  const askAssistant = useCallback(
    async (message: string) => {
      const clean = message.trim();
      if (!clean) return;

      setHistory((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: clean }]);
      setIsThinking(true);
      setError(null);

      try {
        const response = await fetch('/api/ceo-coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: getSessionId(),
            message: clean,
            sourcePage: '/talk-to-ai',
            responseLength: 2,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'AI response failed');
        }

        const reply = (payload.reply as string) || 'I can help you move this forward. Tell me your biggest bottleneck right now.';
        setHistory((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', text: reply }]);
        speak(reply);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        setError(msg);
      } finally {
        setIsThinking(false);
      }
    },
    [speak],
  );

  const startListening = useCallback(() => {
    if (!supportsSpeechRec || recognitionRef.current) return;

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      const finals: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) finals.push(text);
        else interim += `${text} `;
      }
      setPartialTranscript(interim.trim());
      if (finals.length > 0) {
        setPartialTranscript('');
        void askAssistant(finals.join(' '));
      }
    };

    rec.onerror = () => {
      setError('Speech recognition error. Please allow microphone access and try again.');
      setIsListening(false);
    };

    rec.onend = () => {
      if (isListening) {
        try {
          rec.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setIsListening(true);
    } catch {
      setError('Could not start voice recognition in this browser.');
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [askAssistant, isListening, supportsSpeechRec]);

  const enableExperience = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsEnabled(true);
      speak('Hi, I am the AI.');
      startListening();
    } catch {
      setError('Please allow camera and microphone permissions to use Talk to AI.');
    }
  }, [speak, startListening]);

  useEffect(() => {
    return () => {
      stopListening();
      recognitionRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel();
      }
    };
  }, [stopListening]);

  return (
    <main className='min-h-[100dvh] bg-[#02040a] text-white'>
      <div className='mx-auto w-full max-w-[min(100%,96rem)] px-5 py-8 sm:px-8 lg:px-12'>
        <header className='mb-8 rounded-3xl border border-cyan-400/25 bg-[#071326]/80 p-6 backdrop-blur-md sm:p-8'>
          <p className='text-sm font-bold uppercase tracking-[0.22em] text-cyan-300/80'>Talk to AI</p>
          <h1 className='mt-3 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl'>Live voice AI assistant</h1>
          <p className='mt-4 max-w-4xl text-xl leading-relaxed text-cyan-100/85'>
            Grant camera + microphone access, then talk naturally. I transcribe your voice and the AI responds back out loud.
          </p>
        </header>

        <section className='grid gap-8 xl:grid-cols-[1.1fr_1fr]'>
          <div className='rounded-3xl border border-cyan-300/25 bg-[#071325]/90 p-6 shadow-[0_24px_90px_-40px_rgba(0,212,255,0.35)] sm:p-8'>
            <div className='mx-auto mb-6 flex w-full max-w-[26rem] flex-col items-center'>
              <div className='relative h-[22rem] w-[22rem] overflow-hidden rounded-full border border-cyan-300/30 bg-[#050b18] shadow-[0_0_80px_-30px_rgba(0,212,255,0.75)]'>
                <div className='absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.22),rgba(0,0,0,0.12)_50%,rgba(0,0,0,0.75))]' />
                <div className='absolute inset-[9%] rounded-full'>
                  {FACE_DOTS.map((dot, idx) => (
                    <span
                      key={idx}
                      className='absolute rounded-full bg-cyan-300'
                      style={{
                        left: dot.left,
                        top: dot.top,
                        width: `${dot.size}px`,
                        height: `${dot.size}px`,
                        opacity: isListening ? Math.min(1, dot.opacity + 0.12) : dot.opacity,
                        transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 8px rgba(34,211,238,0.8)',
                      }}
                    />
                  ))}
                </div>
              </div>
              <p className='mt-4 text-center text-lg font-semibold text-cyan-100/85'>
                {isThinking ? 'Thinking...' : isListening ? 'Listening...' : isEnabled ? 'Ready' : 'Awaiting permission'}
              </p>
            </div>

            <div className='mb-4 grid gap-3 sm:grid-cols-2'>
              <Button
                type='button'
                size='lg'
                onClick={enableExperience}
                className='h-14 rounded-full bg-cyan-400 text-lg font-black text-black hover:bg-cyan-300'
                disabled={isEnabled}
              >
                <Video className='h-5 w-5' />
                {isEnabled ? 'Permissions granted' : 'Enable camera + mic'}
              </Button>
              <Button
                type='button'
                size='lg'
                variant='outline'
                className='h-14 rounded-full border-cyan-300/40 bg-transparent text-lg text-cyan-50 hover:bg-white/10'
                onClick={() => (isListening ? stopListening() : startListening())}
                disabled={!isEnabled}
              >
                {isListening ? <MicOff className='h-5 w-5' /> : <Mic className='h-5 w-5' />}
                {isListening ? 'Pause listening' : 'Start listening'}
              </Button>
            </div>

            {partialTranscript ? (
              <div className='rounded-xl border border-cyan-300/25 bg-[#0a1d34]/70 px-4 py-3 text-lg text-cyan-100/90'>
                <span className='text-cyan-300/80'>You (live): </span>
                {partialTranscript}
              </div>
            ) : null}

            {error ? <p className='mt-3 text-base text-red-300'>{error}</p> : null}
          </div>

          <div className='rounded-3xl border border-cyan-300/25 bg-[#071325]/90 p-6 sm:p-8'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-2xl font-black'>Conversation</h2>
              <span className='inline-flex items-center gap-2 text-sm text-cyan-200/70'>
                <Volume2 className='h-4 w-4' /> Audio replies on
              </span>
            </div>
            <div className='max-h-[32rem] space-y-3 overflow-y-auto pr-1'>
              {history.length === 0 ? (
                <p className='text-lg text-cyan-200/65'>Say something after enabling permissions. I will transcribe and answer.</p>
              ) : (
                history.map((turn) => (
                  <div key={turn.id} className={turn.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={
                        turn.role === 'user'
                          ? 'max-w-[90%] rounded-2xl rounded-br-lg bg-cyan-400 px-4 py-3 text-lg font-semibold text-black'
                          : 'max-w-[90%] rounded-2xl rounded-bl-lg bg-white/12 px-4 py-3 text-lg leading-relaxed text-white'
                      }
                    >
                      {turn.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className='mt-5 overflow-hidden rounded-2xl border border-cyan-300/30 bg-black/35'>
              <video ref={videoRef} autoPlay muted playsInline className='h-52 w-full object-cover' />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
