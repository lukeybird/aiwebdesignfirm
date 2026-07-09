import type { Metadata } from 'next';
import ActivityMonitor from './ActivityMonitor';

export const metadata: Metadata = {
  title: 'PvP Activity',
  description: 'Live Territory Game PvP queue, match pairings, results, and player win/loss records.',
};

export default function ActivityPage() {
  return <ActivityMonitor />;
}
