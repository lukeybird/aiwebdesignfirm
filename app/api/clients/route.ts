import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

// GET - Get all clients (for developer)
export async function GET(request: NextRequest) {
  try {
    const clients = await sql`
      SELECT id, email, full_name, phone, business_name, business_address, business_website, created_at
      FROM clients
      ORDER BY created_at DESC
    `;
    
    return NextResponse.json({ clients: clients.rows });
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

    if (existing.rows.length > 0) {
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

    return NextResponse.json({ 
      success: true, 
      client: result.rows[0] 
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

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      client: result.rows[0] 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

