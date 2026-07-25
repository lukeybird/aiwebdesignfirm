import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { slugifyIconName } from '@/lib/icon-pipeline';

export const runtime = 'nodejs';
export const maxDuration = 30;

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const category = safeText(body.category) || 'icon-set';
    const icons = Array.isArray(body.icons) ? body.icons : [];

    const files: Array<{ filename: string; svg: string }> = [];
    const used = new Set<string>();

    for (const raw of icons) {
      const svg = safeText(raw?.svg);
      if (!svg || !/^<svg\b/i.test(svg)) continue;

      let base =
        safeText(raw?.slug) ||
        slugifyIconName(safeText(raw?.name) || 'icon');
      base = slugifyIconName(base);
      let filename = `${base}.svg`;
      let n = 2;
      while (used.has(filename)) {
        filename = `${base}-${n}.svg`;
        n += 1;
      }
      used.add(filename);
      files.push({ filename, svg });
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No ready SVG icons to zip.' },
        { status: 400 },
      );
    }

    const zip = new AdmZip();
    const folder = slugifyIconName(category) || 'icon-set';
    for (const file of files) {
      zip.addFile(`${folder}/${file.filename}`, Buffer.from(file.svg, 'utf8'));
    }

    const buffer = zip.toBuffer();
    const zipName = `${folder}-icons.zip`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Icon zip error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create zip';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
