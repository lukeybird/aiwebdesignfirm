import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isDeveloperAuthenticatedFromCookies } from '@/lib/developer-auth';
import ActivityMonitor from './ActivityMonitor';

export const metadata: Metadata = {
  title: 'PvP Activity',
  description: 'Live Territory Game PvP queue, match pairings, results, and player win/loss records.',
};

export default async function ActivityPage() {
  const ok = await isDeveloperAuthenticatedFromCookies();
  if (!ok) {
    redirect('/login/developer?next=/activity');
  }

  return <ActivityMonitor />;
}
