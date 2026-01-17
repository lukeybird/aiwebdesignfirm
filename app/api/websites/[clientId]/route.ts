import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Ensure conversation_history column exists
async function ensureConversationHistoryColumn() {
  try {
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'client_websites' AND column_name = 'conversation_history'
    `;
    
    if (columnCheck.length === 0) {
      await sql.unsafe(`ALTER TABLE client_websites ADD COLUMN conversation_history JSONB`);
      console.log('✓ Added conversation_history column to client_websites table');
    }
  } catch (error: any) {
    console.error('Error ensuring conversation_history column:', error);
  }
}

// GET - Get website for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // Ensure column exists before proceeding
    await ensureConversationHistoryColumn();

    const { clientId: clientIdParam } = await params;
    const clientId = parseInt(clientIdParam);

    const websites = await sql`
      SELECT id, client_id, site_url, site_data, prompt_used, status, conversation_history, created_at, updated_at
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
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    // Ensure column exists before proceeding
    await ensureConversationHistoryColumn();

    const { clientId: clientIdParam } = await params;
    const clientId = parseInt(clientIdParam);
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

