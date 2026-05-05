import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

function parseBusinessId(id: string): number | null {
  const n = Number.parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
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

    const body = (await request.json()) as { title?: string };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const exists = await sql`SELECT 1 FROM business_ideas WHERE id = ${businessId} LIMIT 1`;
    if (exists.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const rows = await sql`
      INSERT INTO business_idea_roadmap_steps (business_id, title, position)
      VALUES (
        ${businessId},
        ${title},
        (
          SELECT COALESCE(MAX(position), 0) + 1
          FROM business_idea_roadmap_steps
          WHERE business_id = ${businessId}
        )
      )
      RETURNING id, title, done
    `;

    await touchBusiness(businessId);

    const row = rows[0] as { id: number; title: string; done: boolean };
    return NextResponse.json({
      step: { id: String(row.id), title: row.title, done: Boolean(row.done) },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('POST /api/business-ideas/[id]/roadmap:', error);
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

    const body = (await request.json()) as {
      stepId?: string;
      done?: boolean;
      orderedStepIds?: string[];
    };

    if (Array.isArray(body.orderedStepIds)) {
      const parsed = body.orderedStepIds
        .map((v) => Number.parseInt(String(v), 10))
        .filter((v) => Number.isFinite(v) && v > 0);
      if (parsed.length === 0) {
        return NextResponse.json({ error: 'orderedStepIds must contain valid ids' }, { status: 400 });
      }

      const existing = await sql`
        SELECT id
        FROM business_idea_roadmap_steps
        WHERE business_id = ${businessId}
      `;
      const existingIds = new Set(existing.map((r) => Number(r.id)));
      if (parsed.some((id) => !existingIds.has(id)) || parsed.length !== existingIds.size) {
        return NextResponse.json({ error: 'orderedStepIds must include all roadmap steps exactly once' }, { status: 400 });
      }

      for (let i = 0; i < parsed.length; i += 1) {
        await sql`
          UPDATE business_idea_roadmap_steps
          SET position = ${i + 1}
          WHERE id = ${parsed[i]} AND business_id = ${businessId}
        `;
      }

      await touchBusiness(businessId);
      return NextResponse.json({ success: true });
    }

    const stepId = Number.parseInt(String(body.stepId ?? ''), 10);
    if (!Number.isFinite(stepId) || stepId <= 0) {
      return NextResponse.json({ error: 'stepId is required' }, { status: 400 });
    }
    if (typeof body.done !== 'boolean') {
      return NextResponse.json({ error: 'done boolean is required' }, { status: 400 });
    }

    const rows = await sql`
      UPDATE business_idea_roadmap_steps
      SET done = ${body.done}
      WHERE id = ${stepId} AND business_id = ${businessId}
      RETURNING id, title, done
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    await touchBusiness(businessId);

    const row = rows[0] as { id: number; title: string; done: boolean };
    return NextResponse.json({
      step: { id: String(row.id), title: row.title, done: Boolean(row.done) },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('PATCH /api/business-ideas/[id]/roadmap:', error);
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
    const stepId = Number.parseInt(searchParams.get('stepId') ?? '', 10);
    if (!Number.isFinite(stepId) || stepId <= 0) {
      return NextResponse.json({ error: 'stepId query param is required' }, { status: 400 });
    }

    const deleted = await sql`
      DELETE FROM business_idea_roadmap_steps
      WHERE id = ${stepId} AND business_id = ${businessId}
      RETURNING id
    `;
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    await touchBusiness(businessId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('DELETE /api/business-ideas/[id]/roadmap:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
