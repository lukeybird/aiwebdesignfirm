'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Search,
  Zap,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  MessageSquare,
  Globe,
  Flame,
  Phone,
  Smartphone,
  BookOpen,
  ShoppingBag,
  RefreshCw,
  Mail,
  Code2,
  Users,
  Megaphone,
  Briefcase,
  Calendar,
  Palette,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const PLAN_IDS = ['starter', 'advanced', 'elite'] as const;
type PlanId = (typeof PLAN_IDS)[number];

const PLAN_LABEL: Record<PlanId, string> = {
  starter: 'Starter AI',
  advanced: 'Advanced AI',
  elite: 'Elite AI',
};

/** Unselected plan segments: shared slate outline (Starter-style gray). */
const PLAN_SEGMENT_IDLE =
  'border-slate-500/25 bg-black/35 text-slate-500 hover:border-slate-400/40 hover:bg-slate-900/45 hover:text-slate-300';

/** Segmented plan picker: selected option uses tier colors; unselected use gray outline. */
const PLAN_SEGMENT_SELECTED: Record<PlanId, string> = {
  starter:
    'border-slate-300/55 bg-gradient-to-b from-slate-600/50 to-slate-800/40 text-white shadow-[0_0_22px_-8px_rgba(148,163,184,0.5)] ring-2 ring-slate-400/45',
  advanced:
    'border-[#00d4ff]/55 bg-gradient-to-b from-[#0066ff]/45 to-[#00d4ff]/28 text-cyan-50 shadow-[0_0_22px_-8px_rgba(0,212,255,0.45)] ring-2 ring-[#00d4ff]/40',
  elite:
    'border-orange-400/55 bg-gradient-to-b from-red-600/50 to-orange-600/38 text-white shadow-[0_0_22px_-8px_rgba(239,68,68,0.48)] ring-2 ring-orange-400/40',
};

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

