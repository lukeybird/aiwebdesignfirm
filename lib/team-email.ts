import { getResendApiKey } from '@/lib/resend-key';

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

  const resendKey = getResendApiKey();
  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);
      // One API call per recipient. With onboarding@resend.dev, Resend often only allows
      // verified addresses — a single multi-recipient send fails entirely if any "to" is blocked.
      const failures: string[] = [];
      for (const recipient of to) {
        const { error } = await resend.emails.send({
          from: fromEmail,
          to: recipient,
          subject: params.subject,
          text: params.text,
          html: params.html,
        });
        if (error) {
          const err = error as { message?: string; name?: string };
          const detail = [err.name, err.message].filter(Boolean).join(': ') || String(error);
          failures.push(`${recipient}: ${detail}`);
          console.error('sendTeamNotification Resend error:', recipient, error);
        }
      }
      if (failures.length === to.length) {
        return { ok: false, error: failures.join(' | ') };
      }
      if (failures.length) {
        console.warn('sendTeamNotification: some recipients failed:', failures.join(' | '));
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

  console.warn(
    'sendTeamNotification: no mail transport (set RESEND_API_KEY, RESND_API_KEY, or AIWEBD on the server, or SMTP)',
  );
  return {
    ok: false,
    error:
      'No API key visible to this server. Add RESEND_API_KEY (or RESND_API_KEY) in Vercel → Production, then redeploy.',
  };
}
