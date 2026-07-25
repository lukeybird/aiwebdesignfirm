import { NextRequest, NextResponse } from 'next/server';
import { listGeneratedIcons } from '@/lib/icon-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim() || null;
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 24);
    const icons = await listGeneratedIcons({
      sessionId,
      limit: Number.isFinite(limitRaw) ? limitRaw : 24,
    });

    return NextResponse.json({
      icons: icons.map((icon) => ({
        id: icon.id,
        name: icon.name,
        slug: icon.slug,
        prompt: icon.prompt,
        style: icon.style,
        size: icon.size,
        svg: icon.svg,
        pngBase64: icon.pngBase64,
        createdAt: icon.createdAt,
      })),
    });
  } catch (error) {
    console.error('Icon list error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load icons';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
