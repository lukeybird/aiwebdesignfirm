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
    <section className="mb-8 rounded-xl border border-white/20 p-5" aria-labelledby="billing-title">
      <h2 id="billing-title" className="text-xl font-semibold">Subscription and billing</h2>
      {failed || billing?.available === false || query.get('billing') === 'unavailable'
        ? <p>Billing is temporarily unavailable.</p>
        : !billing ? <p>Loading subscription…</p>
        : (
          <form action="/api/billing" method="post" className="mt-3 space-y-3">
            {billing.plan && <p>{billing.plan} · {billing.status}</p>}
            {date && <p>{billing.status === 'trialing' ? 'Trial ends' : 'Current period ends'} {new Date(date * 1000).toLocaleDateString()}.</p>}
            {billing.hasCustomer && <button name="action" value="portal" className="block underline">Manage Billing</button>}
            {!billing.status && billing.trialEligible && (
              <>
                <p>Seven days free, then {expert ? '$999' : '$99.99'} per month unless canceled before your trial ends. Card required.</p>
                <button name="action" value={expert ? 'expert' : 'diy'} className="rounded bg-emerald-200 px-4 py-2 font-bold text-slate-950">Start 7-Day Trial</button>
              </>
            )}
          </form>
        )}
    </section>
  );
}
