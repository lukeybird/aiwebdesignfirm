/**
 * Inbound alerts for contact-style submissions (consultation, demo, new signups).
 * Override with CONTACT_NOTIFY_EMAILS="a@x.com,b@y.com" (comma-separated).
 */
const DEFAULT_TEAM_EMAILS = ['luke@webstarts.com', 'info@aiwebdesignfirm.com'];

export function getTeamNotifyEmails(): string[] {
  const raw = process.env.CONTACT_NOTIFY_EMAILS?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [...DEFAULT_TEAM_EMAILS];
}

export async function sendTeamNotification(params: {
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const to = getTeamNotifyEmails();
  if (to.length === 0) {
    console.warn('sendTeamNotification: no recipients configured');
    return { ok: false, error: 'no recipients' };
  }

  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: fromEmail,
        to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      if (error) {
        console.error('sendTeamNotification Resend error:', error);
        return { ok: false, error: (error as { message?: string }).message || String(error) };
      }
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('sendTeamNotification:', msg);
      return { ok: false, error: msg };
    }
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      const smtpFrom = process.env.FROM_EMAIL || process.env.SMTP_USER;
      await transporter.sendMail({
        from: smtpFrom,
        to: to.join(', '),
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('sendTeamNotification SMTP:', msg);
      return { ok: false, error: msg };
    }
  }

  console.warn('sendTeamNotification: RESEND_API_KEY and SMTP are not configured');
  return { ok: false, error: 'no mail transport' };
}
