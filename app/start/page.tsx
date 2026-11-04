import { auth } from '@/auth';
import AccountForm from '@/components/auth/AccountForm';
import CheckoutRedirect from './CheckoutRedirect';

export const metadata = { title: 'Start your trial' };

export default async function StartPage({ searchParams }: {
  searchParams: Promise<{ plan?: string; billing?: string; canceled?: string }>;
}) {
  const query = await searchParams;
  const plan = query.plan === 'expert' ? 'expert' : 'diy';
  const user = (await auth())?.user;
  const interrupted = query.billing === 'unavailable' || query.canceled === '1';
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080D1B] px-5 text-[#F4F7FB]">
      <section className="w-full max-w-md rounded-2xl border border-[#293B55] bg-[#101A2D] p-8">
        <a href="/" className="text-sm text-[#66E3FF]">AI Web Design Firm</a>
        <p className="mt-8 text-sm text-[#9AAAC0]">Account → Card details → Your workspace</p>
        <h1 className="mt-3 text-3xl font-bold">{user ? 'Set up your free trial' : 'Create your account'}</h1>
        <p className="mt-4 text-[#C7D2E2]">{plan === 'expert' ? 'Dedicated AI Specialist' : 'Build It Yourself'} · 7 days free, then {plan === 'expert' ? '$999' : '$99.99'}/month. Card required. Cancel in your account before the trial ends to avoid being charged.</p>
        {user ? <CheckoutRedirect plan={plan} interrupted={interrupted} failed={query.billing === 'unavailable'} /> : (
          <AccountForm callbackUrl={'/start?plan=' + plan} />
        )}
      </section>
    </main>
  );
}
