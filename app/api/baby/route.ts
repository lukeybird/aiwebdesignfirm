import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
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

type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

async function babyIceServers(): Promise<IceServerConfig[]> {
  const fallback: IceServerConfig[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];
  const customUrls = process.env.BABY_TURN_URLS;
  const customUsername = process.env.BABY_TURN_USERNAME;
  const customCredential = process.env.BABY_TURN_CREDENTIAL;
  if (customUrls && customUsername && customCredential) {
    return [
      ...fallback,
      {
        urls: customUrls.split(',').map((url) => url.trim()).filter(Boolean),
        username: customUsername,
        credential: customCredential,
      },
    ];
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return fallback;

  try {
    const networkToken = await twilio(accountSid, authToken).tokens.create();
    const relays: IceServerConfig[] = [];
    for (const server of networkToken.iceServers || []) {
      const urls = server.urls || server.url;
      if (!urls) continue;
      relays.push({
        urls,
        ...(server.username ? { username: server.username } : {}),
        ...(server.credential ? { credential: server.credential } : {}),
      });
    }
    return relays.length ? relays : fallback;
  } catch (error) {
    console.error('baby monitor TURN credentials failed:', error);
    return fallback;
  }
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
      const room = await createBabyRoom(pin);
      return NextResponse.json({ ...room, iceServers: await babyIceServers() });
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
      return NextResponse.json({ ...result, iceServers: await babyIceServers() });
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
