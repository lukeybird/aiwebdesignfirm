import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import crypto from 'crypto';

function getUserId(request: NextRequest): number | null {
  const id = request.headers.get('x-marine-user-id');
  if (id) return parseInt(id, 10) || null;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const marineUserId = getUserId(request);
    if (!marineUserId) {
      return NextResponse.json({ error: 'Must be logged in' }, { status: 401 });
    }

    const devices = await sql`
      SELECT id, device_id, name, last_float_status, last_activity_at, created_at
      FROM marine_devices
      WHERE marine_user_id = ${marineUserId}
      ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
    `;

    return NextResponse.json({ devices });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const marineUserId = getUserId(request);
    if (!marineUserId) {
      return NextResponse.json({ error: 'Must be logged in' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = (body.name || 'My Boat').toString().trim() || 'My Boat';

    const deviceId = crypto.randomBytes(6).toString('hex');
    const authToken = crypto.randomBytes(24).toString('hex');

    await sql`
      INSERT INTO marine_devices (marine_user_id, device_id, auth_token, name)
      VALUES (${marineUserId}, ${deviceId}, ${authToken}, ${name})
    `;

    const [row] = await sql`
      SELECT id, device_id, auth_token, name, created_at
      FROM marine_devices
      WHERE device_id = ${deviceId}
    `;

    return NextResponse.json({
      success: true,
      device: {
        id: (row as any).id,
        device_id: (row as any).device_id,
        auth_token: (row as any).auth_token,
        name: (row as any).name,
        created_at: (row as any).created_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
