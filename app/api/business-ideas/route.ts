import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return String(v);
}

type IdeaRow = { id: number; name: string; created_at: Date | string; updated_at: Date | string };
type StepRow = { id: number; business_id: number; title: string; done: boolean };
type NoteRow = { id: number; business_id: number; body: string; created_at: Date | string };

function assembleBusinesses(ideas: IdeaRow[], steps: StepRow[], notes: NoteRow[]) {
  return ideas.map((bi) => ({
    id: String(bi.id),
    name: bi.name,
    createdAt: toIso(bi.created_at),
    roadmap: steps
      .filter((s) => s.business_id === bi.id)
      .map((s) => ({ id: String(s.id), title: s.title, done: Boolean(s.done) })),
    notes: notes
      .filter((n) => n.business_id === bi.id)
      .map((n) => ({
        id: String(n.id),
        body: n.body,
        createdAt: toIso(n.created_at),
      })),
  }));
}

export async function GET() {
  try {
    const ideas = (await sql`
      SELECT id, name, created_at, updated_at
      FROM business_ideas
      ORDER BY updated_at DESC, id DESC
    `) as unknown as IdeaRow[];

    const ids = ideas.map((i) => i.id);
    if (ids.length === 0) {
      return NextResponse.json({ businesses: [] });
    }

    const steps = (await sql`
      SELECT id, business_id, title, done
      FROM business_idea_roadmap_steps
      WHERE business_id = ANY(${ids})
      ORDER BY id ASC
    `) as unknown as StepRow[];

    const notes = (await sql`
      SELECT id, business_id, body, created_at
      FROM business_idea_notes
      WHERE business_id = ANY(${ids})
      ORDER BY created_at DESC
    `) as unknown as NoteRow[];

    const businesses = assembleBusinesses(ideas, steps, notes);
    return NextResponse.json({ businesses });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('GET /api/business-ideas:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string };
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 500) : '';
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const rows = (await sql`
      INSERT INTO business_ideas (name)
      VALUES (${name})
      RETURNING id, name, created_at, updated_at
    `) as unknown as IdeaRow[];

    const row = rows[0];
    const business = {
      id: String(row.id),
      name: row.name,
      createdAt: toIso(row.created_at),
      roadmap: [] as { id: string; title: string; done: boolean }[],
      notes: [] as { id: string; body: string; createdAt: string }[],
    };

    return NextResponse.json({ business });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('POST /api/business-ideas:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
