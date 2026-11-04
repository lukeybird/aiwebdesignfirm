import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AccountForm from '@/components/auth/AccountForm';
export const metadata = { title: 'Sign in' };
export default async function LoginPage() {
  if ((await auth())?.user?.id) redirect('/product');
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12 text-slate-100"><section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8">
    <a href="/" className="text-sm text-emerald-300">AI Web Design Firm</a><h1 className="mt-6 text-3xl font-bold">Your account</h1><p className="mt-3 text-slate-400">Sign in or create an account to open your workspace.</p>
    <AccountForm callbackUrl="/product" initialMode="signin" />
  </section></main>;
}
