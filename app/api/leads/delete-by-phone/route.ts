import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// DELETE - Delete lead by phone number
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Delete lead(s) with matching phone number
    // Note: This will cascade delete notes due to ON DELETE CASCADE
    await sql`
      DELETE FROM leads
      WHERE business_phone = ${phone}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

