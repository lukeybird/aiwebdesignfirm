const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,mocks={}) {const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>name in mocks?mocks[name]:require(name),module,module.exports);return module.exports;}
const lib=load('lib/pixashop.ts');
test('eligible paid and trial subscriptions grant bounded leases',()=>{
 const item={price:{id:'eligible'},current_period_end:2000};
 assert.equal(lib.accessDuration([{status:'active',items:{data:[item]}}],['eligible'],1000),300);
 assert.equal(lib.accessDuration([{status:'trialing',trial_end:1017,items:{data:[item]}}],['eligible'],1000),17);
 for(const status of ['canceled','unpaid','past_due','incomplete']) assert.equal(lib.accessDuration([{status,items:{data:[item]}}],['eligible'],1000),0);
 assert.equal(lib.accessDuration([{status:'trialing',trial_end:999,items:{data:[item]}}],['eligible'],1000),0);
 assert.equal(lib.accessDuration([{status:'active',items:{data:[{price:{id:'other'},current_period_end:2000}]}}],['eligible'],1000),0);
 assert.equal(lib.accessDuration([{status:'active',items:{data:[{price:{id:'eligible'}}]}}],['eligible'],1000),0);
});
test('download selection rejects upstream, unknown platforms and injected URLs',()=>{
 const name='pixashop-0.20.1-windows-x64-portable.zip';const url='https://github.com/lukeybird/pixashop/releases/download/v0.20.1/'+name;
 assert.equal(lib.releaseAsset([{name,browser_download_url:url}],'windows').browser_download_url,url);
 for(const bad of ['https://evil.example/'+name,'https://github.com/storytold/photocraft/releases/download/v1/'+name,url+'\r\nLocation: bad']) assert.equal(lib.releaseAsset([{name,browser_download_url:bad}],'windows'),undefined);
 assert.equal(lib.releaseAsset([{name,browser_download_url:url}],'mac'),undefined);
});
function device(user={id:'owner'}) {
 const calls=[];const sql=async(strings,...values)=>{calls.push({text:strings.join('?'),values});return [];};
 const api=load('app/api/pixashop/device/route.ts',{'@/auth':{auth:async()=>user?{user}:null},'@/lib/db':{sql},'@/lib/site-users':{ensureSiteUserTables:async()=>{}},'@/lib/password-accounts':{allowAuthAttempt:async()=>true},'@/lib/pixashop':lib});return {api,calls};
}
function request(body,origin='https://aiwebdesignfirm.com') {return new Request('https://aiwebdesignfirm.com/api/pixashop/device',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});}
process.env.PIXASHOP_ENABLED='true';
test('claim and revocation require account session and trusted origin',async()=>{
 assert.equal((await device(null).api.POST(request({action:'activate',code:'AAAAAAAAAA'}))).status,401);
 assert.equal((await device().api.POST(request({action:'revoke-all'},'https://evil.example'))).status,403);
 const {api,calls}=device();assert.equal((await api.POST(request({action:'revoke-all'}))).status,200);
 const revoke=calls.find(c=>c.text.includes('SET revoked=TRUE'));assert.ok(revoke.text.includes('WHERE user_id='));assert.deepEqual(revoke.values,['owner']);
});
test('pairing stores only a digest and invalid or expired tokens grant no access',async()=>{
 const {api,calls}=device();const result=await (await api.POST(request({action:'begin'}))).json();assert.ok(lib.validDeviceToken(result.token));assert.match(result.code,/^[A-F0-9]{10}$/);
 const insert=calls.find(c=>c.text.startsWith('INSERT'));assert.ok(insert.values.includes(lib.tokenHash(result.token)));assert.ok(!insert.values.includes(result.token));
 for(const token of ['invalid','a'.repeat(64)]) {const body=await (await api.POST(request({action:'check',token}))).json();assert.equal(body.access,false);assert.equal(body.accessSeconds,0);}
});
