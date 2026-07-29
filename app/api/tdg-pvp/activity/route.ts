import { NextRequest, NextResponse } from 'next/server';
import { ensureTdgPvpTables } from '@/lib/tdg-pvp';
import { getActivitySnapshot, getPlayerProfile } from '@/lib/tdg-pvp-activity';
import {
  isDeveloperAuthenticatedRequest,
  unauthorizedDeveloperJson,
} from '@/lib/developer-auth';

export async function GET(request: NextRequest) {
  try {
    if (!isDeveloperAuthenticatedRequest(request)) {
      return unauthorizedDeveloperJson();
    }

    await ensureTdgPvpTables();

    const player = request.nextUrl.searchParams.get('player')?.trim().slice(0, 32);
    const snapshot = await getActivitySnapshot();

    if (player && player.length >= 2) {
      const profile = await getPlayerProfile(player);
      return NextResponse.json({ ...snapshot, profile });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('tdg-pvp activity error:', error);
    return NextResponse.json({ error: 'Could not load activity.' }, { status: 500 });
  }
}
