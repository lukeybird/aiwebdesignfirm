import { NextRequest, NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';
import {
  BOOKING_TZ,
  buildAllSlotsForDay,
  type SlotInterval,
  type WeekdayRule,
  weekdaySun0Et,
} from '@/lib/booking/et';
import { assertBookingAdmin } from '@/lib/booking/require-dev-auth';

/** Create a demand hold on a single slot (must match a real bookable window). */
export async function POST(request: NextRequest) {
  const denied = assertBookingAdmin(request);
  if (denied) return denied;
  try {
    await initBookingTables(sql);
    const body = await request.json().catch(() => ({}));
    const startsRaw = typeof body.startsAt === 'string' ? body.startsAt.trim() : '';
    if (!startsRaw) {
      return NextResponse.json({ error: 'startsAt required' }, { status: 400 });
    }

    const startsAt = new Date(startsRaw);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: 'Invalid startsAt' }, { status: 400 });
    }

    const settings = (await sql`
      SELECT slot_interval_minutes FROM booking_settings WHERE id = 1 LIMIT 1
    `)[0] as { slot_interval_minutes: number } | undefined;
    const intervalMin = (settings?.slot_interval_minutes ?? 30) as SlotInterval;

    const endsAt = new Date(startsAt.getTime() + intervalMin * 60 * 1000);

    const ymd = formatInTimeZone(startsAt, BOOKING_TZ, 'yyyy-MM-dd');
    const wd = weekdaySun0Et(ymd);

    const rulesRows = await sql`
      SELECT weekday, enabled, start_time::text AS start_time, end_time::text AS end_time
      FROM booking_weekday_rules WHERE weekday = ${wd} LIMIT 1
    `;
    const rule = rulesRows[0] as WeekdayRule | undefined;
    const validSlots = buildAllSlotsForDay(ymd, rule, intervalMin);
    const onGrid = validSlots.some((s) => s.startsAt.getTime() === startsAt.getTime());
    if (!onGrid) {
      return NextResponse.json({ error: 'That time is outside bookable hours' }, { status: 400 });
    }

    const appt = await sql`
      SELECT id FROM booking_appointments
      WHERE status = 'scheduled' AND starts_at < ${endsAt} AND ends_at > ${startsAt}
      LIMIT 1
    `;
    if (appt.length > 0) {
      return NextResponse.json({ error: 'That slot already has a booking' }, { status: 409 });
    }

    try {
      const ins = await sql`
        INSERT INTO booking_slot_holds (starts_at, ends_at)
        VALUES (${startsAt}, ${endsAt})
        RETURNING id
      `;
      const id = (ins[0] as { id: number }).id;
      return NextResponse.json({
        success: true,
        id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === '23505') {
        return NextResponse.json({ error: 'That slot is already held' }, { status: 409 });
      }
      throw e;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('booking/admin/holds POST:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
