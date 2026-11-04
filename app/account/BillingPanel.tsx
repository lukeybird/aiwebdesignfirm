'use client';

import { useEffect, useState } from 'react';

type Billing = {
  available: boolean;
  hasCustomer: boolean;
  trialEligible: boolean;
  plan: string | null;
  status: string | null;
  trialEnd: number | null;
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
};

export default function BillingPanel() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/billing', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Billing unavailable');
        setBilling(await response.json());
      })
      .catch(() => setFailed(true));
  }, []);

  const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const expert = query.get('plan') === 'expert';
  const date = billing?.status === 'trialing' ? billing.trialEnd : billing?.periodEnd;

  return (
    <section className="brand-card mb-6 p-6 sm:p-8" aria-labelledby="billing-title">
      <h2 id="billing-title" className="text-lg font-semibold tracking-tight">Subscription and billing</h2>
      {failed || billing?.available === false || query.get('billing') === 'unavailable'
        ? <p>Billing is temporarily unavailable.</p>
        : !billing ? <p>Loading subscription…</p>
        : (
          <form action="/api/billing" method="post" className="mt-5 space-y-4 text-sm text-[#C7D2E2]">
            {billing.plan && <p>{billing.plan} · {billing.status}</p>}
            {date && <p>{billing.status === 'trialing' ? 'Trial ends' : 'Current period ends'} {new Date(date * 1000).toLocaleDateString()}.</p>}
            {billing.plan && ['active', 'trialing'].includes(billing.status || '') && <a href="/product" className="inline-block text-[#66E3FF] hover:underline">Open workspace</a>}
            {billing.cancelAtPeriodEnd && <p className="text-[#FF6B7A]">Cancellation scheduled. Your subscription will end at the end of the current trial or billing period.</p>}
            {billing.hasCustomer && <button name="action" value="portal" className="brand-button brand-button-secondary block">Manage billing or cancel subscription</button>}
            {!billing.status && billing.trialEligible && (
              <>
                <p>Seven days free, then {expert ? '$999' : '$99.99'} per month unless canceled before your trial ends. Card required.</p>
                <button name="action" value={expert ? 'expert' : 'diy'} className="brand-button brand-button-primary">Start 7-Day Trial</button>
              </>
            )}
          </form>
        )}
    </section>
  );
}
