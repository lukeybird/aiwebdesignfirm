import { NextRequest, NextResponse } from 'next/server';
import {
  closeBabyRoom,
  createBabyRoom,
  joinBabyRoom,
  touchBabySession,
  validPin,
  verifyBabySession,
} from '@/lib/baby-monitor';
import { safeTrigger } from '@/lib/pusher';

export const runtime = 'nodejs';

function cleanToken(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 64) : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'create') {
      const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
      if (!validPin(pin)) {
        return NextResponse.json({ error: 'Use a 4–8 digit viewer PIN.' }, { status: 400 });
      }
      return NextResponse.json(await createBabyRoom(pin));
    }

    if (action === 'join') {
      const roomCode = typeof body.roomCode === 'string' ? body.roomCode.slice(0, 12) : '';
      const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
      if (!roomCode || !validPin(pin)) {
        return NextResponse.json({ error: 'Enter the room code and 4–8 digit PIN.' }, { status: 400 });
      }
      const result = await joinBabyRoom(roomCode, pin);
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result);
    }

    const token = cleanToken(body.token);
    const session = await verifyBabySession(token);
    if (!session) {
      return NextResponse.json({ error: 'This monitor session has expired.' }, { status: 401 });
    }

    if (action === 'heartbeat') {
      const viewerCount = await touchBabySession(session);
      return NextResponse.json({ ok: true, viewerCount });
    }

    if (action === 'signal') {
      const type = typeof body.type === 'string' ? body.type : '';
      const targetId = typeof body.targetId === 'string' ? body.targetId.slice(0, 64) : null;
      const hostEvents = new Set(['offer', 'ice', 'host-stopped']);
      const viewerEvents = new Set(['answer', 'ice', 'viewer-ready', 'viewer-left']);
      const permitted = session.role === 'host' ? hostEvents.has(type) : viewerEvents.has(type);
      if (!permitted) {
        return NextResponse.json({ error: 'Signal not permitted for this device.' }, { status: 403 });
      }
      if (['offer', 'answer', 'ice'].includes(type) && !targetId) {
        return NextResponse.json({ error: 'Signal target is required.' }, { status: 400 });
      }

      await touchBabySession(session);
      const delivered = await safeTrigger(session.channelName, 'signal', {
        type,
        fromId: session.clientId,
        fromRole: session.role,
        targetId,
        payload: body.payload ?? null,
        sentAt: Date.now(),
      });
      if (!delivered) {
        return NextResponse.json({ error: 'Signaling service is unavailable.' }, { status: 503 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown baby monitor action.' }, { status: 400 });
  } catch (error) {
    console.error('baby monitor request failed:', error);
    return NextResponse.json({ error: 'Baby monitor request failed.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: unknown };
    const session = await verifyBabySession(cleanToken(body.token));
    if (!session || session.role !== 'host') {
      return NextResponse.json({ error: 'Only the camera device can close this room.' }, { status: 403 });
    }
    await safeTrigger(session.channelName, 'signal', {
      type: 'host-stopped',
      fromId: session.clientId,
      fromRole: session.role,
      targetId: null,
      payload: null,
      sentAt: Date.now(),
    });
    await closeBabyRoom(session);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('baby monitor close failed:', error);
    return NextResponse.json({ error: 'Could not close the room.' }, { status: 500 });
  }
}
