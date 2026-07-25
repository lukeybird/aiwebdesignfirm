import sharp from 'sharp';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ImageTracer = require('imagetracerjs') as {
  imagedataToSVG: (
    imageData: { width: number; height: number; data: Uint8ClampedArray },
    options?: Record<string, unknown> | string,
  ) => string;
};

export const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
export const RENDER_SIZE = 768;
export const DEFAULT_ICON_SIZE = 512;
export const ICON_STYLES = ['outline', 'filled', 'duotone', 'glyph'] as const;
export const ICON_SIZES = [512] as const;

const PROMPT_SYSTEM = `You write production prompts for elite black-and-white app/logo icons.

Return ONLY the image prompt text. No quotes, no markdown, no explanation.

The prompt must force a usable icon:
- Single centered subject, bold silhouette, instantly readable at small size
- Pure black shapes on pure white background only
- Flat vector look, crisp edges, no gray, no gradients, no shadows, no glow
- No photorealism, no 3D, no texture, no mockups, no frames, no watermarks
- No text/letters/numbers unless the brief explicitly requires them
- Generous padding (~12-18% empty margin from edges)
- Describe exact geometry: orientation, major shapes, relative proportions, what to omit
- Prefer fewer shapes over ornate detail
- End with: "minimal flat icon, solid black on pure white, high contrast silhouette, centered, vector style, no gray"`;

export function claudeKey(): string {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) throw new Error('CLAUDE_API_KEY is not configured');
  return key;
}

export async function callClaudeJson(system: string, user: string, maxTokens = 1200): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': claudeKey(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const answer = data?.content?.[0]?.text;
  if (!answer || typeof answer !== 'string') {
    throw new Error('Claude returned an invalid response');
  }
  return answer.trim();
}

export async function refineIconPrompt(description: string, style: string): Promise<string> {
  const answer = await callClaudeJson(
    PROMPT_SYSTEM,
    [
      `Rendering style preference: ${style}`,
      'Turn this production brief into one precise image-generation prompt.',
      'Preserve the exact subject and construction details. Do not invent unrelated objects.',
      '',
      description,
    ].join('\n'),
    420,
  );
  return answer.replace(/^["'\s]+|["'\s]+$/g, '').trim();
}

async function generateRasterPng(prompt: string): Promise<{ buffer: Buffer; provider: string }> {
  if (process.env.OPENAI_API_KEY) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
        n: 1,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      const url = data?.data?.[0]?.url;
      if (b64) return { buffer: Buffer.from(b64, 'base64'), provider: 'openai' };
      if (url) {
        const img = await fetch(url);
        if (!img.ok) throw new Error(`OpenAI image download failed (${img.status})`);
        return { buffer: Buffer.from(await img.arrayBuffer()), provider: 'openai' };
      }
    }
  }

  if (process.env.FAL_KEY) {
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square',
        num_images: 1,
        enable_safety_checker: true,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const url = data?.images?.[0]?.url;
      if (url) {
        const img = await fetch(url);
        if (!img.ok) throw new Error(`FAL image download failed (${img.status})`);
        return { buffer: Buffer.from(await img.arrayBuffer()), provider: 'fal' };
      }
    }
  }

  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${RENDER_SIZE}&height=${RENDER_SIZE}&model=flux&nologo=true&enhance=true&seed=${Date.now() % 1_000_000}`;
  const res = await fetch(url, { headers: { Accept: 'image/*' } });
  if (!res.ok) throw new Error(`Image generation failed (${res.status})`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('image') && !contentType.includes('octet-stream')) {
    throw new Error('Image provider returned a non-image response');
  }
  return { buffer: Buffer.from(await res.arrayBuffer()), provider: 'pollinations' };
}

async function thresholdPng(input: Buffer): Promise<Buffer> {
  // Slight blur + harder threshold cleans soft AI edges before tracing
  return sharp(input)
    .resize(RENDER_SIZE, RENDER_SIZE, { fit: 'contain', background: '#ffffff', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .grayscale()
    .normalize()
    .blur(0.6)
    .threshold(150)
    .png()
    .toBuffer();
}

async function ensureBlackOnWhite(bwPng: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(bwPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let black = 0;
  let white = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] < 128) black += 1;
    else white += 1;
  }
  if (black > white) return sharp(bwPng).negate({ alpha: false }).png().toBuffer();
  return bwPng;
}

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
}

function finalizeSvg(rawSvg: string, size: number): string {
  let svg = sanitizeSvg(rawSvg);
  svg = svg.replace(
    /<path\b([^>]*?)fill\s*=\s*['"]([^'"]+)['"]([^>]*?)\/?>/gi,
    (_full, pre: string, fill: string, post: string) => {
      const f = fill.trim().toLowerCase();
      if (
        f === '#fff' ||
        f === '#ffffff' ||
        f === 'white' ||
        f === 'rgb(255,255,255)' ||
        f === 'rgb(255, 255, 255)'
      ) {
        return '';
      }
      const hex = f.match(/^#([0-9a-f]{6})$/i);
      if (hex) {
        const n = parseInt(hex[1], 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        if (r + g + b > 600) return '';
      }
      return `<path${pre}fill="currentColor"${post}/>`;
    },
  );
  if (!/^<svg\b/i.test(svg)) throw new Error('Tracer did not return SVG');
  svg = svg.replace(
    /^<svg\b[^>]*>/i,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RENDER_SIZE} ${RENDER_SIZE}" width="${size}" height="${size}" fill="currentColor">`,
  );
  return svg.replace(/>\s+</g, '><').trim();
}

async function traceToSvg(bwPng: Buffer, size: number): Promise<string> {
  const { data, info } = await sharp(bwPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const imageData = {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
  };
  const traced = ImageTracer.imagedataToSVG(imageData, {
    ltres: 1.0,
    qtres: 1.0,
    pathomit: 16,
    colorsampling: 0,
    numberofcolors: 2,
    mincolorratio: 0,
    colorquantcycles: 1,
    blurradius: 0,
    blurdelta: 20,
    strokewidth: 0,
    linefilter: true,
    scale: 1,
    roundcoords: 1,
    viewbox: true,
    desc: false,
    lcpr: 0,
    qcpr: 0,
  });
  return finalizeSvg(traced, size);
}

export async function createTracedIcon(input: {
  description: string;
  style: string;
  size: number;
}): Promise<{
  svg: string;
  pngBase64: string;
  refinedPrompt: string;
  provider: string;
  pipeline: string;
}> {
  const refined = await refineIconPrompt(input.description, input.style);
  const { buffer: rawImage, provider } = await generateRasterPng(refined);
  const thresholded = await thresholdPng(rawImage);
  const bw = await ensureBlackOnWhite(thresholded);
  const svg = await traceToSvg(bw, input.size);
  return {
    svg,
    pngBase64: bw.toString('base64'),
    refinedPrompt: refined,
    provider,
    pipeline: 'raster-threshold-trace',
  };
}

export function slugifyIconName(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'icon';
}
