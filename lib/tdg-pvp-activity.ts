import { sql } from '@/lib/db';
import { bumpLeaderboardForName } from '@/lib/site-users';
import { getMatchState } from '@/lib/tdg-pvp';
import { ensureTdgPresenceTable, listLiveTdgPresence } from '@/lib/tdg-presence';
import { getPresenceHistorySummary, listPresenceHistory } from '@/lib/tdg-presence-log';

export type TdgMatchEndReason = 'base_destroyed' | 'forfeit' | 'disconnect' | 'draw';

export type TdgMatchRow = {
  id: number;
  room_id: string;
  player0_name: string;
  player1_name: string;
  status: string;
  winner_slot: number | null;
  end_reason: string | null;
  started_at: string | Date;
  ended_at: string | Date | null;
};

export type TdgPlayerStatsRow = {
  player_name: string;
  wins: number;
  losses: number;
  draws: number;
  last_played_at: string | Date | null;
};

async function bumpPlayerStat(playerName: string, outcome: 'win' | 'loss' | 'draw') {
  await sql`
    INSERT INTO tdg_pvp_player_stats (player_name, wins, losses, draws, last_played_at)
    VALUES (
      ${playerName},
      ${outcome === 'win' ? 1 : 0},
      ${outcome === 'loss' ? 1 : 0},
      ${outcome === 'draw' ? 1 : 0},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (player_name) DO UPDATE SET
      wins = tdg_pvp_player_stats.wins + ${outcome === 'win' ? 1 : 0},
      losses = tdg_pvp_player_stats.losses + ${outcome === 'loss' ? 1 : 0},
      draws = tdg_pvp_player_stats.draws + ${outcome === 'draw' ? 1 : 0},
      last_played_at = CURRENT_TIMESTAMP
  `;
}

async function resolveMatchMode(roomId: string) {
  try {
    const snap = await getMatchState(roomId);
    const mode = snap?.mode;
    if (mode === 'tft' || mode === 'limited' || mode === 'standard') return mode;
  } catch {
    // ignore — fall back to standard
  }
  return 'standard';
}

async function applyMatchStats(match: {
  room_id?: string;
  player0_name: string;
  player1_name: string;
  winner_slot: number | null;
}) {
  const mode = match.room_id ? await resolveMatchMode(match.room_id) : 'standard';
  if (match.winner_slot === null) {
    await bumpPlayerStat(match.player0_name, 'draw');
    await bumpPlayerStat(match.player1_name, 'draw');
    await bumpLeaderboardForName(match.player0_name, mode, 'draw');
    await bumpLeaderboardForName(match.player1_name, mode, 'draw');
    return;
  }

  const winner = match.winner_slot === 0 ? match.player0_name : match.player1_name;
  const loser = match.winner_slot === 0 ? match.player1_name : match.player0_name;
  await bumpPlayerStat(winner, 'win');
  await bumpPlayerStat(loser, 'loss');
  await bumpLeaderboardForName(winner, mode, 'win');
  await bumpLeaderboardForName(loser, mode, 'loss');
}

export async function recordMatchStart(roomId: string, player0Name: string, player1Name: string) {
  await sql`
    INSERT INTO tdg_pvp_matches (room_id, player0_name, player1_name, status)
    VALUES (${roomId}, ${player0Name}, ${player1Name}, 'active')
    ON CONFLICT (room_id) DO NOTHING
  `;
}

export async function completeMatch(params: {
  roomId: string;
  winnerSlot: number | null;
  endReason: TdgMatchEndReason;
}): Promise<boolean> {
  const rows = (await sql`
    UPDATE tdg_pvp_matches
    SET status = 'completed',
        winner_slot = ${params.winnerSlot},
        end_reason = ${params.endReason},
        ended_at = CURRENT_TIMESTAMP
    WHERE room_id = ${params.roomId}
      AND status = 'active'
    RETURNING player0_name, player1_name, winner_slot
  `) as unknown as Array<{
    player0_name: string;
    player1_name: string;
    winner_slot: number | null;
  }>;

  if (!rows[0]) return false;
  await applyMatchStats({ ...rows[0], room_id: params.roomId });
  return true;
}

export async function recordForfeit(roomId: string, forfeiterSlot: number) {
  const winnerSlot = forfeiterSlot === 0 ? 1 : 0;
  return completeMatch({ roomId, winnerSlot, endReason: 'forfeit' });
}

export async function recordDisconnect(roomId: string, disconnectedSlot: number) {
  const winnerSlot = disconnectedSlot === 0 ? 1 : 0;
  return completeMatch({ roomId, winnerSlot, endReason: 'disconnect' });
}

