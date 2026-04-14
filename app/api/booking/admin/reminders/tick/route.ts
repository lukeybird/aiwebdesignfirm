import { type NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';
import { runBookingReminders } from '@/lib/booking/reminder-runner';
import { assertBookingAdmin } from '@/lib/booking/require-dev-auth';

/** Fires from /book/admin every ~30s while a developer is logged in. */
export async function POST(request: NextRequest) {
  const denied = assertBookingAdmin(request);
  if (denied) return denied;
  try {
    await initBookingTables(sql);
    const { log } = await runBookingReminders(sql);
    return NextResponse.json({ ok: true, log });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('booking reminders tick:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
