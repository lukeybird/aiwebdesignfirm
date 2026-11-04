import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Web Design Firm | Build your next website or app',
  description: 'Build with AI, call a dedicated specialist, or bring in our engineering team.',
};

const plans = [
  { name: 'Build It Yourself', price: '$99.99', description: 'Describe what you want in plain English and use AI to build and update it. Self-serve, with no reports.' },
  { name: 'Build With a Dedicated Specialist', price: '$999', description: 'Call one dedicated AI specialist for technical work within your plan, including site updates, integrations, and troubleshooting.' },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#080D1B] px-6 py-8 text-[#F4F7FB]">
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Main" className="flex items-center justify-between gap-4 border-b border-[#293B55] pb-5">
          <strong>AI Web Design Firm</strong>
          <a className="text-[#66E3FF] underline" href="#plans">Compare plans</a>
        </nav>
        <header className="relative py-20" style={{ background: 'radial-gradient(ellipse at 15% 30%, rgba(102,227,255,0.08), transparent 65%), radial-gradient(ellipse at 90% 25%, rgba(255,107,122,0.08), transparent 55%)' }}>
          <p className="font-semibold uppercase tracking-widest text-[#66E3FF]">Websites · Apps · Automations</p>
          <h1 className="my-5 max-w-4xl text-5xl font-bold tracking-tight sm:text-7xl">Bring the idea. Choose who builds it.</h1>
          <p className="mb-8 max-w-2xl text-lg text-[#C7D2E2]">Launch a website, connect your booking tools, or build a custom app. Start by describing what you want, call a dedicated AI specialist, or bring in our engineering team for the full build.</p>
          <a className="inline-block rounded-lg bg-[#66E3FF] transition hover:bg-[#A2EEFF] hover:shadow-[0_0_22px_rgba(102,227,255,0.20)] px-5 py-3 font-bold text-[#080D1B]" href="#plans">Get Started</a>
        </header>
        <section id="plans" className="scroll-mt-8" aria-labelledby="plan-title">
          <h2 id="plan-title" className="mb-6 text-3xl font-bold">How hands-on do you want to be?</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((plan, index) => (
              <article key={plan.name} className={index === 1 ? 'flex flex-col rounded-2xl border border-[#FF6B7A]/70 bg-[#101F32] p-6 shadow-[0_0_30px_rgba(255,107,122,0.08)]' : 'flex flex-col rounded-2xl border border-[#293B55] bg-[#101A2D] p-6'}>
                <p className={index === 1 ? "mb-2 text-sm font-semibold uppercase tracking-wide text-[#FF6B7A]" : "mb-2 text-sm font-semibold uppercase tracking-wide text-[#66E3FF]"}>{index === 1 ? 'Recommended' : 'Self-serve'}</p>
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="my-4 text-3xl font-bold">{plan.price} <span className="text-sm font-normal">/ month</span></p>
                <p className="mb-4 text-[#C7D2E2]">{plan.description}</p>
                <p className="mb-6 text-sm text-[#C7D2E2]">7-day trial, then {plan.price}/month.</p>
                <a className="mt-auto rounded-lg bg-[#66E3FF] transition hover:bg-[#A2EEFF] hover:shadow-[0_0_22px_rgba(102,227,255,0.20)] px-4 py-3 text-center font-bold text-[#080D1B]" href={index === 0 ? '/start?plan=diy' : '/start?plan=expert'}>Start 7-Day Trial</a>
              </article>
            ))}
            <article className="flex flex-col rounded-2xl border border-[#293B55] bg-[#101A2D] p-6">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#66E3FF]">Full engineering team</p>
              <h3 className="text-xl font-bold">Build With Our Engineering Team</h3>
              <p className="my-4 text-3xl font-bold">$9,999 <span className="text-sm font-normal">/ month</span></p>
              <p className="mb-6 text-[#C7D2E2]">Talk through your idea with an AI phone coordinator. Our engineering team scopes, designs, builds, tests, and launches the agreed project.</p>
              <a className="mt-auto rounded-lg bg-[#66E3FF] transition hover:bg-[#A2EEFF] hover:shadow-[0_0_22px_rgba(102,227,255,0.20)] px-4 py-3 text-center font-bold text-[#080D1B]" href="/book">Start the Interview Process</a>
            </article>
          </div>
        </section>
        <section className="py-16" aria-labelledby="examples">
          <h2 id="examples" className="mb-4 text-3xl font-bold">What do you want to build?</h2>
          <p className="max-w-2xl text-[#C7D2E2]">A website that turns visitors into leads. A portal where customers can book and manage appointments. A dashboard that brings your team’s daily work into one place.</p>
        </section>
        <footer className="border-t border-[#293B55] pt-6 text-[#C7D2E2]">AI Web Design Firm</footer>
      </div>
    </main>
  );
}
