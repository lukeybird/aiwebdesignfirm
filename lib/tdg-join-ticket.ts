import { createHmac, timingSafeEqual } from 'crypto';

function b64urlJson(obj: unknown) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signPayload(payloadB64: string, secret: string) {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

export type TdgJoinClaims = {
  roomId: string;
  sessionToken: string;
  playerSlot: 0 | 1;
  playerName: string;
  opponentName?: string;
  startsAt?: number;
};

export function mintTdgJoinTicket(claims: TdgJoinClaims, ttlMs = 120_000): string | null {
  const secret = process.env.TDG_JOIN_SECRET;
  if (!secret) return null;

  const payload = {
    roomId: claims.roomId,
    sessionToken: claims.sessionToken,
    playerSlot: claims.playerSlot,
    playerName: claims.playerName,
    opponentName: claims.opponentName || '',
    startsAt: claims.startsAt || Date.now() + 4500,
    exp: Date.now() + ttlMs,
  };
  const payloadB64 = b64urlJson(payload);
  const sig = signPayload(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

export function getTdgGameWsUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_TDG_GAME_WS_URL || process.env.TDG_GAME_WS_URL;
  if (!url) return null;
  return url.replace(/\/$/, '');
}

export function verifyWebhookSecret(headerValue: string | null): boolean {
  const secret = process.env.TDG_WEBHOOK_SECRET || process.env.TDG_JOIN_SECRET;
  if (!secret) return true; // allow if unset (local)
  if (!headerValue) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
