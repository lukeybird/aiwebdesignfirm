import { z } from 'zod';
import type { PageDocument } from '../document';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const designPlanSchema = z.object({
  version: z.literal(1),
  intent: z.string().min(1).max(600),
  audience: z.string().min(1).max(300),
  primaryAction: z.string().max(300),
  colors: z.object({ background: hex, surface: hex, ink: hex, muted: hex, accent: hex, accentInk: hex, border: hex }),
  typography: z.enum(['humanist', 'editorial', 'geometric', 'classic', 'technical']),
  width: z.number().int().min(960).max(1440),
  radius: z.number().int().min(0).max(28),
  spacing: z.enum(['compact', 'balanced', 'generous']),
  headingScale: z.number().min(0.85).max(1.25),
  sections: z.array(z.object({
    id: z.string().min(1).max(150),
    composition: z.enum(['reading', 'editorial', 'media-left', 'media-right', 'centered']),
    treatment: z.enum(['open', 'panel', 'band']),
    cards: z.enum(['grid', 'rows', 'unboxed']),
    columns: z.number().int().min(1).max(4),
    imageFit: z.enum(['cover', 'contain']),
  })).min(1).max(40),
});
export type DesignPlan = z.infer<typeof designPlanSchema>;

function luminance(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Validate references and repair presentation only. Content never comes from the model. */
export function validatePlan(input: unknown, page: PageDocument): DesignPlan {
  const plan = designPlanSchema.parse(input);
  if (!page.content) throw new Error('A structured page is required.');
  const ids = page.content.sections.map(s => s.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !id)) throw new Error('Page section IDs must be unique and nonempty.');
  if (plan.sections.length !== ids.length || new Set(plan.sections.map(s => s.id)).size !== ids.length || plan.sections.some(s => !ids.includes(s.id))) {
    throw new Error('The design must include every original section exactly once.');
  }
  const c = plan.colors;
  const readable = (surface: string) => contrast('#172521', surface) >= contrast('#ffffff', surface) ? '#172521' : '#ffffff';
  // Body text, links and buttons must remain readable across every surface we render.
  for (const key of ['background', 'surface'] as const) {
    if (contrast(c.ink, c[key]) < 4.5) {
      if (key === 'surface') c.surface = c.background;
      c.ink = readable(c.background);
    }
  }
  if (contrast(c.ink, c.surface) < 4.5) c.surface = c.background;
  if (contrast(c.muted, c.background) < 4.5 || contrast(c.muted, c.surface) < 4.5) c.muted = c.ink;
  if (contrast(c.accent, c.background) < 4.5 || contrast(c.accent, c.surface) < 4.5) c.accent = c.ink;
  if (contrast(c.accentInk, c.accent) < 4.5) c.accentInk = readable(c.accent);
  const choices = new Map(plan.sections.map(s => [s.id, s]));
  plan.sections = page.content.sections.map(section => {
    const choice = choices.get(section.id)!;
    const hasImage = section.blocks.some(b => b.kind === 'image');
    const long = section.blocks.reduce((n, b) => n + b.text.length + b.items.join('').length, 0) > 1400;
    return { ...choice, composition: choice.composition.startsWith('media-') && !hasImage || choice.composition === 'centered' && long ? 'reading' : choice.composition };
  });
  return plan;
}

export function fallbackPlan(page: PageDocument): DesignPlan {
  if (!page.content) throw new Error('A structured page is required.');
  const sections = page.content.sections;
  return validatePlan({
    version: 1, intent: 'Make this exact page clear, distinctive and easy to use.',
    audience: 'Visitors to the original page.', primaryAction: '',
    colors: { background: '#faf9f5', surface: '#efeee7', ink: '#202e29', muted: '#505b55', accent: '#255d48', accentInk: '#ffffff', border: '#d5d8cf' },
    typography: 'humanist', width: 1200, radius: 8, spacing: 'balanced', headingScale: 1,
    sections: sections.map((s, i) => ({ id: s.id,
      composition: s.blocks.some(b => b.kind === 'image') ? (i % 2 ? 'media-left' : 'media-right') : s.heading && s.blocks.length > 3 ? 'editorial' : 'reading',
      treatment: 'open', cards: s.cards.some(c => c.blocks.some(b => /^[$£€¥]/.test(b.text))) ? 'rows' : 'unboxed',
      columns: Math.max(1, Math.min(3, s.cards.length)), imageFit: 'contain',
    })),
  }, page);
}

export function summarizePage(page: PageDocument) {
  if (!page.content) throw new Error('A structured page is required.');
  // Untrusted page content is supplied as JSON data, never appended to instructions.
  return {
    businessName: page.businessName, description: page.intro,
    navigation: page.content.navigation,
    sections: page.content.sections.map(s => ({
      id: s.id, heading: s.heading,
      blocks: s.blocks.map(b => ({ kind: b.kind, text: b.text.slice(0, 700), items: b.items.slice(0, 8), url: b.url })),
      cards: s.cards.map(c => ({ heading: c.heading, blocks: c.blocks.map(b => ({ kind: b.kind, text: b.text.slice(0, 400), url: b.url })) })),
    })),
  };
}
