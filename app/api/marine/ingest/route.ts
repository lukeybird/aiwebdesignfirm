import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const deviceId = body.device_id ?? body.deviceId;
    const token = body.token;
    const floatSwitch = body.float_switch ?? body.floatSwitch;
    const event = body.event;

    if (!deviceId || !token) {
      return NextResponse.json(
        { error: 'device_id and token are required' },
        { status: 400 }
      );
    }

    try {
      const devices = await sql`
        SELECT id, marine_user_id, name
        FROM marine_devices
        WHERE device_id = ${String(deviceId)} AND auth_token = ${String(token)}
      `;
      if (devices.length === 0) {
        return NextResponse.json({ error: 'Invalid device or token' }, { status: 401 });
      }
      const device = devices[0] as { id: number; marine_user_id: number; name: string };

      const status = floatSwitch ?? (event === 'float_activated' || event === 'float_closed' ? 'closed' : event === 'float_open' ? 'open' : null);

      await sql`
        INSERT INTO marine_events (device_id, event_type, payload)
        VALUES (${String(deviceId)}, ${event || 'status'}, ${JSON.stringify({ float_switch: status, ...body })})
      `;

      if (status !== null && status !== undefined) {
        await sql`
          UPDATE marine_devices
          SET last_float_status = ${String(status)}, last_activity_at = CURRENT_TIMESTAMP
          WHERE id = ${device.id}
        `;
      } else {
        await sql`
          UPDATE marine_devices
          SET last_activity_at = CURRENT_TIMESTAMP
          WHERE id = ${device.id}
        `;
      }

      return NextResponse.json({ ok: true });
    } catch (dbError: any) {
      if (dbError?.message?.includes('marine_devices') && dbError?.message?.includes('does not exist')) {
        await initDatabase();
        return NextResponse.json({ error: 'Try again' }, { status: 503 });
      }
      throw dbError;
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Ingest failed' },
      { status: 500 }
    );
  }
}
