import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AccountForm from '@/components/auth/AccountForm';
export const metadata = { title: 'Sign in' };
export default async function LoginPage() {
  if ((await auth())?.user?.id) redirect('/product');
  return <main className="flex min-h-screen items-center justify-center bg-[#080D1B] px-5 py-12 text-[#F4F7FB]"><section className="w-full max-w-md rounded-2xl border border-[#293B55] bg-[#101A2D] p-8">
    <a href="/" className="text-sm text-[#66E3FF]">AI Web Design Firm</a><h1 className="mt-6 text-3xl font-bold">Your account</h1><p className="mt-3 text-[#9AAAC0]">Sign in or create an account to open your workspace.</p>
    <AccountForm callbackUrl="/product" initialMode="signin" />
  </section></main>;
}
