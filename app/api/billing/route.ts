import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { ensureSiteUserTables } from '@/lib/site-users';

const origin = 'https://aiwebdesignfirm.com';

async function stripe<T>(path: string, fields?: Record<string, string>, idempotencyKey?: string): Promise<T> {
  const response = await fetch('https://api.stripe.com/v1/' + path, {
    method: fields ? 'POST' : 'GET',
    headers: {
      Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: fields ? new URLSearchParams(fields) : undefined,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Stripe request failed: ' + response.status);
  return response.json();
}

type Subscription = {
  status: string;
  trial_end: number | null;
  cancel_at_period_end: boolean;
  items: { data: { price: { id: string }; current_period_end?: number }[] };
};

async function subscriptions(customer: string) {
  const data = await stripe<{ data: Subscription[] }>(
    'subscriptions?' + new URLSearchParams({ customer, status: 'all', limit: '100' }),
  );
  return data.data;
}

async function billingCustomer(userId: string) {
  await ensureSiteUserTables();
  await sql`ALTER TABLE site_users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`;
  const result = await sql`SELECT stripe_customer_id FROM site_users WHERE id = ${userId}`;
  return result[0]?.stripe_customer_id as string | undefined;
}

export async function GET() {
  const user = (await auth())?.user;
  if (!user?.id) return NextResponse.json({}, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ available: false });
  try {
    const customer = await billingCustomer(user.id);
    const records = customer ? await subscriptions(customer) : [];
    const current = records.find((entry) => !['canceled', 'incomplete_expired'].includes(entry.status));
    const item = current?.items.data[0];
    const plan = item?.price.id === process.env.STRIPE_DIY_PRICE_ID ? 'Build It Yourself'
      : item?.price.id === process.env.STRIPE_EXPERT_PRICE_ID ? 'Dedicated AI Specialist' : null;
    return NextResponse.json({
      available: true, hasCustomer: Boolean(customer), trialEligible: records.length === 0, plan,
      status: current?.status ?? null,
      trialEnd: current?.trial_end ?? null,
      periodEnd: item?.current_period_end ?? null,
      cancelAtPeriodEnd: current?.cancel_at_period_end ?? false,
      hasAccess: Boolean(plan && current && ['active', 'trialing'].includes(current.status)),
    });
  } catch {
    return NextResponse.json({ error: 'Billing is temporarily unavailable.' }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const user = (await auth())?.user;
  if (!user?.id) return NextResponse.redirect(new URL('/account', origin), 303);
  if (request.headers.get('origin') !== origin) return new Response(null, { status: 403 });
  const action = (await request.formData()).get('action');
  const price = action === 'diy' ? process.env.STRIPE_DIY_PRICE_ID
    : action === 'expert' ? process.env.STRIPE_EXPERT_PRICE_ID : undefined;
  if (!process.env.STRIPE_SECRET_KEY || (!price && action !== 'portal')) {
    return NextResponse.redirect(new URL('/start?plan=' + (action === 'expert' ? 'expert' : 'diy') + '&billing=unavailable', origin), 303);
  }
  try {
    let customer = await billingCustomer(user.id);
    if (!customer && price) {
      const created = await stripe<{ id: string }>('customers', {
        'metadata[site_user_id]': user.id,
      }, 'site-customer-' + user.id);
      await sql`UPDATE site_users SET stripe_customer_id = COALESCE(stripe_customer_id, ${created.id}) WHERE id = ${user.id}`;
      customer = await billingCustomer(user.id);
    }
    if (!customer) return NextResponse.redirect(new URL('/account', origin), 303);
    const records = price ? await subscriptions(customer) : [];
    if (price && records.some((entry) => ['active', 'trialing'].includes(entry.status))) {
      return NextResponse.redirect(new URL('/product', origin), 303);
    }
    if (!price || records.some((entry) => !['canceled', 'incomplete_expired'].includes(entry.status))) {
      const portal = await stripe<{ url: string }>('billing_portal/sessions', {
        customer, return_url: origin + '/settings',
      });
      return NextResponse.redirect(portal.url, 303);
    }
    const checkout = await stripe<{ url: string }>('checkout/sessions', {
      customer, mode: 'subscription', payment_method_collection: 'always',
      'line_items[0][price]': price, 'line_items[0][quantity]': '1',
      ...(records.length === 0 ? { 'subscription_data[trial_period_days]': '7' } : {}),
      success_url: origin + '/product', cancel_url: origin + '/start?plan=' + action + '&canceled=1',
    }, 'site-checkout-product-v2-' + customer + '-' + price + '-' + Math.floor(Date.now() / 1800000));
    return NextResponse.redirect(checkout.url, 303);
  } catch {
    return NextResponse.redirect(new URL('/start?plan=' + (action === 'expert' ? 'expert' : 'diy') + '&billing=unavailable', origin), 303);
  }
}
