import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';
import { assertBookingAdmin } from '@/lib/booking/require-dev-auth';

const INTERVALS = [15, 30, 60] as const;

export async function PUT(request: NextRequest) {
  const denied = assertBookingAdmin(request);
  if (denied) return denied;
  try {
    await initBookingTables(sql);

    const body = await request.json();
    const slotIntervalMinutes = Number(body.slotIntervalMinutes);
    if (!INTERVALS.includes(slotIntervalMinutes as (typeof INTERVALS)[number])) {
      return NextResponse.json({ error: 'slotIntervalMinutes must be 15, 30, or 60' }, { status: 400 });
    }

    const rules = body.rules;
    if (!Array.isArray(rules)) {
      return NextResponse.json({ error: 'rules array required' }, { status: 400 });
    }

    await sql`
      UPDATE booking_settings
      SET slot_interval_minutes = ${slotIntervalMinutes}, updated_at = NOW()
      WHERE id = 1
    `;

    for (const r of rules) {
      const weekday = Number(r.weekday);
      if (weekday < 0 || weekday > 6) continue;
      const enabled = Boolean(r.enabled);
      const padTime = (t: string, fallback: string) => {
        const s = (t || fallback).slice(0, 8);
        return s.length === 5 ? `${s}:00` : s;
      };
      const start_time = padTime(
        typeof r.start_time === 'string' ? r.start_time : '',
        '09:00',
      );
      const end_time = padTime(typeof r.end_time === 'string' ? r.end_time : '', '17:00');
      await sql`
        UPDATE booking_weekday_rules
        SET enabled = ${enabled},
            start_time = ${start_time}::time,
            end_time = ${end_time}::time,
            updated_at = NOW()
        WHERE weekday = ${weekday}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
