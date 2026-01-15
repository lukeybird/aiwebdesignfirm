import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET - Get all clients (for developer)
export async function GET(request: NextRequest) {
  try {
    const clients = await sql`
      SELECT id, email, full_name, phone, business_name, business_address, business_website, created_at
      FROM clients
      ORDER BY created_at DESC
    `;
    
    return NextResponse.json({ clients });
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
    const { email, password, fullName } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
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
      INSERT INTO clients (email, password_hash, full_name)
      VALUES (${email}, ${passwordHash}, ${fullName})
      RETURNING id, email, full_name, created_at
    `;

    // Send welcome email
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
        const toEmail = email;

        const emailContent = `
Welcome ${fullName},

Glad to have your interest, please be sure to follow the following steps in the account.

Your username is: ${email}
Your password is: ${password}

1. Upload your best pictures you want to see on your website.

2. Upload info pertaining to your website. Pamphlets etc... The more info and menu prices the better.

3. Click the ready button in your account.

After that you will have a fully custom site up and running in less than 24 hours.
        `;

        await resend.emails.send({
          from: fromEmail,
          to: toEmail,
          subject: 'Welcome to AI Web Design Firm',
          text: emailContent,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(to bottom, #000000, #111827, #000000); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 12px; overflow: hidden;">
                      <!-- Header -->
                      <tr>
                        <td style="padding: 40px 30px; text-align: center; border-bottom: 1px solid rgba(6, 182, 212, 0.2);">
                          <h1 style="margin: 0; font-size: 32px; font-weight: 900; background: linear-gradient(to right, #22d3ee, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -0.5px;">
                            Welcome ${fullName},
                          </h1>
                        </td>
                      </tr>
                      
                      <!-- Content -->
                      <tr>
                        <td style="padding: 30px;">
                          <p style="margin: 0 0 25px 0; color: #d1d5db; font-size: 16px; line-height: 1.6;">
                            Glad to have your interest, please be sure to follow the following steps in the account.
                          </p>
                          
                          <!-- Credentials Box -->
                          <div style="background-color: #1f2937; border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 8px; padding: 20px; margin: 25px 0;">
                            <p style="margin: 8px 0; color: #22d3ee; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your Account Details</p>
                            <p style="margin: 12px 0 8px 0; color: #e5e7eb; font-size: 15px;"><strong style="color: #9ca3af;">Username:</strong> <span style="color: #f3f4f6;">${email}</span></p>
                            <p style="margin: 8px 0; color: #e5e7eb; font-size: 15px;"><strong style="color: #9ca3af;">Password:</strong> <span style="color: #f3f4f6;">${password}</span></p>
                          </div>

                          <!-- Steps -->
                          <div style="margin: 30px 0;">
                            <ol style="margin: 0; padding-left: 20px; color: #d1d5db; font-size: 16px; line-height: 2;">
                              <li style="margin-bottom: 12px;">Upload your best pictures you want to see on your website.</li>
                              <li style="margin-bottom: 12px;">Upload info pertaining to your website. Pamphlets etc... The more info and menu prices the better.</li>
                              <li style="margin-bottom: 12px;">Click the ready button in your account.</li>
                            </ol>
                          </div>

                          <!-- Final Message -->
                          <div style="background: linear-gradient(to right, rgba(6, 182, 212, 0.1), rgba(59, 130, 246, 0.1)); border-left: 3px solid #22d3ee; padding: 20px; margin: 30px 0; border-radius: 6px;">
                            <p style="margin: 0; color: #f3f4f6; font-size: 17px; font-weight: 700; line-height: 1.5;">
                              After that you will have a fully custom site up and running in less than 24 hours.
                            </p>
                          </div>
                        </td>
                      </tr>
                      
                      <!-- Footer -->
                      <tr>
                        <td style="padding: 30px; text-align: center; border-top: 1px solid rgba(6, 182, 212, 0.2);">
                          <p style="margin: 0; color: #6b7280; font-size: 14px;">
                            AI Web Design Firm
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        });

        console.log('Welcome email sent successfully to:', email);
      } catch (emailError: any) {
        // Log error but don't fail the signup if email fails
        console.error('Failed to send welcome email:', emailError);
      }
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
    const body = await request.json();
    const { email, fullName, phone, businessName, businessAddress, businessWebsite } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE clients
      SET 
        full_name = COALESCE(${fullName}, full_name),
        phone = COALESCE(${phone}, phone),
        business_name = COALESCE(${businessName}, business_name),
        business_address = COALESCE(${businessAddress}, business_address),
        business_website = COALESCE(${businessWebsite}, business_website)
      WHERE email = ${email}
      RETURNING id, email, full_name, phone, business_name, business_address, business_website
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
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

