export type CeoArtifactKind = 'plan' | 'checklist' | 'metric' | 'note' | 'risk' | 'next_step';

export type CeoArtifact = {
  id?: string;
  title: string;
  body: string;
  kind?: string;
};

export type ParsedCeoResponse = {
  reply: string;
  artifacts: CeoArtifact[];
};

function normalizeArtifacts(raw: unknown): CeoArtifact[] {
  if (!Array.isArray(raw)) return [];
  const out: CeoArtifact[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim() : '';
    const body = typeof o.body === 'string' ? o.body.trim() : typeof o.content === 'string' ? o.content.trim() : '';
    if (!title || !body) continue;
    const kind = typeof o.kind === 'string' ? o.kind.trim() : 'note';
    const id = typeof o.id === 'string' ? o.id.trim() : undefined;
    out.push({ id, title, body, kind });
  }
  return out;
}

/** Claude must return JSON; this parser tolerates markdown fences. */
export function parseCeoCoachResponse(raw: string): ParsedCeoResponse {
  const trimmed = raw.trim();

  const tryParse = (s: string): ParsedCeoResponse | null => {
    try {
      const j = JSON.parse(s) as Record<string, unknown>;
      if (j && typeof j.reply === 'string') {
        return { reply: j.reply.trim(), artifacts: normalizeArtifacts(j.artifacts) };
      }
    } catch {
      return null;
    }
    return null;
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    const fenced = tryParse(fence[1].trim());
    if (fenced) return fenced;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const sliced = tryParse(trimmed.slice(start, end + 1));
    if (sliced) return sliced;
  }

  return { reply: trimmed, artifacts: [] };
}
