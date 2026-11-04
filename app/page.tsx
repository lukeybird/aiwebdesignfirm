import type { Metadata } from 'next';
import Brand from '@/components/auth/Brand';
export const metadata: Metadata = {
  title: 'AI Web Design Firm | Build your next website or app',
  description: 'Choose your approach to websites, apps, and automations. Start with a seven-day trial or talk through a full-team project.',
};
const plans = [
  { label: 'Self-serve', name: 'Build it yourself', price: '$99.99', description: 'For independent builders who want to shape their own ideas.', details: ['Describe your ideas in plain English', 'Self-serve AI building approach', 'No reports or managed intervention'], href: '/start?plan=diy', cta: 'Start 7-day trial' },
  { label: 'Recommended', name: 'A dedicated specialist', price: '$999', description: 'For businesses that want one point of contact for technical work.', details: ['One dedicated AI phone specialist', 'Help with updates and integrations', 'Technical troubleshooting within your plan'], href: '/start?plan=expert', cta: 'Start 7-day trial' },
  { label: 'Full engineering team', name: 'Your bigger vision', price: '$9,999', description: 'For ambitious projects that need a defined scope and a team.', details: ['Start with a project interview', 'Discuss scope with an AI coordinator', 'Engineering delivery for the agreed project'], href: '/book', cta: 'Start the interview' },
];
export default function Home() {
  return <main className="brand-shell">
    <div className="brand-container">
      <header className="brand-hero">
        <p className="brand-eyebrow">Websites · Apps · Automations</p>
        <h1 className="brand-hero-title mt-7">Bring the idea.<br /><span>Choose who builds it.</span></h1>
        <p className="brand-muted mt-7 max-w-xl text-base sm:text-lg">A website that brings in leads. An app that simplifies your work. An automation that gives you time back. Find the right approach for your next build.</p>
        <div className="mt-9 flex flex-wrap items-center gap-4"><a href="#plans" className="brand-button brand-button-primary">Find your plan <span aria-hidden="true">↗</span></a><span className="text-xs text-[#9AAAC0]">Two trial plans. One full-team option.</span></div>
      </header>
      <div className="grid gap-6 border-y border-white/10 py-7 sm:grid-cols-3">
        {['Choose how hands-on you want to be', 'Create your account', 'Start your trial or project interview'].map((text, i) => <div className="flex items-center gap-4" key={text}><span className="text-xs font-medium text-[#FF6B7A]">0{i + 1}</span><p className="text-sm text-[#C7D2E2]">{text}</p></div>)}
      </div>
      <section id="plans" className="brand-section scroll-mt-8" aria-labelledby="plan-title">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5"><div><p className="brand-eyebrow">A plan for your pace</p><h2 id="plan-title" className="brand-title mt-4">How hands-on do you want to be?</h2></div><p className="max-w-xs text-sm leading-6 text-[#9AAAC0]">Start small or bring a bigger brief. Choose the level of help that fits your business.</p></div>
        <div className="grid gap-5 lg:grid-cols-3">{plans.map((plan, i) => <article key={plan.name} className={'brand-card brand-price-card ' + (i === 1 ? 'brand-price-recommended' : '')}>
          <div className="mb-6"><span className={'brand-chip ' + (i === 1 ? 'brand-chip-coral' : '')}>{plan.label}</span></div>
          <h3 className="font-[family-name:var(--font-heading)] text-2xl font-medium tracking-tight">{plan.name}</h3><p className="mt-3 min-h-[48px] text-sm leading-6 text-[#9AAAC0]">{plan.description}</p>
          <p className="my-7 text-[36px] font-semibold tracking-tight">{plan.price}<span className="ml-2 text-xs font-normal tracking-normal text-[#9AAAC0]">/ month</span></p>
          <hr className="brand-rule mb-6" /><ul className="mb-8 space-y-4">{plan.details.map(detail => <li key={detail} className="flex gap-3 text-sm leading-6 text-[#C7D2E2]"><span aria-hidden="true" className="text-[#66E3FF]">✓</span>{detail}</li>)}</ul>
          <div className="mt-auto"><a className={'brand-button w-full ' + (i === 1 ? 'brand-button-primary' : 'brand-button-secondary')} href={plan.href}>{plan.cta}<span aria-hidden="true">↗</span></a><p className="mt-4 text-center text-[11px] leading-5 text-[#9AAAC0]">{i < 2 ? '7 days free. Card required. Cancel before billing.' : 'Interview first. Scope agreed before work begins.'}</p></div>
        </article>)}</div>
        <p className="mt-5 text-xs leading-6 text-[#9AAAC0]">Trial plans renew monthly at the listed price unless canceled. Account and billing are available now; the building tools are in development.</p>
      </section>
      <section className="brand-section border-t border-white/10" aria-labelledby="ideas-title"><div className="grid gap-8 md:grid-cols-2"><div><p className="brand-eyebrow">Make room for what’s next</p><h2 id="ideas-title" className="brand-title mt-4 max-w-sm">Less friction.<br />More possibility.</h2></div><div className="space-y-5 text-sm leading-7 text-[#9AAAC0]"><p>Your next project could be a customer portal, a booking experience, or a dashboard that brings your daily work into one place.</p><p>Start by choosing your level of support. Your workspace keeps your account and subscription together, with billing settings always within reach.</p><a href="#plans" className="inline-flex items-center gap-3 font-medium text-[#66E3FF]">Explore the plans <span aria-hidden="true">↗</span></a></div></div></section>
      <footer className="brand-footer"><Brand /><span>Websites. Apps. Possibilities.</span><a href="/settings" className="hover:text-[#66E3FF]">Account & billing</a></footer>
    </div>
  </main>;
}
