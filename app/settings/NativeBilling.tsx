'use client';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

type Card = { brand: string; last4: string; exp_month: number; exp_year: number };
type Subscription = { status: string; plan: string | null; priceId: string; amount: number | null; currency: string; interval: string; trialEnd: number | null; periodEnd: number | null; cancelAtPeriodEnd: boolean; canChange: boolean };
type Invoice = { id: string; number: string | null; created: number; status: string; currency: string; total: number; amountRemaining: number; downloadable: boolean };
type Billing = { customer: { name: string; email: string; address: Record<string, string> } | null; subscription: Subscription | null; paymentMethod: Card | null; invoices: Invoice[]; hasMoreInvoices?: boolean; nextInvoiceCursor?: string; publishableKey: string };
type Elements = { create(type: 'payment'): { mount(element: HTMLElement): void; destroy(): void } };
type StripeClient = { elements(options: unknown): Elements; confirmSetup(options: unknown): Promise<{ error?: { message?: string }; setupIntent?: { id: string; status: string } }> };
declare global { interface Window { Stripe?: (key: string) => StripeClient } }
const money = (amount: number | null, currency = 'usd') => amount === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
const date = (timestamp: number | null) => timestamp ? new Date(timestamp * 1000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
async function update(input: Record<string, unknown>) {
  const response = await fetch('/api/billing/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not update billing.');
  return result;
}

export default function NativeBilling() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<'cancel' | 'keep' | 'plan' | null>(null);
  const [plan, setPlan] = useState<'diy' | 'expert'>('diy');
  const [editingInfo, setEditingInfo] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [scriptReady, setScriptReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const stripe = useRef<StripeClient | null>(null);
  const elements = useRef<Elements | null>(null);
  const verifiedSetup = useRef<string | null>(null);
  const cardMount = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const response = await fetch('/api/billing/manage', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load billing.');
    setBilling(data);
  }, []);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const setupIntent = query.get('setup_intent');
    if (setupIntent) {
      window.history.replaceState(null, '', '/settings');
      setBusy(true);
      update({ action: 'save_card', setupIntent })
        .then(result => { setMessage(result.message); return load(); })
        .catch(error => setError(error.message))
        .finally(() => setBusy(false));
    } else load().catch(error => setError(error.message));
  }, [load]);
  useEffect(() => {
    if (!clientSecret || !scriptReady || !billing?.publishableKey || !cardMount.current || !window.Stripe) return;
    stripe.current = window.Stripe(billing.publishableKey);
    const instance = stripe.current.elements({ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#66E3FF', colorBackground: '#080D1B', colorText: '#F4F7FB', colorDanger: '#FF6B7A', borderRadius: '10px', fontFamily: 'Inter, system-ui, sans-serif' } } });
    elements.current = instance;
    const payment = instance.create('payment');
    payment.mount(cardMount.current);
    setCardReady(true);
    return () => { payment.destroy(); elements.current = null; setCardReady(false); };
  }, [clientSecret, scriptReady, billing?.publishableKey]);
  async function run(input: Record<string, unknown>) {
    setBusy(true); setError(''); setMessage('');
    try { const result = await update(input); setMessage(result.message || 'Saved.'); setConfirmation(null); setEditingInfo(false); await load(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function moreInvoices() {
    if (!billing?.nextInvoiceCursor) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/billing/manage?after=' + billing.nextInvoiceCursor, { cache: 'no-store' });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || 'Could not load invoices.');
      setBilling({ ...next, invoices: [...billing.invoices, ...next.invoices] });
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function openCard() {
    setBusy(true); setError(''); setMessage('');
    try { const result = await update({ action: 'setup_card' }); verifiedSetup.current = null; setClientSecret(result.clientSecret); }
    catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe.current || !elements.current) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (!verifiedSetup.current) {
      const result = await stripe.current.confirmSetup({ elements: elements.current, confirmParams: { return_url: window.location.origin + '/settings' }, redirect: 'if_required' });
      if (result.error) throw new Error(result.error.message || 'Card could not be saved.');
      if (!result.setupIntent || result.setupIntent.status !== 'succeeded') throw new Error('Card verification is incomplete. Please try again.');
      verifiedSetup.current = result.setupIntent.id;
      }
      const saved = await update({ action: 'save_card', setupIntent: verifiedSetup.current });
      setClientSecret(''); setMessage(saved.message); await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  const sub = billing?.subscription;
  const end = sub?.status === 'trialing' ? sub.trialEnd : sub?.periodEnd;
  return <div className="space-y-6">
    <Script src="https://js.stripe.com/v3/" strategy="afterInteractive" onReady={() => setScriptReady(true)} onError={() => setError('The secure card form could not load. Please refresh or check your connection.')} />
    {error && <div role="alert" className="rounded-xl border border-[#FF6B7A]/40 bg-[#FF6B7A]/5 p-4 text-sm text-[#FF9BA5]">{error}{!billing && <button className="ml-4 underline" onClick={() => { setError(''); load().catch(error => setError(error.message)); }}>Try again</button>}</div>}
    {message && <p role="status" className="rounded-xl border border-[#66E3FF]/30 p-4 text-sm text-[#66E3FF]">{message}</p>}
    {!billing && !error && <div className="brand-card p-8" role="status">Loading billing…</div>}
    {billing && <>
      <section className="brand-card p-6 sm:p-8" aria-labelledby="native-subscription"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="brand-eyebrow">Subscription</p><h2 id="native-subscription" className="mt-4 text-2xl font-semibold tracking-tight">{sub?.plan || 'No active plan'}</h2></div>{sub && <span className="brand-chip capitalize">{sub.cancelAtPeriodEnd ? 'Ending soon' : sub.status === 'trialing' ? 'Trial active' : sub.status.replaceAll('_', ' ')}</span>}</div>
        {sub ? <><p className="mt-5 text-2xl font-semibold">{money(sub.amount, sub.currency)} <span className="text-sm font-normal text-[#9AAAC0]">/ {sub.interval}</span></p><p className="brand-muted mt-2 text-sm">{sub.cancelAtPeriodEnd ? 'Access ends' : sub.status === 'trialing' ? 'Trial ends; first charge due' : 'Next renewal'} {date(end || null)}.</p>
        {sub.cancelAtPeriodEnd && <p className="mt-4 text-sm text-[#FF9BA5]">Your cancellation is scheduled. Your plan stays available until {date(end || null)}, then it will not renew.</p>}
        <div className="mt-6 flex flex-wrap gap-3">{['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status) && <button disabled={busy} className={'brand-button ' + (sub.cancelAtPeriodEnd ? 'brand-button-primary' : 'brand-button-secondary')} onClick={() => setConfirmation(sub.cancelAtPeriodEnd ? 'keep' : 'cancel')}>{sub.cancelAtPeriodEnd ? 'Keep subscription' : 'Cancel subscription'}</button>}{sub.canChange && !sub.cancelAtPeriodEnd && <button disabled={busy} className="brand-button brand-button-secondary" onClick={() => { setPlan(sub.plan === 'Build It Yourself' ? 'expert' : 'diy'); setConfirmation('plan'); }}>Change plan</button>}</div>
        </> : <><p className="brand-muted mt-4 text-sm">Choose a plan to get started. If you previously used a trial, signing up again does not grant another free trial.</p><a href="/#plans" className="brand-button brand-button-primary mt-6">View plans</a></>}
        {confirmation && <div className="mt-6 rounded-xl border border-white/15 bg-[#080D1B] p-5" role="region" aria-label="Confirm subscription change">
          <h3 className="text-lg font-semibold">{confirmation === 'cancel' ? 'Cancel at the end of this period?' : confirmation === 'keep' ? 'Keep your subscription?' : 'Choose your new plan'}</h3>
          {confirmation === 'plan' ? <><label className="mt-4 block text-sm">Plan<select value={plan} onChange={event => setPlan(event.target.value as 'diy' | 'expert')} className="brand-input"><option value="diy">Build It Yourself — $99.99/month</option><option value="expert">Dedicated AI Specialist — $999/month</option></select></label><p className="brand-muted mt-4 text-sm">Your plan changes now. No charge or credit today. Your trial and renewal dates stay the same; the selected monthly price applies at your next renewal on {date(end || null)}.</p></> : <p className="brand-muted mt-3 text-sm">{confirmation === 'cancel' ? `You keep access until ${date(end || null)}. Your subscription will not renew, and your account remains available.` : `Your plan will renew at ${money(sub?.amount ?? null, sub?.currency)} per month after ${date(end || null)} unless you cancel again.`}</p>}
          <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy} className="brand-button brand-button-primary" onClick={() => run(confirmation === 'plan' ? { action: 'change_plan', plan } : { action: confirmation })}>{busy ? 'Saving…' : confirmation === 'cancel' ? 'Confirm cancellation' : confirmation === 'keep' ? 'Confirm keep subscription' : 'Confirm plan change'}</button><button disabled={busy} className="brand-button brand-button-secondary" onClick={() => setConfirmation(null)}>Go back</button></div>
        </div>}
      </section>
      {billing.customer && <>
        <section className="brand-card p-6 sm:p-8" aria-labelledby="payment-method"><h2 id="payment-method" className="text-lg font-semibold">Payment method</h2>{billing.paymentMethod ? <p className="brand-muted mt-4 text-sm capitalize">{billing.paymentMethod.brand} ending in {billing.paymentMethod.last4} · Expires {billing.paymentMethod.exp_month}/{billing.paymentMethod.exp_year}</p> : <p className="brand-muted mt-4 text-sm">No default card is saved.</p>}
          {!clientSecret ? <button disabled={busy} onClick={openCard} className="brand-button brand-button-secondary mt-5">{busy ? 'Please wait…' : billing.paymentMethod ? 'Update card' : 'Add card'}</button> : <form onSubmit={saveCard} className="mt-5"><div ref={cardMount} /><p className="brand-muted mt-4 text-xs">Stripe securely collects your card. Saving it authorizes its use for future automatic subscription payments under your existing plan. Your card number never passes through our server.</p><div className="mt-5 flex flex-wrap gap-3"><button disabled={busy || !cardReady} className="brand-button brand-button-primary">{busy ? 'Saving securely…' : 'Save card for future payments'}</button><button type="button" disabled={busy} className="brand-button brand-button-secondary" onClick={() => setClientSecret('')}>Cancel card update</button></div></form>}
        </section>
        <section className="brand-card p-6 sm:p-8" aria-labelledby="billing-info"><div className="flex items-center justify-between gap-4"><h2 id="billing-info" className="text-lg font-semibold">Billing information</h2><button disabled={busy} className="brand-button brand-button-quiet" onClick={() => setEditingInfo(!editingInfo)}>{editingInfo ? 'Close' : 'Edit'}</button></div>
          {editingInfo ? <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const address = Object.fromEntries(['line1', 'line2', 'city', 'state', 'postal_code', 'country'].map(key => [key, data.get(key)])); run({ action: 'billing_info', name: data.get('name'), email: data.get('email'), address }); }}>
            <label className="text-sm">Billing name<input className="brand-input" name="name" required maxLength={200} defaultValue={billing.customer.name} autoComplete="billing name" /></label><label className="text-sm">Billing email<input className="brand-input" type="email" name="email" required maxLength={254} defaultValue={billing.customer.email} autoComplete="billing email" /></label>
            {([['line1', 'Address'], ['line2', 'Apartment / suite'], ['city', 'City'], ['state', 'State / region'], ['postal_code', 'Postal code'], ['country', 'Country code (e.g. US)']] as const).map(([key, label]) => <label key={key} className="text-sm">{label}<input className="brand-input" name={key} defaultValue={billing.customer?.address[key] || ''} maxLength={key === 'country' ? 2 : 200} /></label>)}
            <p className="text-xs text-[#9AAAC0] sm:col-span-2">This updates billing details only, not your login email. Country uses a two-letter uppercase code.</p><button disabled={busy} className="brand-button brand-button-primary justify-self-start">{busy ? 'Saving…' : 'Save billing information'}</button>
          </form> : <div className="brand-muted mt-4 text-sm"><p>{billing.customer.name || 'No billing name'}</p><p>{billing.customer.email || 'No billing email'}</p><p className="mt-2">{Object.values(billing.customer.address).filter(Boolean).join(', ')}</p></div>}
        </section>
      </>}
      <section className="brand-card overflow-hidden" aria-labelledby="invoice-history"><div className="p-6 sm:p-8"><h2 id="invoice-history" className="text-lg font-semibold">Invoice history</h2><p className="brand-muted mt-2 text-sm">Your subscription invoices and receipts.</p></div>{billing.invoices.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-white/10 text-xs text-[#9AAAC0]"><tr>{['Date', 'Invoice', 'Amount', 'Status', 'Receipt'].map(label => <th key={label} className="px-6 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{billing.invoices.map(invoice => <tr key={invoice.id} className="border-b border-white/5"><td className="whitespace-nowrap px-6 py-4">{date(invoice.created)}</td><td className="px-6 py-4">{invoice.number || 'Invoice'}</td><td className="px-6 py-4">{money(invoice.total, invoice.currency)}</td><td className="px-6 py-4 capitalize">{invoice.status}{invoice.amountRemaining > 0 && <span className="block text-xs text-[#FF9BA5]">{money(invoice.amountRemaining, invoice.currency)} outstanding</span>}</td><td className="px-6 py-4">{invoice.downloadable ? <a className="text-[#66E3FF] underline" href={'/api/billing/invoice?id=' + invoice.id}>Download PDF</a> : 'Not available'}</td></tr>)}</tbody></table></div> : <p className="px-6 pb-8 text-sm text-[#9AAAC0] sm:px-8">No invoices yet.</p>}{billing.hasMoreInvoices && <div className="p-6"><button disabled={busy} onClick={moreInvoices} className="brand-button brand-button-secondary">{busy ? 'Loading…' : 'Load older invoices'}</button></div>}</section>
    </>}
  </div>;
}
