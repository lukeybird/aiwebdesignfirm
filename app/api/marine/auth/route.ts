import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST - Login
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

    const result = await sql`
      SELECT id, email, password_hash, full_name, subscription_status, subscription_expires_at
      FROM marine_users
      WHERE email = ${String(email).trim().toLowerCase()}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Account not found. Sign up first.' },
        { status: 404 }
      );
    }

    const user = result[0] as {
      id: number;
      email: string;
      password_hash: string;
      full_name: string;
      subscription_status: string;
      subscription_expires_at: string | null;
    };

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    const { password_hash, ...userData } = user;
    return NextResponse.json({ success: true, user: userData });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
