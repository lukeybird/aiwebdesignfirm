import { auth } from '@/auth';
import { GET as getBilling } from '@/app/api/billing/route';
import Brand from '@/components/auth/Brand';
import AccountForm from '@/components/auth/AccountForm';
import CheckoutRedirect from './CheckoutRedirect';

export const metadata = { title: 'Start your trial' };

export default async function StartPage({ searchParams }: {
  searchParams: Promise<{ plan?: string; billing?: string; canceled?: string }>;
}) {
  const query = await searchParams;
  const plan = query.plan === 'expert' ? 'expert' : 'diy';
  const user = (await auth())?.user;
  const billing = user?.id ? await (await getBilling()).json() : null;
  const eligible = billing?.trialEligible !== false;
  const interrupted = query.billing === 'unavailable' || query.canceled === '1';
  return (
    <main className="brand-shell brand-auth">
      <section className="brand-card brand-auth-card">
        <Brand />
        <p className="mt-8 text-[11px] font-medium uppercase tracking-wider text-[#9AAAC0]">Account → Card details → Your workspace</p>
        <h1 className="brand-title mt-5">{user ? eligible ? 'Set up your free trial' : 'Restart your subscription' : 'Create your account'}</h1>
        <p className="mt-4 text-sm leading-6 text-[#AAB9CD]">{plan === 'expert' ? 'Dedicated AI Specialist' : 'Build It Yourself'} · {eligible ? '7 days free, then ' : ''}{plan === 'expert' ? '$999' : '$99.99'}/month. Card required. {eligible ? 'Cancel before the trial ends to avoid being charged.' : 'Payment is due when you subscribe. No additional free trial is included.'}</p>
        {user ? <CheckoutRedirect plan={plan} interrupted={interrupted} failed={query.billing === 'unavailable'} /> : (
          <AccountForm callbackUrl={'/start?plan=' + plan} />
        )}
      </section>
    </main>
  );
}
