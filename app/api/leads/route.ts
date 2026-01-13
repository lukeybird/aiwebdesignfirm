import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// GET - Get all leads
export async function GET() {
  try {
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
    `;

    // Transform notes from array to proper format
    const formattedLeads = leads.rows.map(lead => ({
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
      notes: Array.isArray(lead.notes) ? lead.notes.map((note: any) => ({
        id: `note-${note.id}`,
        text: note.text,
        createdAt: note.createdAt
      })) : [],
      createdAt: lead.created_at
    }));

    return NextResponse.json({ leads: formattedLeads });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new lead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      listingLink,
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

    if (!listingLink) {
      return NextResponse.json(
        { error: 'Listing link is required' },
        { status: 400 }
      );
    }

    // Create lead
    const result = await sql`
      INSERT INTO leads (
        listing_link, business_phone, business_name, business_email, 
        business_address, owner_first_name, owner_phone, has_logo, has_good_photos
      )
      VALUES (
        ${listingLink}, ${businessPhone || null}, ${businessName || null}, 
        ${businessEmail || null}, ${businessAddress || null}, 
        ${ownerFirstName || null}, ${ownerPhone || null}, 
        ${hasLogo || null}, ${hasGoodPhotos || null}
      )
      RETURNING id, listing_link, business_phone, business_name, business_email, 
                business_address, owner_first_name, owner_phone, has_logo, 
                has_good_photos, created_at
    `;

    const lead = result.rows[0];

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

