import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

function parseBusinessId(id: string): number | null {
  const n = Number.parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return String(v);
}

async function touchBusiness(businessId: number) {
  await sql`UPDATE business_ideas SET updated_at = CURRENT_TIMESTAMP WHERE id = ${businessId}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = parseBusinessId(id);
    if (businessId == null) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = (await request.json()) as { body?: string };
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!text) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }

    const exists = await sql`SELECT 1 FROM business_ideas WHERE id = ${businessId} LIMIT 1`;
    if (exists.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const rows = await sql`
      INSERT INTO business_idea_notes (business_id, body)
      VALUES (${businessId}, ${text})
      RETURNING id, body, created_at
    `;

    await touchBusiness(businessId);

    const row = rows[0] as { id: number; body: string; created_at: Date | string };
    return NextResponse.json({
      note: {
        id: String(row.id),
        body: row.body,
        createdAt: toIso(row.created_at),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('POST /api/business-ideas/[id]/notes:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = parseBusinessId(id);
    if (businessId == null) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = Number.parseInt(searchParams.get('noteId') ?? '', 10);
    if (!Number.isFinite(noteId) || noteId <= 0) {
      return NextResponse.json({ error: 'noteId query param is required' }, { status: 400 });
    }

    const deleted = await sql`
      DELETE FROM business_idea_notes
      WHERE id = ${noteId} AND business_id = ${businessId}
      RETURNING id
    `;
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    await touchBusiness(businessId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('DELETE /api/business-ideas/[id]/notes:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
