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
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #06b6d4;">Welcome ${fullName},</h2>
              <p>Glad to have your interest, please be sure to follow the following steps in the account.</p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Your username is:</strong> ${email}</p>
                <p style="margin: 5px 0;"><strong>Your password is:</strong> ${password}</p>
              </div>

              <ol style="line-height: 1.8;">
                <li>Upload your best pictures you want to see on your website.</li>
                <li>Upload info pertaining to your website. Pamphlets etc... The more info and menu prices the better.</li>
                <li>Click the ready button in your account.</li>
              </ol>

              <p style="margin-top: 20px; font-weight: bold;">After that you will have a fully custom site up and running in less than 24 hours.</p>
            </div>
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

