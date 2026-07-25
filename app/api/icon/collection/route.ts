import { NextRequest, NextResponse } from 'next/server';
import { createIconCollection, listIconCollections } from '@/lib/icon-db';
import { callClaudeJson, DEFAULT_ICON_SIZE, ICON_STYLES, slugifyIconName } from '@/lib/icon-pipeline';

export const runtime = 'nodejs';
export const maxDuration = 90;

const SET_COUNT = 12;

const STRATEGY_SYSTEM = `You are a senior brand/icon strategist for an agency-quality icon system.

Think in this exact order, then answer with JSON only (no markdown):

1) What does this category need to communicate as an agency / brand system?
2) Which distinct ideas should icons carry so the set feels complete and useful?
3) How can each idea be reduced to the simplest, most beautiful silhouette?
4) What exact visual details must each icon include (and exclude)?

Return ONLY valid JSON:
{
  "agencyBrief": "2-4 sentences: what this category must communicate",
  "styleBible": {
    "look": "one sentence describing the shared visual language",
    "rules": [
      "shared rule 1",
      "shared rule 2",
      "shared rule 3",
      "shared rule 4"
    ]
  },
  "icons": [
    {
      "name": "Baseball Bat",
      "meaning": "Why this icon exists in the set / what idea it communicates",
      "simplicity": "How it stays simple and beautiful",
      "details": "Exact construction: orientation, key shapes, proportions, what to omit, padding feel",
      "description": "One dense production brief the image model will follow for this single icon"
    }
  ]
}

Hard rules:
- Exactly ${SET_COUNT} icons
- Names: short Title Case, unique, filename-friendly (2-4 words)
- Icons must be distinct subjects (not slight variations)
- Every icon must serve communication, not decoration
- Favor bold, readable silhouettes that work at small sizes
- No text/letters inside icons unless the category truly requires it
- description must be concrete and geometric, not poetic`;

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

function buildProductionBrief(input: {
  category: string;
  style: string;
  agencyBrief: string;
  styleBibleLook: string;
  styleRules: string[];
  name: string;
  meaning: string;
  simplicity: string;
  details: string;
  description: string;
}): string {
  const rules = input.styleRules.filter(Boolean).slice(0, 6).map((r) => `- ${r}`).join('\n');
  return [
    `Category: ${input.category}`,
    `Shared style: ${input.style} · ${input.styleBibleLook}`,
    `Agency communication: ${input.agencyBrief}`,
    rules ? `Style bible:\n${rules}` : '',
    `Icon name: ${input.name}`,
    `Communicates: ${input.meaning}`,
    `Keep it simple: ${input.simplicity}`,
    `Exact details: ${input.details}`,
    `Production brief: ${input.description}`,
    'Render as one centered black silhouette icon on pure white. No gray, no shadows, no text, no photorealism.',
  ]
    .filter(Boolean)
    .join('\n');
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
      STRATEGY_SYSTEM,
      [
        `Category / client theme: ${category}`,
        `Preferred rendering style: ${style}`,
        `Produce exactly ${SET_COUNT} icons.`,
        'Follow the thinking order strictly: communicate → ideas → simplicity → exact details → production briefs.',
      ].join('\n'),
      3500,
    );

    const parsed = extractJson(raw) as {
      agencyBrief?: string;
      styleBible?: { look?: string; rules?: unknown };
      icons?: Array<{
        name?: string;
        meaning?: string;
        simplicity?: string;
        details?: string;
        description?: string;
      }>;
    };

    const agencyBrief = safeText(parsed.agencyBrief) || `A clear, professional icon system for ${category}.`;
    const styleBibleLook =
      safeText(parsed.styleBible?.look) ||
      'Bold, geometric black silhouettes with generous padding and consistent weight.';
    const styleRules = Array.isArray(parsed.styleBible?.rules)
      ? parsed.styleBible!.rules!.map((r) => safeText(r)).filter(Boolean)
      : [
          'Consistent optical weight across the set',
          'Centered subject with ~12-18% padding',
          'No tiny details that disappear at small sizes',
          'One idea per icon',
        ];

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

      const meaning = safeText(idea.meaning) || `Represents a core ${category} idea`;
      const simplicity = safeText(idea.simplicity) || 'Reduce to essential silhouette shapes only';
      const details = safeText(idea.details) || `Centered ${name.toLowerCase()} mark, clear proportions`;
      const description =
        safeText(idea.description) || `Minimal black ${name.toLowerCase()} icon on white`;

      return {
        name,
        slug,
        summary: meaning,
        description: buildProductionBrief({
          category,
          style,
          agencyBrief,
          styleBibleLook,
          styleRules,
          name,
          meaning,
          simplicity,
          details,
          description,
        }),
      };
    });

    while (ideas.length < SET_COUNT) {
      const n = ideas.length + 1;
      const name = `${category} Mark ${n}`;
      const meaning = `Supporting ${category} concept ${n}`;
      ideas.push({
        name,
        slug: slugifyIconName(`${category}-mark-${n}`),
        summary: meaning,
        description: buildProductionBrief({
          category,
          style,
          agencyBrief,
          styleBibleLook,
          styleRules,
          name,
          meaning,
          simplicity: 'One bold shape family only',
          details: 'Centered, high-contrast, no ornament',
          description: `A simple ${category} related icon variation ${n}`,
        }),
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
      agencyBrief,
      styleBible: { look: styleBibleLook, rules: styleRules },
      saved: !saveError && !String(collection.id).startsWith('local-'),
      saveError,
      icons: collection.icons.map((icon, index) => ({
        id: icon.id,
        name: icon.name,
        slug: icon.slug,
        summary: ideas[index]?.summary || icon.name,
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
