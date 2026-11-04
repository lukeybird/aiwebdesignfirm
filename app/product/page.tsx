import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { GET } from '@/app/api/billing/route';
import WorkspaceNav from '@/components/auth/WorkspaceNav';

export const metadata = { title: 'Workspace', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function ProductPage() {
  const user = (await auth())?.user;
  if (!user?.id) redirect('/login');
  const response = await GET();
  const billing = response.ok ? await response.json() : null;
  return <main className="brand-shell">
    <WorkspaceNav />
    <div className="brand-container py-12 sm:py-16">
      <p className="brand-eyebrow">Your workspace</p>
      <h1 className="brand-title mt-4">Welcome, {user.displayName || user.name || 'there'}.</h1>
      <p className="mt-3 max-w-2xl text-[#9AAAC0]">Your account, projects, and subscription in one place.</p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <section className="brand-card p-6 sm:p-7"><h2 className="text-sm text-[#9AAAC0]">Subscription</h2><p className="mt-3 text-xl font-semibold">{billing?.plan || 'No active plan'}</p><p className="mt-2 text-sm capitalize text-[#66E3FF]">{billing?.status || (billing ? 'Choose a plan to start' : 'Status temporarily unavailable')}</p><Link href="/settings" className="mt-6 inline-flex text-sm font-medium text-[#66E3FF] hover:underline">Manage subscription</Link></section>
        <section className="brand-card p-6 sm:p-7"><h2 className="text-sm text-[#9AAAC0]">Projects</h2><p className="mt-3 text-xl font-semibold">No projects yet</p><p className="mt-2 text-sm text-[#9AAAC0]">Your future builds will appear here.</p></section>
        <section className="brand-card p-6 sm:p-7"><h2 className="text-sm text-[#9AAAC0]">Account</h2><p className="mt-3 break-all text-sm">{user.email}</p><Link href="/settings" className="mt-6 inline-flex text-sm font-medium text-[#66E3FF] hover:underline">Settings & billing</Link></section>
      </div>
      <section className="brand-card mt-8 p-8 sm:p-12 text-center"><h2 className="text-xl font-semibold">A home for your next idea</h2><p className="mx-auto mt-3 max-w-lg text-[#9AAAC0]">The building tools are still being prepared. This dashboard is ready for your account and billing; product features will arrive here.</p>{!billing?.hasAccess && <Link href="/#plans" className="brand-button brand-button-primary mt-6">Explore plans</Link>}</section>
    </div>
  </main>;
}