const PLAN_THEMES: Record<PlanId, ContactTheme> = {
  starter: {
    sectionBg: 'bg-gradient-to-b from-[#0c0d10] via-[#0a0a0f] to-[#08080a]',
    sectionBorder: 'border-slate-600/25',
    blurTop: 'bg-slate-400/22',
    blurBottom: 'bg-slate-500/18',
    radial: 'bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(148,163,184,0.14),transparent)]',
    leftFeatureShell:
      'bg-gradient-to-br from-slate-600/35 to-slate-800/25 border border-slate-500/40',
    leftFeatureShadowHover:
      'shadow-[0_0_20px_-6px_rgba(148,163,184,0.4)] group-hover:shadow-[0_0_28px_-4px_rgba(203,213,225,0.35)]',
    leftFeatureIcon: 'text-slate-200',
    leftFeatureText: 'text-slate-200/90',
    formGlowMotion: 'bg-gradient-to-b from-slate-400/35 via-slate-500/22 to-slate-600/18',
    formGlowStatic: 'bg-gradient-to-br from-slate-500/20 via-slate-600/12 to-transparent',
    formCard:
      'bg-gradient-to-b from-[#121318] via-[#0c0d12] to-[#08090c] border-2 border-slate-500/55 shadow-[0_0_56px_-10px_rgba(148,163,184,0.35),0_0_24px_-12px_rgba(100,116,139,0.25)] ring-1 ring-slate-400/20',
    formBlobTL: 'bg-slate-400/12',
    formBlobBR: 'bg-slate-500/14',
    divider: 'bg-gradient-to-r from-transparent via-slate-500/40 to-transparent',
    formHeaderSub: 'text-slate-300/90',
    label: 'text-slate-200/90',
    input:
      'bg-black/50 border-slate-500/40 text-white text-base placeholder:text-slate-400/30 h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:border-slate-300/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
    error: 'text-slate-300',
    submit:
      'w-full h-14 rounded-xl text-lg font-black uppercase tracking-wide bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 hover:from-slate-200 hover:via-white hover:to-slate-200 text-black shadow-[0_0_36px_-8px_rgba(203,213,225,0.5)] border border-white/25 hover:scale-[1.01] active:scale-[0.99] transition-all duration-500 disabled:opacity-60 disabled:hover:scale-100',
    successRing:
      'bg-gradient-to-br from-slate-400/30 to-slate-600/30 border border-slate-400/45',
    successTitle:
      'text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-200',
    successSub: 'text-slate-300/65',
    successBtn: 'border-slate-500/45 text-slate-200 hover:bg-slate-950/60 hover:text-white',
    successIcon: 'text-slate-200',
  },
  advanced: {
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
  },
  elite: {
    sectionBg: 'bg-gradient-to-b from-[#0a0303] via-[#0d0505] to-[#0a0a0f]',
    sectionBorder: 'border-red-950/40',
    blurTop: 'bg-red-600/30',
    blurBottom: 'bg-orange-600/25',
    radial: 'bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(220,38,38,0.18),transparent)]',
    leftFeatureShell:
      'bg-gradient-to-br from-red-600/40 to-orange-600/25 border border-red-500/35',
    leftFeatureShadowHover:
      'shadow-[0_0_20px_-6px_rgba(239,68,68,0.5)] group-hover:shadow-[0_0_28px_-4px_rgba(249,115,22,0.45)]',
    leftFeatureIcon: 'text-orange-300',
    leftFeatureText: 'text-red-100/80',
    formGlowMotion: 'bg-gradient-to-b from-red-500/50 via-orange-500/35 to-red-600/20',
    formGlowStatic: 'bg-gradient-to-br from-red-600/25 via-orange-600/15 to-transparent',
    formCard:
      'bg-gradient-to-b from-[#160606] via-[#0c0303] to-[#080202] border-2 border-red-500/70 shadow-[0_0_72px_-10px_rgba(239,68,68,0.55),0_0_24px_-8px_rgba(249,115,22,0.35)] ring-1 ring-orange-500/25',
    formBlobTL: 'bg-orange-500/10',
    formBlobBR: 'bg-red-600/15',
    divider: 'bg-gradient-to-r from-transparent via-red-500/35 to-transparent',
    formHeaderSub: 'text-red-300/85',
    label: 'text-red-200/90',
    input:
      'bg-black/50 border-red-500/35 text-white text-base placeholder:text-red-200/25 h-12 rounded-xl focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:border-orange-400/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
    error: 'text-orange-300',
    submit:
      'w-full h-14 rounded-xl text-lg font-black uppercase tracking-wide bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-500 hover:via-orange-500 hover:to-orange-400 text-white shadow-[0_0_40px_-6px_rgba(239,68,68,0.85),0_0_20px_-8px_rgba(249,115,22,0.4)] border border-red-400/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-500 disabled:opacity-60 disabled:hover:scale-100',
    successRing:
      'bg-gradient-to-br from-orange-500/30 to-red-600/30 border border-orange-400/40',
    successTitle:
      'text-transparent bg-clip-text bg-gradient-to-r from-white to-orange-200',
    successSub: 'text-red-200/60',
    successBtn: 'border-red-500/40 text-orange-200 hover:bg-red-950/50 hover:text-white',
    successIcon: 'text-orange-400',
  },
};

const PLAN_LEFT_COPY: Record<
  PlanId,
  {
    BadgeIcon: LucideIcon;
    bullets: { Icon: LucideIcon; text: string }[];
  }
> = {
  starter: {
    BadgeIcon: Bot,
    bullets: [
      { Icon: Bot, text: 'An AI Q&A Chatbot that strengthens your SEO' },
      { Icon: Zap, text: 'Site built out in 7 days or less' },
      { Icon: Search, text: 'Submission to Google & major search engines' },
      { Icon: Palette, text: 'Web design makeover included' },
      { Icon: MessageSquare, text: 'Virtual support via our Q&A Chatbot' },
      { Icon: FileText, text: 'Detailed documents on how to best effectively use the tool' },
      { Icon: Mail, text: '2 custom emails' },
    ],
  },
  advanced: {
    BadgeIcon: Zap,
    bullets: [
      { Icon: Smartphone, text: 'One Basic Custom App Build Out (generic)' },
      { Icon: Phone, text: 'AI Phone Receptionist (books appointments)' },
      { Icon: MessageSquare, text: 'Appointment Booking App (sends SMS reminders)' },
      { Icon: Bot, text: 'Custom design for AI Chatbot' },
      { Icon: RefreshCw, text: 'Free tweaks and changes' },
      { Icon: BookOpen, text: 'Online Blog (generic)' },
      { Icon: ShoppingBag, text: 'Online Store (generic)' },
      { Icon: Mail, text: '20 custom emails' },
    ],
  },
  elite: {
    BadgeIcon: Flame,
    bullets: [
      {
        Icon: Code2,
        text: 'Proactive custom development designed to solve the biggest problems in your business',
      },
      {
        Icon: Calendar,
        text: 'Weekly status meetings to discuss progress and pain points',
      },
      {
        Icon: Users,
        text: '24/7 dedication to solve the biggest problems before you know they exist',
      },
      { Icon: BarChart3, text: 'Deep data analysis (learn to convert leads)' },
      { Icon: Mail, text: '100 custom emails' },
      {
        Icon: Megaphone,
        text: 'Full time social media marketing (video editor, marketing planner, and executionist)',
      },
      { Icon: Briefcase, text: 'Technical consultation' },
    ],
  },
};

