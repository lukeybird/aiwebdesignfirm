import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';
import bcrypt from 'bcryptjs';

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

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const emailNorm = String(email).trim().toLowerCase();
    const hash = await bcrypt.hash(password, 10);

    try {
      const result = await sql`
        INSERT INTO marine_users (email, password_hash, full_name)
        VALUES (${emailNorm}, ${hash}, ${String(fullName).trim()})
        RETURNING id, email, full_name, subscription_status, subscription_expires_at, created_at
      `;
      const user = result[0] as Record<string, unknown>;
      return NextResponse.json({ success: true, user });
    } catch (dbError: any) {
      if (dbError?.message?.includes('marine_users') && dbError?.message?.includes('does not exist')) {
        await initDatabase();
        const result = await sql`
          INSERT INTO marine_users (email, password_hash, full_name)
          VALUES (${emailNorm}, ${hash}, ${String(fullName).trim()})
          RETURNING id, email, full_name, subscription_status, subscription_expires_at, created_at
        `;
        return NextResponse.json({ success: true, user: result[0] });
      }
      if (dbError?.code === '23505') {
        return NextResponse.json(
          { error: 'An account with this email already exists.' },
          { status: 409 }
        );
      }
      throw dbError;
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Sign up failed' },
      { status: 500 }
    );
  }
}
