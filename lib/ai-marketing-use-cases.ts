/**
 * Long-form marketing use cases; titles power the hero marquee (shuffled per row client-side).
 */
export type MarketingAiUseCase = {
  title: string;
  description: string;
  benefit: string;
};

export const AI_MARKETING_USE_CASES: readonly MarketingAiUseCase[] = [
  {
    title: 'Lead Capture & Conversion (AI Chatbots)',
    description:
      'AI can instantly respond to website visitors, answer questions, qualify leads, and book appointments 24/7.',
    benefit: 'More conversions without hiring more staff.',
  },
  {
    title: 'Search Visibility & SEO Domination',
    description:
      'AI-generated content, FAQs, and structured data help businesses rank on Google and get surfaced in tools like ChatGPT.',
    benefit: 'More visibility = more inbound customers.',
  },
  {
    title: 'Automated Follow-Ups & Nurturing',
    description:
      'AI can text, email, and follow up with leads automatically over days or weeks.',
    benefit: 'Most businesses lose money here—AI fixes that.',
  },
  {
    title: 'Sales Assistance & Closing',
    description:
      'AI can handle objections, suggest responses, and support closing via chat or voice.',
    benefit: 'Like giving every business a trained sales assistant.',
  },
  {
    title: 'Content Creation at Scale',
    description:
      'AI can generate ads, blogs, social posts, and video scripts—what used to take days.',
    benefit: 'What took days now takes minutes.',
  },
  {
    title: 'Customer Support Automation',
    description:
      'AI replaces or assists support teams by answering common questions instantly.',
    benefit: 'Faster support and lower costs.',
  },
  {
    title: 'Reputation Management',
    description:
      'AI can request reviews, respond to reviews, and monitor brand mentions.',
    benefit: 'Stronger trust and a stronger online presence.',
  },
  {
    title: 'Data Analysis & Decision Making',
    description:
      'AI can analyze customer behavior, ad performance, and sales trends.',
    benefit: 'Smarter, faster decisions without a data team.',
  },
  {
    title: 'Workflow & Task Automation',
    description:
      'AI connects tools and automates repetitive work: CRM updates, appointment reminders, internal handoffs.',
    benefit: 'Massive time saved and fewer errors.',
  },
  {
    title: 'Hyper-Personalized Marketing',
    description:
      'AI tailors messages, ads, and offers to each individual user.',
    benefit: 'Higher engagement and conversion rates.',
  },
  {
    title: 'Voice & Phone AI',
    description:
      'AI can answer calls after hours, capture leads, book appointments, and escalate urgent issues.',
    benefit: 'You stop missing calls that would have become revenue.',
  },
  {
    title: 'Competitive & Market Intelligence',
    description:
      'AI can track competitor pricing, promos, and positioning—and summarize what changed.',
    benefit: 'React faster instead of guessing.',
  },
  {
    title: 'Local Search & Maps Presence',
    description:
      'AI can strengthen Google Business Profile copy, Q&A, posts, and local landing pages.',
    benefit: 'Win more “near me” and map-pack traffic.',
  },
  {
    title: 'Email Marketing & Lifecycle Sequences',
    description:
      'AI can segment audiences, write sequences, and test subject lines and body copy.',
    benefit: 'More revenue from the list you already have.',
  },
  {
    title: 'Staff Onboarding & Internal Q&A',
    description:
      'AI can onboard new hires with role-specific answers, checklists, and policy explanations.',
    benefit: 'People get productive sooner with fewer repeat questions.',
  },
  {
    title: 'Invoicing, Reminders & Collections',
    description:
      'AI can send polite payment reminders and summarize who owes what.',
    benefit: 'Cash comes in faster with less awkward chasing.',
  },
  {
    title: 'Multilingual Customer Experience',
    description:
      'AI can chat, email, and support customers in many languages from one knowledge base.',
    benefit: 'Serve more customers without a full multilingual team.',
  },
  {
    title: 'Video & Multimedia Production',
    description:
      'AI can draft scripts, hooks, storyboards, captions, and cut-downs for ads and social.',
    benefit: 'More creative output without burning out your team.',
  },
  {
    title: 'Compliance & Documentation',
    description:
      'AI can draft standardized disclosures, log interactions, and keep templates consistent.',
    benefit: 'Less friction on repeatable paperwork and handoffs.',
  },
  {
    title: 'Offer & Messaging Tests',
    description:
      'AI can generate angles, headlines, and survey questions—and summarize what resonated.',
    benefit: 'Learn what to sell and how to say it, faster.',
  },

  // Voice calls — deeper coverage
  {
    title: 'AI Answers Every Call 24/7',
    description:
      'AI voice agents pick up on the first ring, sound natural, and never put customers on endless hold.',
    benefit: 'Every ring becomes a chance to book, sell, or help—not voicemail dead air.',
  },
  {
    title: 'AI Outbound Calls & Reminders',
    description:
      'AI can place confirmation calls, appointment reminders, and polite follow-ups at scale.',
    benefit: 'Fewer no-shows and warmer leads without a dialer team.',
  },
  {
    title: 'AI Call Notes & CRM Updates',
    description:
      'AI transcribes calls, pulls action items, and updates your CRM so nothing falls through the cracks.',
    benefit: 'Reps sell and serve instead of typing notes.',
  },
  {
    title: 'AI Smart Call Routing',
    description:
      'AI figures out who is calling and why, then routes or deflects routine questions automatically.',
    benefit: 'Experts only handle calls that actually need a human.',
  },
  {
    title: 'AI Callbacks When Lines Are Busy',
    description:
      'AI offers instant callbacks, holds a place in line, and texts confirmations so callers feel respected.',
    benefit: 'You stop losing impatient callers to competitors.',
  },
  {
    title: 'AI Voice Booking & Payments',
    description:
      'AI can complete bookings, take deposits, and read balances over the phone with clear compliance.',
    benefit: 'Revenue closes on the call—not “we’ll call you back.”',
  },

  // Chatbots — deeper coverage
  {
    title: 'AI Chatbots on SMS & Social',
    description:
      'AI chatbots meet customers where they already text—Instagram, Facebook, SMS—with one brain behind them.',
    benefit: 'Conversations start faster than “visit our website.”',
  },
  {
    title: 'AI Chatbots That Pre-Qualify Leads',
    description:
      'AI asks budget, timeline, and fit before your team ever picks up the phone.',
    benefit: 'Sales only talks to people who are ready.',
  },
  {
    title: 'AI Chatbots Trained on Your Business',
    description:
      'AI learns your services, pricing rules, and tone so answers match how you actually operate.',
    benefit: 'No generic bot that sounds like every other site.',
  },
  {
    title: 'AI Chat-to-Human Handoff',
    description:
      'AI handles the routine, then passes full context to a person when empathy or authority matters.',
    benefit: 'Customers never repeat themselves from scratch.',
  },
  {
    title: 'AI Shopping & Quote Chatbots',
    description:
      'AI guides product picks, builds quotes, and recovers abandoned carts inside chat.',
    benefit: 'More completed orders from the same traffic.',
  },

  // Efficiencies — time, cost, throughput
  {
    title: 'AI Slashes Admin & Busywork',
    description:
      'AI drafts emails, fills forms, schedules, and chases status updates that used to eat your day.',
    benefit: 'Hours back every week for owners and frontline staff.',
  },
  {
    title: 'AI Faster Replies Same Quality',
    description:
      'AI keeps tone and accuracy while cutting response time from hours to seconds.',
    benefit: 'Speed without sounding robotic or careless.',
  },
  {
    title: 'AI Fewer Mistakes Less Rework',
    description:
      'AI double-checks numbers, names, and policy rules before customers ever see them.',
    benefit: 'Less firefighting, fewer refunds, fewer angry tickets.',
  },
  {
    title: 'AI More Output Per Person',
    description:
      'AI multiplies what each employee can handle—without burning them out on overtime.',
    benefit: 'Grow revenue before you grow payroll.',
  },
  {
    title: 'AI Lower Cost Per Conversation',
    description:
      'AI handles volume spikes so you don’t hire temps or lose leads during busy seasons.',
    benefit: 'Margins hold up when demand spikes.',
  },
  {
    title: 'AI Instant First Touch Everywhere',
    description:
      'AI greets every chat, call, and form the moment it arrives—no “we’ll get back to you Monday.”',
    benefit: 'Speed-to-lead beats competitors who move slow.',
  },
];

/** Labels shown in the scrolling backdrop (same as titles). */
export const AI_MARKETING_MARQUEE_LABELS: readonly string[] = AI_MARKETING_USE_CASES.map(
  (c) => c.title,
);
