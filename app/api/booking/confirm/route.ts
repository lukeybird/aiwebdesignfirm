import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';
import { sendBookingAdminNotification, sendBookingConfirmed } from '@/lib/booking/emails';

export async function POST(request: NextRequest) {
  try {
    await initBookingTables(sql);
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
    const emailKey = emailRaw.toLowerCase();
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const plan = typeof body.plan === 'string' ? body.plan.trim().slice(0, 32) : null;
    const startsRaw = typeof body.startsAt === 'string' ? body.startsAt.trim() : '';

    if (name.length < 2) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });
    }
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
    const intervalMin = settings?.slot_interval_minutes ?? 30;
    const endsAt = new Date(startsAt.getTime() + intervalMin * 60 * 1000);

    const existingLead = await sql`
      SELECT id FROM booking_leads
      WHERE LOWER(TRIM(email)) = ${emailKey}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    let leadId: number;
    if (existingLead.length > 0) {
      leadId = (existingLead[0] as { id: number }).id;
      await sql`
        UPDATE booking_leads
        SET name = ${name}, phone = ${phone || null}, plan = COALESCE(${plan}, plan), updated_at = NOW()
        WHERE id = ${leadId}
      `;
    } else {
      const ins = await sql`
        INSERT INTO booking_leads (name, email, phone, plan, status)
        VALUES (${name}, ${emailRaw}, ${phone || null}, ${plan}, ${'new'})
        RETURNING id
      `;
      leadId = (ins[0] as { id: number }).id;
    }

    const taken = await sql`
      SELECT id FROM booking_appointments
      WHERE lead_id = ${leadId} AND status = 'scheduled'
      LIMIT 1
    `;
    if (taken.length > 0) {
      return NextResponse.json({ error: 'Already booked' }, { status: 409 });
    }

    const held = await sql`
      SELECT id FROM booking_slot_holds
      WHERE starts_at < ${endsAt} AND ends_at > ${startsAt}
      LIMIT 1
    `;
    if (held.length > 0) {
      return NextResponse.json(
        { error: 'That time is not available. Pick another slot.' },
        { status: 409 },
      );
    }

    try {
      const ins = await sql`
        INSERT INTO booking_appointments (lead_id, starts_at, ends_at, status)
        VALUES (${leadId}, ${startsAt}, ${endsAt}, 'scheduled')
        RETURNING id
      `;
      const apptId = (ins[0] as { id: number }).id;

      await sql`
        UPDATE booking_leads SET status = 'booked', updated_at = NOW() WHERE id = ${leadId}
      `;

      const mail = await sendBookingConfirmed({
        to: emailRaw,
        name,
        startsAt,
      });
      if (!mail.ok) {
        console.error('booking confirm email failed:', mail.error);
      }
      const notify = await sendBookingAdminNotification({
        clientName: name,
        clientEmail: emailRaw,
        clientPhone: phone,
        startsAt,
      });
      if (!notify.ok) {
        console.error('booking admin notify failed:', notify.error);
      }

      return NextResponse.json({
        success: true,
        appointmentId: apptId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        confirmationEmailSent: mail.ok,
        adminNotified: notify.ok,
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === '23505') {
        return NextResponse.json({ error: 'That time was just taken. Pick another slot.' }, { status: 409 });
      }
      throw e;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('booking/confirm:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
