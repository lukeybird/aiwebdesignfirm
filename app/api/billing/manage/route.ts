import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { billingOrigin, billingSubscriptions, configuredPlan, currentSubscription, customerForUser, stripeRequest, type PaymentMethod } from '@/lib/stripe-billing';

type Customer = { id: string; name: string | null; email: string | null; address: Record<string, string> | null; invoice_settings: { default_payment_method: PaymentMethod | string | null } };
type Invoice = { id: string; number: string | null; created: number; status: string; currency: string; total: number; amount_due: number; amount_remaining: number; invoice_pdf: string | null };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(request: Request) {
  const user = (await auth())?.user;
  if (!user?.id) return json({ error: 'Sign in required.' }, 401);
  try {
    const cursor = new URL(request.url).searchParams.get('after');
    if (cursor && !/^in_[A-Za-z0-9]+$/.test(cursor)) return json({ error: 'Invalid invoice cursor.' }, 400);
    const customer = await customerForUser(user.id);
    if (!customer) return json({ customer: null, subscription: null, invoices: [] });
    const [profile, records, invoices] = await Promise.all([
      stripeRequest<Customer>('customers/' + customer + '?expand[]=invoice_settings.default_payment_method'),
      billingSubscriptions(customer),
      stripeRequest<{ data: Invoice[]; has_more: boolean }>('invoices?' + new URLSearchParams({ customer, limit: '20', ...(cursor ? { starting_after: cursor } : {}) })),
    ]);
    const subscription = currentSubscription(records);
    const item = subscription?.items.data[0];
    const pm = subscription?.default_payment_method || profile.invoice_settings.default_payment_method;
    return json({
      customer: { name: profile.name || '', email: profile.email || '', address: profile.address || {} },
      paymentMethod: typeof pm === 'object' && pm?.card ? pm.card : null,
      subscription: subscription && { status: subscription.status, plan: configuredPlan(item?.price.id || ''), priceId: item?.price.id, amount: item?.price.unit_amount, currency: item?.price.currency, interval: item?.price.recurring?.interval, trialEnd: subscription.trial_end, periodEnd: item?.current_period_end || subscription.current_period_end, cancelAtPeriodEnd: subscription.cancel_at_period_end, canChange: ['active', 'trialing'].includes(subscription.status) && !subscription.schedule && !subscription.pending_update && subscription.items.data.length === 1 },
      invoices: invoices.data.map(({ id, number, created, status, currency, total, amount_remaining, invoice_pdf }) => ({ id, number, created, status, currency, total, amountRemaining: amount_remaining, downloadable: Boolean(invoice_pdf) })),
      hasMoreInvoices: invoices.has_more,
      nextInvoiceCursor: invoices.data.at(-1)?.id || null,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_live_51UXpU831APlLj3agr9cHn6C8nreicizG3TtBjhRAKdwIm8ysxNZ1aI2eH3FlFVJY9M22cTi27EwSvGjLA64aTjgZ00isV4ROvK',
    });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Billing unavailable.' }, 502); }
}

export async function POST(request: Request) {
  const user = (await auth())?.user;
  if (!user?.id) return json({ error: 'Sign in required.' }, 401);
  if (request.headers.get('origin') !== billingOrigin) return json({ error: 'Invalid request origin.' }, 403);
  try {
    const input = await request.json();
    const customer = await customerForUser(user.id);
    if (!customer) return json({ error: 'Start a plan before managing billing.' }, 400);
    const records = await billingSubscriptions(customer);
    const current = currentSubscription(records);
    // Customer and subscription IDs are always resolved from the signed-in user, never from the browser.
    if (input.action === 'cancel' || input.action === 'keep') {
      if (!current || !['active', 'trialing', 'past_due', 'unpaid'].includes(current.status)) return json({ error: 'No manageable subscription found.' }, 400);
      if (input.action === 'cancel' && current.schedule) return json({ error: 'This subscription has a custom schedule. Contact support to change it.' }, 400);
      await stripeRequest('subscriptions/' + current.id, { cancel_at_period_end: String(input.action === 'cancel') });
      return json({ ok: true, message: input.action === 'cancel' ? 'Cancellation scheduled. No further renewal will be charged after your current trial or billing period.' : 'Your subscription will continue. The scheduled cancellation has been removed.' });
    }
    if (input.action === 'change_plan') {
      const price = input.plan === 'diy' ? process.env.STRIPE_DIY_PRICE_ID : input.plan === 'expert' ? process.env.STRIPE_EXPERT_PRICE_ID : undefined;
      if (!price || !current || !['active', 'trialing'].includes(current.status) || current.cancel_at_period_end || current.schedule || current.pending_update || current.items.data.length !== 1) return json({ error: 'This subscription cannot change plans right now.' }, 400);
      if (current.items.data[0].price.id === price) return json({ ok: true, message: 'You are already on this plan.' });
      // Preserve trial dates and renewal dates. No immediate charge or proration.
      await stripeRequest('subscriptions/' + current.id, { 'items[0][id]': current.items.data[0].id, 'items[0][price]': price, proration_behavior: 'none', billing_cycle_anchor: 'unchanged', payment_behavior: 'error_if_incomplete' });
      return json({ ok: true, message: 'Plan updated. Your trial and renewal dates are unchanged. The new monthly price applies to your next renewal; no charge was made today.' });
    }
    if (input.action === 'billing_info') {
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      const email = typeof input.email === 'string' ? input.email.trim() : '';
      if (!name || name.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'Enter a valid billing name and email.' }, 400);
      const fields: Record<string, string> = { name, email };
      for (const key of ['line1', 'line2', 'city', 'state', 'postal_code', 'country']) {
        const value = typeof input.address?.[key] === 'string' ? input.address[key].trim() : '';
        if (value.length > 200 || (key === 'country' && value && !/^[A-Z]{2}$/.test(value))) return json({ error: 'Check the billing address. Country must be a two-letter code such as US.' }, 400);
        fields['address[' + key + ']'] = value;
      }
      await stripeRequest('customers/' + customer, fields);
      return json({ ok: true, message: 'Billing information saved. Your sign-in email has not changed.' });
    }
    if (input.action === 'setup_card') {
      const setup = await stripeRequest<{ id: string; client_secret: string }>('setup_intents', { customer, usage: 'off_session', 'payment_method_types[0]': 'card', 'metadata[site_user_id]': user.id });
      return json({ clientSecret: setup.client_secret });
    }
    if (input.action === 'save_card') {
      if (typeof input.setupIntent !== 'string' || !/^seti_[A-Za-z0-9]+$/.test(input.setupIntent)) return json({ error: 'Invalid card setup.' }, 400);
      const setup = await stripeRequest<{ customer: string; status: string; payment_method: string; metadata: Record<string, string> }>('setup_intents/' + input.setupIntent);
      if (setup.customer !== customer || setup.status !== 'succeeded' || setup.metadata.site_user_id !== user.id || !setup.payment_method) return json({ error: 'Card setup has not completed for this account.' }, 400);
      await stripeRequest('customers/' + customer, { 'invoice_settings[default_payment_method]': setup.payment_method });
      for (const subscription of records.filter(entry => !['canceled', 'incomplete_expired'].includes(entry.status))) {
        await stripeRequest('subscriptions/' + subscription.id, { default_payment_method: setup.payment_method });
      }
      return json({ ok: true, message: 'Card saved as your default for future subscription payments.' });
    }
    return json({ error: 'Unknown billing action.' }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Could not update billing.' }, 502); }
}
