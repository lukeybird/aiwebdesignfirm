const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, mocks={}) {
 const output=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};new Function('require','module','exports',output)(name=>name in mocks?mocks[name]:require(name),module,module.exports);return module.exports;
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
test('extractor discards scripts, keeps actual content and same-host image URLs',()=>{
 const s=source.extractSource('<title>Acme</title><h1>Good design</h1><script>secretInstruction()</script><img src="/hero.jpg"><img src="https://tracker.example/x"><a href="mailto:hello@example.com">Contact</a>','https://example.com');
 assert.equal(s.headings[0],'Good design');assert.ok(!s.text.includes('secretInstruction'));assert.deepEqual(s.images,['https://example.com/hero.jpg']);assert.equal(s.email,'hello@example.com');
});
test('page renderer escapes hostile content and discards executable image schemes',()=>{
 const page=ai.importedDraft(fixture);page.headline='<script>alert(1)</script>';page.image='javascript:alert(1)';page.contactEmail='x@example.com" onmouseover="alert(1)';
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
