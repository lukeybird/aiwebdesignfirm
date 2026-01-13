import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { put, list } from '@vercel/blob';

// GET - Get files for a client
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    const files = await sql`
      SELECT id, blob_url, file_name, file_size, file_type, uploaded_at
      FROM client_files
      WHERE client_id = ${clientId}
      ORDER BY uploaded_at DESC
    `;

    return NextResponse.json({ files: files.rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// POST - Upload file for a client
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('clientId') as string;

    if (!file || !clientId) {
      return NextResponse.json(
        { error: 'File and client ID are required' },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
    });

    // Save metadata to database
    const result = await sql`
      INSERT INTO client_files (client_id, blob_url, file_name, file_size, file_type)
      VALUES (${clientId}, ${blob.url}, ${file.name}, ${file.size}, ${file.type})
      RETURNING id, blob_url, file_name, file_size, file_type, uploaded_at
    `;

    return NextResponse.json({ 
      success: true, 
      file: result.rows[0] 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a file
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, clientId } = body;

    if (!fileId || !clientId) {
      return NextResponse.json(
        { error: 'File ID and client ID are required' },
        { status: 400 }
      );
    }

    // Get file info to delete from blob
    const fileResult = await sql`
      SELECT blob_url FROM client_files WHERE id = ${fileId} AND client_id = ${clientId}
    `;

    if (fileResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Delete from database (blob deletion can be handled separately if needed)
    await sql`
      DELETE FROM client_files WHERE id = ${fileId} AND client_id = ${clientId}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Rename a file
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, clientId, newName } = body;

    if (!fileId || !clientId || !newName) {
      return NextResponse.json(
        { error: 'File ID, client ID, and new name are required' },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE client_files
      SET file_name = ${newName}
      WHERE id = ${fileId} AND client_id = ${clientId}
      RETURNING id, file_name
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      file: result.rows[0] 
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

