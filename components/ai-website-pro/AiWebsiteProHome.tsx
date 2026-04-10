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
import { UseCasesMarqueeBackdrop } from '@/components/ai-website-pro/UseCasesMarqueeBackdrop';
import {
  CONTACT_SECTION_THEME,
  AI_WEB_SECTION_GUTTER_X,
  AI_WEB_SECTION_PAD_Y,
  AI_WEB_FOOTER_PAD_Y,
  AI_WEB_TYPE_SECTION_TITLE,
  AI_WEB_TYPE_BODY,
  AI_WEB_FORM_LABEL,
  AI_WEB_FORM_BRAND_TITLE,
  AI_WEB_FORM_BRAND_SUB,
  AI_WEB_TYPE_META,
} from '@/lib/ai-website-pro-contact-theme';

/** Default when no plan is chosen in the UI (booking + CRM still expect a plan id). */
const DEFAULT_CONSULTATION_PLAN = 'advanced' as const;

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .refine((val) => val.replace(/\D/g, "").length >= 10, "Enter a valid phone number"),
  notes: z.string().max(2000, "Must be 2000 characters or less").optional(),
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
        <div className={cn('mx-auto flex h-20 w-full max-w-none items-center justify-between', AI_WEB_SECTION_GUTTER_X)}>
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img
              src="/blueBall.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-white">aiWebDF</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Button
              asChild
              className="bg-white text-black hover:bg-gray-200 font-medium text-sm sm:text-base px-5 md:px-6 rounded-full transition-all duration-300 shrink-0"
            >
              <a href="#contact" aria-label="Book a Call — go to contact form">
                Book a Call!
              </a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section — full viewport height, centered column */}
      <section
        className={cn(
          'relative flex min-h-[100dvh] w-full max-w-none flex-col items-center justify-center overflow-hidden',
          AI_WEB_SECTION_GUTTER_X,
          'pt-[calc(5rem+env(safe-area-inset-top,0px))] pb-20 sm:pt-28 sm:pb-24 md:pt-32 md:pb-28 max-sm:pb-[max(5rem,env(safe-area-inset-bottom,0px))]',
        )}
      >
        <div className="pointer-events-none absolute inset-0 z-0">
          <img
            src="/hero-bg.png"
            alt=""
            className="h-full w-full object-cover object-center scale-105 blur-md sm:blur-lg opacity-[0.22]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/65 via-[#0a0a0f]/88 to-[#0a0a0f]"></div>
          <div className="absolute top-1/4 left-1/2 h-[min(100vw,800px)] w-[min(100vw,800px)] -translate-x-1/2 rounded-full bg-[#0066ff]/15 blur-[120px] mix-blend-screen"></div>
          <div className="absolute inset-0 z-[1] flex min-h-0 flex-col overflow-hidden py-2 sm:py-4">
            <UseCasesMarqueeBackdrop className="min-h-0 flex-1" />
          </div>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-none flex-col items-center justify-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex w-full max-w-none flex-col items-center text-center"
          >
            <motion.div
              variants={fadeIn}
              className="relative z-[1] mx-auto mb-10 w-full max-w-[min(100%,calc(100vw-2rem))] rounded-3xl px-4 py-6 sm:mb-12 sm:max-w-[min(100%,48rem)] sm:px-6 sm:py-8 md:mb-14 md:max-w-[min(100%,60rem)] lg:max-w-[min(100%,min(96vw,76rem))] xl:max-w-[min(100%,min(96vw,88rem))] 2xl:max-w-[min(100%,min(98vw,100rem))]"
            >
              {/* Same glow stack as contact form card */}
              <motion.div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute -inset-px rounded-3xl blur-2xl -z-10 transition-colors duration-500',
                  theme.formGlowMotion,
                )}
                animate={{ opacity: [0.55, 0.85, 0.55] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-0 rounded-3xl blur-xl -z-10 transition-colors duration-500',
                  theme.formGlowStatic,
                )}
              />
              <p className="relative z-[1] text-balance font-black font-heading tracking-tight text-white text-[clamp(1.7rem,5.2vw+0.65rem,2.35rem)] leading-[1.2] sm:text-5xl sm:leading-[1.1] md:text-6xl md:leading-[1.08] lg:text-7xl lg:leading-[1.05] xl:text-8xl xl:leading-[1.03] 2xl:text-9xl 2xl:leading-[1.02]">
                You&apos;re{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-300 to-red-500">
                  losing money
                </span>{' '}
                if you haven&apos;t{' '}
                <br className="hidden lg:block" aria-hidden="true" />
                implemented{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#0066ff]">AI</span>{' '}
                yet.
              </p>
            </motion.div>

            <motion.div variants={fadeIn} className="relative z-[1] flex w-full flex-col items-center justify-center">
              <div className="relative w-full sm:w-auto rounded-3xl p-1">
                <motion.div
                  className={cn(
                    'pointer-events-none absolute -inset-px rounded-3xl blur-2xl -z-10 transition-colors duration-500',
                    theme.formGlowMotion,
                  )}
                  animate={{ opacity: [0.55, 0.85, 0.55] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div
                  className={cn(
                    'pointer-events-none absolute inset-0 rounded-3xl blur-xl -z-10 transition-colors duration-500',
                    theme.formGlowStatic,
                  )}
                />
                <Button
                  asChild
                  size="lg"
                  className="relative z-10 w-full !h-14 rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] px-8 text-base font-bold text-black hover:scale-[1.02] hover:from-[#0052cc] hover:to-[#00bfff] sm:w-auto sm:text-lg border border-[#00d4ff]/35 shadow-[0_0_40px_-6px_rgba(0,212,255,0.75),0_0_20px_-8px_rgba(0,102,255,0.4)] transition-all duration-500"
                >
                  <a href="#contact" aria-label="Book Call Now — go to contact form">
                    Book Call Now!
                  </a>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {showConsumersShiftSection && (
        /* The Pain — layout aligned with aiwebdesignfirm.com; fills viewport height responsively */
        <section
          className={cn(
            'relative flex min-h-[72svh] flex-col justify-center border-y border-white/5 bg-[#0d0d1a] sm:min-h-[76svh] md:min-h-[78svh] lg:min-h-[80svh]',
            AI_WEB_SECTION_PAD_Y,
          )}
        >
          <div className={cn('relative z-10 mx-auto w-full max-w-none', AI_WEB_SECTION_GUTTER_X)}>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={staggerContainer}
              className="grid items-center gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20"
            >
              <div>
                <motion.h2 variants={fadeIn} className={cn(AI_WEB_TYPE_SECTION_TITLE, 'mb-6')}>
                  Consumers don&apos;t Google anymore. <br />
                  <span className="text-gray-500">They ask ChatGPT.</span>
                </motion.h2>
                <motion.p variants={fadeIn} className={cn(AI_WEB_TYPE_BODY, 'mb-8')}>
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
                      <h4 className="text-xl sm:text-2xl font-bold font-heading mb-2">Rising Ad Costs</h4>
                      <p className={AI_WEB_TYPE_BODY}>Traditional PPC is becoming unsustainable for local businesses.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                      <Globe className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h4 className="text-xl sm:text-2xl font-bold font-heading mb-2">Algorithm Chaos</h4>
                      <p className={AI_WEB_TYPE_BODY}>Google updates are burying honest businesses beneath aggregators.</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <motion.div variants={fadeIn} className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#0066ff]/20 to-transparent rounded-3xl blur-2xl"></div>
                <div className="relative bg-[#0a0a0f] border border-white/10 rounded-3xl p-8 shadow-2xl">
                  <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
                    <Search className="w-5 h-5 text-gray-400" />
                    <div className={cn('text-gray-400 font-mono', AI_WEB_TYPE_META)}>Query behavior shift (2023-2025)</div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className={cn('font-medium', AI_WEB_TYPE_BODY, 'text-white/90')}>Traditional Search (Google)</span>
                        <span className="text-red-400">-24%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500/50 w-[76%] rounded-full"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className={cn('font-medium', AI_WEB_TYPE_BODY, 'text-white/90')}>Generative AI (ChatGPT, Claude)</span>
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
          'relative overflow-hidden border-t transition-colors duration-500',
          AI_WEB_SECTION_PAD_Y,
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
          <div className="absolute inset-0 z-[1] flex min-h-0 flex-col overflow-hidden py-4 sm:py-8">
            <UseCasesMarqueeBackdrop className="min-h-0 flex-1" />
          </div>
        </div>

        <div className={cn('relative z-10 mx-auto w-full max-w-none', AI_WEB_SECTION_GUTTER_X)}>
            <div id="contact" className="h-0 w-full overflow-hidden pointer-events-none" aria-hidden="true" />
            <div className="mx-auto w-full max-w-lg text-center mb-3">
              {!fridayAvailLoading && fridayAvail != null ? (
                <p className={cn(AI_WEB_TYPE_META, 'text-red-500')}>
                  <span className="sr-only">Call slots still available to book.</span>
                  Only{' '}
                  <span className="tabular-nums font-semibold">
                    {fridayAvail.hoursEnabled && fridayAvail.total > 0 ? fridayAvail.available : 0}
                  </span>{' '}
                  spots left
                </p>
              ) : null}
            </div>
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

                      <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-6">
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
                            <p className={AI_WEB_FORM_BRAND_TITLE}>aiWebDF</p>
                            <p className={cn(AI_WEB_FORM_BRAND_SUB, theme.formHeaderSub)}>Book a call</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className={cn(AI_WEB_FORM_LABEL, theme.label)}>Name</label>
                            <Input placeholder="John Doe" className={cn(theme.input)} {...register('name')} />
                            {errors.name && (
                              <p className={cn('text-sm sm:text-base mt-1.5', theme.error)}>{errors.name.message}</p>
                            )}
                          </div>
                          <div>
                            <label className={cn(AI_WEB_FORM_LABEL, theme.label)}>Phone</label>
                            <Input placeholder="(555) 555-0123" className={cn(theme.input)} {...register('phone')} />
                            {errors.phone && (
                              <p className={cn('text-sm sm:text-base mt-1.5', theme.error)}>{errors.phone.message}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className={cn(AI_WEB_FORM_LABEL, theme.label)}>Email</label>
                          <Input
                            placeholder="john@example.com"
                            type="email"
                            className={cn(theme.input)}
                            {...register('email')}
                          />
                          {errors.email && (
                            <p className={cn('text-sm sm:text-base mt-1.5', theme.error)}>{errors.email.message}</p>
                          )}
                        </div>

                        <div>
                          <label className={cn(AI_WEB_FORM_LABEL, theme.label)}>
                            About Your Business{' '}
                            <span className="opacity-60 font-normal normal-case">(optional)</span>
                          </label>
                          <Textarea
                            placeholder="Anything we should know before we reach out?"
                            className={cn(theme.input, 'h-auto min-h-[120px] resize-y')}
                            {...register('notes')}
                          />
                          {errors.notes && (
                            <p className={cn('text-sm sm:text-base mt-1.5', theme.error)}>{errors.notes.message}</p>
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
      <footer
        className={cn(
          'bg-[#0a0a0f] border-t border-white/5 text-center text-gray-500 text-sm sm:text-base',
          AI_WEB_FOOTER_PAD_Y,
        )}
      >
        <div className={cn('mx-auto w-full max-w-none', AI_WEB_SECTION_GUTTER_X)}>
          <p>© {new Date().getFullYear()} aiWebDF. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}