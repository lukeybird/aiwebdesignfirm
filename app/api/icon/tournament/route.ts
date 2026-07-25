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
        `You are a senior brand strategist designing an agency-quality website icon system.

Think in this order before listing icons:
1) What does this category need to communicate as an agency / brand / business on the web?
2) Which distinct ideas should icons carry so the set feels complete and useful?
3) Prefer ideas that can later become simple, beautiful silhouettes.

Return ONLY valid JSON:
{
  "agencyBrief": "2-4 sentences: what this category must communicate",
  "icons": [
    { "title": "Short Icon Name", "summary": "What this icon communicates / why the site needs it" }
  ]
}

Rules:
- Exactly 96 icons
- Titles are 2-4 words, title case, unique
- Every icon must serve communication, not decoration
- Broad coverage: navigation, trust, contact, services, commerce, support, social proof, operations, etc.
- No duplicates or near-duplicates
- No obscure niche icons unless truly core to the category`,
        `Business category: ${category}

First answer what this category must communicate as an agency system, then list the 96 icons that carry those messages.`,
        4800,
      );

      const parsed = extractJsonObject(raw) as {
        agencyBrief?: string;
        icons?: Array<{ title?: string; summary?: string }>;
      };
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
        const title = safeText(item.title) || `Icon ${index + 1}`;
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
        agencyBrief:
          safeText(parsed.agencyBrief) ||
          `A clear, professional icon system that communicates what a ${category} business stands for online.`,
        message: `Found ${icons.length} communication-driven icon types for “${category}”.`,
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
        usefulness: `Pick which icon better serves what this category must communicate as an agency / brand website.
Prefer clarity, familiarity, practical website use, and stronger brand communication over novelty.`,
        idea: `Pick which concept is the stronger icon idea overall: clearer meaning, more distinctive, more useful on a website, and better aligned with agency-quality communication.`,
        simplicity: `Pick which icon concept would become the simplest, most beautiful black-and-white vector mark.
Prefer fewer shapes, cleaner silhouette, and faster recognition at small size — without losing meaning.`,
      } as const;

      const raw = await callClaudeJson(
        `You are judging an icon tournament match for an agency-quality icon system.

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
        220,
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
        `You deepen one website icon concept for an agency-quality set.

Think: what must this icon communicate, then how to make the idea stronger and more useful.

Return ONLY JSON:
{
  "title": "Keep or lightly improve the short title",
  "summary": "One line: what this icon communicates for the category",
  "description": "2-4 sentences: the best version of this idea — meaning, use on a website, and why it belongs in the set"
}`,
        `Category: ${category || 'general'}
Current title: ${idea.title}
Current summary: ${idea.summary}
Make this the best possible icon idea in this category — clear, useful, distinctive, and communication-driven.`,
        420,
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
        `You design the exact simplest, most beautiful black-and-white website icon.

Think in order:
1) What idea must this silhouette communicate?
2) Which few shapes communicate it best?
3) How to keep it simple and beautiful?
4) Exact construction details (orientation, proportions, padding, what to omit).

Return ONLY JSON:
{
  "title": "short title",
  "look": "Exact production visual: orientation, major shapes, relative proportions, padding feel, what to omit. Flat black silhouette on white. No color, no gray, no text unless essential, no clutter."
}`,
        `Category: ${category || 'general'}
Title: ${idea.title}
Communicates: ${idea.summary}
Concept: ${idea.description || idea.summary}

Make it as simple and beautiful as possible while instantly understandable at small size.`,
        450,
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
