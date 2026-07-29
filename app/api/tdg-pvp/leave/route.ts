import { NextRequest, NextResponse } from 'next/server';
import {
  ensureTdgPvpTables,
  findQueueRowByToken,
  notifyOpponentSessionEnded,
  removeQueueSession,
  deleteRoomById,
} from '@/lib/tdg-pvp';
import { recordDisconnect } from '@/lib/tdg-pvp-activity';
import { leaveTftLobby, listTftLobbyMembers } from '@/lib/tdg-tft-lobby';
import { safeTrigger } from '@/lib/pusher';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionToken?: string };
    const sessionToken =
      typeof body.sessionToken === 'string' ? body.sessionToken.trim().slice(0, 64) : '';

    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session.' }, { status: 400 });
    }

    await ensureTdgPvpTables();

    const row = await findQueueRowByToken(sessionToken);

    // Leaving a TFT lobby before match start — refresh remaining players.
    if (row?.status === 'waiting_tft') {
      await leaveTftLobby(sessionToken);
      return NextResponse.json({ ok: true });
    }

    const removed = await removeQueueSession(sessionToken);
    if (!removed?.room_id) {
      return NextResponse.json({ ok: true });
    }

    // TFT multi: one player leaving should forfeit them, not cancel the lobby.
    if (removed.status === 'matched_tft') {
      const peers = await listTftLobbyMembers(removed.room_id);
      if (peers.length <= 1) {
        // Match is over — notify whoever is left and clear the room.
        if (removed.player_slot != null) {
          await recordDisconnect(removed.room_id, removed.player_slot);
        }
        await Promise.all(
          peers.map((p) =>
            safeTrigger(`tdg-player-${p.sessionToken}`, 'match_cancelled', {
              reason: 'opponent_left',
              t: Date.now(),
            }),
          ),
        );
        await deleteRoomById(removed.room_id);
      } else if (removed.player_slot != null) {
        await safeTrigger(`tdg-room-${removed.room_id}`, 'forfeit', {
          from: removed.player_slot,
          name: removed.player_name,
          t: Date.now(),
        });
      }
      return NextResponse.json({ ok: true });
    }

    // Classic 1v1 / limited — room already dissolved; notify opponent.
    if (
      (removed.status === 'matched' || removed.status === 'matched_limited') &&
      removed.player_slot != null
    ) {
      await recordDisconnect(removed.room_id, removed.player_slot);
      await notifyOpponentSessionEnded(removed, 'match_cancelled', {
        reason: 'opponent_left',
        t: Date.now(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('tdg-pvp leave error:', error);
    return NextResponse.json({ error: 'Could not leave queue.' }, { status: 500 });
  }
}
