import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';
import { getTeamNotifyEmails, sendTeamNotification } from '@/lib/team-email';

const PLACEHOLDER_LISTING = 'aiWebDF — consultation request';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (name.length < 2) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const noteText = [message ? `Message: ${message}` : null].filter(Boolean).join('\n') || null;

    const result = await sql`
      INSERT INTO leads (
        listing_link, website_link, business_phone, business_name, business_email,
        business_address, owner_first_name, owner_phone, has_logo, has_good_photos
      )
      VALUES (
        ${PLACEHOLDER_LISTING},
        ${null},
        ${phone || null},
        ${businessName || null},
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

    if (noteText && lead?.id) {
      await sql`
        INSERT INTO lead_notes (lead_id, text)
        VALUES (${lead.id}, ${noteText})
      `;
    }

    const textBody = [
      `aiWebDF — Full AI Agency consultation`,
      ``,
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      businessName ? `Business: ${businessName}` : null,
      message ? `Message: ${message}` : null,
      ``,
      `Lead ID: ${lead?.id ?? '—'}`,
      `Submitted: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join('\n');

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const htmlBody = `
      <h2>aiWebDF — Agency consultation</h2>
      <p><strong>Name:</strong> ${esc(name)}</p>
      <p><strong>Email:</strong> ${esc(email)}</p>
      ${phone ? `<p><strong>Phone:</strong> ${esc(phone)}</p>` : ''}
      ${businessName ? `<p><strong>Business:</strong> ${esc(businessName)}</p>` : ''}
      ${message ? `<p><strong>Message:</strong> ${esc(message)}</p>` : ''}
      <p><em>Lead ID: ${lead?.id ?? '—'} · ${new Date().toLocaleString()}</em></p>
    `;

    const mail = await sendTeamNotification({
      subject: `aiWebDF consultation: ${name}`,
      text: textBody,
      html: htmlBody,
    });
    if (!mail.ok) {
      console.error('ai-website-consultation email notify failed:', mail.error, 'recipients:', getTeamNotifyEmails());
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.message?.includes('leads') && e?.message?.includes('does not exist')) {
      await initDatabase();
      return NextResponse.json({ error: 'Database was initialized. Please try again.' }, { status: 503 });
    }
    console.error('ai-website-consultation:', e);
    return NextResponse.json({ error: e?.message || 'Failed to save' }, { status: 500 });
  }
}
