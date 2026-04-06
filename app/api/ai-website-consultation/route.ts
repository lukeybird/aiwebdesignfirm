import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';
import {
  getTeamNotifyEmails,
  sendConsultationThankYou,
  sendTeamNotification,
} from '@/lib/team-email';

const PLACEHOLDER_LISTING = 'aiWebDF — consultation request';

const PLAN_OPTIONS = ['starter', 'advanced', 'elite'] as const;
type PlanId = (typeof PLAN_OPTIONS)[number];

const PLAN_LABEL: Record<PlanId, string> = {
  starter: 'Starter AI',
  advanced: 'Advanced AI',
  elite: 'Elite AI',
};

function parsePlan(raw: unknown): PlanId | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  return PLAN_OPTIONS.includes(t as PlanId) ? (t as PlanId) : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : '';
    const plan = parsePlan(body.plan);

    if (name.length < 2) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });
    }
    if (!plan) {
      return NextResponse.json({ error: 'Valid plan is required' }, { status: 400 });
    }

    const planLabel = PLAN_LABEL[plan];

    const noteText = [`Plan: ${planLabel}`, notes ? `Notes: ${notes}` : null]
      .filter(Boolean)
      .join('\n');

    const result = await sql`
      INSERT INTO leads (
        listing_link, website_link, business_phone, business_name, business_email,
        business_address, owner_first_name, owner_phone, has_logo, has_good_photos
      )
      VALUES (
        ${PLACEHOLDER_LISTING},
        ${null},
        ${phone || null},
        ${null},
        ${email},
        ${null},
        ${name},
        ${phone || null},
        ${null},
        ${null}
      )
      RETURNING id
    `;

    const lead = result[0] as { id: number };

    if (lead?.id) {
      await sql`
        INSERT INTO lead_notes (lead_id, text)
        VALUES (${lead.id}, ${noteText})
      `;
    }

    const textBody = [
      `aiWebDF — ${planLabel} consultation`,
      ``,
      `Plan: ${planLabel}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      notes ? `Notes: ${notes}` : null,
      ``,
      `Lead ID: ${lead?.id ?? '—'}`,
      `Submitted: ${new Date().toISOString()}`,
    ]
      .filter((line) => line !== null)
      .join('\n');

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const htmlBody = `
      <h2>aiWebDF — ${esc(planLabel)} consultation</h2>
      <p><strong>Plan:</strong> ${esc(planLabel)}</p>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      <p><strong>Phone:</strong> ${esc(phone)}</p>
      ${notes ? `<p><strong>Notes:</strong> ${esc(notes).replace(/\n/g, '<br/>')}</p>` : ''}
      <p><em>Lead ID: ${lead?.id ?? '—'} · ${new Date().toLocaleString()}</em></p>
    `;

    const mail = await sendTeamNotification({
      subject: `aiWebDF ${planLabel}: ${name}`,
      text: textBody,
      html: htmlBody,
    });
    if (!mail.ok) {
      console.error(
        'ai-website-consultation: team notify failed (lead still saved):',
        mail.error,
        'recipients:',
        getTeamNotifyEmails(),
      );
    }

    const thanks = await sendConsultationThankYou({ to: email, name });
    if (!thanks.ok) {
      console.error('ai-website-consultation: thank-you email failed:', thanks.error, 'to:', email);
    }

    const allOk = mail.ok && thanks.ok;

    return NextResponse.json({
      success: true,
      emailSent: mail.ok,
      thankYouSent: thanks.ok,
      ...(mail.ok ? {} : { notifyError: mail.error || 'Team notification failed' }),
      ...(thanks.ok ? {} : { thankYouError: thanks.error || 'Thank-you email failed' }),
      // Back-compat for older clients: "fully delivered" when both emails sent
      allEmailsSent: allOk,
    });
  } catch (e: any) {
    if (e?.message?.includes('leads') && e?.message?.includes('does not exist')) {
      await initDatabase();
      return NextResponse.json({ error: 'Database was initialized. Please try again.' }, { status: 503 });
    }
    console.error('ai-website-consultation:', e);
    return NextResponse.json({ error: e?.message || 'Failed to save' }, { status: 500 });
  }
}
