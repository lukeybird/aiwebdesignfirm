import { NextRequest, NextResponse } from 'next/server';
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

/** Admin: calendar grid with booked vs demand-hold per slot */
export async function GET(request: NextRequest) {
  try {
    await initBookingTables(sql);

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

    const startYmd = request.nextUrl.searchParams.get('start')?.trim() || etYmdNow();
    const days = Math.min(
      45,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('days') || '45', 10) || 45),
    );

    const rangeStart = etWallToUtc(startYmd, '00:00');
    const noonStart = etWallToUtc(startYmd, '12:00');
    const rangeEnd = addDays(noonStart, days + 1);

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
      SELECT id, starts_at, ends_at FROM booking_slot_holds
      WHERE starts_at >= ${rangeStart} AND starts_at < ${rangeEnd}
    `;
    const holds = (holdRows as unknown as { id: number; starts_at: Date; ends_at: Date }[]).map(
      (h) => ({
        id: h.id,
        start: new Date(h.starts_at),
        end: new Date(h.ends_at),
      }),
    );

    const out: {
      date: string;
      slots: {
        startsAt: string;
        endsAt: string;
        label: string;
        booked: boolean;
        held: boolean;
        holdId: number | null;
      }[];
    }[] = [];

    for (let i = 0; i < days; i++) {
      const dayInst = addDays(noonStart, i);
      const ymd = formatInTimeZone(dayInst, BOOKING_TZ, 'yyyy-MM-dd');
      const wd = weekdaySun0Et(ymd);
      const rule = rulesMap.get(wd);
      const allSlots = buildAllSlotsForDay(ymd, rule, interval);
      if (allSlots.length === 0) continue;

      out.push({
        date: ymd,
        slots: allSlots.map((s) => {
          const startMs = s.startsAt.getTime();
          const endMs = s.endsAt.getTime();
          const isBooked = booked.some((b) => startMs < b.end.getTime() && endMs > b.start.getTime());
          let holdId: number | null = null;
          for (const h of holds) {
            if (startMs < h.end.getTime() && endMs > h.start.getTime()) {
              holdId = h.id;
              break;
            }
          }
          const held = holdId != null;
          return {
            startsAt: s.startsAt.toISOString(),
            endsAt: s.endsAt.toISOString(),
            label: formatInTimeZone(s.startsAt, BOOKING_TZ, 'h:mm a') + ' EST',
            booked: isBooked,
            held,
            holdId,
          };
        }),
      });
    }

    return NextResponse.json({ intervalMinutes: interval, days: out });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('booking/admin/slot-overview:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
