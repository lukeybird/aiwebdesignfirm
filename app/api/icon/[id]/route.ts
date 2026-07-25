import { NextRequest, NextResponse } from 'next/server';
import { getGeneratedIcon } from '@/lib/icon-db';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!id || id.length > 64) {
      return NextResponse.json({ error: 'Invalid icon id' }, { status: 400 });
    }

    const icon = await getGeneratedIcon(id);
    if (!icon) {
      return NextResponse.json({ error: 'Icon not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: icon.id,
      prompt: icon.prompt,
      refinedPrompt: icon.refinedPrompt,
      style: icon.style,
      size: icon.size,
      svg: icon.svg,
      pngBase64: icon.pngBase64,
      provider: icon.provider,
      pipeline: icon.pipeline,
      createdAt: icon.createdAt,
    });
  } catch (error) {
    console.error('Icon get error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load icon';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
