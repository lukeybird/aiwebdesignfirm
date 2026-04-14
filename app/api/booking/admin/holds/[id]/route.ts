import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { initBookingTables } from '@/lib/booking/init-tables';
import { assertBookingAdmin } from '@/lib/booking/require-dev-auth';

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = assertBookingAdmin(request);
  if (denied) return denied;
  try {
    await initBookingTables(sql);
    const { id: idRaw } = await ctx.params;
    const id = parseInt(idRaw, 10);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const del = await sql`
      DELETE FROM booking_slot_holds WHERE id = ${id} RETURNING id
    `;
    if (del.length === 0) {
      return NextResponse.json({ error: 'Hold not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('booking/admin/holds DELETE:', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
