import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// DELETE - Delete lead by phone number
// Normalizes phone numbers for comparison (removes formatting)
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

    // Normalize the input phone number (remove all non-digit characters except +)
    const normalizePhone = (p: string): string => {
      return p.replace(/[^\d+]/g, '');
    };

    const normalizedInput = normalizePhone(phone);

    // Get all leads and check for matches with normalized phone numbers
    const allLeads = await sql`
      SELECT id, business_phone FROM leads
      WHERE business_phone IS NOT NULL AND business_phone != ''
    `;

    // Find leads with matching normalized phone numbers
    const matchingIds = allLeads
      .filter(lead => lead.business_phone && normalizePhone(lead.business_phone) === normalizedInput)
      .map(lead => lead.id);

    if (matchingIds.length === 0) {
      // No matches found, but that's okay - return success
      return NextResponse.json({ success: true, deleted: 0 });
    }

    // Delete all matching leads
    // Note: This will cascade delete notes due to ON DELETE CASCADE
    await sql`
      DELETE FROM leads
      WHERE id = ANY(${matchingIds})
    `;

    return NextResponse.json({ success: true, deleted: matchingIds.length });
  } catch (error: any) {
    console.error('Error deleting by phone:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

