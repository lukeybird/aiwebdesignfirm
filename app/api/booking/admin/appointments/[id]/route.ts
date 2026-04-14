import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await initBookingTables(sql);

    const { id: raw } = await ctx.params;
    const id = parseInt(raw, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json();
    const row = await sql`SELECT * FROM booking_appointments WHERE id = ${id} LIMIT 1`;
    if (row.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const cur = row[0] as Record<string, unknown>;

    const status = typeof body.status === 'string' ? body.status : cur.status;
    const no_show = typeof body.no_show === 'boolean' ? body.no_show : cur.no_show;
    const notes = typeof body.notes === 'string' ? body.notes : cur.notes;
    const call_link = typeof body.call_link === 'string' ? body.call_link : cur.call_link;
    const starts_at =
      body.starts_at != null ? new Date(body.starts_at as string) : new Date(cur.starts_at as string);
    const ends_at =
      body.ends_at != null ? new Date(body.ends_at as string) : new Date(cur.ends_at as string);

    if (Number.isNaN(starts_at.getTime()) || Number.isNaN(ends_at.getTime())) {
      return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });
    }

    const allowed = ['scheduled', 'cancelled', 'completed'];
    if (!allowed.includes(status as string)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    try {
      await sql`
        UPDATE booking_appointments
        SET
          status = ${status},
          no_show = ${no_show},
          notes = ${notes},
          call_link = ${call_link},
          starts_at = ${starts_at},
          ends_at = ${ends_at},
          updated_at = NOW()
        WHERE id = ${id}
      `;
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === '23505') {
        return NextResponse.json({ error: 'Slot conflict' }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
