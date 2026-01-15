import { NextRequest, NextResponse } from 'next/server';
import { getWelcomeEmailContent } from '@/lib/email-templates';

// POST - Send test welcome email
export async function POST(request: NextRequest) {
  try {
    const testEmail = 'luke@webstarts.com';
    const testFullName = 'Luke Barger';
    const testPassword = 'TestPassword123!';

    // Prepare email content using shared template
    const { emailContent, htmlContent } = getWelcomeEmailContent(testFullName, testEmail, testPassword);

    // Try SMTP first, then fall back to Resend API
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const nodemailer = await import('nodemailer');
        
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const fromEmail = process.env.FROM_EMAIL || 'support@aiwebdesignfirm.com';

        await transporter.sendMail({
          from: fromEmail,
          to: testEmail,
          subject: 'Welcome to AI Web Design Firm',
          text: emailContent,
          html: htmlContent,
        });

        return NextResponse.json({ 
          success: true, 
          message: 'Test email sent successfully via SMTP',
          to: testEmail
        });
      } catch (error: any) {
        console.error('Error sending test email via SMTP:', error);
        return NextResponse.json(
          { error: error.message || 'Failed to send test email via SMTP' },
          { status: 500 }
        );
      }
    } else if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        const fromEmail = process.env.FROM_EMAIL || 'support@aiwebdesignfirm.com';

        const emailResult = await resend.emails.send({
          from: fromEmail,
          to: testEmail,
          subject: 'Welcome to AI Web Design Firm',
          text: emailContent,
          html: htmlContent,
        });

        if (emailResult.error) {
          return NextResponse.json(
            { error: emailResult.error.message || 'Failed to send test email' },
            { status: 500 }
          );
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Test email sent successfully via Resend',
          to: testEmail
        });
      } catch (error: any) {
        console.error('Error sending test email via Resend:', error);
        return NextResponse.json(
          { error: error.message || 'Failed to send test email via Resend' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'No email service configured (SMTP or RESEND_API_KEY)' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to send test email' },
      { status: 500 }
    );
  }
}

