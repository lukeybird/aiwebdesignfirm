'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Video, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

type Profile = {
  name: string;
  phone: string;
  email: string;
  businessName: string;
  businessDescription: string;
  biggestProblem: string;
  websiteUrl: string;
};

type OnboardingField = keyof Profile;

type ApiArtifact = {
  id: number;
  title: string;
  body: string;
  kind: string;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: {
      new (): {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((event: any) => void) | null;
        onerror: ((event: Event) => void) | null;
        onend: (() => void) | null;
        start(): void;
        stop(): void;
      };
    };
    SpeechRecognition?: {
      new (): {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((event: any) => void) | null;
        onerror: ((event: Event) => void) | null;
        onend: (() => void) | null;
        start(): void;
        stop(): void;
      };
    };
  }
}

const SESSION_KEY = 'talk_to_ai_session_id';

const onboardingFlow: Array<{ key: OnboardingField; question: string }> = [
  { key: 'name', question: 'Great. First, what is your full name?' },
  { key: 'phone', question: 'What is the best phone number to reach you?' },
  { key: 'email', question: 'What is your email address?' },
  { key: 'businessName', question: 'What is your business called?' },
  {
    key: 'businessDescription',
    question: 'What does your business do? Give me a short summary so I can tailor recommendations.',
  },
  {
    key: 'biggestProblem',
    question: 'What is the biggest problem you are facing in your business right now?',
  },
  {
    key: 'websiteUrl',
    question:
      'Do you have a website? Share the URL so I can learn about your business from it. If not, say "no website".',
  },
];

const defaultProfile: Profile = {
  name: '',
  phone: '',
  email: '',
  businessName: '',
  businessDescription: '',
  biggestProblem: '',
  websiteUrl: '',
};

const orderedIntakeKeys: OnboardingField[] = [
  'name',
  'phone',
  'email',
  'businessName',
  'businessDescription',
  'biggestProblem',
  'websiteUrl',
];

function nextMissingProfileField(profile: Profile): OnboardingField | null {
  for (const key of orderedIntakeKeys) {
    if (!String(profile[key] ?? '').trim()) return key;
  }
  return null;
}

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
      dots.push({
        left: `${(x / (cols - 1)) * 100}%`,
        top: `${(y / (rows - 1)) * 100}%`,
        opacity: 0.35 + wave * 0.55,
        size: 3 + wave * 2.6,
      });
    }
  }
  return dots;
}

const FACE_DOTS = buildFaceDots();

function inferPlan(problem: string): 'starter' | 'advanced' | 'elite' {
  const p = problem.toLowerCase();
  if (/scale|multi|team|enterprise|complex|automation|pipeline|crm|integrat/.test(p)) return 'elite';
  if (/lead|sales|marketing|follow.?up|booking|support|ops|operation/.test(p)) return 'advanced';
  return 'starter';
}