export async function getActivitySnapshot() {
  await ensureTdgPresenceTable();
  const [queueRows, activeRows, recentRows, onlineNow, presenceHistory, presenceHistorySummary] = await Promise.all([
    sql`
      SELECT player_name, created_at, last_seen_at
      FROM tdg_pvp_queue
      WHERE status = 'waiting'
        AND last_seen_at >= NOW() - INTERVAL '30 seconds'
      ORDER BY created_at ASC
    ` as unknown as Promise<Array<{ player_name: string; created_at: string | Date; last_seen_at: string | Date }>>,
    sql`
      SELECT room_id, player0_name, player1_name, started_at
      FROM tdg_pvp_matches
      WHERE status = 'active'
      ORDER BY started_at DESC
      LIMIT 20
    ` as unknown as Promise<Array<{
      room_id: string;
      player0_name: string;
      player1_name: string;
      started_at: string | Date;
    }>>,
    sql`
      SELECT room_id, player0_name, player1_name, winner_slot, end_reason, started_at, ended_at
      FROM tdg_pvp_matches
      WHERE status = 'completed'
      ORDER BY ended_at DESC NULLS LAST, started_at DESC
      LIMIT 50
    ` as unknown as Promise<
      Array<{
        room_id: string;
        player0_name: string;
        player1_name: string;
        winner_slot: number | null;
        end_reason: string | null;
        started_at: string | Date;
        ended_at: string | Date | null;
      }>
    >,
    listLiveTdgPresence(),
    listPresenceHistory({ hours: 168, limit: 250 }),
    getPresenceHistorySummary(168),
  ]);

  const nameSet = new Set<string>();
  for (const row of queueRows) nameSet.add(row.player_name);
  for (const row of activeRows) {
    nameSet.add(row.player0_name);
    nameSet.add(row.player1_name);
  }
  for (const row of recentRows) {
    nameSet.add(row.player0_name);
    nameSet.add(row.player1_name);
  }

  const names = [...nameSet];
  const statsRows =
    names.length === 0
      ? []
      : ((await sql`
          SELECT player_name, wins, losses, draws, last_played_at
          FROM tdg_pvp_player_stats
          WHERE player_name = ANY(${names})
        `) as unknown as TdgPlayerStatsRow[]);

  const statsByName: Record<
    string,
    { wins: number; losses: number; draws: number; winRate: number | null; lastPlayedAt: string | null }
  > = {};

  for (const name of names) {
    const row = statsRows.find((s) => s.player_name === name);
    const wins = row?.wins ?? 0;
    const losses = row?.losses ?? 0;
    const draws = row?.draws ?? 0;
    const decided = wins + losses;
    statsByName[name] = {
      wins,
      losses,
      draws,
      winRate: decided > 0 ? Math.round((wins / decided) * 1000) / 10 : null,
      lastPlayedAt: row?.last_played_at ? new Date(row.last_played_at).toISOString() : null,
    };
  }

  return {
    queue: queueRows.map((row) => ({
      playerName: row.player_name,
      waitingSince: new Date(row.created_at).toISOString(),
      lastSeenAt: new Date(row.last_seen_at).toISOString(),
    })),
    activeMatches: activeRows.map((row) => ({
      roomId: row.room_id,
      player0Name: row.player0_name,
      player1Name: row.player1_name,
      startedAt: new Date(row.started_at).toISOString(),
    })),
    recentMatches: recentRows.map((row) => {
      const winnerName =
        row.winner_slot === null
          ? null
          : row.winner_slot === 0
            ? row.player0_name
            : row.player1_name;
      const loserName =
        row.winner_slot === null
          ? null
          : row.winner_slot === 0
            ? row.player1_name
            : row.player0_name;
      return {
        roomId: row.room_id,
        player0Name: row.player0_name,
        player1Name: row.player1_name,
        winnerSlot: row.winner_slot,
        winnerName,
        loserName,
        endReason: row.end_reason,
        startedAt: new Date(row.started_at).toISOString(),
        endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
      };
    }),
    players: statsByName,
    onlineNow,
    onlineCount: onlineNow.length,
    presenceHistory,
    presenceHistorySummary: {
      events: Number(presenceHistorySummary.events) || 0,
      visitors: Number(presenceHistorySummary.visitors) || 0,
      gpsEvents: Number(presenceHistorySummary.gps_events) || 0,
      mappedEvents: Number(presenceHistorySummary.mapped_events) || 0,
      hours: 168,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function getPlayerProfile(playerName: string) {
  const statsRows = (await sql`
    SELECT player_name, wins, losses, draws, last_played_at
    FROM tdg_pvp_player_stats
    WHERE player_name = ${playerName}
    LIMIT 1
  `) as unknown as TdgPlayerStatsRow[];

  const matches = (await sql`
    SELECT room_id, player0_name, player1_name, winner_slot, end_reason, started_at, ended_at
    FROM tdg_pvp_matches
    WHERE status = 'completed'
      AND (player0_name = ${playerName} OR player1_name = ${playerName})
    ORDER BY ended_at DESC NULLS LAST, started_at DESC
    LIMIT 25
  `) as unknown as Array<{
    room_id: string;
    player0_name: string;
    player1_name: string;
    winner_slot: number | null;
    end_reason: string | null;
    started_at: string | Date;
    ended_at: string | Date | null;
  }>;

  const row = statsRows[0];
  const wins = row?.wins ?? 0;
  const losses = row?.losses ?? 0;
  const draws = row?.draws ?? 0;
  const decided = wins + losses;

  return {
    playerName,
    wins,
    losses,
    draws,
    winRate: decided > 0 ? Math.round((wins / decided) * 1000) / 10 : null,
    record: `${wins}-${losses}${draws > 0 ? `-${draws}` : ''}`,
    lastPlayedAt: row?.last_played_at ? new Date(row.last_played_at).toISOString() : null,
    recentMatches: matches.map((match) => {
      const isPlayer0 = match.player0_name === playerName;
      const opponent = isPlayer0 ? match.player1_name : match.player0_name;
      let result: 'win' | 'loss' | 'draw' = 'draw';
      if (match.winner_slot !== null) {
        const won = (isPlayer0 && match.winner_slot === 0) || (!isPlayer0 && match.winner_slot === 1);
        result = won ? 'win' : 'loss';
      }
      return {
        roomId: match.room_id,
        opponent,
        result,
        endReason: match.end_reason,
        endedAt: match.ended_at ? new Date(match.ended_at).toISOString() : null,
      };
    }),
  };
}
