import { sql } from '@/lib/db';
import { ensureSiteUserTables } from '@/lib/site-users';

export const billingOrigin = 'https://aiwebdesignfirm.com';
export async function stripeRequest<T>(path: string, fields?: Record<string, string>, idempotencyKey?: string): Promise<T> {
  const response = await fetch('https://api.stripe.com/v1/' + path, {
    method: fields ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    body: fields ? new URLSearchParams(fields) : undefined, cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(response.status === 403 ? 'Billing permissions are not configured for this action.' : 'Stripe could not complete this request. Please try again.');
    console.error('Billing API error', { status: response.status, code: body.error?.code, type: body.error?.type });
    throw error;
  }
  return response.json();
}
export type PaymentMethod = { id: string; type: string; card?: { brand: string; last4: string; exp_month: number; exp_year: number } };
export type BillingSubscription = {
  id: string; customer: string; status: string; trial_end: number | null; cancel_at_period_end: boolean;
  default_payment_method: string | PaymentMethod | null; schedule: string | null; pending_update: unknown;
  items: { data: { id: string; price: { id: string; unit_amount: number | null; currency: string; recurring: { interval: string } }; current_period_end?: number }[] };
  current_period_end?: number;
};
export async function billingSubscriptions(customer: string) {
  const result = await stripeRequest<{ data: BillingSubscription[] }>('subscriptions?' + new URLSearchParams({ customer, status: 'all', limit: '100', 'expand[]': 'data.default_payment_method' }));
  return result.data;
}
export function currentSubscription(records: BillingSubscription[]) {
  return records.find(entry => ['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete'].includes(entry.status));
}
export function configuredPlan(price: string) {
  return price === process.env.STRIPE_DIY_PRICE_ID ? 'Build It Yourself' : price === process.env.STRIPE_EXPERT_PRICE_ID ? 'Dedicated AI Specialist' : null;
}
export async function customerForUser(userId: string) {
  await ensureSiteUserTables();
  await sql`ALTER TABLE site_users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`;
  const rows = await sql`SELECT stripe_customer_id FROM site_users WHERE id = ${userId}`;
  return rows[0]?.stripe_customer_id as string | undefined;
}
