'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Search, TrendingUp, Globe } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** Default when no plan is chosen in the UI (booking + CRM still expect a plan id). */
const DEFAULT_CONSULTATION_PLAN = 'advanced' as const;

type ContactTheme = {
  sectionBg: string;
  sectionBorder: string;
  blurTop: string;
  blurBottom: string;
  radial: string;
  leftFeatureShell: string;
  leftFeatureShadowHover: string;
  leftFeatureIcon: string;
  leftFeatureText: string;
  formGlowMotion: string;
  formGlowStatic: string;
  formCard: string;
  formBlobTL: string;
  formBlobBR: string;
  divider: string;
  formHeaderSub: string;
  label: string;
  input: string;
  error: string;
  submit: string;
  successRing: string;
  successTitle: string;
  successSub: string;
  successBtn: string;
  successIcon: string;
};

const CONTACT_SECTION_THEME: ContactTheme = {
  sectionBg: 'bg-gradient-to-b from-[#050a14] via-[#070d18] to-[#0a0a0f]',
  sectionBorder: 'border-[#0066ff]/25',
  blurTop: 'bg-[#0066ff]/28',
  blurBottom: 'bg-[#00d4ff]/20',
  radial: 'bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,102,255,0.2),transparent)]',
  leftFeatureShell:
    'bg-gradient-to-br from-[#0066ff]/35 to-[#00d4ff]/18 border border-[#00d4ff]/35',
  leftFeatureShadowHover:
    'shadow-[0_0_20px_-6px_rgba(0,102,255,0.5)] group-hover:shadow-[0_0_28px_-4px_rgba(0,212,255,0.45)]',
  leftFeatureIcon: 'text-[#7dd3fc]',
  leftFeatureText: 'text-cyan-100/85',
  formGlowMotion: 'bg-gradient-to-b from-[#0066ff]/40 via-[#00d4ff]/28 to-[#0052cc]/15',
  formGlowStatic: 'bg-gradient-to-br from-[#0066ff]/22 via-[#00d4ff]/12 to-transparent',
  formCard:
    'bg-gradient-to-b from-[#0a1525] via-[#060d18] to-[#050810] border-2 border-[#0066ff]/60 shadow-[0_0_64px_-10px_rgba(0,102,255,0.45),0_0_28px_-10px_rgba(0,212,255,0.25)] ring-1 ring-[#00d4ff]/22',
  formBlobTL: 'bg-[#00d4ff]/12',
  formBlobBR: 'bg-[#0066ff]/18',
  divider: 'bg-gradient-to-r from-transparent via-[#00d4ff]/35 to-transparent',
  formHeaderSub: 'text-[#7dd3fc]/90',
  label: 'text-[#a5f3fc]/90',
  input:
    'bg-black/50 border-[#0066ff]/35 text-white text-base placeholder:text-cyan-200/20 h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-[#00d4ff]/70 focus-visible:border-[#00d4ff]/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
  error: 'text-cyan-200',
  submit:
    'w-full h-14 rounded-xl text-lg font-black uppercase tracking-wide bg-gradient-to-r from-[#0066ff] to-[#00d4ff] hover:from-[#0052cc] hover:to-[#00bfff] text-black shadow-[0_0_40px_-6px_rgba(0,212,255,0.75),0_0_20px_-8px_rgba(0,102,255,0.4)] border border-[#00d4ff]/35 hover:scale-[1.01] active:scale-[0.99] transition-all duration-500 disabled:opacity-60 disabled:hover:scale-100',
  successRing:
    'bg-gradient-to-br from-[#00d4ff]/28 to-[#0066ff]/28 border border-[#00d4ff]/45',
  successTitle:
    'text-transparent bg-clip-text bg-gradient-to-r from-white to-[#a5f3fc]',
  successSub: 'text-cyan-200/60',
  successBtn:
    'border-[#00d4ff]/40 text-cyan-200 hover:bg-[#061428]/55 hover:text-white',
  successIcon: 'text-[#00d4ff]',
};

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .refine((val) => val.replace(/\D/g, "").length >= 10, "Enter a valid phone number"),
  notes: z.string().max(2000, "Notes must be 2000 characters or less").optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AiWebsiteProHome() {
  /** “Consumers don’t Google anymore” / query-behavior shift block — set true to show again */
  const showConsumersShiftSection = false;

  const defaultFormValues: FormValues = {
    name: '',
    email: '',
    phone: '',
    notes: '',
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultFormValues,
  });

  const theme = CONTACT_SECTION_THEME;

  const scrollToSectionId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start', inline: 'nearest' });
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]');
      if (!a || !(a instanceof HTMLAnchorElement)) return;
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const id = decodeURIComponent(href.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start', inline: 'nearest' });
      try {
        history.pushState(null, '', href);
      } catch {
        /* ignore */
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const raw = window.location.hash.slice(1);
    if (!raw) return;
    const id = decodeURIComponent(raw);
    const el = document.getElementById(id);
    if (!el) return;
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(t);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fridayAvailLoading, setFridayAvailLoading] = useState(true);
  const [fridayAvail, setFridayAvail] = useState<{
    label: string;
    available: number;
    total: number;
    hoursEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/booking/friday-availability');
        const j = (await r.json().catch(() => ({}))) as {
          label?: string;
          available?: number;
          total?: number;
          hoursEnabled?: boolean;
          error?: string;
        };
        if (cancelled || !r.ok) {
          setFridayAvail(null);
          return;
        }
        if (
          typeof j.label === 'string' &&
          typeof j.available === 'number' &&
          typeof j.total === 'number' &&
          typeof j.hoursEnabled === 'boolean'
        ) {
          setFridayAvail({
            label: j.label,
            available: j.available,
            total: j.total,
            hoursEnabled: j.hoursEnabled,
          });
        } else {
          setFridayAvail(null);
        }
      } catch {
        if (!cancelled) setFridayAvail(null);
      } finally {
        if (!cancelled) setFridayAvailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/ai-website-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, plan: DEFAULT_CONSULTATION_PLAN }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        emailSent?: boolean;
        thankYouSent?: boolean;
        allEmailsSent?: boolean;
        notifyError?: string;
        thankYouError?: string;
        error?: string;
      };

      if (response.ok && payload.success) {
        const teamOk = payload.emailSent === true;
        const thanksOk = payload.thankYouSent === true;
        const fullyOk = payload.allEmailsSent === true || (teamOk && thanksOk);

        if (fullyOk) {
          toast.success('Next: schedule your call', {
            description: 'Pick a time below (US Eastern).',
          });
        } else {
          const parts: string[] = [];
          if (!teamOk) {
            const hint = payload.notifyError?.trim();
            const maxLen = 160;
            const shortErr =
              hint && hint.length > maxLen ? `${hint.slice(0, maxLen)}…` : hint;
            parts.push(
              shortErr
                ? `Team notification: ${shortErr}`
                : 'Team notification did not send.',
            );
          }
          if (!thanksOk) {
            const hint = payload.thankYouError?.trim();
            const maxLen = 160;
            const shortErr =
              hint && hint.length > maxLen ? `${hint.slice(0, maxLen)}…` : hint;
            parts.push(
              shortErr
                ? `Your confirmation email: ${shortErr}`
                : 'Confirmation email to you did not send.',
            );
          }
          toast.warning('Saved — pick a time; some email may not have sent', {
            description: parts.join(' '),
          });
        }

        const q = new URLSearchParams();
        q.set('name', data.name.trim());
        q.set('email', data.email.trim());
        q.set('phone', data.phone.trim());
        q.set('plan', DEFAULT_CONSULTATION_PLAN);
        window.location.href = `/book?${q.toString()}`;
        return;
      } else {
        throw new Error(payload.error || 'Failed to submit');
      }
    } catch {
      toast.error('Something went wrong', {
        description: 'Please try again in a moment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-none bg-[#0a0a0f] text-white overflow-x-clip selection:bg-[#00d4ff]/30 selection:text-white">
      {/* Sticky Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-none items-center justify-between px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img
              src="/blueBall.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className="font-heading font-bold text-2xl tracking-tight text-white">aiWebDF</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <div className="hidden md:flex items-center gap-5 text-base text-gray-400">
              <a href="#contact" className="hover:text-white transition-colors">
                How it works
              </a>
              <a href="#contact" className="hover:text-white transition-colors">
                Book a call
              </a>
            </div>
            <Button asChild className="bg-white text-black hover:bg-gray-200 font-medium text-base px-5 md:px-6 rounded-full transition-all duration-300 shrink-0">
              <a href="#contact" aria-label="Book a call — go to contact form">
                Book A Call
              </a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section — full viewport height, centered column */}
      <section className="relative flex min-h-[100dvh] w-full max-w-none flex-col items-center justify-center overflow-hidden px-6 py-10 pt-[calc(5rem+env(safe-area-inset-top,0px))] pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:px-8 sm:py-12 sm:pt-28 md:pt-32 md:pb-14 lg:px-12 xl:px-16 2xl:px-20">
        <div className="pointer-events-none absolute inset-0 z-0">
          <img
            src="/hero-bg.png"
            alt=""
            className="h-full w-full object-cover object-center scale-105 blur-md sm:blur-lg opacity-[0.22]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/65 via-[#0a0a0f]/88 to-[#0a0a0f]"></div>
          <div className="absolute top-1/4 left-1/2 h-[min(100vw,800px)] w-[min(100vw,800px)] -translate-x-1/2 rounded-full bg-[#0066ff]/15 blur-[120px] mix-blend-screen"></div>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-none flex-col items-center justify-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex w-full max-w-none flex-col items-center text-center"
          >
            <motion.p
              variants={fadeIn}
              className="mx-auto mb-10 w-full max-w-[min(100%,calc(100vw-2rem))] text-balance font-black font-heading tracking-tight text-white text-[clamp(1.7rem,5.2vw+0.65rem,2.35rem)] leading-[1.2] sm:mb-12 sm:max-w-[min(100%,48rem)] sm:text-5xl sm:leading-[1.1] md:mb-14 md:max-w-[min(100%,60rem)] md:text-6xl md:leading-[1.08] lg:max-w-[min(100%,min(96vw,76rem))] lg:text-7xl lg:leading-[1.05] xl:max-w-[min(100%,min(96vw,88rem))] xl:text-8xl xl:leading-[1.03] 2xl:max-w-[min(100%,min(98vw,100rem))] 2xl:text-9xl 2xl:leading-[1.02]"
            >
              You&apos;re{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-300 to-red-500">
                losing money
              </span>{' '}
              if you haven&apos;t{' '}
              <br className="hidden lg:block" aria-hidden="true" />
              implemented{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#0066ff]">AI</span>{' '}
              yet.
            </motion.p>

            <motion.div variants={fadeIn} className="flex w-full flex-col items-center justify-center gap-6 sm:gap-8">
              <Button
                asChild
                size="lg"
                className="w-full !h-14 rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] px-8 text-base font-bold text-black hover:scale-[1.02] hover:from-[#0052cc] hover:to-[#00bfff] sm:w-auto sm:text-lg"
              >
                <a href="#contact" aria-label="Book call now — go to contact form">
                  Book call now!
                </a>
              </Button>
              <a
                href="#contact"
                className="text-base text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Already convinced — go to contact form"
              >
                Already convinced — get started →
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {showConsumersShiftSection && (
        /* The Pain — layout aligned with aiwebdesignfirm.com; fills viewport height responsively */
        <section className="relative flex min-h-[72svh] flex-col justify-center border-y border-white/5 bg-[#0d0d1a] py-12 sm:min-h-[76svh] sm:py-16 md:min-h-[78svh] md:py-20 lg:min-h-[80svh] lg:py-24">
          <div className="relative z-10 mx-auto w-full max-w-none px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={staggerContainer}
              className="grid items-center gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20"
            >
              <div>
                <motion.h2 variants={fadeIn} className="text-4xl lg:text-6xl font-bold font-heading mb-6">
                  Consumers don&apos;t Google anymore. <br />
                  <span className="text-gray-500">They ask ChatGPT.</span>
                </motion.h2>
                <motion.p variants={fadeIn} className="text-lg text-gray-400 mb-8">
                  The shift is already here. People are typing &quot;what&apos;s the best plumber near me&quot; into AI
                  platforms instead of search engines. If your business isn&apos;t optimized for AI, you are completely
                  invisible to the next generation of buyers.
                </motion.p>
                <motion.div variants={fadeIn} className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold mb-2">Rising Ad Costs</h4>
                      <p className="text-lg text-gray-400">Traditional PPC is becoming unsustainable for local businesses.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                      <Globe className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold mb-2">Algorithm Chaos</h4>
                      <p className="text-lg text-gray-400">Google updates are burying honest businesses beneath aggregators.</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <motion.div variants={fadeIn} className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#0066ff]/20 to-transparent rounded-3xl blur-2xl"></div>
                <div className="relative bg-[#0a0a0f] border border-white/10 rounded-3xl p-8 shadow-2xl">
                  <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
                    <Search className="w-5 h-5 text-gray-400" />
                    <div className="text-gray-400 font-mono text-sm">Query behavior shift (2023-2025)</div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium text-lg">Traditional Search (Google)</span>
                        <span className="text-red-400">-24%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500/50 w-[76%] rounded-full"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium text-lg">Generative AI (ChatGPT, Claude)</span>
                        <span className="text-[#00d4ff]">+415%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] w-full rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Lead capture */}
      <section
        className={cn(
          'relative overflow-hidden border-t pt-12 pb-16 md:pt-16 md:pb-24 transition-colors duration-500',
          theme.sectionBorder,
        )}
      >
        {/* Full-bleed behind section padding so the top band isn’t flat page black (#0a0a0f) */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <motion.div
            initial={{ opacity: 0.88 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <div className={cn('absolute inset-0', theme.sectionBg)} />
            <div className={cn('absolute inset-0', theme.radial)} />
            <motion.div
              className={cn(
                'absolute -top-32 right-0 w-[min(90vw,520px)] h-[520px] rounded-full blur-[100px]',
                theme.blurTop,
              )}
              animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.08, 1] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className={cn(
                'absolute bottom-0 left-0 w-[min(85vw,480px)] h-[480px] rounded-full blur-[110px]',
                theme.blurBottom,
              )}
              animate={{ opacity: [0.3, 0.55, 0.3] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            />
          </motion.div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-none px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
            <div id="contact" className="h-0 w-full overflow-hidden pointer-events-none" aria-hidden="true" />
            <div className="mx-auto w-full max-w-lg">
                <div className="relative rounded-3xl">
                  <motion.div
                    className={cn(
                      'absolute -inset-px rounded-3xl blur-2xl -z-10 pointer-events-none transition-colors duration-500',
                      theme.formGlowMotion,
                    )}
                    animate={{ opacity: [0.55, 0.85, 0.55] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div
                    className={cn(
                      'absolute inset-0 rounded-3xl blur-xl -z-10 pointer-events-none transition-colors duration-500',
                      theme.formGlowStatic,
                    )}
                  />
                  <div
                    className={cn(
                      'relative rounded-3xl p-8 md:p-9 overflow-hidden transition-all duration-500',
                      theme.formCard,
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none transition-colors duration-500',
                        theme.formBlobTL,
                      )}
                    />
                    <div
                      className={cn(
                        'absolute bottom-0 left-0 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-colors duration-500',
                        theme.formBlobBR,
                      )}
                    />

                    {fridayAvailLoading ? (
                      <div
                        className={cn(
                          'mb-5 rounded-xl border px-4 py-3 text-center text-sm',
                          'border-white/10 bg-white/[0.04] text-gray-500',
                        )}
                        aria-live="polite"
                      >
                        Checking how many call slots are open this Friday…
                      </div>
                    ) : fridayAvail ? (
                      <div
                        className={cn(
                          'mb-5 rounded-xl border px-4 py-3 text-center',
                          'border-[#00d4ff]/30 bg-[#0066ff]/12',
                        )}
                        aria-live="polite"
                      >
                        {!fridayAvail.hoursEnabled ? (
                          <p className={cn('text-sm leading-snug', theme.formHeaderSub)}>
                            No booking hours on <span className="text-white font-semibold">{fridayAvail.label}</span>{' '}
                            (EST). Pick a time after you submit — other days may be open.
                          </p>
                        ) : fridayAvail.total === 0 ? (
                          <p className={cn('text-sm leading-snug', theme.formHeaderSub)}>
                            No call times still open on <span className="text-white font-semibold">{fridayAvail.label}</span>{' '}
                            (EST) right now.
                          </p>
                        ) : fridayAvail.available === 0 ? (
                          <p className="text-sm text-gray-200">
                            <span className="font-black tabular-nums text-lg text-white">0</span> calls left —{' '}
                            <span className="text-white font-semibold">{fridayAvail.label}</span> (EST) is fully booked.
                          </p>
                        ) : (
                          <p className="text-sm text-gray-200">
                            <span className="font-black tabular-nums text-2xl text-white sm:text-3xl">
                              {fridayAvail.available}
                            </span>{' '}
                            <span className="text-gray-300">calls left</span>
                            <span className="text-gray-500"> · </span>
                            <span className="text-white font-semibold">{fridayAvail.label}</span>
                            <span className="text-gray-500"> (EST)</span>
                          </p>
                        )}
                      </div>
                    ) : null}

                    <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-5">
                        <div className="flex items-center gap-3 pb-4 mb-1 relative">
                          <div
                            className={cn(
                              'absolute bottom-0 left-0 right-0 h-px rounded-full pointer-events-none transition-colors duration-500',
                              theme.divider,
                            )}
                            aria-hidden
                          />
                          <img
                            src="/blueBall.png"
                            alt=""
                            width={44}
                            height={44}
                            className="h-11 w-11 object-contain shrink-0 drop-shadow-[0_0_16px_rgba(59,130,246,0.45)]"
                          />
                          <div className="min-w-0">
                            <p className="text-2xl font-black font-heading tracking-tight text-white">aiWebDF</p>
                            <p
                              className={cn(
                                'text-xs font-bold uppercase tracking-[0.2em] mt-0.5 transition-colors duration-500',
                                theme.formHeaderSub,
                              )}
                            >
                              Book a call
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label
                              className={cn(
                                'text-sm font-bold uppercase tracking-wider block mb-2 transition-colors duration-500',
                                theme.label,
                              )}
                            >
                              Name
                            </label>
                            <Input placeholder="John Doe" className={cn(theme.input)} {...register('name')} />
                            {errors.name && (
                              <p className={cn('text-base mt-1.5', theme.error)}>{errors.name.message}</p>
                            )}
                          </div>
                          <div>
                            <label
                              className={cn(
                                'text-sm font-bold uppercase tracking-wider block mb-2 transition-colors duration-500',
                                theme.label,
                              )}
                            >
                              Phone
                            </label>
                            <Input placeholder="(555) 555-0123" className={cn(theme.input)} {...register('phone')} />
                            {errors.phone && (
                              <p className={cn('text-base mt-1.5', theme.error)}>{errors.phone.message}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label
                            className={cn(
                              'text-sm font-bold uppercase tracking-wider block mb-2 transition-colors duration-500',
                              theme.label,
                            )}
                          >
                            Email
                          </label>
                          <Input
                            placeholder="john@example.com"
                            type="email"
                            className={cn(theme.input)}
                            {...register('email')}
                          />
                          {errors.email && (
                            <p className={cn('text-base mt-1.5', theme.error)}>{errors.email.message}</p>
                          )}
                        </div>

                        <div>
                          <label
                            className={cn(
                              'text-sm font-bold uppercase tracking-wider block mb-2 transition-colors duration-500',
                              theme.label,
                            )}
                          >
                            Notes <span className="opacity-60 font-normal normal-case">(optional)</span>
                          </label>
                          <Textarea
                            placeholder="Anything we should know before we reach out?"
                            className={cn(theme.input, 'h-auto min-h-[120px] resize-y')}
                            {...register('notes')}
                          />
                          {errors.notes && (
                            <p className={cn('text-base mt-1.5', theme.error)}>{errors.notes.message}</p>
                          )}
                        </div>

                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className={cn(
                            'inline-flex items-center justify-center gap-2 transition-all duration-500',
                            theme.submit,
                          )}
                        >
                          {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="h-4 w-4 border-2 rounded-full animate-spin border-black/25 border-t-black" />
                              Sending…
                            </span>
                          ) : (
                            <>
                              <Bot className="w-5 h-5 shrink-0" />
                              Book A Call!
                            </>
                          )}
                        </Button>
                      </form>
                  </div>
                </div>
            </div>
          </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 bg-[#0a0a0f] border-t border-white/5 text-center text-gray-500 text-base">
        <div className="mx-auto w-full max-w-none px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <p>© {new Date().getFullYear()} aiWebDF. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}