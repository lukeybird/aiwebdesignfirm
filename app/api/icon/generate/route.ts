import { NextRequest, NextResponse } from 'next/server';
import { markIconFailed, saveGeneratedIcon } from '@/lib/icon-db';
import {
  createTracedIcon,
  DEFAULT_ICON_SIZE,
  ICON_STYLES,
  slugifyIconName,
} from '@/lib/icon-pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PROMPT_CHARS = 4000;

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = safeText(body.prompt);
    const name = safeText(body.name) || null;
    const slug = safeText(body.slug) || (name ? slugifyIconName(name) : null);
    const style = safeText(body.style).toLowerCase() || 'filled';
    const size = DEFAULT_ICON_SIZE;
    const sessionId = safeText(body.sessionId).slice(0, 128) || null;
    const collectionId = safeText(body.collectionId) || null;
    const iconId = safeText(body.iconId) || null;
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : null;
    const changeRequest = safeText(body.changeRequest);

    if (!prompt) {
      return NextResponse.json({ error: 'Describe the icon you want.' }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return NextResponse.json(
        { error: `Description is too long (max ${MAX_PROMPT_CHARS} chars).` },
        { status: 400 },
      );
    }
    if (changeRequest.length > MAX_PROMPT_CHARS) {
      return NextResponse.json(
        { error: `Change request is too long (max ${MAX_PROMPT_CHARS} chars).` },
        { status: 400 },
      );
    }
    if (!(ICON_STYLES as readonly string[]).includes(style)) {
      return NextResponse.json({ error: 'Invalid style.' }, { status: 400 });
    }

    const art = await createTracedIcon({
      description: changeRequest
        ? [
            prompt,
            '',
            'USER REVISION (must follow precisely while keeping one simple black-on-white icon):',
            changeRequest,
            'Preserve the same subject unless the revision explicitly changes it. Apply only the requested change. Keep the silhouette bold, centered, and free of gray/shadows/text.',
          ].join('\n')
        : prompt,
      style,
      size,
    });

    // Persist the effective description when revising
    const promptToStore = changeRequest
      ? `${prompt} (revised: ${changeRequest})`
      : prompt;

    let savedId: string | null = null;
    let createdAt: string | null = null;
    let saveError: string | null = null;
    try {
      const saved = await saveGeneratedIcon({
        sessionId,
        collectionId: collectionId?.startsWith('local-') ? null : collectionId,
        iconId: iconId?.startsWith('local-') ? null : iconId,
        name,
        slug,
        sortOrder,
        prompt: promptToStore,
        refinedPrompt: art.refinedPrompt,
        style,
        size,
        svg: art.svg,
        pngBase64: art.pngBase64,
        provider: art.provider,
        pipeline: art.pipeline,
      });
      savedId = saved.id;
      createdAt = saved.createdAt;
    } catch (err) {
      console.error('Icon DB save failed:', err);
      saveError = err instanceof Error ? err.message : 'Failed to save icon';
      if (iconId && !iconId.startsWith('local-')) {
        try {
          await markIconFailed(iconId, saveError);
        } catch {
          // ignore
        }
      }
    }

    return NextResponse.json({
      id: savedId || iconId,
      name,
      slug,
      filename: `${slug || 'icon'}.svg`,
      saved: Boolean(savedId),
      saveError,
      svg: art.svg,
      pngBase64: art.pngBase64,
      mime: 'image/png',
      style,
      size,
      provider: art.provider,
      refinedPrompt: art.refinedPrompt,
      pipeline: art.pipeline,
      prompt: promptToStore,
      createdAt,
    });
  } catch (error) {
    console.error('Icon generate error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate icon';
    const status = message.includes('CLAUDE_API_KEY') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
