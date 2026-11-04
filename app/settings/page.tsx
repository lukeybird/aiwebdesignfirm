import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import WorkspaceNav from '@/components/auth/WorkspaceNav';
import BillingPanel from '@/app/account/BillingPanel';
export const metadata = { title: 'Settings & billing', robots: { index: false, follow: false } };
export default async function SettingsPage() {
  const user = (await auth())?.user;
  if (!user?.id) redirect('/login');
  return <main className="min-h-screen bg-[#080D1B] text-[#F4F7FB]"><WorkspaceNav /><div className="mx-auto max-w-3xl px-6 py-12">
    <h1 className="text-3xl font-semibold">Settings & billing</h1><p className="mt-3 mb-8 text-[#9AAAC0]">Manage your account and stay in control of your subscription.</p>
    <section className="mb-6 rounded-xl border border-[#223149] bg-[#101A2D] p-6"><h2 className="text-xl font-semibold">Account</h2><p className="mt-3">{user.displayName || user.name}</p><p className="mt-1 text-[#9AAAC0]">{user.email}</p></section>
    <BillingPanel />
    <p className="text-sm text-[#9AAAC0]">Manage billing opens Stripe’s secure portal, where you can update payment details, view invoices, change plans, or cancel. Cancel before your trial ends to avoid the first monthly charge.</p>
  </div></main>;
}
