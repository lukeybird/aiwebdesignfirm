/** Slider 1–10: word targets for `reply` + max output tokens (API ceiling). */

const CLAUDE_OUTPUT_CAP = 8192;

export function clampResponseLengthLevel(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return 4;
  return Math.min(10, Math.max(1, Math.round(n)));
}

export function getCeoResponseLengthConfig(level: number): { maxTokens: number; instruction: string } {
  const L = clampResponseLengthLevel(level);

  const rows: Record<number, { maxTokens: number; instruction: string }> = {
    1: {
      maxTokens: 120,
      instruction: `RESPONSE LENGTH (slider = 1): Ultra-short. The "reply" field must be ONE WORD whenever a single word still answers (e.g. Yes, No, Ship, Pause, Focus). Maximum 3 words only if one word is impossible. Use "artifacts": [] always.`,
    },
    2: {
      maxTokens: 200,
      instruction: `RESPONSE LENGTH (slider = 2): Exactly ONE sentence in "reply", about 15–20 words. No second sentence. At most 1 artifact with a single short line in body, or [].`,
    },
    3: {
      maxTokens: 400,
      instruction: `RESPONSE LENGTH (slider = 3): "reply" is a couple of sentences, about 20–60 words total. 0–2 compact artifacts only.`,
    },
    4: {
      maxTokens: 900,
      instruction: `RESPONSE LENGTH (slider = 4): "reply" is one paragraph, about 120–180 words. 1–2 artifacts with tight bodies.`,
    },
    5: {
      maxTokens: 2200,
      instruction: `RESPONSE LENGTH (slider = 5): "reply" is a couple of paragraphs, about 350–600 words total. 1–3 artifacts.`,
    },
    6: {
      maxTokens: 3200,
      instruction: `RESPONSE LENGTH (slider = 6): "reply" is a small report, about 600–800 words. 2–4 artifacts with structured bullets.`,
    },
    7: {
      maxTokens: CLAUDE_OUTPUT_CAP,
      instruction: `RESPONSE LENGTH (slider = 7): "reply" is a medium report targeting about 750–1500 words (if you hit the output limit, prioritize the executive summary + outline + key sections first). 2–4 artifacts.`,
    },
    8: {
      maxTokens: CLAUDE_OUTPUT_CAP,
      instruction: `RESPONSE LENGTH (slider = 8): "reply" is a detailed report targeting up to ~3000 words worth of content density within one response (prioritize clarity and structure; stop at the token ceiling). 2–4 substantial artifacts.`,
    },
    9: {
      maxTokens: CLAUDE_OUTPUT_CAP,
      instruction: `RESPONSE LENGTH (slider = 9): "reply" aims for up to ~6000 words of insight in one shot—impossible to fully hit in one API response, so deliver a dense multi-section report filling the maximum output, with clear section headers, then end the "reply" with one line: "Say 'continue' for the next section." 3–4 artifacts.`,
    },
    10: {
      maxTokens: CLAUDE_OUTPUT_CAP,
      instruction: `RESPONSE LENGTH (slider = 10): "reply" aims toward a very long brief (up to ~15000 words of material)—still bounded by one response; produce the longest, most structured single-response report you can (executive summary, thesis, pillars, roadmap, metrics, risks, org implications). End with: "Say 'continue' for the next chapter." 3–4 substantial artifacts.`,
    },
  };

  return rows[L] ?? rows[4];
}
