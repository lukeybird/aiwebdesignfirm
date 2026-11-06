const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { load: html } = require('cheerio');
function load(file) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => name.startsWith('.') ? load(path.join(path.dirname(file), name + '.ts')) : require(name), module, module.exports);
  return module.exports;
}
const { importedDraft } = load('lib/builder/ai.ts');
const { extractSource } = load('lib/builder/source.ts');
const { renderPage } = load('lib/builder/document.ts');
const { fallbackPlan, validatePlan, contrast, designPlanSchema } = load('lib/builder/design-engine/plan.ts');
const { renderDesignedPage } = load('lib/builder/design-engine/render.ts');
const { designSinglePage, visualReviewSchema } = load('lib/builder/design-engine/pipeline.ts');
const { createOpenAIModel } = load('lib/builder/design-engine/model.ts');
const fixture = () => importedDraft(extractSource(`<nav><a href="/book">Book</a></nav><main><h1>Repairs with care</h1><p>Read <a href="/terms">our terms</a> before booking.</p><img src="https://example.com/team.jpg" alt="The actual team"><section id="prices"><h2>Actual prices</h2><article><h3>One visit</h3><p>$250 per visit</p><a href="/buy?price=250">Book a visit</a></article><article><h3>Three visits</h3><p>$650</p></article></section><section id="details"><h2>What is included</h2><p>${'Actual service details. '.repeat(80)}</p></section></main><footer><a href="tel:+15551234567">Call</a></footer>`, 'https://example.com/repairs'));
const output = value => ({ value, model: 'fixture-model', inputTokens: 50, outputTokens: 20 });
const pair = () => [{ viewport: 'desktop', dataUrl: 'data:image/png;base64,YQ==' }, { viewport: 'mobile', dataUrl: 'data:image/png;base64,Yg==' }];
const good = () => ({ desktop: { score: 88, issues: [] }, mobile: { score: 87, issues: [] }, repair: false });

