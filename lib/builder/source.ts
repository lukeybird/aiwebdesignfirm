import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
export type SiteSource = { url: string; title: string; description: string; headings: string[]; text: string; images: string[]; email: string; phone: string };
export function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a,b] = address.split('.').map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===168||b===0||b===2)) || (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19||b===51)) || (a===203&&b===0));
  }
  return isIP(address) === 6 && /^[23]/.test(address) && !/^2001:(db8|0:|10:|20:)/i.test(address);
}
export function siteUrl(raw: string) {
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw new Error('Use a public http or https website URL.');
  if (!url.hostname.includes('.') && !isIP(url.hostname.replace(/^\[|\]$/g,''))) throw new Error('Use a public website address.');
  url.hash = ''; return url;
}
async function requestHtml(url: URL): Promise<{ status: number; location?: string; html: string }> {
  const hostname = url.hostname.replace(/^\[|\]$/g,'');
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(entry => !publicAddress(entry.address))) throw new Error('This address is not a public website.');
  const address = addresses[0];
  return new Promise((resolve,reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      family: address.family,
      headers: { 'User-Agent': 'AIWebDesignFirm-Importer/1.0', Accept: 'text/html,application/xhtml+xml' },
      lookup: ((_host: unknown,_options: unknown,callback: (error: Error|null,address: string,family: number)=>void) => callback(null,address.address,address.family)) as never,
      timeout: 12000,
    }, response => {
      const status = response.statusCode || 0;
      if ([301,302,303,307,308].includes(status)) { response.resume(); resolve({status,location:response.headers.location,html:''}); return; }
      if (status !== 200) {response.resume();reject(new Error(status===403||status===429 ? 'This website does not allow automated imports. Paste its text instead.' : 'The website could not be loaded. Check the URL or paste its text.'));return;}
      if (!String(response.headers['content-type']).includes('html')) {response.resume();reject(new Error('That URL does not point to an HTML webpage.'));return;}
      let size=0; const chunks: Buffer[]=[];
      response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>1500000){request.destroy(new Error('The page is too large. Paste its text instead.'));return;}chunks.push(chunk);});
      response.on('end',()=>resolve({status,html:Buffer.concat(chunks).toString('utf8')}));response.on('error',reject);
    });
    request.on('timeout',()=>request.destroy(new Error('The website took too long to respond. Paste its text instead.')));request.on('error',reject);
  });
}
export function plainText(input: string) {
  return input.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>{const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';}).replace(/&(?:nbsp|amp|quot|apos|lt|gt);/g,value=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[value]||' ')).replace(/\s+/g,' ').trim();
}
function attribute(tag: string,name: string) {return tag.match(new RegExp('\\b'+name+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]||'';}
export function extractSource(html: string,url: string): SiteSource {
  const title=plainText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'Your business').slice(0,160);
  const metas=html.match(/<meta\b[^>]*>/gi)||[];
  const description=plainText(attribute(metas.find(tag=>attribute(tag,'name').toLowerCase()==='description')||'','content')).slice(0,500);
  const headings=Array.from(html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)).map(match=>plainText(match[1])).filter(Boolean).slice(0,12);
  const text=plainText(html).slice(0,14000);
  const images=Array.from(html.matchAll(/<img\b[^>]*>/gi)).map(match=>attribute(match[0],'src')).map(src=>{try{const image=new URL(src,url);return image.protocol==='https:'&&!image.username&&!image.password&&image.host===new URL(url).host?image.href:'';}catch{return '';}}).filter(Boolean).slice(0,8);
  const email=html.match(/href=["']mailto:([^?"']+)/i)?.[1]||'';
  const phone=html.match(/href=["']tel:([^"']+)/i)?.[1]||'';
  return {url,title,description,headings,text,images:[...new Set(images)],email:email.slice(0,150),phone:phone.slice(0,50)};
}
export async function importWebsite(raw:string) {
  let url=siteUrl(raw);
  for(let i=0;i<4;i++){const result=await requestHtml(url);if(result.location){url=siteUrl(new URL(result.location,url).href);continue;}const source=extractSource(result.html,url.href);if(source.text.length<100)throw new Error('This site needs browser rendering to read. Paste its homepage text below instead.');return source;}
  throw new Error('The website redirects too many times. Paste its final URL or its text.');
}
