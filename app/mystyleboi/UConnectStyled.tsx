'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

const ORIGIN = 'https://uconnected.vercel.app';
const GUTTER = 'px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20';
const CHROME =
  'border-[#0066ff]/20 bg-[#0a1528]/70 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[#0a1528]/55';
const TITLE = 'text-3xl sm:text-4xl md:text-5xl font-bold font-heading tracking-tight text-white';
const BODY = 'text-base sm:text-lg leading-relaxed text-gray-400';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14 } },
};

const INTERESTS = [
  'Project teams',
  'Learning circles',
  'Local meetups',
  'Hobby groups',
  'Mentorship',
  'Side projects',
  'Book clubs',
  'Skill shares',
  'Founders',
  'Hiking crews',
  'Design pods',
  'Study groups',
];

const WHY = [
  {
    n: '01',
    title: 'Define what you are looking for',
    body: 'Post a group seeking with your ideal size and interest mix. Be clear about what kind of collaboration or community you want to build.',
  },
  {
    n: '02',
    title: 'Discover compatible people',
    body: 'Browse profiles matched by shared interests and compatible group seekings. Connect with people who want the same kind of group you do.',
  },
  {
    n: '03',
    title: 'Form focused groups',
    body: 'Accept formation invites, spin up a group, and move from intent to action. Small groups built around shared goals, not endless scrolling.',
  },
  {
    n: '04',
    title: 'Meet and grow together',
    body: 'Organize events, stay active in group chat, and turn online connections into real-world collaboration and community.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Build your profile',
    body: 'Add your display name, bio, and ranked interests so others understand what you care about and what you bring to a group.',
  },
  {
    n: '02',
    title: 'Share your group seeking',
    body: 'Describe the kind of group you want: hobby circle, project team, local meetup, or professional network — and who should join.',
  },
  {
    n: '03',
    title: 'Connect and form',
    body: 'Discover compatible people, respond to formation invites, and launch a group when the right mix comes together.',
  },
  {
    n: '04',
    title: 'Show up consistently',
    body: 'Use events and group chat to stay engaged. The best groups are built through regular, thoughtful participation.',
  },
];

const USES = [
  {
    title: 'Project collaborators',
    body: 'Find co-builders for side projects, startups, or creative work with aligned skills and availability.',
  },
  {
    title: 'Learning circles',
    body: 'Join or start small study groups, book clubs, or skill-sharing communities around shared interests.',
  },
  {
    title: 'Professional networks',
    body: 'Connect with peers in your field for mentorship, referrals, and meaningful industry relationships.',
  },
  {
    title: 'Local communities',
    body: 'Meet people nearby who share your hobbies — from maker spaces to hiking — and turn interests into regular meetups.',
  },
];

