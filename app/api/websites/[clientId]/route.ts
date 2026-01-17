import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// GET - Get website for a client
export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const clientId = parseInt(params.clientId);

    const websites = await sql`
      SELECT id, client_id, site_url, site_data, prompt_used, status, created_at, updated_at
      FROM client_websites
      WHERE client_id = ${clientId}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (websites.length === 0) {
      return NextResponse.json(
        { error: 'Website not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ website: websites[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update website
export async function PUT(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
  try {
    const clientId = parseInt(params.clientId);
    const body = await request.json();
    const { siteData, prompt, status, siteUrl } = body;

    const existing = await sql`
      SELECT id FROM client_websites WHERE client_id = ${clientId}
    `;

    if (existing.length > 0) {
      // Update existing
      await sql`
        UPDATE client_websites
        SET site_data = ${JSON.stringify(siteData)}::jsonb,
            site_url = COALESCE(${siteUrl}, site_url),
            prompt_used = COALESCE(${prompt}, prompt_used),
            status = COALESCE(${status}, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ${clientId}
      `;

      // Update business_website if siteUrl provided
      if (siteUrl) {
        await sql`
          UPDATE clients
          SET business_website = ${siteUrl}
          WHERE id = ${clientId}
        `;
      }
    } else {
      // Create new
      await sql`
        INSERT INTO client_websites (client_id, site_url, site_data, prompt_used, status)
        VALUES (${clientId}, ${siteUrl || `/sites/${clientId}`}, ${JSON.stringify(siteData)}::jsonb, ${prompt || ''}, ${status || 'draft'})
      `;

      if (siteUrl) {
        await sql`
          UPDATE clients
          SET business_website = ${siteUrl}
          WHERE id = ${clientId}
        `;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

