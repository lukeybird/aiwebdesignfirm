import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';

const STATUSES = ['new', 'contacted', 'booked', 'completed', 'lost'] as const;

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
    const row = await sql`SELECT * FROM booking_leads WHERE id = ${id} LIMIT 1`;
    if (row.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const cur = row[0] as Record<string, unknown>;

    const name = typeof body.name === 'string' ? body.name.trim() : (cur.name as string);
    const email = typeof body.email === 'string' ? body.email.trim() : (cur.email as string);
    const phone =
      typeof body.phone === 'string' ? body.phone.trim() : ((cur.phone as string | null) ?? null);
    const plan =
      typeof body.plan === 'string' ? body.plan.trim() : ((cur.plan as string | null) ?? null);
    const notes =
      typeof body.notes === 'string' ? body.notes.trim() : ((cur.notes as string | null) ?? null);
    const admin_notes =
      typeof body.admin_notes === 'string'
        ? body.admin_notes.trim()
        : ((cur.admin_notes as string | null) ?? null);
    let status = typeof body.status === 'string' ? body.status.trim() : (cur.status as string);
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
      status = cur.status as string;
    }

    if (name.length < 2 || !email) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 });
    }

    await sql`
      UPDATE booking_leads
      SET
        name = ${name},
        email = ${email},
        phone = ${phone},
        plan = ${plan},
        notes = ${notes},
        admin_notes = ${admin_notes},
        status = ${status},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
