import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getWelcomeEmailContent } from '@/lib/email-templates';

// GET - Get all clients (for developer) or single client (for client dashboard)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const email = searchParams.get('email');

    if (clientId) {
      // Get single client by ID (for client dashboard)
      const clients = await sql`
        SELECT id, email, full_name, phone, business_name, business_address, business_website, 
               instruction_1_completed, instruction_2_completed, instruction_3_completed, website_notes, created_at
        FROM clients
        WHERE id = ${clientId}
      `;
      
      return NextResponse.json({ client: clients[0] || null });
    } else if (email) {
      // Get single client by email
      const clients = await sql`
        SELECT id, email, full_name, phone, business_name, business_address, business_website, 
               instruction_1_completed, instruction_2_completed, instruction_3_completed, website_notes, created_at
        FROM clients
        WHERE email = ${email}
      `;
      
      return NextResponse.json({ client: clients[0] || null });
    } else {
      // Get all clients (for developer)
      const clients = await sql`
        SELECT id, email, full_name, phone, business_name, business_address, business_website, 
               instruction_1_completed, instruction_2_completed, instruction_3_completed, website_notes, created_at
        FROM clients
        ORDER BY created_at DESC
      `;
      
      return NextResponse.json({ clients });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new client account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName, phone } = body;

    if (!email || !password || !fullName || !phone) {
      return NextResponse.json(
        { error: 'Email, password, full name, and phone number are required' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if email already exists
    const existing = await sql`
      SELECT id FROM clients WHERE email = ${email}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Create client
    const result = await sql`
      INSERT INTO clients (email, password_hash, full_name, phone)
      VALUES (${email}, ${passwordHash}, ${fullName}, ${phone})
      RETURNING id, email, full_name, created_at
    `;

    // Prepare welcome email content using shared template
    const { emailContent, htmlContent } = getWelcomeEmailContent(fullName, email, password);

    // Send welcome email
    // Try SMTP first (Resend SMTP or ProtonMail), then fall back to Resend API
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      // Use ProtonMail SMTP
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
        const toEmail = email;

        console.log('Sending welcome email via SMTP:', {
          fromEmail,
          toEmail,
          smtpHost: process.env.SMTP_HOST,
        });

        // Send via ProtonMail SMTP
        await transporter.sendMail({
          from: fromEmail,
          to: toEmail,
          subject: 'Welcome to AI Web Design Firm',
          text: emailContent,
          html: htmlContent,
        });

        console.log('Welcome email sent successfully via SMTP to:', email);
        
        // Send notification email to support
        try {
          const notificationContent = `
New Client Signup

A new client has signed up for an account:

Full Name: ${fullName}
Email: ${email}
Phone: ${phone}
Account Created: ${new Date().toLocaleString()}

You can view this client's account in the developer dashboard.
          `;
          
          const notificationHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
            </head>
            <body style="margin: 0; padding: 20px; background: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%); border: 2px solid rgba(34, 211, 238, 0.3); padding: 40px;">
                <h1 style="color: #22d3ee; font-size: 28px; margin-bottom: 30px; text-align: center;">New Client Signup</h1>
                <div style="background: rgba(15, 23, 42, 0.8); border: 2px solid rgba(34, 211, 238, 0.4); padding: 30px; margin-bottom: 20px;">
                  <p style="color: #f3f4f6; font-size: 18px; margin: 15px 0;"><strong style="color: #22d3ee;">Full Name:</strong> ${fullName}</p>
                  <p style="color: #f3f4f6; font-size: 18px; margin: 15px 0;"><strong style="color: #22d3ee;">Email:</strong> ${email}</p>
                  <p style="color: #f3f4f6; font-size: 18px; margin: 15px 0;"><strong style="color: #22d3ee;">Phone:</strong> ${phone}</p>
                  <p style="color: #f3f4f6; font-size: 18px; margin: 15px 0;"><strong style="color: #22d3ee;">Account Created:</strong> ${new Date().toLocaleString()}</p>
                </div>
                <p style="color: #9ca3af; font-size: 14px; text-align: center; margin-top: 30px;">
                  You can view this client's account in the developer dashboard.
                </p>
              </div>
            </body>
            </html>
          `;
          
          await transporter.sendMail({
            from: fromEmail,
            to: 'support@aiwebdesignfirm.com',
            subject: `New Client Signup: ${fullName}`,
            text: notificationContent,
            html: notificationHtml,
          });
          
          console.log('Notification email sent to support@aiwebdesignfirm.com');
        } catch (notificationError: any) {
          console.error('Error sending notification email:', notificationError);
          // Don't fail the signup if notification email fails
        }
      } catch (emailError: any) {
        console.error('Error sending welcome email via SMTP:', emailError);
        console.error('Error details:', {
          message: emailError?.message,
          stack: emailError?.stack,
          email: email,
        });
        // Don't fail signup if email fails
      }
    } else if (process.env.RESEND_API_KEY) {
      // Fall back to Resend API
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        const fromEmail = process.env.FROM_EMAIL || 'support@aiwebdesignfirm.com';
        const toEmail = email;

        // Log configuration (without exposing full API key)
        console.log('Welcome email configuration (Resend API):', {
          hasApiKey: !!process.env.RESEND_API_KEY,
          apiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 10) + '...',
          fromEmail,
          toEmail,
        });

        const emailResult = await resend.emails.send({
          from: fromEmail,
          to: toEmail,
          subject: 'Welcome to AI Web Design Firm',
          text: emailContent,
          html: htmlContent,
        });

        if (emailResult.error) {
          console.error('Resend API error when sending welcome email:', JSON.stringify(emailResult.error, null, 2));
          console.error('Failed to send welcome email to:', email);
        } else {
          console.log('Welcome email sent successfully via Resend to:', email);
          console.log('Email result:', emailResult.data);
          
          // Send notification email to support
          try {
            const notificationContent = `
New Client Signup

A new client has signed up for an account:

Full Name: ${fullName}
Email: ${email}
Phone: ${phone}
Account Created: ${new Date().toLocaleString()}

You can view this client's account in the developer dashboard.
            `;
            
            const notificationHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
              </head>
              <body style="margin: 0; padding: 20px; background: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%); border: 2px solid rgba(34, 211, 238, 0.3); padding: 40px;">
                  <h1 style="color: #22d3ee; font-size: 28px; margin-bottom: 30px; text-align: center;">New Client Signup</h1>
                  <div style="background: rgba(15, 23, 42, 0.8); border: 2px solid rgba(34, 211, 238, 0.4); padding: 30px; margin-bottom: 20px;">
                    <p style="color: #f3f4f6; font-size: 18px; margin: 15px 0;"><strong style="color: #22d3ee;">Full Name:</strong> ${fullName}</p>
                    <p style="color: #f3f4f6; font-size: 18px; margin: 15px 0;"><strong style="color: #22d3ee;">Email:</strong> ${email}</p>
                    <p style="color: #f3f4f6; font-size: 18px; margin: 15px 0;"><strong style="color: #22d3ee;">Phone:</strong> ${phone}</p>
                    <p style="color: #f3f4f6; font-size: 18px; margin: 15px 0;"><strong style="color: #22d3ee;">Account Created:</strong> ${new Date().toLocaleString()}</p>
                  </div>
                  <p style="color: #9ca3af; font-size: 14px; text-align: center; margin-top: 30px;">
                    You can view this client's account in the developer dashboard.
                  </p>
                </div>
              </body>
              </html>
            `;
            
            const notificationResult = await resend.emails.send({
              from: fromEmail,
              to: 'support@aiwebdesignfirm.com',
              subject: `New Client Signup: ${fullName}`,
              text: notificationContent,
              html: notificationHtml,
            });
            
            if (notificationResult.error) {
              console.error('Error sending notification email:', notificationResult.error);
            } else {
              console.log('Notification email sent to support@aiwebdesignfirm.com');
            }
          } catch (notificationError: any) {
            console.error('Error sending notification email:', notificationError);
            // Don't fail the signup if notification email fails
          }
        }
      } catch (emailError: any) {
        console.error('Error sending welcome email via Resend:', emailError);
        console.error('Error details:', {
          message: emailError?.message,
          stack: emailError?.stack,
          email: email,
        });
      }
    } else {
      console.warn('No email service configured (SMTP or RESEND_API_KEY) - welcome email not sent to:', email);
    }

    return NextResponse.json({ 
      success: true, 
      client: result[0] 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update client account
export async function PUT(request: NextRequest) {
  try {
    // Ensure instruction columns exist
    try {
      const { initDatabase } = await import('@/lib/db');
      await initDatabase();
    } catch (initError) {
      console.error('Error initializing database:', initError);
      // Continue anyway - columns might already exist
    }

    const body = await request.json();
    const { 
      email, 
      fullName, 
      phone, 
      businessName, 
      businessAddress, 
      businessWebsite,
      instruction1Completed,
      instruction2Completed,
      instruction3Completed,
      websiteNotes
    } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('Updating client:', {
      email,
      instruction1Completed,
      instruction2Completed,
      instruction3Completed,
      websiteNotes: websiteNotes ? 'provided' : 'not provided'
    });

    // Update only fields that are provided (not undefined)
    // Use conditional SQL similar to leads update
    const result = await sql`
      UPDATE clients
      SET 
        full_name = ${fullName !== undefined ? fullName : sql`full_name`},
        phone = ${phone !== undefined ? phone : sql`phone`},
        business_name = ${businessName !== undefined ? businessName : sql`business_name`},
        business_address = ${businessAddress !== undefined ? businessAddress : sql`business_address`},
        business_website = ${businessWebsite !== undefined ? businessWebsite : sql`business_website`},
        instruction_1_completed = ${instruction1Completed !== undefined ? instruction1Completed : sql`instruction_1_completed`},
        instruction_2_completed = ${instruction2Completed !== undefined ? instruction2Completed : sql`instruction_2_completed`},
        instruction_3_completed = ${instruction3Completed !== undefined ? instruction3Completed : sql`instruction_3_completed`},
        website_notes = ${websiteNotes !== undefined ? websiteNotes : sql`website_notes`}
      WHERE email = ${email}
      RETURNING id, email, full_name, phone, business_name, business_address, business_website,
                 instruction_1_completed, instruction_2_completed, instruction_3_completed, website_notes
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    console.log('Client updated successfully:', result[0].email);

    return NextResponse.json({ 
      success: true, 
      client: result[0] 
    });
  } catch (error: any) {
    console.error('Error updating client:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: error.message || 'Failed to update client' },
      { status: 500 }
    );
  }
}

// DELETE - Delete client account
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Delete client (cascade will delete related files and messages)
    const result = await sql`
      DELETE FROM clients
      WHERE id = ${clientId}
      RETURNING id, email
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Client account deleted successfully',
      deletedClient: result[0]
    });
  } catch (error: any) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete client' },
      { status: 500 }
    );
  }
}
