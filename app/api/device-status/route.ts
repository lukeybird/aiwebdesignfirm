import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// In-memory fallback when DB isn't set up (e.g. no device_status table yet)
let memoryStatus: boolean | null = null;

export async function GET() {
  try {
    const rows = await sql`
      SELECT status FROM device_status ORDER BY created_at DESC LIMIT 1
    `;
    const status = rows.length > 0 ? rows[0].status : memoryStatus;
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ status: memoryStatus });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const status = body.status === true || body.status === 'true';
    memoryStatus = status;

    try {
      await sql`INSERT INTO device_status (status) VALUES (${status})`;
    } catch {
      // Table might not exist yet; in-memory is still updated
    }

    return NextResponse.json({ success: true, status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
