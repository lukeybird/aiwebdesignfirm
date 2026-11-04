import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Brand from '@/components/auth/Brand';
import AccountForm from '@/components/auth/AccountForm';
export const metadata = { title: 'Sign in' };
export default async function LoginPage() {
  if ((await auth())?.user?.id) redirect('/product');
  return <main className="brand-shell brand-auth"><section className="brand-card brand-auth-card">
    <Brand /><h1 className="brand-title mt-8">Your account</h1><p className="mt-3 text-[#9AAAC0]">Sign in or create an account to open your workspace.</p>
    <AccountForm callbackUrl="/product" initialMode="signin" />
  </section></main>;
}