const formSchema = z.object({
  plan: z.enum(['starter', 'advanced', 'elite']),
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
    plan: 'advanced',
    name: '',
    email: '',
    phone: '',
    notes: '',
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultFormValues,
  });

  const selectedPlan: PlanId = watch('plan') ?? 'advanced';
  const theme = PLAN_THEMES[selectedPlan];
  const leftCopy = PLAN_LEFT_COPY[selectedPlan];
  const LeftBadgeIcon = leftCopy.BadgeIcon;

  const scrollToSectionId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start', inline: 'nearest' });
  }, []);

  const scrollToContact = (planId: PlanId) => {
    setValue('plan', planId, { shouldValidate: true });
    scrollToSectionId('contact');
  };

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

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    const submittedPlan = data.plan;
    try {
      const response = await fetch('/api/ai-website-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
        q.set('plan', data.plan);
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
              <a href="#journey" className="hover:text-white transition-colors">
                How it works
              </a>
              <a href="#contact" className="hover:text-white transition-colors">
                Book a call
              </a>
              <a href="#plans" className="hover:text-white transition-colors">
                Pricing
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
                <a href="#journey" aria-label="See how we fix that">
                  How so?
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

      {/* Journey / How — value breakdown */}
      <section className="py-24 bg-[#0a0a0f] border-y border-white/5">
        <div className="mx-auto w-full max-w-none px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div id="journey" className="h-0 w-full overflow-hidden pointer-events-none" aria-hidden="true" />
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="mx-auto mb-16 w-full max-w-none text-center"
          >
            <motion.h2
              variants={fadeIn}
              className="max-w-5xl mx-auto text-balance text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black font-heading text-white mb-2 leading-tight"
            >
              The Ways You Could Be Losing Money
            </motion.h2>
          </motion.div>

          <div className="mx-auto w-full max-w-none space-y-5">
            {[
              {
                n: '1',
                title: 'Instant Replies',
                body: "If you don't reply instantly, you are losing leads. Every second you wait loses money—AI replies instantly and converts while interest is highest",
              },
              {
                n: '2',
                title: 'SEO Ranking',
                body: "If you don't have extremely detailed FAQ's you are losing a chance to get on top of the search engines. Every question your customers ask should become SEO fuel— Our AI Q&A Chatbot answers questions the way you want them to be answered, and if it doesn't have the answer you only need to manually answer it once, then it's forever locked in place and given to Google and ChatGPT for higher SEO Ranking!",
              },
              {
                n: '3',
                title: 'Catches Human Errors',
                body: 'If you ever miss a single call, text, or email, you are losing a lead. Eliminate missed calls, slow responses, and human error—AI handles it all instantly and flawlessly',
              },
              {
                n: '4',
                title: 'AI Works 24/7',
                body: "If you sleep, you're losing leads. Our AI Systems work night and day to convert new leads into sales.",
              },
              {
                n: '5',
                title: 'Be There First',
                body: "The gun has been shot for the race on AI and if you are still on the starting line you're not winning the race!",
              },
            ].map((block, i) => (
              <motion.div
                key={block.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-white/10 border-l-4 border-l-[#00d4ff] bg-[#0d0d1a]/80 px-5 py-6 sm:px-6"
              >
                <div className="flex flex-wrap items-baseline gap-3 mb-3">
                  <span className="text-[#00d4ff] font-black tabular-nums text-xl">{block.n}.</span>
                  <h3 className="text-2xl sm:text-3xl font-bold font-heading text-white">{block.title}</h3>
                </div>
                <p className="text-lg text-gray-300 leading-relaxed pl-0 sm:pl-8">{block.body}</p>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl border border-orange-500/35 border-l-4 border-l-orange-400 bg-gradient-to-br from-red-950/40 to-[#0d0d1a] px-5 py-7 sm:px-7"
            >
              <h3 className="text-2xl sm:text-3xl font-black font-heading text-white mb-4">Conclusion</h3>
              <p className="text-gray-200 text-xl leading-relaxed">
                You dramatically reduce physical labor costs, you increase your number of leads, you increase your closing
                percentages, you increase your exposure online dramatically through ChatGPT and Google, this is literally a
                no brainer!
              </p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-14"
          >
            <Button
              asChild
              size="lg"
              className="rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black font-bold text-lg px-8 hover:scale-[1.02] transition-transform"
            >
              <a href="#plans">
                Compare plans <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
            <a
              href="#contact"
              className="text-base font-medium text-gray-400 hover:text-[#7dd3fc] transition-colors"
            >
              Not sure yet? Book a call →
            </a>
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

      {/* Pricing */}
      <section className="pt-14 pb-28 sm:pt-16 sm:pb-32 lg:pt-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0d0d1a] to-[#0a0a0f]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-[#0066ff]/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="relative z-10 mx-auto flex w-full max-w-none flex-col px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
          <div id="plans" className="h-0 w-full shrink-0 overflow-hidden pointer-events-none" aria-hidden="true" />
          <div className="mx-auto mb-12 flex w-full flex-col items-center justify-center py-5 text-center sm:mb-14 sm:py-6 lg:mb-16 lg:py-7">
            <h2 className="text-5xl font-bold font-heading lg:text-6xl">Choose Your Advantage</h2>
          </div>

          <div className="mx-auto grid w-full max-w-none grid-cols-1 items-stretch gap-6 lg:grid-cols-3">

            {/* Tier 1 — Starter AI */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              viewport={{ once: true }}
              className="relative rounded-3xl flex flex-col h-full min-h-0 w-full"
              style={{ zIndex: 1 }}
            >
              <div className="absolute -inset-2 rounded-3xl bg-white/[0.14] blur-2xl -z-10 pointer-events-none" />
              <div className="absolute -inset-px bg-gradient-to-b from-slate-300/22 via-slate-400/10 to-slate-600/12 rounded-3xl blur-lg -z-10 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-slate-400/10 via-transparent to-transparent rounded-3xl blur-md -z-10 pointer-events-none" />
              <div className="relative bg-gradient-to-b from-[#141418] to-[#0d0d1a] border-2 border-slate-400/45 rounded-3xl p-8 flex flex-col h-full min-h-0 shadow-[0_0_32px_-6px_rgba(255,255,255,0.2),0_0_28px_-14px_rgba(148,163,184,0.4),0_0_10px_-8px_rgba(203,213,225,0.15)] ring-1 ring-slate-500/20">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 text-black text-xs font-black uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                  Start Today
                </div>

                <div className="mb-6 mt-2">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <p className="text-base font-semibold text-slate-400 uppercase tracking-widest min-w-0">Starter AI</p>
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-500 shrink-0">
                      TIER III
                    </span>
                  </div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="tabular-nums text-5xl font-black font-heading text-white leading-none">
                      $99
                      <span className="text-[0.55em] align-super font-black ml-0.5">95</span>
                    </span>
                    <span className="text-slate-500 mb-1 text-base">/mo</span>
                  </div>
                  <p className="text-base text-slate-400/90">
                    The plan to get started with AI.
                  </p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "An AI Q&A Chatbot that strengthens your SEO",
                    "Site built out in 7 days or less",
                    "Submission to Google & major search engines",
                    "Web design makeover included",
                    "Virtual support via our Q&A Chatbot",
                    "Detailed documents on how to best effectively use the tool",
                    "2 custom emails",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-base">
                      <CheckCircle2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-gray-200">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => scrollToContact('starter')}
                  className="w-full rounded-full bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 hover:from-slate-200 hover:via-white hover:to-slate-200 text-black font-black text-xl h-14 shadow-[0_0_24px_-6px_rgba(203,213,225,0.45)] border border-white/25 hover:scale-[1.02] transition-all duration-200 gap-0"
                >
                  Get Started <ArrowRight className="ml-2 w-5 h-5 shrink-0" />
                </Button>
                <p className="text-sm text-center text-slate-500/70 mt-3">Perfect to get live fast</p>
              </div>
            </motion.div>

            {/* Tier 2 — Advanced AI */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="relative rounded-3xl flex flex-col h-full min-h-0 w-full"
              style={{ zIndex: 10 }}
            >
              {/* Glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#0066ff]/32 to-[#00d4ff]/22 rounded-3xl blur-xl -z-10" />
              <div className="relative bg-gradient-to-b from-[#0a1628] to-[#0d0d1a] border-2 border-[#0066ff]/65 rounded-3xl p-8 flex flex-col h-full min-h-0 shadow-[0_0_56px_-10px_rgba(0,102,255,0.5),0_0_28px_-10px_rgba(0,212,255,0.3)] ring-1 ring-[#00d4ff]/25">
                {/* Badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black text-xs font-black uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                  Most Popular — Best Value
                </div>

                <div className="mb-6 mt-2">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <p className="text-base font-semibold text-[#00d4ff] uppercase tracking-widest min-w-0">Advanced AI</p>
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#00d4ff]/55 shrink-0">
                      TIER II
                    </span>
                  </div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="tabular-nums text-6xl font-black font-heading text-white leading-none">
                      $499
                      <span className="text-[0.55em] align-super font-black ml-0.5">95</span>
                    </span>
                    <span className="text-gray-400 mb-1.5 text-base">/mo</span>
                  </div>
                  <p className="text-base text-[#00d4ff]/70">The most reliable tools AI has to offer.</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "Everything in Starter AI",
                    "One Basic Custom App Build Out (generic)",
                    "AI Phone Receptionist (books appointments)",
                    "Appointment Booking App (sends SMS reminders)",
                    "Custom design for AI Chatbot",
                    "Free tweaks and changes",
                    "Online Blog (generic)",
                    "Online Store (generic)",
                    "20 custom emails",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-base">
                      <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${i === 0 ? "text-gray-500" : "text-[#00d4ff]"}`} />
                      <span className={i === 0 ? "text-gray-500" : "text-gray-200"}>{item}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  type="button"
                  size="lg"
                  onClick={() => scrollToContact('advanced')}
                  className="w-full rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] hover:from-[#0052cc] hover:to-[#00bfff] text-black font-black text-xl h-14 shadow-[0_0_30px_-5px_#00d4ff] hover:scale-105 transition-all duration-200 gap-0"
                >
                  Go Advanced AI <ArrowRight className="ml-2 w-5 h-5 shrink-0" />
                </Button>
                <p className="text-sm text-center text-[#00d4ff]/50 mt-3">The obvious choice for serious growth</p>
              </div>
            </motion.div>

            {/* Tier 3 — Elite AI */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
              className="relative rounded-3xl flex flex-col h-full min-h-0 w-full"
              style={{ zIndex: 11 }}
            >
              <div className="absolute -inset-px bg-gradient-to-b from-red-500/50 via-orange-500/35 to-red-600/20 rounded-3xl blur-2xl -z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/25 via-orange-600/15 to-transparent rounded-3xl blur-xl -z-10" />
              <div className="relative bg-gradient-to-b from-[#1a0808] via-[#120606] to-[#0d0d1a] border-2 border-red-500/70 rounded-3xl p-8 flex flex-col h-full min-h-0 shadow-[0_0_64px_-10px_rgba(239,68,68,0.55),0_0_24px_-8px_rgba(249,115,22,0.35)] ring-1 ring-orange-500/25">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest px-4 sm:px-5 py-1.5 rounded-full shadow-lg shadow-red-950/60 whitespace-nowrap">
                  Elite AI
                </div>

                <div className="mb-6 mt-2">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <p className="text-base font-semibold text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-400 to-red-500 uppercase tracking-widest min-w-0">
                      Elite AI
                    </p>
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-orange-400/80 shrink-0">
                      TIER I
                    </span>
                  </div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="tabular-nums text-6xl font-black font-heading text-white leading-none">
                      $4,999
                      <span className="text-[0.55em] align-super font-black ml-0.5">95</span>
                    </span>
                    <span className="text-red-200/60 mb-1.5 text-base">/mo</span>
                  </div>
                  <p className="text-base text-red-200/70 leading-relaxed">
                    Full technical division that happens to be on the cutting edge of AI.
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    'Everything in Advanced AI',
                    'Proactive custom development designed to solve the biggest problems in your business',
                    'Weekly status meetings to discuss progress and pain points',
                    '24/7 dedication to solve the biggest problems before you know they exist',
                    'Deep data analysis (learn to convert leads)',
                    '100 custom emails',
                    'Full time social media marketing (video editor, marketing planner, and executionist)',
                    'Technical consultation',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-base">
                      <CheckCircle2
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          i === 0 ? 'text-gray-500' : 'text-orange-400'
                        }`}
                      />
                      <span className={i === 0 ? 'text-gray-500' : 'text-gray-200'}>{item}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  type="button"
                  size="lg"
                  onClick={() => scrollToContact('elite')}
                  className="w-full rounded-full bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-500 hover:via-orange-500 hover:to-orange-400 text-white font-black text-xl h-14 shadow-[0_0_36px_-6px_rgba(239,68,68,0.75)] hover:scale-[1.02] transition-all duration-200 border border-red-400/30 gap-0"
                >
                  Go Elite AI <ArrowRight className="ml-2 w-5 h-5 shrink-0" />
                </Button>
                <p className="text-sm text-center text-orange-400/55 mt-3">For businesses that refuse to lose</p>
              </div>
            </motion.div>

          </div>

          {/* Bottom note */}
          <p className="text-center text-base text-gray-600 mt-10">
            All plans are a manual onboarding process to set reasonable expectations and goals for your specific business.
          </p>
        </div>
      </section>

      {/* Lead capture — plan-themed contact */}
      <section
        className={cn(
          'relative overflow-hidden border-t pt-12 pb-16 md:pt-16 md:pb-24 transition-colors duration-500',
          theme.sectionBorder,
        )}
      >
        {/* Full-bleed behind section padding so the top band isn’t flat page black (#0a0a0f) */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <motion.div
            key={selectedPlan}
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
            <div className="mx-auto w-full max-w-none">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start lg:items-center">
                <div className="order-2 space-y-8 lg:order-1">
                  <div className="space-y-5">
                    {leftCopy.bullets.map(({ Icon, text }) => (
                      <div key={text} className={cn('flex items-center gap-4 group', theme.leftFeatureText)}>
                        <div
                          className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500',
                            theme.leftFeatureShell,
                            theme.leftFeatureShadowHover,
                          )}
                        >
                          <Icon className={cn('w-5 h-5', theme.leftFeatureIcon)} />
                        </div>
                        <span className="font-medium text-lg leading-snug">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative order-1 lg:order-2 lg:pt-2 rounded-3xl">
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
                              {PLAN_LABEL[selectedPlan]} · Contact
                            </p>
                          </div>
                        </div>

                        <div>
                          <label
                            className={cn(
                              'text-sm font-bold uppercase tracking-wider block mb-2 transition-colors duration-500',
                              theme.label,
                            )}
                          >
                            Which plan?
                          </label>
                          <input type="hidden" {...register('plan')} />
                          <div
                            className={cn(
                              'grid grid-cols-3 gap-1.5 rounded-xl border p-1.5 transition-colors duration-500',
                              selectedPlan === 'starter' && 'border-slate-500/40 bg-slate-950/50',
                              selectedPlan === 'advanced' && 'border-[#0066ff]/40 bg-[#050a14]/55',
                              selectedPlan === 'elite' && 'border-red-500/35 bg-[#120606]/55',
                            )}
                            role="group"
                            aria-label="Which plan?"
                          >
                            {PLAN_IDS.map((planId) => {
                              const isSelected = selectedPlan === planId;
                              return (
                                <button
                                  key={planId}
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() =>
                                    setValue('plan', planId, { shouldValidate: true, shouldDirty: true })
                                  }
                                  className={cn(
                                    'relative min-w-0 rounded-lg border px-1 py-2.5 text-center text-[10px] font-black uppercase leading-tight tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 sm:px-2 sm:text-[11px]',
                                    isSelected ? PLAN_SEGMENT_SELECTED[planId] : PLAN_SEGMENT_IDLE,
                                  )}
                                >
                                  <span className="block truncate">{PLAN_LABEL[planId]}</span>
                                </button>
                              );
                            })}
                          </div>
                          {errors.plan && (
                            <p className={cn('text-base mt-1.5', theme.error)}>{errors.plan.message}</p>
                          )}
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
                              <span
                                className={cn(
                                  'h-4 w-4 border-2 rounded-full animate-spin',
                                  selectedPlan === 'elite'
                                    ? 'border-white/30 border-t-white'
                                    : 'border-black/25 border-t-black',
                                )}
                              />
                              Sending…
                            </span>
                          ) : (
                            <>
                              <LeftBadgeIcon className="w-5 h-5 shrink-0" />
                              Book A Call!
                            </>
                          )}
                        </Button>
                      </form>
                  </div>
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