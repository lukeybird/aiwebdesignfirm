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

    // Normalize phone numbers for comparison (remove all non-digit characters except +)
    const normalizePhone = (p: string): string => {
      return p.replace(/[^\d+]/g, '');
    };

    const normalizedInputPhones = validPhones.map(normalizePhone);

    // Get all leads with phone numbers
    const allLeads = await sql`
      SELECT DISTINCT business_phone FROM leads
      WHERE business_phone IS NOT NULL AND business_phone != ''
    `;

    // Count how many normalized phone numbers from input match existing leads
    const existingNormalized = allLeads
      .map(lead => normalizePhone(lead.business_phone))
      .filter(phone => phone !== '');

    const duplicateCount = normalizedInputPhones.filter(phone => 
      existingNormalized.includes(phone)
    ).length;

    return NextResponse.json({ duplicateCount: Number(duplicateCount) });
  } catch (error: any) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json(
      { error: error.message, duplicateCount: 0 },
      { status: 500 }
    );
  }
}

