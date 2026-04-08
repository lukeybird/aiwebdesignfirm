import { NextResponse } from 'next/server';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';
import {
  BOOKING_TZ,
  buildAllSlotsForDay,
  etWallToUtc,
  etYmdNow,
  type SlotInterval,
  type WeekdayRule,
  weekdaySun0Et,
} from '@/lib/booking/et';

/** Next calendar Friday on or after “today” in US Eastern (includes today if it’s Friday). */
function nextFridayYmdEt(): string {
  const startNoon = etWallToUtc(etYmdNow(), '12:00');
  for (let i = 0; i < 21; i++) {
    const day = addDays(startNoon, i);
    const ymd = formatInTimeZone(day, BOOKING_TZ, 'yyyy-MM-dd');
    if (weekdaySun0Et(ymd) === 5) return ymd;
  }
  return formatInTimeZone(addDays(startNoon, 4), BOOKING_TZ, 'yyyy-MM-dd');
}

/** Public: how many call slots remain on the upcoming Friday (EST). */
export async function GET() {
  try {
    await initBookingTables(sql);

    const fridayYmd = nextFridayYmdEt();

    const settings = (await sql`
      SELECT slot_interval_minutes FROM booking_settings WHERE id = 1 LIMIT 1
    `)[0] as { slot_interval_minutes: number } | undefined;
    const interval = (settings?.slot_interval_minutes ?? 30) as SlotInterval;

    const rulesRows = await sql`
      SELECT weekday, enabled, start_time::text AS start_time, end_time::text AS end_time
      FROM booking_weekday_rules
      ORDER BY weekday
    `;
    const rulesMap = new Map<number, WeekdayRule>();
    for (const r of rulesRows as unknown as WeekdayRule[]) {
      rulesMap.set(r.weekday, r);
    }

    const wd = weekdaySun0Et(fridayYmd);
    const rule = rulesMap.get(wd);
    const allSlots = buildAllSlotsForDay(fridayYmd, rule, interval);

    const rangeStart = etWallToUtc(fridayYmd, '00:00');
    const rangeEnd = addDays(etWallToUtc(fridayYmd, '12:00'), 1);

    const bookedRows = await sql`
      SELECT starts_at, ends_at FROM booking_appointments
      WHERE status = 'scheduled'
        AND starts_at >= ${rangeStart}
        AND starts_at < ${rangeEnd}
    `;
    const booked = (bookedRows as unknown as { starts_at: Date; ends_at: Date }[]).map((b) => ({
      start: new Date(b.starts_at),
      end: new Date(b.ends_at),
    }));

    const holdRows = await sql`
      SELECT starts_at, ends_at FROM booking_slot_holds
      WHERE starts_at >= ${rangeStart} AND starts_at < ${rangeEnd}
    `;
    const holds = (holdRows as unknown as { starts_at: Date; ends_at: Date }[]).map((h) => ({
      start: new Date(h.starts_at),
      end: new Date(h.ends_at),
    }));

    let available = 0;
    for (const s of allSlots) {
      const startMs = s.startsAt.getTime();
      const endMs = s.endsAt.getTime();
      const taken =
        booked.some((b) => startMs < b.end.getTime() && endMs > b.start.getTime()) ||
        holds.some((h) => startMs < h.end.getTime() && endMs > h.start.getTime());
      if (!taken) available += 1;
    }

    const total = allSlots.length;
    const hoursEnabled = Boolean(rule?.enabled);
    const label = formatInTimeZone(etWallToUtc(fridayYmd, '12:00'), BOOKING_TZ, 'EEEE, MMM d');

    return NextResponse.json({
      fridayYmd,
      label,
      available,
      total,
      hoursEnabled,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('booking/friday-availability:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
