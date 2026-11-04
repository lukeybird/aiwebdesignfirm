import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { GET } from '@/app/api/billing/route';

export const metadata = { title: 'Workspace', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ProductPage() {
  if (!(await auth())?.user?.id) redirect('/start');
  const response = await GET();
  if (!response.ok) redirect('/account?billing=unavailable');
  const billing = await response.json();
  if (!billing.hasAccess) redirect('/account');
  return <main aria-label="Product workspace" className="min-h-screen bg-white" />;
}