test('redesign preserves every original word, price, destination and image; caller remains immutable', () => {
  const page = fixture(), before = structuredClone(page), plan = fallbackPlan(page);
  plan.colors.accent = '#6038a5'; plan.typography = 'classic'; plan.radius = 0;
  const original = html(renderPage(page)), redesigned = html(renderDesignedPage(page, plan));
  const words = $ => $('body').text().replace(/\s+/g, ' ').trim();
  assert.equal(words(redesigned), words(original));
  for (const attr of ['href', 'src']) {
    const values = $ => $(`[${attr}]`).map((_, e) => $(e).attr(attr)).get().sort();
    assert.deepEqual(values(redesigned), values(original));
  }
  assert.ok(redesigned('#builder-design-engine').text().includes('#6038a5'));
  assert.deepEqual(page, before);
});
test('rejects invented, missing and duplicate sections rather than deleting or replacing content', () => {
  const page = fixture();
  for (const mutate of [p => p.sections.pop(), p => p.sections[0].id = 'invented', p => p.sections[1].id = p.sections[0].id]) {
    const plan = fallbackPlan(page); mutate(plan); assert.throws(() => validatePlan(plan, page), /every original section/);
  }
});
test('validates CSS values and repairs low contrast using WCAG relative luminance', () => {
  const page = fixture(), plan = fallbackPlan(page);
  plan.colors.accent = 'red;}</style><script>alert(1)</script>';
  assert.throws(() => renderDesignedPage(page, plan));
  const bad = fallbackPlan(page);
  bad.colors.ink = bad.colors.muted = bad.colors.accent = bad.colors.accentInk = '#faf9f5';
  const c = validatePlan(bad, page).colors;
  for (const surface of [c.background, c.surface]) {
    for (const ink of [c.ink, c.muted, c.accent]) assert.ok(contrast(ink, surface) >= 4.5);
  }
  assert.ok(contrast(c.accentInk, c.accent) >= 4.5);
  assert.equal(contrast('#000000', '#ffffff'), 21);
});
test('long copy remains left aligned; image layouts require an existing image', () => {
  const page = fixture(), plan = fallbackPlan(page);
  plan.sections.forEach(s => s.composition = 'media-left');
  const checked = validatePlan(plan, page);
  checked.sections.forEach((s, i) => {
    if (!page.content.sections[i].blocks.some(b => b.kind === 'image')) assert.equal(s.composition, 'reading');
  });
  plan.sections.forEach(s => s.composition = 'centered');
  const longIndex = page.content.sections.findIndex(s => s.id === 'details');
  assert.equal(validatePlan(plan, page).sections[longIndex].composition, 'reading');
});
test('model outage returns original content and an explicit fallback, never a false success', async () => {
  const page = fixture();
  const result = await designSinglePage({ page, model: async () => { throw new Error('private provider error'); } });
  assert.equal(result.status, 'fallback'); assert.equal(result.review, null);
  assert.ok(result.warnings.length >= 2); assert.ok(result.html.includes('$250'));
  assert.ok(!result.warnings.join('').includes('private provider error'));
});
test('zero call budget makes no paid calls and does not claim a visual review', async () => {
  let calls = 0;
  const result = await designSinglePage({ page: fixture(), maxModelCalls: 0, model: async () => { calls++; throw new Error(); } });
  assert.equal(calls, 0); assert.equal(result.status, 'fallback');
});
test('only a real pair of captures can reach reviewed status', async () => {
  const page = fixture(); let calls = 0;
  const result = await designSinglePage({ page, capture: async () => pair(), model: async r => { calls++; return output(r.stage === 'design' ? fallbackPlan(page) : good()); } });
  assert.equal(calls, 2); assert.equal(result.status, 'reviewed'); assert.equal(result.usage.length, 2);
  const missing = await designSinglePage({ page, capture: async () => [pair()[0]], model: async () => output(fallbackPlan(page)) });
  assert.equal(missing.status, 'needs-review'); assert.equal(missing.review, null);
});
test('repair stays within budget, captures the revised page, and clears the stale review', async () => {
  const page = fixture(); let captures = 0; const stages = [];
  const result = await designSinglePage({ page, capture: async () => { captures++; return pair(); }, model: async r => {
    stages.push(r.stage);
    return output(r.stage === 'review' ? { ...good(), repair: true } : fallbackPlan(page));
  } });
  assert.deepEqual(stages, ['design', 'review', 'repair']); assert.equal(captures, 2);
  assert.equal(result.status, 'needs-review'); assert.equal(result.review, null);
  assert.ok(result.warnings.some(w => /final AI review/.test(w)));
});
test('an optional fourth call reviews the final repair instead of looping indefinitely', async () => {
  const page = fixture(); let reviews = 0;
  const result = await designSinglePage({ page, maxModelCalls: 4, capture: async () => pair(), model: async r => output(r.stage === 'review' ? { ...good(), repair: reviews++ === 0 } : fallbackPlan(page)) });
  assert.equal(result.status, 'reviewed'); assert.equal(result.usage.length, 4); assert.equal(reviews, 2);
});
test('deadline bounds even a capture adapter that ignores cancellation', async () => {
  const page = fixture();
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const result = await designSinglePage({ page, timeoutMs: 20, capture: async () => new Promise(() => {}), model: async () => output(fallbackPlan(page)) });
    assert.equal(result.status, 'needs-review'); assert.ok(result.warnings.length);
  } finally { clearTimeout(keepAlive); }
});
test('Responses request supports explicit Astra design, separate cheap text model and no stored responses', async () => {
  const page = fixture(), requests = [];
  const model = createOpenAIModel({ apiKey: 'unit-test-not-a-real-key', designModel: 'gpt-6-astra', textModel: 'gpt-4.1-mini', fetch: async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); requests.push(JSON.parse(init.body));
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(fallbackPlan(page)) }] }], usage: { input_tokens: 100, output_tokens: 50 } });
  } });
  for (const stage of ['design', 'text']) await model({ stage, instructions: 'Test', data: {}, schema: designPlanSchema, screenshots: stage === 'design' ? pair() : [], signal: AbortSignal.timeout(1000) });
  assert.equal(requests[0].model, 'gpt-6-astra'); assert.equal(requests[1].model, 'gpt-4.1-mini');
  assert.equal(requests[0].store, false); assert.equal(requests[0].text.format.strict, true);
  assert.equal(requests[0].input[0].content.filter(p => p.type === 'input_image').length, 2);
  assert.equal(requests[1].reasoning, undefined);
});
test('provider failures expose a useful category and request ID, never response bodies or credentials', async () => {
  const model = createOpenAIModel({ apiKey: 'unit-test-secret', fetch: async () => new Response('sensitive vendor error', { status: 403, headers: { 'x-request-id': 'request-123' } }) });
  await assert.rejects(model({ stage: 'review', instructions: 'Test', data: {}, schema: visualReviewSchema, signal: AbortSignal.timeout(1000) }), error => {
    assert.equal(error.code, 'access_denied'); assert.equal(error.requestId, 'request-123');
    assert.ok(!error.message.includes('secret')); assert.ok(!error.message.includes('sensitive')); return true;
  });
});
