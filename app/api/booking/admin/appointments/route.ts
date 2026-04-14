import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';
import { assertBookingAdmin } from '@/lib/booking/require-dev-auth';

/** Manual create appointment (admin). */
export async function POST(request: NextRequest) {
  const denied = assertBookingAdmin(request);
  if (denied) return denied;
  try {
    await initBookingTables(sql);

    const body = await request.json();
    const leadId = Number(body.leadId);
    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    if (!leadId || !startsAt || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: 'leadId and startsAt required' }, { status: 400 });
    }

    const settings = (await sql`
      SELECT slot_interval_minutes FROM booking_settings WHERE id = 1 LIMIT 1
    `)[0] as { slot_interval_minutes: number };
    const intervalMin = settings?.slot_interval_minutes ?? 30;
    let endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (!endsAt || Number.isNaN(endsAt.getTime())) {
      endsAt = new Date(startsAt.getTime() + intervalMin * 60 * 1000);
    }

    const lead = await sql`SELECT id FROM booking_leads WHERE id = ${leadId} LIMIT 1`;
    if (lead.length === 0) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    try {
      const ins = await sql`
        INSERT INTO booking_appointments (lead_id, starts_at, ends_at, status)
        VALUES (${leadId}, ${startsAt}, ${endsAt}, 'scheduled')
        RETURNING id
      `;
      await sql`
        UPDATE booking_leads SET status = 'booked', updated_at = NOW() WHERE id = ${leadId}
      `;
      return NextResponse.json({ success: true, id: (ins[0] as { id: number }).id });
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === '23505') {
        return NextResponse.json({ error: 'Slot conflict' }, { status: 409 });
      }
      throw e;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
