import { load } from 'cheerio';
import { renderPage, type PageDocument } from '../document';
import { validatePlan, type DesignPlan } from './plan';

/** Uses the existing escaped renderer; AI cannot emit HTML, CSS, scripts or new links. */
export function renderDesignedPage(page: PageDocument, input: DesignPlan): string {
  const plan = validatePlan(input, page);
  const $ = load(renderPage(page));
  const sections = $('main > section');
  if (sections.length !== plan.sections.length) throw new Error('Renderer and design sections disagree.');
  sections.each((index, element) => {
    const s = plan.sections[index];
    $(element).attr('class', `section de-section de-${s.composition} de-${s.treatment} de-cards-${s.cards}`)
      .attr('style', `--de-columns:${s.columns};--de-fit:${s.imageFit}`);
    // Media layouts use a float to retain the full original text and link order.
    if (s.composition.startsWith('media-')) {
      const body = $(element).children('.body');
      body.children('figure').first().prependTo(body);
    }
  });
  const fonts = {
    humanist: '"Trebuchet MS","Segoe UI",sans-serif',
    editorial: 'Georgia,"Times New Roman",serif',
    geometric: '"Avenir Next","Century Gothic",sans-serif',
    classic: 'Palatino,"Book Antiqua",Georgia,serif',
    technical: '"SFMono-Regular",Consolas,monospace',
  };
  const c = plan.colors, space = { compact: 44, balanced: 72, generous: 104 }[plan.spacing];
  $('head').append($('<style>').attr('id', 'builder-design-engine').text(`
  :root{--de-bg:${c.background};--de-surface:${c.surface};--de-ink:${c.ink};--de-muted:${c.muted};--de-accent:${c.accent};--de-accent-ink:${c.accentInk};--de-border:${c.border};--de-radius:${plan.radius}px;--de-space:${space}px;--de-heading:${fonts[plan.typography]}}
  body{background:var(--de-bg);color:var(--de-ink);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  header,main,footer{width:min(${plan.width}px,calc(100% - 64px));min-width:0}
  header{border-color:var(--de-border);padding:24px 0}.brand{letter-spacing:-.025em;min-width:0;overflow-wrap:anywhere}.nav{gap:20px}.nav-more>div{background:var(--de-bg);border:1px solid var(--de-border);border-radius:var(--de-radius);width:min(280px,calc(100vw - 40px))}
  h1,h2,h3,h4,h5,h6{font-family:var(--de-heading);font-weight:${['editorial','classic'].includes(plan.typography) ? 400 : 650};letter-spacing:-.035em;line-height:1.1;overflow-wrap:anywhere}
  h1{font-size:clamp(2.5rem,${6 * plan.headingScale}vw,${5.5 * plan.headingScale}rem);max-width:17ch}h2{font-size:clamp(1.9rem,${3.7 * plan.headingScale}vw,${3.5 * plan.headingScale}rem)}h3{font-size:1.45rem}
  .de-section,.de-section:first-child{padding:var(--de-space) 0;border-bottom:1px solid var(--de-border);margin:0;border-radius:0;text-align:left}.de-section:first-child{padding-top:calc(var(--de-space) * 1.25)}
  .de-section .body{min-width:0;display:flow-root}.body>p{opacity:1;color:var(--de-muted);max-width:68ch}.body a:not(.action){color:var(--de-accent)}p,li,.action{overflow-wrap:anywhere}p{max-width:68ch}
  .de-panel,.de-band{background:var(--de-surface);padding:clamp(24px,4vw,56px);margin:28px 0;border:0}.de-panel{border-radius:var(--de-radius)}
  .de-editorial:not(:first-child)>h2{max-width:13ch}.de-editorial:not(:first-child){display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:28px 60px}.de-editorial>.cards{grid-column:2}
  .de-centered{text-align:center}.de-centered h1,.de-centered h2,.de-centered p{margin-inline:auto}.de-centered .body>p{max-width:54ch}
  .de-media-left .body>figure:first-of-type,.de-media-right .body>figure:first-of-type{width:44%;margin:0 0 32px 48px;float:right}.de-media-left .body>figure:first-of-type{float:left;margin:0 48px 32px 0}
  figure img{border-radius:var(--de-radius);object-fit:var(--de-fit,contain);height:auto;max-height:620px;background:var(--de-surface)}
  .cards{grid-template-columns:repeat(var(--de-columns),minmax(0,1fr));gap:28px;margin-top:36px}.card{background:var(--de-bg);color:var(--de-ink);border-color:var(--de-border);border-radius:var(--de-radius);padding:28px;min-width:0}.card p{opacity:1;color:var(--de-muted)}.card figure img{height:auto;max-height:280px;object-fit:var(--de-fit,contain)}
  .de-cards-unboxed .card{border:0;background:transparent;padding:24px 0;border-top:1px solid var(--de-border);border-radius:0}.de-cards-rows .cards{display:flex;flex-direction:column;gap:0}.de-cards-rows .card{border:0;border-top:1px solid var(--de-border);border-radius:0;background:transparent;padding:28px 0}.de-cards-rows .card .action{align-self:flex-start}
  .action,.contrast .action{background:var(--de-accent);color:var(--de-accent-ink);border-radius:var(--de-radius);min-height:48px;max-width:100%;text-align:center}.card .action{margin-top:auto}footer{opacity:1;color:var(--de-muted);border-color:var(--de-border)}footer .action{background:none;color:var(--de-accent)}:focus-visible{outline:3px solid var(--de-accent);outline-offset:4px}
  @media(max-width:1000px){.cards{grid-template-columns:repeat(min(var(--de-columns),2),minmax(0,1fr))}.de-editorial:not(:first-child){gap:24px}}
  @media(max-width:760px){header,main,footer{width:calc(100% - 40px)}header{gap:16px}.nav{gap:16px}.de-section,.de-section:first-child{padding:44px 0}.de-panel,.de-band{padding:24px;margin:20px 0}.de-editorial:not(:first-child){display:block}.cards{grid-template-columns:minmax(0,1fr);gap:20px}.de-media-left .body>figure:first-of-type,.de-media-right .body>figure:first-of-type{float:none;width:100%;margin:24px 0}.de-section h1{font-size:clamp(2.3rem,10vw,3.6rem)}.card{padding:24px}.nav-more>div{left:0;right:auto}.brand img{max-width:min(140px,60vw)}}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  `));
  return $.html();
}
