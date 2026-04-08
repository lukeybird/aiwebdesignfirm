import { NextRequest, NextResponse } from 'next/server';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';
import {
  BOOKING_TZ,
  buildSlotsForDay,
  etWallToUtc,
  etYmdNow,
  type SlotInterval,
  type WeekdayRule,
  weekdaySun0Et,
} from '@/lib/booking/et';

export async function GET(request: NextRequest) {
  try {
    await initBookingTables(sql);

    const emailRaw = request.nextUrl.searchParams.get('email')?.trim().toLowerCase() || '';
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    if (emailRaw) {
      const leadRows = await sql`
        SELECT l.id
        FROM booking_leads l
        WHERE LOWER(TRIM(l.email)) = ${emailRaw}
        ORDER BY l.created_at DESC
        LIMIT 1
      `;
      const leadId = (leadRows[0] as { id: number } | undefined)?.id;
      if (leadId) {
        const existing = await sql`
          SELECT id FROM booking_appointments
          WHERE lead_id = ${leadId} AND status = 'scheduled'
          LIMIT 1
        `;
        if (existing.length > 0) {
          return NextResponse.json({ error: 'Already booked', days: [] }, { status: 400 });
        }
      }
    }

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
      30,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('days') || '14', 10) || 14),
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

    const out: { date: string; slots: { startsAt: string; endsAt: string; label: string }[] }[] = [];

    for (let i = 0; i < days; i++) {
      const dayInst = addDays(noonStart, i);
      const ymd = formatInTimeZone(dayInst, BOOKING_TZ, 'yyyy-MM-dd');
      const wd = weekdaySun0Et(ymd);
      const rule = rulesMap.get(wd);
      const slots = buildSlotsForDay(ymd, rule, interval, booked);
      if (slots.length === 0) continue;
      out.push({
        date: ymd,
        slots: slots.map((s) => ({
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          label: formatInTimeZone(s.startsAt, BOOKING_TZ, 'h:mm a') + ' EST',
        })),
      });
    }

    return NextResponse.json({ intervalMinutes: interval, days: out });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('booking/slots:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