function normalizeWebsite(raw: string): string {
  const v = raw.trim();
  if (!v || /^(no|none|no website)$/i.test(v)) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export function TalkToAiExperience() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meetingSuccess, setMeetingSuccess] = useState<string | null>(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [artifacts, setArtifacts] = useState<ApiArtifact[]>([]);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [onboardingIndex, setOnboardingIndex] = useState(0);
  const [onboardingDone, setOnboardingDone] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<{
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: any) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const supportsSpeechRec = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const loadSessionProfile = useCallback(async () => {
    try {
      const sessionId = getSessionId();
      const res = await fetch(`/api/ceo-coach?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      if (data?.profile && typeof data.profile === 'object') {
        const hydrated: Profile = {
          ...defaultProfile,
          name: typeof data.profile.name === 'string' ? data.profile.name : '',
          phone: typeof data.profile.phone === 'string' ? data.profile.phone : '',
          email: typeof data.profile.email === 'string' ? data.profile.email : '',
          businessName: typeof data.profile.businessName === 'string' ? data.profile.businessName : '',
          businessDescription:
            typeof data.profile.businessDescription === 'string' ? data.profile.businessDescription : '',
          biggestProblem: typeof data.profile.biggestProblem === 'string' ? data.profile.biggestProblem : '',
          websiteUrl: typeof data.profile.websiteUrl === 'string' ? data.profile.websiteUrl : '',
        };
        setProfile((prev) => ({
          ...prev,
          ...hydrated,
        }));
        const next = nextMissingProfileField(hydrated);
        if (next) {
          const idx = onboardingFlow.findIndex((f) => f.key === next);
          if (idx >= 0) setOnboardingIndex(idx);
          setOnboardingDone(false);
        } else {
          setOnboardingDone(true);
        }
      }
      if (Array.isArray(data?.messages) && data.messages.length > 0) {
        setHistory(
          data.messages
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any) => ({ id: `db_${m.id}`, role: m.role, text: m.content })),
        );
      }
      if (Array.isArray(data?.artifacts)) {
        setArtifacts(data.artifacts);
      }
    } catch {
      // ignore profile hydration errors in UI
    }
  }, []);

  useEffect(() => {
    void loadSessionProfile();
  }, [loadSessionProfile]);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1.02;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }, []);

  const appendAssistant = useCallback(
    (text: string) => {
      setHistory((prev) => [...prev, { id: `a_${Date.now()}_${Math.random()}`, role: 'assistant', text }]);
      speak(text);
    },
    [speak],
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const askAssistant = useCallback(
    async (message: string, nextProfile: Profile, opts?: { duringIntake?: boolean }) => {
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
            message: opts?.duringIntake
              ? `${clean}\n\n[INTAKE MODE: Give a short helpful response in 1-2 sentences. Do not ask for name/phone/email/business/problem/website again. The form funnel handles those prompts.]`
              : clean,
            sourcePage: '/talk-to-ai',
            responseLength: 2,
            profile: {
              name: nextProfile.name,
              phone: nextProfile.phone,
              email: nextProfile.email,
              businessName: nextProfile.businessName,
              businessDescription: nextProfile.businessDescription,
              biggestProblem: nextProfile.biggestProblem,
              websiteUrl: nextProfile.websiteUrl,
            },
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'AI response failed');
        }

        const reply =
          (payload.reply as string) ||
          'AI can usually remove repetitive work, speed response times, and lift revenue. I recommend booking a strategy call next.';

        appendAssistant(reply);

        if (Array.isArray(payload.artifacts)) {
          setArtifacts(payload.artifacts as ApiArtifact[]);
        }
        if (payload?.profile && typeof payload.profile === 'object') {
          setProfile((prev) => ({
            ...prev,
            name: typeof payload.profile.name === 'string' ? payload.profile.name : prev.name,
            phone: typeof payload.profile.phone === 'string' ? payload.profile.phone : prev.phone,
            email: typeof payload.profile.email === 'string' ? payload.profile.email : prev.email,
            businessName:
              typeof payload.profile.businessName === 'string' ? payload.profile.businessName : prev.businessName,
            businessDescription:
              typeof payload.profile.businessDescription === 'string'
                ? payload.profile.businessDescription
                : prev.businessDescription,
            biggestProblem:
              typeof payload.profile.biggestProblem === 'string'
                ? payload.profile.biggestProblem
                : prev.biggestProblem,
            websiteUrl:
              typeof payload.profile.websiteUrl === 'string' ? payload.profile.websiteUrl : prev.websiteUrl,
          }));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed';
        setError(msg);
      } finally {
        setIsThinking(false);
      }
    },
    [appendAssistant],
  );

  const finalizeOnboardingAndKickoff = useCallback(
    async (nextProfile: Profile) => {
      setOnboardingDone(true);
      const kickoff = `Profile summary: ${nextProfile.name}, ${nextProfile.email}, ${nextProfile.phone}. Business: ${nextProfile.businessName}. What they do: ${nextProfile.businessDescription}. Biggest problem: ${nextProfile.biggestProblem}. Website: ${nextProfile.websiteUrl || 'none provided'}. Explain why AI is critical for this business and propose immediate steps. End by prompting them to book a strategy call.`;
      await askAssistant(kickoff, nextProfile);
      appendAssistant('I can help you keep refining this plan. When you are ready, submit the booking form below and we will schedule your strategy call.');
    },
    [appendAssistant, askAssistant],
  );

  const handleSpokenInput = useCallback(
    async (rawInput: string) => {
      const input = rawInput.trim();
      if (!input) return;

      if (!onboardingDone) {
        const current = onboardingFlow[onboardingIndex];
        if (!current) return;

        setIsThinking(true);
        try {
          const r = await fetch('/api/ceo-coach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: getSessionId(),
              intent: 'intake_map',
              targetField: current.key,
              message: input,
              sourcePage: '/talk-to-ai',
              profile: {
                name: profile.name,
                phone: profile.phone,
                email: profile.email,
                businessName: profile.businessName,
                businessDescription: profile.businessDescription,
                biggestProblem: profile.biggestProblem,
                websiteUrl: profile.websiteUrl,
              },
            }),
          });
          const payload = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw new Error((payload as { error?: string }).error || 'Could not map intake answer');
          }

          const merged: Profile = {
            ...profile,
            ...(payload.profile || {}),
            websiteUrl: typeof payload?.profile?.websiteUrl === 'string' ? payload.profile.websiteUrl : profile.websiteUrl,
          };
          setProfile(merged);

          const nextField = nextMissingProfileField(merged);
          const done = !nextField;
          if (done) {
            await finalizeOnboardingAndKickoff(merged);
          } else {
            await askAssistant(input, merged, { duringIntake: true });
            appendAssistant(onboardingFlow.find((f) => f.key === nextField)?.question ?? 'Next question.');
            const idx = onboardingFlow.findIndex((f) => f.key === nextField);
            if (idx >= 0) setOnboardingIndex(idx);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not process intake';
          setError(msg);
          appendAssistant(`I want to put that in the right place. ${current.question}`);
        } finally {
          setIsThinking(false);
        }
        return;
      }

      await askAssistant(input, profile);
    },
    [appendAssistant, askAssistant, finalizeOnboardingAndKickoff, onboardingDone, onboardingIndex, profile],
  );

  const startListening = useCallback(() => {
    if (!supportsSpeechRec || recognitionRef.current) return;

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
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
        void handleSpokenInput(finals.join(' '));
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
  }, [handleSpokenInput, isListening, supportsSpeechRec]);

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
      appendAssistant('Hi, I am the AI. I am going to build your profile first, then help you see exactly how AI can transform your business.');
      appendAssistant(onboardingFlow[0].question);
      startListening();
    } catch {
      setError('Please allow camera and microphone permissions to use Talk to AI.');
    }
  }, [appendAssistant, startListening]);

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

  const bookingPlan = inferPlan(profile.biggestProblem || profile.businessDescription);
  const bookingNotes = [
    profile.businessName ? `Business: ${profile.businessName}` : null,
    profile.businessDescription ? `What they do: ${profile.businessDescription}` : null,
    profile.biggestProblem ? `Biggest problem: ${profile.biggestProblem}` : null,
    profile.websiteUrl ? `Website: ${profile.websiteUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const canSubmitMeeting =
    onboardingDone &&
    profile.name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim()) &&
    profile.phone.replace(/\D/g, '').length >= 10;

  async function submitMeeting() {
    if (!canSubmitMeeting || isSubmittingMeeting) return;
    setIsSubmittingMeeting(true);
    setError(null);
    setMeetingSuccess(null);

    try {
      const r = await fetch('/api/ai-website-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          plan: bookingPlan,
          notes: bookingNotes,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error((j as { error?: string }).error || 'Failed to book meeting');
      }

      setMeetingSuccess('Meeting request submitted. Check your email for next steps and scheduling confirmation.');
      appendAssistant('Great move. Your strategy call request is in. We can keep refining your AI plan while you wait for the meeting.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to submit meeting';
      setError(msg);
    } finally {
      setIsSubmittingMeeting(false);
    }
  }

  async function saveProfile() {
    if (isSavingProfile) return;
    setIsSavingProfile(true);
    setProfileSaveSuccess(null);
    setError(null);
    try {
      const r = await fetch('/api/ceo-coach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: getSessionId(),
          profile: {
            name: profile.name,
            phone: profile.phone,
            email: profile.email,
            businessName: profile.businessName,
            businessDescription: profile.businessDescription,
            biggestProblem: profile.biggestProblem,
            websiteUrl: profile.websiteUrl,
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error((j as { error?: string }).error || 'Failed to save profile');
      }
      if ((j as any).profile) {
        setProfile((j as any).profile);
      }
      setProfileSaveSuccess('Profile saved.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save profile';
      setError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <main className='min-h-[100dvh] bg-[#02040a] text-white'>
      <div className='mx-auto w-full max-w-[min(100%,104rem)] px-5 py-8 sm:px-8 lg:px-12'>
        <header className='mb-8 rounded-3xl border border-cyan-400/25 bg-[#071326]/80 p-6 backdrop-blur-md sm:p-8'>
          <p className='text-sm font-bold uppercase tracking-[0.22em] text-cyan-300/80'>Talk to AI</p>
          <h1 className='mt-3 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl'>Live voice AI advisor + profile builder</h1>
          <p className='mt-4 max-w-5xl text-xl leading-relaxed text-cyan-100/85'>
            I will gather your profile (name, phone, email, business, biggest problem, website), explain how AI solves your bottlenecks,
            and guide you into booking a strategy meeting.
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
                <Volume2 className='h-4 w-4' /> Browser voice on
              </span>
            </div>
            <div className='max-h-[22rem] space-y-3 overflow-y-auto pr-1'>
              {history.length === 0 ? (
                <p className='text-lg text-cyan-200/65'>Enable permissions, then I will start profile intake questions.</p>
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

            <div className='mt-5 rounded-2xl border border-cyan-300/25 bg-[#0a1d34]/55 p-4'>
              <div className='mb-3 flex items-center justify-between gap-3'>
                <p className='text-sm font-semibold uppercase tracking-wider text-cyan-200/80'>Profile (editable)</p>
                <Button
                  type='button'
                  size='sm'
                  className='h-9 rounded-full bg-cyan-400 px-4 text-black hover:bg-cyan-300 disabled:opacity-60'
                  onClick={saveProfile}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
              <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} placeholder='Name' className='bg-black/40 text-white' />
              <Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder='Phone' className='bg-black/40 text-white' />
              <Input value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} placeholder='Email' className='bg-black/40 text-white' />
              <Input value={profile.businessName} onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))} placeholder='Business name' className='bg-black/40 text-white' />
              <Input value={profile.businessDescription} onChange={(e) => setProfile((p) => ({ ...p, businessDescription: e.target.value }))} placeholder='What do you do?' className='bg-black/40 text-white sm:col-span-2' />
              <Input value={profile.biggestProblem} onChange={(e) => setProfile((p) => ({ ...p, biggestProblem: e.target.value }))} placeholder='Biggest problem' className='bg-black/40 text-white sm:col-span-2' />
              <Input value={profile.websiteUrl} onChange={(e) => setProfile((p) => ({ ...p, websiteUrl: e.target.value }))} placeholder='Website URL (optional)' className='bg-black/40 text-white sm:col-span-2' />
              </div>
              {profileSaveSuccess ? <p className='mt-2 text-xs text-emerald-300'>{profileSaveSuccess}</p> : null}
            </div>

            {onboardingDone ? (
              <div className='mt-5 rounded-2xl border border-cyan-300/25 bg-[#0a1a2f] p-4'>
                <p className='mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-200/80'>Book strategy meeting</p>
                <p className='mb-4 text-sm text-cyan-100/70'>Autofilled from your profile. Plan category selected automatically.</p>
                <Button
                  type='button'
                  size='lg'
                  className='h-12 rounded-full bg-cyan-400 px-6 text-black hover:bg-cyan-300 disabled:opacity-60'
                  disabled={!canSubmitMeeting || isSubmittingMeeting}
                  onClick={submitMeeting}
                >
                  {isSubmittingMeeting ? 'Submitting…' : `Book ${bookingPlan.toUpperCase()} meeting`}
                </Button>
                {meetingSuccess ? <p className='mt-3 text-sm text-emerald-300'>{meetingSuccess}</p> : null}
              </div>
            ) : (
              <p className='mt-5 text-sm text-cyan-100/60'>I will unlock booking right after profile intake is complete.</p>
            )}

            {artifacts.length > 0 ? (
              <div className='mt-5 space-y-2'>
                {artifacts.slice(-3).map((a) => (
                  <div key={a.id} className='rounded-xl border border-cyan-300/20 bg-white/5 p-3'>
                    <p className='text-sm font-bold text-cyan-100'>{a.title}</p>
                    <p className='text-sm text-cyan-50/85'>{a.body}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className='mt-5 overflow-hidden rounded-2xl border border-cyan-300/30 bg-black/35'>
              <video ref={videoRef} autoPlay muted playsInline className='h-52 w-full object-cover' />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
