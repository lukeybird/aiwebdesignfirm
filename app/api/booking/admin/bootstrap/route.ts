import { type NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';
import { assertBookingAdmin } from '@/lib/booking/require-dev-auth';

export async function GET(request: NextRequest) {
  const denied = assertBookingAdmin(request);
  if (denied) return denied;
  try {
    await initBookingTables(sql);

    const now = new Date();

    const settings = (await sql`
      SELECT slot_interval_minutes FROM booking_settings WHERE id = 1 LIMIT 1
    `)[0] as { slot_interval_minutes: number };

    const rules = await sql`
      SELECT weekday, enabled, start_time::text AS start_time, end_time::text AS end_time
      FROM booking_weekday_rules
      ORDER BY weekday
    `;

    const upcoming = await sql`
      SELECT
        a.id,
        a.starts_at,
        a.ends_at,
        a.status,
        a.no_show,
        a.notes,
        a.call_link,
        a.reminder_1h_sent_at,
        a.reminder_30m_sent_at,
        a.reminder_15m_sent_at,
        l.id AS lead_id,
        l.name AS lead_name,
        l.email AS lead_email,
        l.phone AS lead_phone
      FROM booking_appointments a
      JOIN booking_leads l ON l.id = a.lead_id
      WHERE a.starts_at >= ${now} AND a.status = 'scheduled'
      ORDER BY a.starts_at ASC
    `;

    const past = await sql`
      SELECT
        a.id,
        a.starts_at,
        a.ends_at,
        a.status,
        a.no_show,
        a.notes,
        a.call_link,
        l.id AS lead_id,
        l.name AS lead_name,
        l.email AS lead_email
      FROM booking_appointments a
      JOIN booking_leads l ON l.id = a.lead_id
      WHERE a.starts_at < ${now}
         OR a.status IN ('cancelled', 'completed')
      ORDER BY a.starts_at DESC
      LIMIT 200
    `;

    const leads = await sql`
      SELECT
        l.id,
        l.name,
        l.email,
        l.phone,
        l.plan,
        l.status,
        l.admin_notes,
        l.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', a.id,
              'starts_at', a.starts_at,
              'ends_at', a.ends_at,
              'status', a.status,
              'no_show', a.no_show
            )
            ORDER BY a.starts_at DESC
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) AS appointments
      FROM booking_leads l
      LEFT JOIN booking_appointments a ON a.lead_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT 500
    `;

    return NextResponse.json({
      settings,
      rules,
      upcoming,
      past,
      leads,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('booking admin bootstrap:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
