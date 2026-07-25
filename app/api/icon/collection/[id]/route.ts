import { NextRequest, NextResponse } from 'next/server';
import { getIconCollection } from '@/lib/icon-db';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!id || id.length > 80) {
      return NextResponse.json({ error: 'Invalid collection id' }, { status: 400 });
    }
    if (id.startsWith('local-')) {
      return NextResponse.json({ error: 'Local unsaved collection cannot be reloaded' }, { status: 404 });
    }

    const collection = await getIconCollection(id);
    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: collection.id,
      category: collection.category,
      style: collection.style,
      size: collection.size,
      status: collection.status,
      createdAt: collection.createdAt,
      icons: collection.icons.map((icon) => ({
        id: icon.id,
        name: icon.name,
        slug: icon.slug,
        description: icon.prompt,
        status: icon.status,
        sortOrder: icon.sortOrder,
        svg: icon.svg,
        pngBase64: icon.pngBase64,
      })),
    });
  } catch (error) {
    console.error('Collection get error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load collection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
