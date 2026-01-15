import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET - Get all leads with pagination
export async function GET(request: NextRequest) {
  try {
    // Ensure website_link column exists
    await ensureWebsiteLinkColumn();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await sql`SELECT COUNT(*) as total FROM leads`;
    const total = Number(countResult[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    // Get paginated leads
    const leads = await sql`
      SELECT 
        l.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ln.id,
              'text', ln.text,
              'createdAt', ln.created_at
            )
            ORDER BY ln.created_at DESC
          ) FILTER (WHERE ln.id IS NOT NULL),
          '[]'::json
        ) as notes
      FROM leads l
      LEFT JOIN lead_notes ln ON l.id = ln.lead_id
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Transform notes from array to proper format
    // NOTE: Data appears to be swapped in database - website_link contains Google Maps, listing_link contains website
    const formattedLeads = leads.map(lead => ({
      id: lead.id.toString(),
      listingLink: lead.website_link || lead.listing_link, // Swap: website_link contains Google Maps
      websiteLink: lead.listing_link || lead.website_link || null, // Swap: listing_link contains website
      businessPhone: lead.business_phone,
      businessName: lead.business_name,
      businessEmail: lead.business_email,
      businessAddress: lead.business_address,
      ownerFirstName: lead.owner_first_name,
      ownerPhone: lead.owner_phone,
      hasLogo: lead.has_logo,
      hasGoodPhotos: lead.has_good_photos,
      notes: Array.isArray(lead.notes) ? lead.notes.map((note: any) => ({
        id: `note-${note.id}`,
        text: note.text,
        createdAt: note.createdAt
      })) : [],
      createdAt: lead.created_at
    }));

    return NextResponse.json({ 
      leads: formattedLeads,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Helper function to ensure website_link column exists
async function ensureWebsiteLinkColumn() {
  try {
    // Try to add the column - PostgreSQL will error if it already exists, which is fine
    await sql`ALTER TABLE leads ADD COLUMN website_link TEXT`;
    console.log('✓ Added website_link column to leads table');
  } catch (error: any) {
    // If column already exists, that's fine
    if (error.message && (
      error.message.includes('already exists') || 
      error.message.includes('duplicate column') ||
      error.code === '42701' // PostgreSQL duplicate column error code
    )) {
      // Column already exists - that's what we want
    } else if (error.message && error.message.includes('does not exist')) {
      // Table doesn't exist - that's a bigger problem, but initDatabase should handle it
      throw error;
    } else {
      // Some other error - log it but don't fail
      console.error('Error ensuring website_link column:', error.message);
    }
  }
}

// POST - Create new lead
export async function POST(request: NextRequest) {
  try {
    // Ensure website_link column exists before proceeding
    await ensureWebsiteLinkColumn();

    const body = await request.json();
    const {
      listingLink,
      websiteLink,
      businessPhone,
      businessName,
      businessEmail,
      businessAddress,
      ownerFirstName,
      ownerPhone,
      hasLogo,
      hasGoodPhotos,
      customNotes
    } = body;

    // Allow listing link to be a placeholder if no Google Maps link is available
    if (!listingLink || listingLink.trim() === '') {
      return NextResponse.json(
        { error: 'Listing link is required' },
        { status: 400 }
      );
    }
    
    // If listing link is a placeholder, store it as-is (allows tracking leads without Google Maps links)
    const finalListingLink = listingLink === 'No Google Maps listing available' 
      ? listingLink 
      : listingLink;

    // Create lead
    const result = await sql`
      INSERT INTO leads (
        listing_link, website_link, business_phone, business_name, business_email, 
        business_address, owner_first_name, owner_phone, has_logo, has_good_photos
      )
      VALUES (
        ${finalListingLink}, ${websiteLink || null}, ${businessPhone || null}, ${businessName || null}, 
        ${businessEmail || null}, ${businessAddress || null}, 
        ${ownerFirstName || null}, ${ownerPhone || null}, 
        ${hasLogo || null}, ${hasGoodPhotos || null}
      )
      RETURNING id, listing_link, website_link, business_phone, business_name, business_email, 
                business_address, owner_first_name, owner_phone, has_logo, 
                has_good_photos, created_at
    `;

    const lead = result[0];

    // If there's a legacy customNotes, create a note
    if (customNotes) {
      await sql`
        INSERT INTO lead_notes (lead_id, text)
        VALUES (${lead.id}, ${customNotes})
      `;
    }

    return NextResponse.json({ 
      success: true, 
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
        notes: customNotes ? [{
          id: `note-${Date.now()}`,
          text: customNotes,
          createdAt: new Date().toISOString()
        }] : [],
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

// DELETE - Delete a lead
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Delete lead (cascade will delete notes)
    await sql`DELETE FROM leads WHERE id = ${leadId}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

