import { NextRequest, NextResponse } from 'next/server';
import { createIconCollection, listIconCollections } from '@/lib/icon-db';
import { callClaudeJson, DEFAULT_ICON_SIZE, ICON_STYLES, slugifyIconName } from '@/lib/icon-pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SET_COUNT = 12;

const PLAN_SYSTEM = `You design icon set concepts for a black-and-white icon generator.

Return ONLY valid JSON (no markdown) with this shape:
{
  "icons": [
    {
      "name": "Baseball Bat",
      "description": "A simple baseball bat icon, angled diagonally"
    }
  ]
}

Rules:
- Exactly ${SET_COUNT} icons
- Each name is short (2-4 words), title case, unique, filename-friendly
- Each description is one clear sentence of what the icon should depict
- All icons must clearly belong to the given category
- Prefer distinct subjects (not 12 slight variations of the same thing)
- No text/letters inside icons unless the category requires it
- Keep shapes simple enough for silhouette / vector tracing`;

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('Could not parse icon plan JSON');
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim() || null;
    const keyword = request.nextUrl.searchParams.get('q')?.trim() || null;
    const collections = await listIconCollections({ sessionId, limit: 40, keyword });
    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Collection list error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list collections';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const category = safeText(body.category);
    const style = safeText(body.style).toLowerCase() || 'filled';
    const size = DEFAULT_ICON_SIZE;
    const sessionId = safeText(body.sessionId).slice(0, 128) || null;

    if (!category) {
      return NextResponse.json({ error: 'Enter a category, like baseball.' }, { status: 400 });
    }
    if (category.length > 80) {
      return NextResponse.json({ error: 'Category is too long.' }, { status: 400 });
    }
    if (!(ICON_STYLES as readonly string[]).includes(style)) {
      return NextResponse.json({ error: 'Invalid style.' }, { status: 400 });
    }

    const raw = await callClaudeJson(
      PLAN_SYSTEM,
      `Category: ${category}\nStyle: ${style}\nCreate exactly ${SET_COUNT} icon ideas.`,
      1600,
    );
    const parsed = extractJson(raw) as { icons?: Array<{ name?: string; description?: string }> };
    const ideasRaw = Array.isArray(parsed?.icons) ? parsed.icons : [];
    if (ideasRaw.length < 8) {
      return NextResponse.json({ error: 'Icon planner returned too few ideas. Try again.' }, { status: 502 });
    }

    const usedSlugs = new Set<string>();
    const ideas = ideasRaw.slice(0, SET_COUNT).map((idea, index) => {
      const name = safeText(idea.name) || `Icon ${index + 1}`;
      let slug = slugifyIconName(name);
      if (usedSlugs.has(slug)) slug = `${slug}-${index + 1}`;
      usedSlugs.add(slug);
      return {
        name,
        slug,
        description: safeText(idea.description) || `${category} icon: ${name}`,
      };
    });

    // Pad to 12 if model returned 8-11
    while (ideas.length < SET_COUNT) {
      const n = ideas.length + 1;
      ideas.push({
        name: `${category} Mark ${n}`,
        slug: slugifyIconName(`${category}-mark-${n}`),
        description: `A simple ${category} related icon variation ${n}`,
      });
    }

    let collection = null as Awaited<ReturnType<typeof createIconCollection>> | null;
    let saveError: string | null = null;
    try {
      collection = await createIconCollection({
        sessionId,
        category,
        style,
        size,
        ideas,
      });
    } catch (err) {
      console.error('Collection save failed:', err);
      saveError = err instanceof Error ? err.message : 'Failed to save collection';
      // Still return planned ideas so generation can proceed client-side without DB
      collection = {
        id: `local-${Date.now()}`,
        sessionId,
        category,
        style,
        size,
        status: 'planned',
        createdAt: new Date().toISOString(),
        icons: ideas.map((idea, index) => ({
          id: `local-${index}-${Date.now()}`,
          sessionId,
          collectionId: null,
          name: idea.name,
          slug: idea.slug,
          sortOrder: index,
          status: 'pending',
          prompt: idea.description,
          refinedPrompt: null,
          style,
          size,
          svg: null,
          pngBase64: null,
          provider: null,
          pipeline: null,
          createdAt: new Date().toISOString(),
        })),
      };
    }

    return NextResponse.json({
      collectionId: collection.id,
      category: collection.category,
      style: collection.style,
      size: collection.size,
      saved: !saveError && !String(collection.id).startsWith('local-'),
      saveError,
      icons: collection.icons.map((icon) => ({
        id: icon.id,
        name: icon.name,
        slug: icon.slug,
        description: icon.prompt,
        status: icon.status || 'pending',
        sortOrder: icon.sortOrder,
      })),
    });
  } catch (error) {
    console.error('Collection plan error:', error);
    const message = error instanceof Error ? error.message : 'Failed to plan icon set';
    const status = message.includes('CLAUDE_API_KEY') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
