import { NextRequest, NextResponse } from 'next/server';

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

    // Option 1: Using Resend (Recommended - Modern & Easy)
    // You'll need to install: npm install resend
    // Get API key from: https://resend.com/api-keys
    
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
      const toEmail = process.env.TO_EMAIL || 'support@aiwebdesignfirm.com';

      // Log configuration (without exposing full API key)
      console.log('Resend configuration:', {
        hasApiKey: !!process.env.RESEND_API_KEY,
        apiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 10) + '...',
        fromEmail,
        toEmail,
      });

      const emailContent = `
        New Demo Request from ${fullName}
        
        Contact Information:
        - Name: ${fullName}
        - Email: ${email}
        - Phone: ${phone}
        
        ${competitorSites ? `Competitor Sites: ${competitorSites}\n` : ''}
        ${notes ? `Notes: ${notes}\n` : ''}
        
        Submitted at: ${new Date().toLocaleString()}
      `;

      try {
        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: toEmail,
          subject: `New Demo Request from ${fullName}`,
          text: emailContent,
          html: `
            <h2>New Demo Request</h2>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            ${competitorSites ? `<p><strong>Competitor Sites:</strong> ${competitorSites}</p>` : ''}
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            <p><em>Submitted at: ${new Date().toLocaleString()}</em></p>
          `,
        });

        if (error) {
          console.error('Resend API error:', JSON.stringify(error, null, 2));
          
          // Provide more specific error messages
          let errorMessage = 'Failed to send email';
          if (error.message) {
            errorMessage = error.message;
          } else if (typeof error === 'object' && error !== null) {
            errorMessage = JSON.stringify(error);
          }
          
          return NextResponse.json(
            { 
              error: errorMessage,
              details: 'Check Vercel function logs for more details. Common issues: Invalid API key, unverified domain, or incorrect email format.'
            },
            { status: 500 }
          );
        }

        console.log('Email sent successfully:', data);
        return NextResponse.json(
          { success: true, message: 'Form submitted successfully' },
          { status: 200 }
        );
      } catch (resendError: any) {
        console.error('Resend send error:', resendError);
        return NextResponse.json(
          { 
            error: resendError?.message || 'Failed to send email',
            details: 'Check that RESEND_API_KEY is set correctly in Vercel environment variables.'
          },
          { status: 500 }
        );
      }
    }

    // Option 2: Using Nodemailer with SMTP (Gmail, SendGrid, etc.)
    // Uncomment and configure if you prefer this approach
    /*
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.TO_EMAIL || 'your-email@example.com',
        subject: `New Demo Request from ${fullName}`,
        text: emailContent,
        html: htmlContent,
      });

      return NextResponse.json(
        { success: true, message: 'Form submitted successfully' },
        { status: 200 }
      );
    }
    */

    // If no email service is configured
    console.error('No email service configured! RESEND_API_KEY is missing.');
    console.log('Form submission (no email service configured):', {
      fullName,
      email,
      phone,
      competitorSites,
      notes,
    });

    return NextResponse.json(
      { 
        error: 'Email service not configured',
        message: 'RESEND_API_KEY environment variable is missing. Please add it to Vercel environment variables.',
        details: 'Go to Vercel Dashboard → Settings → Environment Variables and add RESEND_API_KEY'
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

