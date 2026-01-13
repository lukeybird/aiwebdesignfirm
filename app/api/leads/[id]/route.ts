import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET - Get single lead with notes
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = params.id;

    const leadResult = await sql`
      SELECT * FROM leads WHERE id = ${leadId}
    `;

    if (leadResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    const lead = leadResult.rows[0];

    // Get notes
    const notesResult = await sql`
      SELECT id, text, created_at
      FROM lead_notes
      WHERE lead_id = ${leadId}
      ORDER BY created_at DESC
    `;

    const notes = notesResult.rows.map(note => ({
      id: `note-${note.id}`,
      text: note.text,
      createdAt: note.created_at
    }));

    return NextResponse.json({
      lead: {
        id: lead.id.toString(),
        listingLink: lead.listing_link,
        businessPhone: lead.business_phone,
        businessName: lead.business_name,
        businessEmail: lead.business_email,
        businessAddress: lead.business_address,
        ownerFirstName: lead.owner_first_name,
        ownerPhone: lead.owner_phone,
        hasLogo: lead.has_logo,
        hasGoodPhotos: lead.has_good_photos,
        notes,
        createdAt: lead.created_at
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

