const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pathUtil = require('node:path');
const ts = require('typescript');
function load(path, mocks={}) {
 const output=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};new Function('require','module','exports',output)(name=>name in mocks?mocks[name]:name.startsWith('.')?load(pathUtil.join(pathUtil.dirname(path),name+'.ts'),mocks):require(name),module,module.exports);return module.exports;
}
const source=load('lib/builder/source.ts');
const document=load('lib/builder/document.ts');
const ai=load('lib/builder/ai.ts',{'./document':document});
const fixture={url:'https://example.com',title:'Acme',description:'Local design services',headings:['Design with care','Web design'],text:'Acme makes useful websites for local businesses. '.repeat(4),images:[],email:'hello@example.com',phone:''};
test('public address guard rejects private, loopback, metadata and reserved networks',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','198.18.0.1','0.0.0.0','224.0.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(source.publicAddress(ip),false,ip);
 for(const ip of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111'])assert.equal(source.publicAddress(ip),true,ip);
});
test('URL handling rejects credentials and unusual ports; canonicalizes numeric hosts',()=>{
 for(const value of ['https://user:pass@example.com','http://example.com:3000','localhost'])assert.throws(()=>source.siteUrl(value));
 assert.equal(source.siteUrl('example.com/#hello').href,'https://example.com/');
 assert.equal(source.publicAddress(source.siteUrl('http://2130706433').hostname),false);
});
test('import rejects private DNS before making a connection, including mixed answers',async()=>{
 for(const answers of [[{address:'127.0.0.1',family:4}],[{address:'1.1.1.1',family:4},{address:'10.0.0.1',family:4}]]){
 const blocked=load('lib/builder/source.ts',{'node:dns/promises':{lookup:async()=>answers}});
 await assert.rejects(blocked.importWebsite('https://example.com'),/not a public/);
 }
});
test('extractor discards scripts, keeps actual content and original HTTPS image URLs',()=>{
 const s=source.extractSource('<title>Acme</title><h1>Good design</h1><script>secretInstruction()</script><img src="/hero.jpg"><img src="https://tracker.example/x"><a href="mailto:hello@example.com">Contact</a>','https://example.com');
 assert.equal(s.headings[0],'Good design');assert.ok(!s.text.includes('secretInstruction'));assert.deepEqual(s.images,['https://example.com/hero.jpg','https://tracker.example/x']);assert.equal(s.email,'hello@example.com');
});
test('page renderer escapes hostile content and discards executable image schemes',()=>{
 const page=ai.importedDraft(fixture);page.headline='<script>alert(1)</script>';page.content.sections[0].heading=page.headline;page.image='javascript:alert(1)';page.contactEmail='x@example.com" onmouseover="alert(1)';
 const html=document.renderPage(document.pageSchema.parse(page));
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('src="javascript:'));assert.ok(!html.includes(' onmouseover="'));
 assert.throws(()=>document.pageSchema.parse({...page,accent:'red;display:none'}));
});
test('fallback document meets schema even with a long business name',()=>{
 document.pageSchema.parse(ai.importedDraft({...fixture,title:'A'.repeat(160)}));
});
function route({user={id:'owner'},access=true,rows=[]}={}){
 const calls=[];const sql=async(strings,...values)=>{calls.push({text:strings.join('?'),values});return rows.shift()||[];};sql.json=v=>v;
 const api=load('app/api/builder/route.ts',{'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},'@/auth':{auth:async()=>user?{user}:null},'@/app/api/billing/route':{GET:async()=>Response.json({hasAccess:access})},'@/lib/db':{sql},'@/lib/builder/source':source,'@/lib/builder/document':document,'@/lib/builder/ai':ai,'@/lib/builder/store':{ensureBuilder:async()=>{},consumeGeneration:async()=>{}}});
 return {api,calls};
}
const id='12345678-1234-1234-1234-123456789012';
const request=(body,origin='https://aiwebdesignfirm.com')=>new Request('https://aiwebdesignfirm.com/api/builder',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('builder rejects unauthenticated and cross-origin mutations',async()=>{
 assert.equal((await route({user:null}).api.POST(request({}))).status,401);
 assert.equal((await route().api.POST(request({},'https://evil.example'))).status,403);
});
test('foreign projects are unavailable and query is constrained to owner',async()=>{
 const {api,calls}=route();assert.equal((await api.POST(request({action:'save',id,revision:1}))).status,404);
 assert.ok(calls[0].text.includes('user_id='));assert.ok(calls[0].values.includes('owner'));
});
test('unpublishing remains available after subscription ends and is owner constrained',async()=>{
 const {api,calls}=route({access:false,rows:[[{id}]]});assert.equal((await api.POST(request({action:'unpublish',id}))).status,200);
 assert.ok(calls[0].text.includes('published_document=NULL'));assert.ok(calls[0].values.includes('owner'));
});
test('stale saves and publishing are rejected',async()=>{
 for(const action of ['save','publish']){
 const {api,calls}=route({rows:[[{id,revision:2}]]});assert.equal((await api.POST(request({action,id,revision:1}))).status,409);assert.equal(calls.length,1);
 }
});
test('publishing snapshots saved document with atomic revision check',async()=>{
 const saved=ai.importedDraft(fixture);const {api,calls}=route({rows:[[{id,revision:3,document:saved}],[{id}]]});
 assert.equal((await api.POST(request({action:'publish',id,revision:3,document:{headline:'Injected draft'}}))).status,200);
 assert.deepEqual(calls[1].values[0],saved);assert.ok(calls[1].text.includes('AND revision='));
});
test('manual save rejects image URLs that were not imported',async()=>{
 const page={...ai.importedDraft(fixture),image:'https://evil.example/pixel'};
 const {api}=route({rows:[[{id,revision:1,source:fixture}]]});assert.equal((await api.POST(request({action:'save',id,revision:1,document:page}))).status,400);
});

test('single-page extraction keeps prices, original articles, copy and exact URL destinations',()=>{
 const html=`<nav><a href="/about">About us</a></nav><main><h1>Our consulting packages</h1><p>Book practical help.</p><section id="packages"><h2>Packages</h2><article><h3>One session</h3><p>$250</p><p>One hour, no contract.</p><ul><li>Video call</li><li>Written notes</li></ul><a href="/checkout?plan=single">Book now</a></article><article><h3>Three sessions</h3><p>$650</p><a href="https://booking.example/package">Reserve</a></article></section></main><footer><p>Real footer</p></footer>`;
 const imported=source.extractSource(html,'https://example.com/services/consulting?lang=en');
 const doc=ai.importedDraft(imported);const htmlOut=document.renderPage(doc);
 assert.equal(imported.url,'https://example.com/services/consulting?lang=en');
 for(const value of ['Our consulting packages','One session','$250','$650','One hour, no contract.','Video call','Written notes','https://example.com/checkout?plan=single','https://booking.example/package','Real footer'])assert.ok(htmlOut.includes(value),value);
 for(const value of ['Built around your needs','Take the next step','Add your contact details','Get in touch'])assert.ok(!htmlOut.includes(value),value);
 assert.equal(doc.content.sections.find(s=>s.heading==='Packages').cards.length,2);
});
test('extractor does not crawl the site or invent navigation and contact sections',()=>{
 const doc=ai.importedDraft(source.extractSource('<main><h1>Our menu</h1><p>Soup — $12</p><p>Salad — $15</p><a href="/order">Order</a></main>','https://example.com/menu'));
 const html=document.renderPage(doc);
 assert.ok(html.includes('https://example.com/order'));assert.ok(!html.includes('>Services</a>'));assert.ok(!html.includes('About our'));assert.equal(doc.content.navigation.length,0);
});
test('internal page anchors stay local when their sections were imported',()=>{
 const doc=ai.importedDraft(source.extractSource('<main><h1>Our plans</h1><a href="#prices">See pricing</a><section id="prices"><h2>Prices</h2><p>Actual pricing.</p></section></main>','https://example.com/nested/page'));
 assert.ok(document.renderPage(doc).includes('href="#prices"'));
});
test('AI styling cannot alter content, prices or destinations even if it returns replacement content',async()=>{
 const imported=source.extractSource('<main><h1>Real service</h1><p>$250 per session.</p><a href="/buy?price=250">Buy</a></main>','https://example.com/service');
 const before=ai.importedDraft(imported);const oldFetch=global.fetch;const oldKey=process.env.OPENAI_API_KEY;
 process.env.OPENAI_API_KEY='unit-test';
 global.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({accent:'coral',theme:'light',font:'editorial',sections:before.content.sections.map(s=>({id:s.id,layout:'center',tone:'plain'})),headline:'Fake claim',content:{sections:[]}})}}]});
 try{const after=await ai.redesign(imported,'ignored');assert.equal(after.accent,'coral');assert.equal(after.headline,before.headline);assert.deepEqual(after.content.sections.map(s=>s.blocks),before.content.sections.map(s=>s.blocks));assert.ok(document.renderPage(after).includes('$250 per session.'));}
 finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
});
test('inline and list links stay in place instead of becoming duplicate CTA buttons',()=>{
 const doc=ai.importedDraft(source.extractSource('<main><h1>Repairs</h1><p>Read about <a href="/repairs">our repairs</a> here.</p><ul><li><a href="/water">Water lines</a></li><li><a href="/sewers">Sewer lines</a></li></ul></main>','https://example.com/services'));
 const html=document.renderPage(doc);assert.equal((html.match(/href="https:\/\/example.com\/repairs"/g)||[]).length,1);assert.ok(html.includes('<li><a href="https://example.com/water"'));assert.ok(!html.includes('class="action"'));
});
test('large menus collapse automatically while keeping original destinations',()=>{
 const nav=Array.from({length:14},(_,i)=>`<a href="/service-${i}">Service ${i}</a>`).join('');
 const doc=ai.importedDraft(source.extractSource('<meta property="og:site_name" content="Acme"><nav>'+nav+'</nav><main><h1>Our page</h1><p>Original copy.</p></main>','https://example.com/services'));
 const html=document.renderPage(doc);assert.equal(doc.businessName,'Acme');assert.ok(html.includes('<summary>More</summary>'));assert.ok(html.includes('https://example.com/service-13'));
});
test('site footer is separated from page content and original preview imagery is retained',()=>{
 const doc=ai.importedDraft(source.extractSource('<meta property="og:image" content="https://example.com/team.jpg"><main><h1>Our page</h1><p>Body copy.</p><div class="site-footer"><h4>Reach us</h4><a href="tel:+15551234567">Call</a></div></main>','https://example.com/services'));
 assert.ok(doc.content.footer.some(b=>b.text==='Reach us'));assert.ok(!doc.content.sections.some(s=>s.blocks.some(b=>b.text==='Reach us')));assert.ok(document.renderPage(doc).includes('src="https://example.com/team.jpg"'));
});
