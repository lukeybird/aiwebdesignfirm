import { NextRequest, NextResponse } from 'next/server';
import { ensureTdgPvpTables, verifyRoomPlayer } from '@/lib/tdg-pvp';
import { completeMatch, type TdgMatchEndReason } from '@/lib/tdg-pvp-activity';
import { verifyWebhookSecret } from '@/lib/tdg-join-ticket';

const VALID_REASONS = new Set<TdgMatchEndReason>(['base_destroyed', 'forfeit', 'disconnect', 'draw']);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      roomId?: string;
      sessionToken?: string;
      winnerSlot?: number | null;
      endReason?: string;
      source?: string;
    };

    if (body.source === 'tdg-game-server') {
      const secret = request.headers.get('x-tdg-webhook-secret');
      if (!verifyWebhookSecret(secret)) {
        return NextResponse.json({ error: 'Unauthorized webhook.' }, { status: 401 });
      }
    }

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';
    const winnerSlot =
      body.winnerSlot === null || body.winnerSlot === undefined
        ? null
        : body.winnerSlot === 0 || body.winnerSlot === 1
          ? body.winnerSlot
          : null;
    const endReason =
      typeof body.endReason === 'string' && VALID_REASONS.has(body.endReason as TdgMatchEndReason)
        ? (body.endReason as TdgMatchEndReason)
        : winnerSlot === null
          ? 'draw'
          : 'base_destroyed';

    if (!roomId || !sessionToken) {
      return NextResponse.json({ error: 'Invalid match payload.' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    const player = await verifyRoomPlayer(roomId, sessionToken);
    if (!player) {
      return NextResponse.json({ error: 'Not in this match.' }, { status: 403 });
    }

    const recorded = await completeMatch({ roomId, winnerSlot, endReason });
    return NextResponse.json({ ok: true, recorded });
  } catch (error) {
    console.error('tdg-pvp match-complete error:', error);
    return NextResponse.json({ error: 'Could not record match.' }, { status: 500 });
  }
}
