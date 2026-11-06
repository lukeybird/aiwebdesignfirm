# Single-page design engine: implementation and integration status

## Status

This branch adds a tested design engine. It is **not connected to the customer builder**, does not create a new public endpoint, and must not be deployed as a replacement for the current production source.

At review time GitHub main was `4aa058de205a132f75a0f2fd8ce27bf1c58e01e2`, but the current CLI production deployment `4ahTFRuL6F4bPoSX9nWZh8UNU7Fg` contained newer uncommitted builder files. Those newer files are on the user's Mac at `/Users/kellycarlson/Desktop/Cursor/aiwebdesignfirm`. This branch intentionally adds only new paths; it does not overwrite those files.

Before integration, preserve that Mac checkout's current source in Git, excluding credentials, `.env*` values, build output, dependencies, uploads and runtime data. Review the diff for secrets before committing. Do not deploy GitHub's older main or this branch's older application snapshot to production. Reconcile the new engine against the recovered live renderer and document schema first.

## Implemented

- `lib/builder/design-engine/plan.ts`: validated presentation contract, automatic fallback, source summary, immutable section references, arbitrary six-digit colors, five typography families, adjustable width/spacing/radius/heading scale, five compositions, three treatments, three card presentations, and image-fit choices. There is no four-section prescription or style questionnaire. Uses the original document's section count and order.
- `render.ts`: applies the plan to the existing escaped renderer; preserves source text, links, prices, images and section order. AI cannot supply executable HTML, arbitrary CSS or new destinations. Includes responsive rules and WCAG text-contrast repair. The engine adds layout flexibility, not unrestricted code generation.
- `model.ts`: server-side OpenAI Responses adapter with schema-constrained output, optional desktop/mobile image inputs, bounded inputs and output tokens, token accounting, no automatic retries, and sanitized categorized errors. No real API key is included or needed for mocked tests.
- `pipeline.ts`: design → render → capture both viewports → review → at most one repair. Default budget is three model calls; a fourth can review the repaired result. Every result reports fallback, needs-review or reviewed honestly. A repaired page's previous review is invalidated. No screenshot adapter means no visual review claim.

The engine does not crawl another page. Its input is the structured document produced by the existing guarded single-URL importer. It does not generate images or change billing/account behavior.

## Model configuration

The adapter reads the existing server-side `OPENAI_API_KEY`. It does not add, rename or modify any Vercel key.

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEBSITE_BUILDER_DESIGN_MODEL` | `gpt-4.1-mini` | Initial design, screenshot review, repair |
| `WEBSITE_BUILDER_TEXT_MODEL` | `gpt-4.1-mini` | Future routine text-edit caller using the adapter's `text` stage |

Set the design model to `gpt-6-astra` only after confirming account access and testing quality, latency and cost. Official OpenAI documentation lists Astra's API identifier and image-input/structured-output support: https://developers.openai.com/api/docs/models/gpt-6-astra . This does not establish this account's access. No paid model request has been run for this branch.

Three calls with a 6,000-output-token cap each bound call count and output length, not a fixed dollar amount. Reserve generation quota before a job starts, record returned usage by stage, and apply account/project spending controls. Do not automatically escalate to a pricier model or silently fall back to a different provider.

## Required integration work after preserving the live source

1. Reconcile the recovered `document.ts` / `page-content.ts` types and render markup. Keep new live prompt building, uploaded pictures and generated-image support. The tests currently run against GitHub's older document/renderer.
2. Store the design plan alongside its exact document revision. Save and publish both atomically; restore both together. Publishing a document with another revision's plan must fail. Export and public pages must use the same renderer as the preview.
3. Run this pipeline in a durable background worker. The existing builder route has a 120-second limit; do not place the whole design/review/image sequence in it. A new authenticated job API must enforce project ownership, subscription access, daily quota, idempotency and optimistic revision checks. Canceled or stale jobs must not overwrite new edits. Poll a stored status; do not rely on an unawaited Vercel promise after returning a response.
4. Connect a trusted server-side `Capture` adapter. It receives generated HTML, not arbitrary customer-controlled navigation URLs, and must return exactly one desktop and one mobile image. Recommended viewports are 1440×1000 and 390×844. Capture enough of the full page to see all sections, with a bounded montage/downscale to remain below the adapter's image-size limit. Wait for images, bound execution, report overflow and failed images, and honor cancellation. Use an isolated browser worker with public-network-only egress: HTML images may reference arbitrary original hosts, so SSRF controls must cover all subrequests and redirects, not just the initial import. Block scripts, private networks, metadata services, local files, popups and downloads. Never capture signed-in customer settings or payment screens.
5. Optionally supply original desktop/mobile captures to the initial design step so it can understand the existing visual identity. This is not implemented by the raw HTML importer.
6. Show simple customer progress (Reading your page / Designing / Checking mobile / Ready), with clear recoverable failures. Keep fonts, palettes and compositions out of the customer's decision flow. Display `needs-review` honestly; it is not a publish approval or an objective design score.
7. Fix the recovered builder's production-only origin check with an exact server-configured origin allowlist and set up isolated Preview auth, Stripe test mode and database data. Do not trust a request-supplied host as authorization or expose production Stripe credentials to arbitrary previews.
8. Add end-to-end fixtures for services, menus, long articles, pricing and image-heavy portfolios. Verify visual output on desktop and mobile and compare screenshot-reviewed output with the existing builder before switching live traffic. Verify signup, seven-day trial, cancellation and publish/export still work separately.

## Worker-side usage

```ts
import { createOpenAIModel } from '@/lib/builder/design-engine/model';
import { designSinglePage } from '@/lib/builder/design-engine/pipeline';

// Called only after the job's ownership, subscription, quota and revision checks.
const result = await designSinglePage({
  page: savedDocument,
  model: createOpenAIModel(),
  capture: trustedCaptureWorker, // Must be implemented and connected; see above.
  signal: cancellationSignal,
  maxModelCalls: 3,
  onEvent: event => persistJobStage(event),
});
// Persist using compare-and-swap against the starting revision.
// Do not claim result.status === 'needs-review' is visually verified.
```

## Verification

```sh
node --test scripts/test-design-engine.cjs scripts/test-builder.cjs
```

Tests cover content/link/image preservation, invalid/duplicate references, CSS injection rejection, contrast, long copy, model failure, zero-call budget, two-viewport requirements, bounded repair, stale-review invalidation, deadlines, and the Responses adapter's request format/error sanitization. API calls and screenshots in these tests are fixtures, not live evidence. A focused strict TypeScript check also passed for the new modules. A full application build, live model access, real screenshot capture and production integration are pending recovery of the newer live source.
