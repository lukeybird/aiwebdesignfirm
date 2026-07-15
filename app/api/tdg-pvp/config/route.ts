import { NextResponse } from 'next/server';
import { getTdgGameWsUrl } from '@/lib/tdg-join-ticket';

export async function GET() {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';
  const gameWsUrl = getTdgGameWsUrl();

  if (!key) {
    return NextResponse.json({ error: 'Online PvP is not configured.' }, { status: 503 });
  }

  return NextResponse.json({
    key,
    cluster,
    gameWsUrl,
    serverAuth: Boolean(gameWsUrl),
  });
}
