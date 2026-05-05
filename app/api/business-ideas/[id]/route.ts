import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

function parseBusinessId(id: string): number | null {
  const n = Number.parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = parseBusinessId(id);
    if (businessId == null) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const deleted = await sql`
      DELETE FROM business_ideas WHERE id = ${businessId} RETURNING id
    `;
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('DELETE /api/business-ideas/[id]:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = parseBusinessId(id);
    if (businessId == null) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = (await request.json()) as { name?: string };
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 500) : '';
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const rows = await sql`
      UPDATE business_ideas
      SET name = ${name}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${businessId}
      RETURNING id, name, created_at, updated_at
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, name: rows[0].name });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('PATCH /api/business-ideas/[id]:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
