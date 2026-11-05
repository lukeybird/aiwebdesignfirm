import { load } from 'cheerio';
import type { AnyNode,Element } from 'domhandler';
import type { PageBlock,PageContent,PageSection } from './page-content';
import { safeDestination } from './page-content';
const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const block=(kind:PageBlock['kind'],text='',url='',items:string[]=[],level=3):PageBlock=>({kind,text,url,items,level});
export function extractPage(html:string,url:string):PageContent{
 const $=load(html);$('script,style,noscript,svg,template,iframe,[hidden],[aria-hidden="true"]').remove();
 $('br').replaceWith(' ');
 const absolute=(raw:string)=>{try{return safeDestination(new URL(raw,url).href);}catch{return '';}};
 const image=(el:Element)=>{const n=$(el);const candidates=[n.attr('src'),n.attr('data-src'),(n.attr('srcset')||'').split(',')[0]?.trim().split(/\s+/)[0]];if(Number(n.attr('width'))>0&&Number(n.attr('width'))<=16)return '';for(const raw of candidates){if(!raw)continue;const src=absolute(raw);if(src.startsWith('https:'))return src;}return '';};
 const nav:Array<{label:string;url:string}>=[];
 $('nav a, [role="navigation"] a').each((_,el)=>{const label=clean($(el).text());const href=absolute($(el).attr('href')||'');if(label&&href&&label.length<=300&&!nav.some(l=>l.label===label&&l.url===href)&&nav.length<12)nav.push({label,url:href});});
 let logo='';$('img').each((_,el)=>{if(!logo&&/logo/i.test(($(el).attr('alt')||'')+' '+($(el).attr('src')||'')))logo=image(el);});
 const footer:PageBlock[]=[];
 const sections:PageSection[]=[];let current:PageSection={id:'page-intro',heading:'',blocks:[],cards:[],layout:'stack',tone:'plain'};
 sections.push(current);const ids=new Set<string>(['page-intro']);
 function sectionId(node:Element){const raw=$(node).attr('id')||$(node).closest('section').attr('id')||'section-'+sections.length;let id=raw.slice(0,140);let n=2;while(ids.has(id))id=raw.slice(0,130)+'-'+n++;ids.add(id);return id;}
 function linksInside(node:Element,into:PageBlock[]){$(node).find('a[href]').each((_,a)=>{const href=absolute($(a).attr('href')||'');const label=clean($(a).text());if(href&&label)into.push(block('link',label,href));});}
 function walk(nodes:AnyNode[],target?:PageBlock[],inCard=false){
  for(const node of nodes){
   const into=target||current.blocks;
   if(node.type==='text'){const text=clean(node.data);if(text){const prev=into[into.length-1];if(prev?.kind==='text')prev.text+=' '+text;else into.push(block('text',text));}continue;}
   if(node.type!=='tag')continue;
   const tag=node.name.toLowerCase(),n=$(node);
   if(['nav','footer'].includes(tag)||n.attr('role')==='navigation')continue;
   if(tag==='header'&&n.find('nav,[role="navigation"]').length&&!n.find('h1,h2').length)continue;
   if(!target&&['div','section','ul'].includes(tag)){
    const children=n.children().toArray();
    if(children.length>=2&&children.length<=12&&children.every(child=>$(child).find('h2,h3,h4,h5,h6').length===1&&!$(child).find('h1').length)){
     for(const child of children){const copy=$(child).clone();const heading=copy.find('h2,h3,h4,h5,h6').first();const card={heading:clean(heading.text()),blocks:[] as PageBlock[]};heading.remove();walk(copy.contents().toArray(),card.blocks,true);current.cards.push(card);}continue;
    }
   }
   const background=n.attr('style')?.match(/background(?:-image)?\s*:[^;]*url\(["']?([^"')]+)["']?\)/i)?.[1];
   if(background){const src=absolute(background);if(src.startsWith('https:'))into.push(block('image','',src));}
   if(tag==='article'&&!inCard){const card={heading:'',blocks:[] as PageBlock[]};const heading=n.find('h1,h2,h3,h4,h5,h6').first();card.heading=clean(heading.text());const copy=n.clone();copy.find('h1,h2,h3,h4,h5,h6').first().remove();walk(copy.contents().toArray(),card.blocks,true);if(card.heading||card.blocks.length)current.cards.push(card);continue;}
   if(/^h[1-6]$/.test(tag)){
    const text=clean(n.text());if(!text)continue;
    if(!target&&(tag==='h1'||tag==='h2')){if(current.heading||current.cards.length||(tag==='h2'&&current.blocks.length)){current={id:sectionId(node),heading:text,blocks:[],cards:[],layout:'stack',tone:'plain'};sections.push(current);}else{current.heading=text;current.id=sectionId(node);} }
    else into.push(block('heading',text,'',[],Number(tag[1])));
    continue;
   }
   if(tag==='p'||tag==='blockquote'||tag==='figcaption'||tag==='address'){const text=clean(n.text());if(text)into.push(block('text',text));linksInside(node,into);continue;}
   if(tag==='ul'||tag==='ol'){const items=n.children('li').toArray().map(li=>clean($(li).text())).filter(Boolean);if(items.length)into.push(block('list','','',items));linksInside(node,into);continue;}
   if(tag==='a'){const href=absolute(n.attr('href')||'');const label=clean(n.text())||n.find('img').attr('alt')||'';if(href&&label)into.push(block('link',label,href));n.find('img').each((_,img)=>{const src=image(img);if(src&&src!==logo)into.push(block('image',$(img).attr('alt')||'',src));});continue;}
   if(tag==='img'){const src=image(node);if(src&&src!==logo)into.push(block('image',n.attr('alt')||'',src));continue;}
   if(tag==='table'){n.find('tr').each((_,tr)=>{const cells=$(tr).find('th,td').toArray().map(td=>clean($(td).text()));if(cells.some(Boolean))into.push(block('text',cells.join(' · ')));});continue;}
   if(['button','input','select','textarea','dialog'].includes(tag))continue;
   walk(n.contents().toArray(),target,inCard);
  }
 }
 $('footer').first().each((_,el)=>walk($(el).contents().toArray(),footer,true));
 let root=$('main').first();if(!root.length)root=$('body');walk(root.contents().toArray());
 const kept=sections.filter(s=>s.heading||s.blocks.length||s.cards.length);
 if(!kept.length)throw new Error('This page has no readable content. Try its public page URL.');
 if(kept.length>40||kept.some(s=>s.blocks.length>150||s.cards.length>30||s.cards.some(c=>c.blocks.length>150)))throw new Error('This page has too much content for one redesign. Try a shorter page URL.');
 // Keep links to existing sections within the redesign; other links retain their exact source destination.
 const localize=(href:string)=>{try{const u=new URL(href);const base=new URL(url);return u.origin===base.origin&&u.pathname===base.pathname&&u.search===base.search&&u.hash&&kept.some(s=>s.id===decodeURIComponent(u.hash.slice(1)))?u.hash:href;}catch{return href;}};
 nav.forEach(l=>l.url=localize(l.url));
 for(const s of kept){for(const b of [...s.blocks,...s.cards.flatMap(c=>c.blocks)])if(b.kind==='link')b.url=localize(b.url);s.layout=s.blocks.some(b=>b.kind==='image')?'split':'stack';}
 kept.forEach((s,i)=>{if(i>0&&i%3===0)s.tone='soft';});
 return {navigation:nav,sections:kept,footer,logo,font:'sans'};
}
