import type { Sql } from 'postgres';
import {
  sendBookingReminder,
  sendCallLinkMissingAlert,
} from '@/lib/booking/emails';

type ApptRow = {
  id: number;
  starts_at: Date;
  lead_id: number;
  call_link: string | null;
  reminder_1h_sent_at: Date | null;
  reminder_30m_sent_at: Date | null;
  reminder_15m_sent_at: Date | null;
  call_link_alert_sent_at: Date | null;
  name: string;
  email: string;
};

export async function runBookingReminders(sql: Sql): Promise<{ log: string[] }> {
  const log: string[] = [];
  const now = new Date();

  const rows = (await sql`
    SELECT
      a.id,
      a.starts_at,
      a.lead_id,
      a.call_link,
      a.reminder_1h_sent_at,
      a.reminder_30m_sent_at,
      a.reminder_15m_sent_at,
      a.call_link_alert_sent_at,
      l.name,
      l.email
    FROM booking_appointments a
    JOIN booking_leads l ON l.id = a.lead_id
    WHERE a.status = 'scheduled'
      AND a.starts_at > ${now}
  `) as unknown as ApptRow[];

  for (const a of rows) {
    const start = new Date(a.starts_at);
    const ms = start.getTime() - now.getTime();

    const oneH = 60 * 60 * 1000;
    const thirtyM = 30 * 60 * 1000;
    const fifteenM = 15 * 60 * 1000;

    if (!a.reminder_1h_sent_at && ms <= oneH && ms > 0) {
      const r = await sendBookingReminder({
        to: a.email,
        name: a.name,
        startsAt: start,
        label: '1 hour before',
      });
      if (r.ok) {
        await sql`UPDATE booking_appointments SET reminder_1h_sent_at = NOW(), updated_at = NOW() WHERE id = ${a.id}`;
        log.push(`1h reminder appt ${a.id}`);
      } else {
        log.push(`1h reminder failed appt ${a.id}: ${r.error}`);
      }
    }

    if (!a.reminder_30m_sent_at && ms <= thirtyM && ms > 0) {
      const r = await sendBookingReminder({
        to: a.email,
        name: a.name,
        startsAt: start,
        label: '30 minutes before',
      });
      if (r.ok) {
        await sql`UPDATE booking_appointments SET reminder_30m_sent_at = NOW(), updated_at = NOW() WHERE id = ${a.id}`;
        log.push(`30m reminder appt ${a.id}`);
      } else {
        log.push(`30m reminder failed appt ${a.id}: ${r.error}`);
      }
    }

    if (!a.reminder_15m_sent_at && ms <= fifteenM && ms > 0) {
      const r = await sendBookingReminder({
        to: a.email,
        name: a.name,
        startsAt: start,
        label: '15 minutes before',
      });
      if (r.ok) {
        await sql`UPDATE booking_appointments SET reminder_15m_sent_at = NOW(), updated_at = NOW() WHERE id = ${a.id}`;
        log.push(`15m reminder appt ${a.id}`);
      } else {
        log.push(`15m reminder failed appt ${a.id}: ${r.error}`);
      }

      const hasLink = a.call_link && a.call_link.trim().length > 0;
      if (!hasLink && !a.call_link_alert_sent_at) {
        const ar = await sendCallLinkMissingAlert({
          clientName: a.name,
          clientEmail: a.email,
          startsAt: start,
        });
        if (ar.ok) {
          await sql`UPDATE booking_appointments SET call_link_alert_sent_at = NOW(), updated_at = NOW() WHERE id = ${a.id}`;
          log.push(`call-link alert appt ${a.id}`);
        } else {
          log.push(`call-link alert failed appt ${a.id}: ${ar.error}`);
        }
      }
    }
  }

  return { log };
}
