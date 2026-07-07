import { NextRequest, NextResponse } from 'next/server';
import { ensureTdgPvpTables } from '@/lib/tdg-pvp';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionToken?: string };
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';

    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session.' }, { status: 400 });
    }

    await ensureTdgPvpTables();

    await sql`
      DELETE FROM tdg_pvp_queue
      WHERE session_token = ${sessionToken}
        AND status = 'waiting'
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('tdg-pvp leave error:', error);
    return NextResponse.json({ error: 'Could not leave queue.' }, { status: 500 });
  }
}
