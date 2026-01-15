import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Helper function to ensure website_link column exists
async function ensureWebsiteLinkColumn() {
  try {
    await sql`ALTER TABLE leads ADD COLUMN website_link TEXT`;
    console.log('✓ Added website_link column to leads table');
  } catch (error: any) {
    if (error.message && (
      error.message.includes('already exists') || 
      error.message.includes('duplicate column') ||
      error.code === '42701'
    )) {
      // Column already exists - that's fine
    } else if (error.message && error.message.includes('does not exist')) {
      throw error;
    } else {
      console.error('Error ensuring website_link column:', error.message);
    }
  }
}

// GET - Get single lead with notes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ensure website_link column exists before proceeding
    await ensureWebsiteLinkColumn();

    const { id } = await params;
    const leadId = id;

    const leadResult = await sql`
      SELECT * FROM leads WHERE id = ${leadId}
    `;

    if (leadResult.length === 0) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    const lead = leadResult[0];

    // Get notes
    const notesResult = await sql`
      SELECT id, text, created_at
      FROM lead_notes
      WHERE lead_id = ${leadId}
      ORDER BY created_at DESC
    `;

    const notes = notesResult.map(note => ({
      id: `note-${note.id}`,
      text: note.text,
      createdAt: note.created_at
    }));

    return NextResponse.json({
      lead: {
        id: lead.id.toString(),
        listingLink: lead.listing_link,
        websiteLink: lead.website_link,
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

