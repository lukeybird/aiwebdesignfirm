import type { Metadata } from 'next';
import LeaderboardClient from './LeaderboardClient';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Territory Game rankings for signed-in players across Live Battle, Draft Battle, and TFT.',
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
