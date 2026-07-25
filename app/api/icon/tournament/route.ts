import { NextRequest, NextResponse } from 'next/server';
import { callClaudeJson, slugifyIconName } from '@/lib/icon-pipeline';
import { extractJsonObject, type TournamentIdea } from '@/lib/icon-tournament';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 60;

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function ok(data: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...data });
}

function fail(stage: string, message: string, status = 500, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      ok: false,
      stage,
      error: message,
      ...extra,
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  let action = 'unknown';
  try {
    const body = await request.json();
    action = safeText(body.action) || 'unknown';
    const category = safeText(body.category);

    if (action === 'ideas') {
      if (!category) return fail('ideas', 'Enter a business category first.', 400);
      if (category.length > 100) return fail('ideas', 'Category is too long (max 100 chars).', 400);

      const raw = await callClaudeJson(
        `You are an expert product designer listing website icons businesses actually need.

Return ONLY valid JSON:
{
  "icons": [
    { "title": "Short Icon Name", "summary": "One short line why this icon is commonly needed" }
  ]
}

Rules:
- Exactly 96 icons
- Titles are 2-4 words, title case, unique
- Focus on common website / brand / product UI icons for that business category
- Broad coverage: navigation, trust, contact, services, commerce, support, social proof, etc.
- No duplicates or near-duplicates
- No obscure niche icons unless truly core to the category`,
        `Business category: ${category}

Question to answer with the list:
What are the most common general types of icons needed for a business involving this category?`,
        4500,
      );

      const parsed = extractJsonObject(raw) as { icons?: Array<{ title?: string; summary?: string }> };
      const iconsRaw = Array.isArray(parsed.icons) ? parsed.icons : [];
      if (iconsRaw.length < 80) {
        return fail(
          'ideas',
          `Expected about 96 icon ideas, but Claude returned ${iconsRaw.length}. Try again.`,
          502,
        );
      }

      const used = new Set<string>();
      const icons: TournamentIdea[] = iconsRaw.slice(0, 96).map((item, index) => {
        let title = safeText(item.title) || `Icon ${index + 1}`;
        let base = slugifyIconName(title);
        if (used.has(base)) base = `${base}-${index + 1}`;
        used.add(base);
        return {
          id: randomUUID(),
          title,
          summary: safeText(item.summary) || `Common ${category} website icon`,
        };
      });

      while (icons.length < 96) {
        const n = icons.length + 1;
        icons.push({
          id: randomUUID(),
          title: `${category} Icon ${n}`,
          summary: `Additional common icon type for ${category} websites`,
        });
      }

      return ok({
        stage: 'ideas',
        message: `Found ${icons.length} common icon types for “${category}”.`,
        icons,
      });
    }

    if (action === 'match') {
      const criterion = safeText(body.criterion) as 'usefulness' | 'idea' | 'simplicity';
      const a = body.a as TournamentIdea | undefined;
      const b = body.b as TournamentIdea | undefined;
      if (!a?.title || !b?.title) return fail('match', 'Both competitors are required for a match.', 400);
      if (!['usefulness', 'idea', 'simplicity'].includes(criterion)) {
        return fail('match', 'Invalid match criterion.', 400);
      }

      const prompts = {
        usefulness: `Pick which icon type is more useful / more commonly recognized for a real website in this business category.
Prefer clarity, familiarity, and practical website use over novelty.`,
        idea: `Pick which concept is the stronger icon idea overall: clearer meaning, more distinctive, and more useful on a website.`,
        simplicity: `Pick which icon concept would be simplest to understand as a minimal black-and-white vector icon.
Prefer the one a stranger could recognize fastest at small size.`,
      } as const;

      const raw = await callClaudeJson(
        `You are judging an icon tournament match.

Return ONLY JSON:
{ "winner": "a" | "b", "reason": "one short sentence" }

Never pick both. Never refuse. Always choose a winner.`,
        `Category: ${category || 'general'}
Criterion: ${criterion}
${prompts[criterion]}

Option A:
Title: ${a.title}
Summary: ${a.summary || ''}
Description: ${a.description || ''}
Look: ${a.look || ''}

Option B:
Title: ${b.title}
Summary: ${b.summary || ''}
Description: ${b.description || ''}
Look: ${b.look || ''}`,
        200,
      );

      const parsed = extractJsonObject(raw) as { winner?: string; reason?: string };
      const winnerKey = safeText(parsed.winner).toLowerCase();
      if (winnerKey !== 'a' && winnerKey !== 'b') {
        return fail('match', 'Claude did not return a valid winner (expected "a" or "b").', 502, {
          rawPreview: raw.slice(0, 240),
        });
      }
      const winner = winnerKey === 'a' ? a : b;
      const loser = winnerKey === 'a' ? b : a;
      return ok({
        stage: 'match',
        criterion,
        winner,
        loser,
        reason: safeText(parsed.reason) || 'Selected as the stronger option for this round.',
        message: `Winner: ${winner.title}`,
      });
    }

    if (action === 'enrich') {
      const idea = body.idea as TournamentIdea | undefined;
      if (!idea?.title) return fail('enrich', 'Missing idea to enrich.', 400);

      const raw = await callClaudeJson(
        `You deepen one website icon concept.

Return ONLY JSON:
{
  "title": "Keep or lightly improve the short title",
  "summary": "One line on why it matters",
  "description": "2-3 sentences describing the best version of this icon idea for a website"
}`,
        `Category: ${category || 'general'}
Current title: ${idea.title}
Current summary: ${idea.summary}
Make this the best possible icon idea in this category — clear, useful, and distinctive.`,
        350,
      );

      const parsed = extractJsonObject(raw) as {
        title?: string;
        summary?: string;
        description?: string;
      };
      const enriched: TournamentIdea = {
        ...idea,
        title: safeText(parsed.title) || idea.title,
        summary: safeText(parsed.summary) || idea.summary,
        description:
          safeText(parsed.description) ||
          `${idea.summary}. A clear, commonly understood website icon for ${category}.`,
      };
      return ok({
        stage: 'enrich',
        idea: enriched,
        message: `Enriched: ${enriched.title}`,
      });
    }

    if (action === 'visualize') {
      const idea = body.idea as TournamentIdea | undefined;
      if (!idea?.title) return fail('visualize', 'Missing idea to visualize.', 400);

      const raw = await callClaudeJson(
        `You define the exact simplest visual for one black-and-white website icon.

Return ONLY JSON:
{
  "title": "short title",
  "look": "Exact visual description of the simplest recognizable silhouette/glyph. No color, no text unless essential, no clutter. Say what shapes to use and what to omit."
}`,
        `Category: ${category || 'general'}
Title: ${idea.title}
Summary: ${idea.summary}
Description: ${idea.description || idea.summary}

Make it as simple as possible while still instantly understandable.`,
        300,
      );

      const parsed = extractJsonObject(raw) as { title?: string; look?: string };
      const look = safeText(parsed.look);
      if (!look) return fail('visualize', 'Claude returned no visual look description.', 502);
      const visualized: TournamentIdea = {
        ...idea,
        title: safeText(parsed.title) || idea.title,
        look,
      };
      return ok({
        stage: 'visualize',
        idea: visualized,
        message: `Visual locked: ${visualized.title}`,
      });
    }

    return fail(action, `Unknown tournament action: ${action}`, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tournament step failed';
    const status = message.includes('CLAUDE_API_KEY') ? 503 : 500;
    return fail(action, message, status);
  }
}
