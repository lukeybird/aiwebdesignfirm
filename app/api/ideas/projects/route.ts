import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';

export async function GET() {
  try {
    const rows = await sql`
      SELECT slug, name, created_at
      FROM idea_projects
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ projects: rows });
  } catch (e: any) {
    if (e?.message?.includes('idea_projects') && e?.message?.includes('does not exist')) {
      await initDatabase();
      return NextResponse.json({ projects: [] });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
