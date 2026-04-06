import { getResendApiKey } from '@/lib/resend-key';

/**
 * Inbound alerts for contact-style submissions (consultation, demo, new signups).
 * Override with CONTACT_NOTIFY_EMAILS="a@x.com,b@y.com" (comma-separated).
 */
const DEFAULT_TEAM_EMAILS = ['luke@webstarts.com', 'info@evodetection.com'];

function escHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** One recipient — used for team loops and lead thank-yous. */
async function deliverEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  const resendKey = getResendApiKey();
  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      if (error) {
        const err = error as { message?: string; name?: string };
        const detail = [err.name, err.message].filter(Boolean).join(': ') || String(error);
        return { ok: false, error: detail };
      }
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('deliverEmail Resend:', msg);
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
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('deliverEmail SMTP:', msg);
      return { ok: false, error: msg };
    }
  }

  console.warn(
    'deliverEmail: no mail transport (set RESEND_API_KEY, RESND_API_KEY, or AIWEBD on the server, or SMTP)',
  );
  return {
    ok: false,
    error:
      'No API key visible to this server. Add RESEND_API_KEY (or RESND_API_KEY) in Vercel → Production, then redeploy.',
  };
}

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

  const failures: string[] = [];
  for (const recipient of to) {
    const r = await deliverEmail({
      to: recipient,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    if (!r.ok) {
      failures.push(`${recipient}: ${r.error || 'unknown'}`);
      console.error('sendTeamNotification failed for', recipient, r.error);
    }
  }
  if (failures.length === to.length) {
    return { ok: false, error: failures.join(' | ') };
  }
  if (failures.length) {
    console.warn('sendTeamNotification: some recipients failed:', failures.join(' | '));
  }
  return { ok: true };
}

/** Confirmation to the person who submitted the agency consultation form. */
export async function sendConsultationThankYou(params: {
  to: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  const first =
    params.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0] || 'there';
  const safeFirst = escHtml(first);

  const subject = 'We received your request — aiWebDF';
  const text = `Hi ${first},

Thank you for reaching out about Elite AI. We received your consultation request and will reach out shortly.

If you have any questions in the meantime, reply to this email.

— aiWebDF`;

  const html = `
    <p>Hi ${safeFirst},</p>
    <p>Thank you for reaching out about <strong>Elite AI</strong>. We received your consultation request and <strong>we'll reach out shortly</strong>.</p>
    <p>If you have any questions in the meantime, reply to this email.</p>
    <p>— aiWebDF</p>
  `.trim();

  return deliverEmail({
    to: params.to.trim(),
    subject,
    text,
    html,
  });
}
