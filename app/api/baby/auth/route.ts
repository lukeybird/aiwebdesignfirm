import { NextRequest, NextResponse } from 'next/server';
import { verifyBabySession } from '@/lib/baby-monitor';
import { pusher } from '@/lib/pusher';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const socketId = String(form.get('socket_id') || '').slice(0, 64);
    const channelName = String(form.get('channel_name') || '').slice(0, 128);
    const token = String(form.get('monitorToken') || '').slice(0, 64);
    const session = await verifyBabySession(token);

    if (!session || !socketId || channelName !== session.channelName) {
      return NextResponse.json({ error: 'Not authorized for this monitor room.' }, { status: 403 });
    }

    return NextResponse.json(pusher.authorizeChannel(socketId, channelName));
  } catch (error) {
    console.error('baby monitor Pusher auth failed:', error);
    return NextResponse.json({ error: 'Channel authorization failed.' }, { status: 500 });
  }
}
