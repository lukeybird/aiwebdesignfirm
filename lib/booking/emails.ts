import { deliverEmail } from '@/lib/team-email';
import { formatEtSlot } from '@/lib/booking/et';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const BOOKING_ALERT_EMAILS = ['luke@webstarts.com', 'support@aiwebdesignfirm.com'];
export const BOOKING_NOTIFY_FROM = 'support@aiwebdesignfirm.com';

export async function sendBookingConfirmed(params: {
  to: string;
  name: string;
  startsAt: Date;
}): Promise<{ ok: boolean; error?: string }> {
  const when = formatEtSlot(params.startsAt);
  const first = params.name.trim().split(/\s+/)[0] || 'there';
  const subject = `Call confirmed — ${when}`;
  const text = `Hi ${first},

Your call with AiWebDesignFirm is confirmed for:
${when}
(All times are US Eastern.)

We look forward to speaking with you.

— AiWebDesignFirm`;
  const html = `<p>Hi ${esc(first)},</p>
<p>Your call with <strong>AiWebDesignFirm</strong> is confirmed for:</p>
<p><strong>${esc(when)}</strong></p>
<p><em>All times are US Eastern.</em></p>
<p>We look forward to speaking with you.</p>
<p>— AiWebDesignFirm</p>`;
  return deliverEmail({ to: params.to, subject, text, html });
}

export async function sendBookingAdminNotification(params: {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  startsAt: Date;
}): Promise<{ ok: boolean; error?: string }> {
  const when = formatEtSlot(params.startsAt);
  const subject = `New booking — ${params.clientName} @ ${when}`;
  const text = `New booking made.\n\nName: ${params.clientName}\nEmail: ${params.clientEmail}\nPhone: ${params.clientPhone}\nWhen: ${when} (Eastern)\n`;
  const html = `<h2>New booking made</h2>\n<p><strong>Name:</strong> ${esc(params.clientName)}</p>\n<p><strong>Email:</strong> ${esc(params.clientEmail)}</p>\n<p><strong>Phone:</strong> ${esc(params.clientPhone)}</p>\n<p><strong>When:</strong> ${esc(when)} (Eastern)</p>`;

  const failures: string[] = [];
  for (const to of BOOKING_ALERT_EMAILS) {
    const r = await deliverEmail({ to, from: BOOKING_NOTIFY_FROM, subject, text, html });
    if (!r.ok) failures.push(`${to}: ${r.error || '?'}`);
  }
  if (failures.length === BOOKING_ALERT_EMAILS.length) {
    return { ok: false, error: failures.join(' | ') };
  }
  return { ok: true };
}

export async function sendBookingReminder(params: {
  to: string;
  name: string;
  startsAt: Date;
  label: string;
}): Promise<{ ok: boolean; error?: string }> {
  const when = formatEtSlot(params.startsAt);
  const first = params.name.trim().split(/\s+/)[0] || 'there';
  const subject = `${params.label}: your AiWebDesignFirm call — ${when}`;
  const text = `Hi ${first},

Reminder: your scheduled call with AiWebDesignFirm is ${params.label.toLowerCase()}.

${when}
(All times are US Eastern.)

— AiWebDesignFirm`;
  const html = `<p>Hi ${esc(first)},</p>
<p>Reminder: your scheduled call with <strong>AiWebDesignFirm</strong> is <strong>${esc(params.label)}</strong>.</p>
<p><strong>${esc(when)}</strong></p>
<p><em>All times are US Eastern.</em></p>
<p>— AiWebDesignFirm</p>`;
  return deliverEmail({ to: params.to, subject, text, html });
}

export async function sendCallLinkEmail(params: {
  to: string;
  name: string;
  link: string;
  startsAt: Date;
}): Promise<{ ok: boolean; error?: string }> {
  const when = formatEtSlot(params.startsAt);
  const first = params.name.trim().split(/\s+/)[0] || 'there';
  const subject = `Your call link — ${when}`;
  const text = `Hi ${first},

Here is your link for the scheduled call (${when} Eastern):

${params.link}

— AiWebDesignFirm`;
  const html = `<p>Hi ${esc(first)},</p>
<p>Here is your link for the scheduled call (<strong>${esc(when)}</strong> Eastern):</p>
<p><a href="${esc(params.link)}">${esc(params.link)}</a></p>
<p>— AiWebDesignFirm</p>`;
  return deliverEmail({ to: params.to, subject, text, html });
}

export async function sendCallLinkMissingAlert(params: {
  clientName: string;
  clientEmail: string;
  startsAt: Date;
}): Promise<{ ok: boolean; error?: string }> {
  const when = formatEtSlot(params.startsAt);
  const subject = `[AiWebDesignFirm] Add call link — ${params.clientName} @ ${when}`;
  const text = `15-minute reminder fired but no call link is set yet.

Client: ${params.clientName}
Email: ${params.clientEmail}
Appointment: ${when} (Eastern)

Please add the call link in the booking admin and send it to the client.`;
  const html = `<p><strong>15-minute reminder</strong> fired but <strong>no call link</strong> is set yet.</p>
<ul>
<li><strong>Client:</strong> ${esc(params.clientName)}</li>
<li><strong>Email:</strong> ${esc(params.clientEmail)}</li>
<li><strong>Appointment:</strong> ${esc(when)} (Eastern)</li>
</ul>
<p>Please add the call link in the booking admin and send it to the client.</p>`;

  const failures: string[] = [];
  for (const to of BOOKING_ALERT_EMAILS) {
    const r = await deliverEmail({ to, subject, text, html });
    if (!r.ok) failures.push(`${to}: ${r.error || '?'}`);
  }
  if (failures.length === BOOKING_ALERT_EMAILS.length) {
    return { ok: false, error: failures.join(' | ') };
  }
  return { ok: true };
}
