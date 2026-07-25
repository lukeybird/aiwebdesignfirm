export type TournamentIdea = {
  id: string;
  title: string;
  summary: string;
  description?: string;
  look?: string;
};

export type TournamentStageId =
  | 'idle'
  | 'ideas'
  | 'round1'
  | 'enrich'
  | 'round2'
  | 'visualize'
  | 'round3'
  | 'render'
  | 'done'
  | 'error';

export const TOURNAMENT_STAGES: Array<{
  id: TournamentStageId;
  label: string;
  detail: string;
  /** Rough seconds for the whole stage at sequential pace */
  estimatedSeconds: number;
}> = [
  {
    id: 'ideas',
    label: 'Discovering icon types',
    detail: 'Asking what icons a business in this category usually needs (96 ideas).',
    estimatedSeconds: 25,
  },
  {
    id: 'round1',
    label: 'Round 1 — usefulness tournament',
    detail: 'Pairing all 96 at random. The more useful / known website icon wins each match (→ 48).',
    estimatedSeconds: 48 * 3,
  },
  {
    id: 'enrich',
    label: 'Deepening the 48 ideas',
    detail: 'Expanding each surviving idea into a clearer, stronger concept with a description.',
    estimatedSeconds: 48 * 3.5,
  },
  {
    id: 'round2',
    label: 'Round 2 — best idea tournament',
    detail: 'Pairing the 48 enriched ideas. The stronger concept wins (→ 24).',
    estimatedSeconds: 24 * 3,
  },
  {
    id: 'visualize',
    label: 'Simplifying the look',
    detail: 'For each of the 24, deciding the simplest possible visual so anyone can recognize it.',
    estimatedSeconds: 24 * 3.5,
  },
  {
    id: 'round3',
    label: 'Round 3 — simplicity tournament',
    detail: 'Pairing the 24. The easiest-to-understand vector concept wins (→ 12).',
    estimatedSeconds: 12 * 3,
  },
  {
    id: 'render',
    label: 'Drawing & tracing SVGs',
    detail: 'Making each final icon as an image, then converting to SVG — one at a time.',
    estimatedSeconds: 12 * 12,
  },
  {
    id: 'done',
    label: 'Set complete',
    detail: 'Your final tournament winners are ready to browse and download.',
    estimatedSeconds: 0,
  },
];

export function shuffleInPlace<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pairIdeas<T>(items: T[]): Array<[T, T]> {
  const shuffled = shuffleInPlace(items);
  if (shuffled.length % 2 !== 0) {
    // Bye: last item auto-advances by pairing with a copy of itself — caller should handle odd counts.
    // We expect even counts in this tournament.
  }
  const pairs: Array<[T, T]> = [];
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

export function extractJsonObject(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Could not parse JSON from Claude response');
  }
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'about a minute';
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `~${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `~${hrs}h ${rem}m` : `~${hrs}h`;
}

export function estimateRemainingSeconds(
  stageId: TournamentStageId,
  stageProgress: number,
  stageTotal: number,
): number {
  const idx = TOURNAMENT_STAGES.findIndex((s) => s.id === stageId);
  if (idx < 0) return 0;
  let remaining = 0;
  for (let i = idx; i < TOURNAMENT_STAGES.length; i += 1) {
    const stage = TOURNAMENT_STAGES[i];
    if (stage.id === 'done' || stage.id === 'error' || stage.id === 'idle') continue;
    if (i === idx && stageTotal > 0) {
      const left = Math.max(0, stageTotal - stageProgress);
      remaining += (stage.estimatedSeconds / stageTotal) * left;
    } else if (i > idx) {
      remaining += stage.estimatedSeconds;
    }
  }
  return Math.ceil(remaining);
}

export function slugifyTitle(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'icon'
  );
}
