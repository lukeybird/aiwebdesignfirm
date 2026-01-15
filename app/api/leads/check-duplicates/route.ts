import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// POST - Check for duplicate phone numbers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumbers } = body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return NextResponse.json({ duplicateCount: 0 });
    }

    // Filter out empty phone numbers
    const validPhones = phoneNumbers.filter(phone => phone && phone.trim() !== '');

    if (validPhones.length === 0) {
      return NextResponse.json({ duplicateCount: 0 });
    }

    // Check which phone numbers already exist in the database
    const placeholders = validPhones.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      SELECT COUNT(DISTINCT business_phone) as duplicate_count
      FROM leads
      WHERE business_phone IN (${placeholders})
        AND business_phone IS NOT NULL
        AND business_phone != ''
    `;

    const result = await sql`
      SELECT COUNT(DISTINCT business_phone) as duplicate_count
      FROM leads
      WHERE business_phone = ANY(${validPhones})
        AND business_phone IS NOT NULL
        AND business_phone != ''
    `;

    const duplicateCount = result[0]?.duplicate_count || 0;

    return NextResponse.json({ duplicateCount: Number(duplicateCount) });
  } catch (error: any) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json(
      { error: error.message, duplicateCount: 0 },
      { status: 500 }
    );
  }
}

