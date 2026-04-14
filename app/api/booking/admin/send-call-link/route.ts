import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';
import { sendCallLinkEmail } from '@/lib/booking/emails';
import { assertBookingAdmin } from '@/lib/booking/require-dev-auth';

export async function POST(request: NextRequest) {
  const denied = assertBookingAdmin(request);
  if (denied) return denied;
  try {
    await initBookingTables(sql);

    const body = await request.json();
    const appointmentId = Number(body.appointmentId);
    const link = typeof body.link === 'string' ? body.link.trim() : '';
    if (!appointmentId || !link) {
      return NextResponse.json({ error: 'appointmentId and link required' }, { status: 400 });
    }

    const rows = await sql`
      SELECT a.id, a.starts_at, a.call_link, l.name, l.email
      FROM booking_appointments a
      JOIN booking_leads l ON l.id = a.lead_id
      WHERE a.id = ${appointmentId}
      LIMIT 1
    `;
    const row = rows[0] as
      | { id: number; starts_at: Date; call_link: string | null; name: string; email: string }
      | undefined;
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const mail = await sendCallLinkEmail({
      to: row.email,
      name: row.name,
      link,
      startsAt: new Date(row.starts_at),
    });
    if (!mail.ok) {
      return NextResponse.json({ error: mail.error || 'Email failed' }, { status: 502 });
    }

    await sql`
      UPDATE booking_appointments
      SET call_link = ${link}, updated_at = NOW()
      WHERE id = ${appointmentId}
    `;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
