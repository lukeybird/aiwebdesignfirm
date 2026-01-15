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
        listingLink: lead.website_link || lead.listing_link, // Swap: website_link contains Google Maps
        websiteLink: lead.listing_link || lead.website_link, // Swap: listing_link contains website
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

// PUT - Update lead
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ensure website_link column exists before proceeding
    await ensureWebsiteLinkColumn();

    const { id } = await params;
    const leadId = id;
    const body = await request.json();

    // Convert empty strings to null for clearing fields
    // Only update fields that are explicitly provided in the body
    const listingLinkValue = 'listingLink' in body ? (body.listingLink === '' ? null : body.listingLink) : undefined;
    const websiteLinkValue = 'websiteLink' in body ? (body.websiteLink === '' ? null : body.websiteLink) : undefined;
    const businessPhoneValue = 'businessPhone' in body ? (body.businessPhone === '' ? null : body.businessPhone) : undefined;
    const businessNameValue = 'businessName' in body ? (body.businessName === '' ? null : body.businessName) : undefined;
    const businessEmailValue = 'businessEmail' in body ? (body.businessEmail === '' ? null : body.businessEmail) : undefined;
    const businessAddressValue = 'businessAddress' in body ? (body.businessAddress === '' ? null : body.businessAddress) : undefined;
    const ownerFirstNameValue = 'ownerFirstName' in body ? (body.ownerFirstName === '' ? null : body.ownerFirstName) : undefined;
    const ownerPhoneValue = 'ownerPhone' in body ? (body.ownerPhone === '' ? null : body.ownerPhone) : undefined;
    const hasLogoValue = 'hasLogo' in body ? (body.hasLogo === '' || body.hasLogo === null ? null : body.hasLogo) : undefined;
    const hasGoodPhotosValue = 'hasGoodPhotos' in body ? (body.hasGoodPhotos === '' || body.hasGoodPhotos === null ? null : body.hasGoodPhotos) : undefined;

    // Update lead - use provided values or null to clear, undefined to keep existing
    const result = await sql`
      UPDATE leads
      SET 
        listing_link = ${listingLinkValue !== undefined ? listingLinkValue : sql`listing_link`},
        website_link = ${websiteLinkValue !== undefined ? websiteLinkValue : sql`website_link`},
        business_phone = ${businessPhoneValue !== undefined ? businessPhoneValue : sql`business_phone`},
        business_name = ${businessNameValue !== undefined ? businessNameValue : sql`business_name`},
        business_email = ${businessEmailValue !== undefined ? businessEmailValue : sql`business_email`},
        business_address = ${businessAddressValue !== undefined ? businessAddressValue : sql`business_address`},
        owner_first_name = ${ownerFirstNameValue !== undefined ? ownerFirstNameValue : sql`owner_first_name`},
        owner_phone = ${ownerPhoneValue !== undefined ? ownerPhoneValue : sql`owner_phone`},
        has_logo = ${hasLogoValue !== undefined ? hasLogoValue : sql`has_logo`},
        has_good_photos = ${hasGoodPhotosValue !== undefined ? hasGoodPhotosValue : sql`has_good_photos`}
      WHERE id = ${leadId}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    const updatedLead = result[0];

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
        id: updatedLead.id.toString(),
        listingLink: updatedLead.website_link || updatedLead.listing_link,
        websiteLink: updatedLead.listing_link || updatedLead.website_link,
        businessPhone: updatedLead.business_phone,
        businessName: updatedLead.business_name,
        businessEmail: updatedLead.business_email,
        businessAddress: updatedLead.business_address,
        ownerFirstName: updatedLead.owner_first_name,
        ownerPhone: updatedLead.owner_phone,
        hasLogo: updatedLead.has_logo,
        hasGoodPhotos: updatedLead.has_good_photos,
        notes,
        createdAt: updatedLead.created_at
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

