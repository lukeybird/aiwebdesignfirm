import { auth, signIn } from '@/auth';
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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8">
        <a href="/" className="text-sm text-emerald-300">AI Web Design Firm</a>
        <p className="mt-8 text-sm text-slate-400">Account → Card details → Your workspace</p>
        <h1 className="mt-3 text-3xl font-bold">{user ? 'Set up your free trial' : 'Create your account'}</h1>
        <p className="mt-4 text-slate-300">{plan === 'expert' ? 'Dedicated AI Specialist' : 'Build It Yourself'} · 7 days free, then {plan === 'expert' ? '$999' : '$99.99'}/month. Card required. Cancel in your account before the trial ends to avoid being charged.</p>
        {user ? <CheckoutRedirect plan={plan} interrupted={interrupted} failed={query.billing === 'unavailable'} /> : (
          <form className="mt-6" action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/start?plan=' + plan });
          }}>
            <p className="mb-4 text-sm text-slate-400">Continue with Google to create an account or sign in. Next, enter your card securely with Stripe.</p>
            <button className="w-full rounded-lg bg-emerald-300 px-5 py-3 font-semibold text-slate-950">Continue with Google</button>
          </form>
        )}
      </section>
    </main>
  );
}
