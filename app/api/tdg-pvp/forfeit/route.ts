import { NextRequest, NextResponse } from 'next/server';
import { safeTrigger } from '@/lib/pusher';
import {
  ensureTdgPvpTables,
  removeQueueSession,
  verifyRoomPlayer,
  findQueueRowByToken,
  deleteRoomById,
} from '@/lib/tdg-pvp';
import { recordForfeit } from '@/lib/tdg-pvp-activity';
import { listTftLobbyMembers } from '@/lib/tdg-tft-lobby';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { roomId?: string; sessionToken?: string };
    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';

    if (!roomId || !sessionToken) {
      return NextResponse.json({ error: 'Invalid forfeit payload.' }, { status: 400 });
    }

    await ensureTdgPvpTables();
    const row = await findQueueRowByToken(sessionToken);
    const player = await verifyRoomPlayer(roomId, sessionToken);
    if (!player) {
      return NextResponse.json({ error: 'Not in this match.' }, { status: 403 });
    }

    const isTft = player.status === 'matched_tft' || row?.status === 'matched_tft';

    await safeTrigger(`tdg-room-${roomId}`, 'forfeit', {
      from: player.player_slot,
      name: player.player_name,
      t: Date.now(),
    });

    await removeQueueSession(sessionToken);

    if (isTft) {
      const peers = await listTftLobbyMembers(roomId);
      if (peers.length <= 1) {
        await recordForfeit(roomId, player.player_slot);
        await Promise.all(
          peers.map((p) =>
            safeTrigger(`tdg-player-${p.sessionToken}`, 'match_cancelled', {
              reason: 'opponent_left',
              t: Date.now(),
            }),
          ),
        );
        await deleteRoomById(roomId);
      }
      // Otherwise remaining players keep going — activity match stays active.
    } else {
      await recordForfeit(roomId, player.player_slot);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('tdg-pvp forfeit error:', error);
    return NextResponse.json({ error: 'Forfeit failed.' }, { status: 500 });
  }
}
