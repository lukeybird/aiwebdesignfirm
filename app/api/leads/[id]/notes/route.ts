import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// POST - Add note to lead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = id;
    const body = await request.json();
    const { text } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Note text is required' },
        { status: 400 }
      );
    }

    const result = await sql`
      INSERT INTO lead_notes (lead_id, text)
      VALUES (${leadId}, ${text.trim()})
      RETURNING id, text, created_at
    `;

    return NextResponse.json({
      success: true,
      note: {
        id: `note-${result.rows[0].id}`,
        text: result.rows[0].text,
        createdAt: result.rows[0].created_at
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a note
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID is required' },
        { status: 400 }
      );
    }

    // Extract numeric ID from note-{id} format
    const id = noteId.replace('note-', '');

    await sql`DELETE FROM lead_notes WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

