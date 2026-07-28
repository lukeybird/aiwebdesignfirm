import { NextResponse } from 'next/server';
import { getLeaderboard, type LeaderboardMode } from '@/lib/site-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const modeParam = (searchParams.get('mode') || 'all').toLowerCase();
  const mode: LeaderboardMode =
    modeParam === 'tft' || modeParam === 'limited' || modeParam === 'standard' || modeParam === 'all'
      ? modeParam
      : 'all';
  const limit = Number(searchParams.get('limit') || 50);

  try {
    const rows = await getLeaderboard(mode, limit);
    return NextResponse.json({
      mode,
      updatedAt: new Date().toISOString(),
      entries: rows.map((row, index) => {
        const wins = Number(row.wins) || 0;
        const losses = Number(row.losses) || 0;
        const draws = Number(row.draws) || 0;
        const decided = wins + losses;
        return {
          rank: index + 1,
          userId: row.user_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          wins,
          losses,
          draws,
          winRate: decided > 0 ? Math.round((wins / decided) * 1000) / 10 : null,
          lastPlayedAt: row.last_played_at ? new Date(row.last_played_at).toISOString() : null,
        };
      }),
    });
  } catch (err) {
    console.error('leaderboard GET failed:', err);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