function InterestMarquee() {
  const row = [...INTERESTS, ...INTERESTS];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.14]" aria-hidden>
      <div className="absolute inset-x-0 top-[18%] -rotate-2">
        <div className="ai-use-case-marquee-ltr flex w-max gap-10 whitespace-nowrap font-heading text-4xl font-bold uppercase tracking-[0.12em] text-white sm:text-5xl">
          {row.map((label, i) => (
            <span key={`a-${i}`}>{label}</span>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 top-[48%] rotate-[1.5deg]">
        <div className="ai-use-case-marquee-rtl flex w-max gap-10 whitespace-nowrap font-heading text-4xl font-bold uppercase tracking-[0.12em] text-white sm:text-5xl">
          {row.map((label, i) => (
            <span key={`b-${i}`}>{label}</span>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 top-[78%] -rotate-1">
        <div className="ai-use-case-marquee-ltr flex w-max gap-10 whitespace-nowrap font-heading text-3xl font-bold uppercase tracking-[0.14em] text-white sm:text-4xl">
          {row.map((label, i) => (
            <span key={`c-${i}`}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UConnectStyled() {
  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] text-[#f5f5f7] selection:bg-[#00d4ff]/30">
      <header className={`fixed inset-x-0 top-0 z-50 h-20 border-b ${CHROME}`}>
        <div className={`mx-auto flex h-full max-w-[1600px] items-center justify-between ${GUTTER}`}>
          <Link href="/mystyleboi" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <Image src="/blueBall.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" priority />
            <span className="font-heading text-xl font-bold tracking-tight sm:text-2xl">UConnect</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <a
              href={`${ORIGIN}/auth`}
              className="hidden px-4 py-2 text-sm font-medium text-white/65 transition-colors hover:text-white sm:inline-block"
            >
              Sign in
            </a>
            <a
              href={`${ORIGIN}/auth`}
              className="inline-flex h-11 items-center rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] px-5 text-sm font-bold text-black shadow-[0_0_28px_-8px_rgba(0,212,255,0.65)] transition-transform hover:scale-[1.02]"
            >
              Get started
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero — full-bleed, brand-first, no inset card */}
        <section className="relative flex min-h-[100dvh] items-center overflow-hidden pt-20">
          <div className="absolute inset-0">
            <Image
              src="/hero-bg.png"
              alt=""
              fill
              priority
              className="scale-105 object-cover opacity-[0.22] blur-md sm:blur-lg"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/65 via-[#0a0a0f]/88 to-[#0a0a0f]" />
            <motion.div
              className="absolute left-1/2 top-1/3 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[#0066ff]/15 blur-[120px] mix-blend-screen"
              animate={{ opacity: [0.55, 0.85, 0.55] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <InterestMarquee />
          </div>

          <motion.div
            className={`relative z-10 mx-auto w-full max-w-[1600px] ${GUTTER} py-16 sm:py-20`}
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            <motion.p
              variants={fadeUp}
              className="font-heading text-4xl font-black tracking-tight text-transparent sm:text-5xl md:text-6xl lg:text-7xl"
              style={{
                backgroundImage: 'linear-gradient(90deg, #00d4ff, #0066ff)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
              }}
            >
              UConnect
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="mt-4 max-w-4xl font-heading text-[clamp(2.25rem,6vw,5.5rem)] font-black leading-[1.05] tracking-tight text-white"
            >
              Find your people. Build your group.
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
              Discover compatible people, form small groups around shared interests, and grow meaningful connections —
              professionally and personally.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <motion.a
                href={`${ORIGIN}/auth`}
                className="inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] px-8 text-base font-black text-black shadow-[0_0_40px_-6px_rgba(0,212,255,0.75)] transition-transform hover:scale-[1.02]"
                animate={{
                  boxShadow: [
                    '0 0 32px -8px rgba(0,212,255,0.55)',
                    '0 0 48px -6px rgba(0,212,255,0.85)',
                    '0 0 32px -8px rgba(0,212,255,0.55)',
                  ],
                }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                Create your account
              </motion.a>
              <a
                href="#how-it-works"
                className="inline-flex h-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-8 text-base font-semibold text-white/85 transition-colors hover:border-[#00d4ff]/40 hover:bg-white/[0.07]"
              >
                See how it works
              </a>
            </motion.div>
          </motion.div>
        </section>

        {/* About */}
        <section className={`border-t border-white/[0.06] ${GUTTER} ${'py-20 sm:py-24 md:py-28'}`}>
          <motion.div
            className="mx-auto max-w-3xl"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.18em] text-[#7dd3fc]/90">
              About UConnect
            </motion.p>
            <motion.h2 variants={fadeUp} className={`mt-3 ${TITLE}`}>
              Networking that starts with intent, not noise
            </motion.h2>
            <motion.p variants={fadeUp} className={`mt-5 ${BODY}`}>
              Most platforms optimize for engagement. UConnect optimizes for alignment — matching you with people who
              share your interests and want the same kind of group experience. Whether you are building a professional
              network, a hobby community, or a project team, you start by saying what you are looking for.
            </motion.p>
          </motion.div>
        </section>

        {/* Why */}
        <section className="border-t border-white/[0.06] bg-gradient-to-b from-[#050a14] via-[#070d18] to-[#0a0a0f]">
          <div className={`mx-auto max-w-[1600px] ${GUTTER} py-20 sm:py-24 md:py-28`}>
            <motion.div
              className="max-w-2xl"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.18em] text-[#7dd3fc]/90">
                Why UConnect
              </motion.p>
              <motion.h2 variants={fadeUp} className={`mt-3 ${TITLE}`}>
                Built for people who want more than a feed
              </motion.h2>
            </motion.div>

            <div className="mt-14 space-y-0">
              {WHY.map((item) => (
                <motion.div
                  key={item.n}
                  className="grid gap-4 border-t border-white/[0.08] py-8 sm:grid-cols-[5rem_1fr] sm:gap-10"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="font-heading text-sm font-bold tracking-[0.2em] text-[#00d4ff]">{item.n}</span>
                  <div>
                    <h3 className="font-heading text-xl font-bold tracking-tight text-white sm:text-2xl">{item.title}</h3>
                    <p className="mt-2 max-w-2xl text-base leading-relaxed text-gray-400">{item.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className={`scroll-mt-24 border-t border-white/[0.06] ${GUTTER} py-20 sm:py-24 md:py-28`}>
          <motion.div
            className="max-w-2xl"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.18em] text-[#7dd3fc]/90">
              How it works
            </motion.p>
            <motion.h2 variants={fadeUp} className={`mt-3 ${TITLE}`}>
              From profile to group in four steps
            </motion.h2>
            <motion.p variants={fadeUp} className={`mt-4 ${BODY}`}>
              Define what you want, find compatible people, form a group, and stay connected.
            </motion.p>
          </motion.div>

          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {STEPS.map((step, i) => (
              <motion.li
                key={step.n}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <span className="font-heading text-5xl font-black tracking-tight text-white/[0.08]">{step.n}</span>
                <h3 className="mt-3 font-heading text-lg font-bold tracking-tight text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400 sm:text-base">{step.body}</p>
              </motion.li>
            ))}
          </ol>

          <div className="mt-12">
            <a
              href={`${ORIGIN}/about`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#7dd3fc] transition-colors hover:text-[#00d4ff]"
            >
              Learn more about how UConnect works
              <span aria-hidden>→</span>
            </a>
          </div>
        </section>

        {/* Use cases */}
        <section className="border-t border-white/[0.06] bg-[#0a0a0f]">
          <div className={`mx-auto max-w-[1600px] ${GUTTER} py-20 sm:py-24 md:py-28`}>
            <motion.div
              className="max-w-2xl"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              variants={stagger}
            >
              <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.18em] text-[#7dd3fc]/90">
                Use it your way
              </motion.p>
              <motion.h2 variants={fadeUp} className={`mt-3 ${TITLE}`}>
                Professional, personal, or both
              </motion.h2>
              <motion.p variants={fadeUp} className={`mt-4 ${BODY}`}>
                Groups on UConnect can be as focused or as casual as you need.
              </motion.p>
            </motion.div>

            <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {USES.map((use, i) => (
                <motion.div
                  key={use.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: i * 0.05 }}
                  className="border-l border-[#0066ff]/35 pl-5 sm:pl-6"
                >
                  <h3 className="font-heading text-xl font-bold tracking-tight text-white">{use.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-gray-400">{use.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden border-t border-[#0066ff]/25">
          <div className="absolute inset-0 bg-gradient-to-b from-[#050a14] via-[#070d18] to-[#0a0a0f]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(0,102,255,0.22),transparent)]" />
          <motion.div
            className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#0066ff]/25 blur-[100px]"
            animate={{ opacity: [0.45, 0.8, 0.45], scale: [1, 1.06, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-[#00d4ff]/20 blur-[90px]"
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />

          <div className={`relative mx-auto max-w-3xl ${GUTTER} py-24 text-center sm:py-28`}>
            <p className="font-heading text-2xl font-black tracking-tight text-transparent sm:text-3xl" style={{
              backgroundImage: 'linear-gradient(90deg, #00d4ff, #0066ff)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}>
              UConnect
            </p>
            <h2 className={`mt-4 ${TITLE}`}>Ready to get connected?</h2>
            <p className={`mx-auto mt-4 max-w-xl ${BODY}`}>
              Create your profile, rank your interests, and start discovering people who are looking for the same kind
              of group you are.
            </p>
            <a
              href={`${ORIGIN}/auth`}
              className="mt-9 inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] px-10 text-base font-black text-black shadow-[0_0_40px_-6px_rgba(0,212,255,0.75)] transition-transform hover:scale-[1.02]"
            >
              Get started for free
            </a>
          </div>
        </section>
      </main>

      <footer className={`h-20 border-t ${CHROME}`}>
        <div className={`mx-auto flex h-full max-w-[1600px] items-center justify-between ${GUTTER}`}>
          <div className="flex items-center gap-3">
            <Image src="/blueBall.png" alt="" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="font-heading text-sm font-bold tracking-tight">UConnect</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <a href={ORIGIN} className="transition-colors hover:text-white/70">
              Original site
            </a>
            <Link href="/" className="transition-colors hover:text-white/70">
              AiWebDesignFirm
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
