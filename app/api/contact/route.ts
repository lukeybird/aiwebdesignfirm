import { NextRequest, NextResponse } from 'next/server';
import { getTeamNotifyEmails, sendTeamNotification } from '@/lib/team-email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, phone, competitorSites, notes } = body;

    // Validate required fields
    if (!fullName || !email || !phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const emailContent = `
New Demo Request from ${fullName}

Contact Information:
- Name: ${fullName}
- Email: ${email}
- Phone: ${phone}

${competitorSites ? `Competitor Sites: ${competitorSites}\n` : ''}
${notes ? `Notes: ${notes}\n` : ''}

Submitted at: ${new Date().toLocaleString()}
    `.trim();

    const htmlContent = `
            <h2>New Demo Request</h2>
            <p><strong>Name:</strong> ${esc(String(fullName))}</p>
            <p><strong>Email:</strong> ${esc(String(email))}</p>
            <p><strong>Phone:</strong> ${esc(String(phone))}</p>
            ${competitorSites ? `<p><strong>Competitor Sites:</strong> ${esc(String(competitorSites))}</p>` : ''}
            ${notes ? `<p><strong>Notes:</strong> ${esc(String(notes))}</p>` : ''}
            <p><em>Submitted at: ${new Date().toLocaleString()}</em></p>
          `;

    const result = await sendTeamNotification({
      subject: `New Demo Request from ${fullName}`,
      text: emailContent,
      html: htmlContent,
    });

    if (result.ok) {
      console.log('Contact form email sent to:', getTeamNotifyEmails().join(', '));
      return NextResponse.json(
        { success: true, message: 'Form submitted successfully' },
        { status: 200 }
      );
    }

    console.error('Contact form email failed:', result.error);
    console.log('Form submission (email failed):', {
      fullName,
      email,
      phone,
      competitorSites,
      notes,
    });

    return NextResponse.json(
      {
        error: result.error || 'Failed to send email',
        details:
          'Configure RESEND_API_KEY or SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS). Optional: CONTACT_NOTIFY_EMAILS for recipients.',
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('Form submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

