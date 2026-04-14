import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';

export async function POST(request: NextRequest) {
  try {
    await initBookingTables(sql);

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const plan = typeof body.plan === 'string' ? body.plan.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const status = typeof body.status === 'string' ? body.status.trim() : 'new';

    if (name.length < 2 || !email) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 });
    }

    const ins = await sql`
      INSERT INTO booking_leads (name, email, phone, plan, notes, status)
      VALUES (${name}, ${email}, ${phone || null}, ${plan}, ${notes}, ${status})
      RETURNING id
    `;

    const id = (ins[0] as { id: number }).id;
    const q = new URLSearchParams();
    q.set('name', name);
    q.set('email', email);
    if (phone) q.set('phone', phone);
    return NextResponse.json({
      success: true,
      id,
      bookingUrl: `/book?${q.toString()}`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
