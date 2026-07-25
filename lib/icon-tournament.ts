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
    label: 'What must this category communicate?',
    detail: 'Agency brief first: what a site in this category needs to say, then 96 icon ideas that carry those messages.',
    estimatedSeconds: 25,
  },
  {
    id: 'round1',
    label: 'Round 1 — communication usefulness',
    detail: 'Pairing all 96. Icons that better communicate core agency/brand needs win (→ 48).',
    estimatedSeconds: 48 * 3,
  },
  {
    id: 'enrich',
    label: 'Deepening ideas',
    detail: 'For each of the 48: what it communicates, why it belongs, and a stronger concept brief.',
    estimatedSeconds: 48 * 3.5,
  },
  {
    id: 'round2',
    label: 'Round 2 — strongest ideas',
    detail: 'Pairing the 48. Clearer, more distinctive, more useful concepts win (→ 24).',
    estimatedSeconds: 24 * 3,
  },
  {
    id: 'visualize',
    label: 'Simple & beautiful details',
    detail: 'For each of the 24: reduce to the simplest beautiful silhouette and lock exact construction details.',
    estimatedSeconds: 24 * 3.5,
  },
  {
    id: 'round3',
    label: 'Round 3 — simplest beautiful mark',
    detail: 'Pairing the 24. The cleanest, most recognizable black-and-white glyph wins (→ 12).',
    estimatedSeconds: 12 * 3,
  },
  {
    id: 'render',
    label: 'Drawing & tracing SVGs',
    detail: 'One carefully detailed production brief per icon → image → crisp SVG, sequentially.',
    estimatedSeconds: 12 * 12,
  },
  {
    id: 'done',
    label: 'Set complete',
    detail: 'Final icons are ready. Use Change on any icon to remake it with your notes.',
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

/** Dense brief sent to the image → SVG pipeline for maximum fidelity. */
export function buildIconProductionBrief(input: {
  category: string;
  title: string;
  summary?: string;
  description?: string;
  look?: string;
}): string {
  return [
    `Category / agency context: ${input.category}`,
    `Icon name: ${input.title}`,
    input.summary ? `Communicates: ${input.summary}` : '',
    input.description ? `Concept: ${input.description}` : '',
    input.look ? `Exact visual construction: ${input.look}` : '',
    'Craft one centered black-on-white icon mark.',
    'Prioritize: bold silhouette, few shapes, instant recognition at small size, generous padding (~12-18%).',
    'Omit: gray, gradients, shadows, texture, photorealism, 3D, mockups, frames, watermarks, and text unless essential.',
  ]
    .filter(Boolean)
    .join('\n');
}
