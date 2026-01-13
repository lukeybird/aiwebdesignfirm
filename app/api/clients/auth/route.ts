import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST - Login client
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Get client from database
    const result = await sql`
      SELECT id, email, password_hash, full_name, phone, business_name, business_address, business_website
      FROM clients
      WHERE email = ${email}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Account not found. Please create an account first.' },
        { status: 404 }
      );
    }

    const client = result[0];

    // Verify password
    const isValid = await bcrypt.compare(password, client.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Return client data (without password hash)
    const { password_hash, ...clientData } = client;

    return NextResponse.json({ 
      success: true, 
      client: clientData 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

