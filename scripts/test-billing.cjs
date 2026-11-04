const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const root = require('node:path').resolve(__dirname, '..') + '/';
let user = { id: 'user_own' }, calls = [], ownCustomer = 'cus_own';
const subscription = () => ({ id:'sub_own', customer:'cus_own', status:'trialing', trial_end:2000000000, cancel_at_period_end:false, default_payment_method:null, schedule:null, pending_update:null, items:{data:[{id:'si_own',price:{id:'price_diy',unit_amount:9999,currency:'usd',recurring:{interval:'month'}},current_period_end:2000000000}]}});
let records = [subscription()], setupOwner = 'cus_other', invoiceOwner = 'cus_other';
const billing = {
 billingOrigin:'https://aiwebdesignfirm.com', customerForUser:async id=>{assert.equal(id,'user_own');return ownCustomer;}, billingSubscriptions:async id=>{assert.equal(id,'cus_own');return records;}, currentSubscription:rs=>rs.find(s=>!['canceled','incomplete_expired'].includes(s.status)), configuredPlan:p=>p==='price_diy'?'Build It Yourself':null,
 stripeRequest:async(path,fields)=>{calls.push({path,fields});if(path.startsWith('setup_intents/'))return {customer:setupOwner,status:'succeeded',payment_method:'pm_owned',metadata:{site_user_id:'user_own'}};if(path.startsWith('invoices/'))return {customer:invoiceOwner,invoice_pdf:'https://pay.stripe.com/invoice/fixture/pdf'};if(path.startsWith('customers/'))return {id:'cus_own',name:'Fixture User',email:'fixture@example.com',address:{},invoice_settings:{default_payment_method:null}};if(path.startsWith('invoices?'))return {data:[],has_more:false};return {ok:true};}
};
function load(file){const code=ts.transpileModule(fs.readFileSync(root+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};const req=name=>name==='next/server'?{NextResponse:{json:(body,init)=>new Response(JSON.stringify(body),init)}}:name==='@/auth'?{auth:async()=>({user})}:name==='@/lib/stripe-billing'?billing:(()=>{throw Error('Unexpected import '+name)})();new Function('require','exports','module','process',code)(req,module.exports,module,{env:{STRIPE_DIY_PRICE_ID:'price_diy',STRIPE_EXPERT_PRICE_ID:'price_expert'}});return module.exports;}
const manage=load('app/api/billing/manage/route.ts'), invoice=load('app/api/billing/invoice/route.ts');
const request=(input,origin='https://aiwebdesignfirm.com')=>new Request('https://aiwebdesignfirm.com/api/billing/manage',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(input)});
(async()=>{
 let tests=0;
 user=null;assert.equal((await manage.POST(request({action:'cancel'}))).status,401);tests++;
 user={id:'user_own'};calls=[];assert.equal((await manage.POST(request({action:'cancel'},'https://other.example'))).status,403);assert.equal(calls.length,0);tests++;
 calls=[];let result=await manage.POST(request({action:'cancel',customer:'cus_victim',subscription:'sub_victim'}));assert.equal(result.status,200);assert.deepEqual(calls[0],{path:'subscriptions/sub_own',fields:{cancel_at_period_end:'true'}});tests++;
 calls=[];result=await manage.POST(request({action:'keep'}));assert.equal(result.status,200);assert.equal(calls[0].fields.cancel_at_period_end,'false');tests++;
 calls=[];result=await manage.POST(request({action:'change_plan',plan:'expert'}));assert.equal(result.status,200);assert.equal(calls[0].fields['items[0][id]'],'si_own');assert.equal(calls[0].fields['items[0][price]'],'price_expert');assert.equal(calls[0].fields.proration_behavior,'none');assert.equal(calls[0].fields.billing_cycle_anchor,'unchanged');assert.ok(!('trial_end' in calls[0].fields));tests++;
 calls=[];assert.equal((await manage.POST(request({action:'change_plan',plan:'arbitrary_price'}))).status,400);assert.equal(calls.length,0);tests++;
 calls=[];result=await manage.POST(request({action:'save_card',setupIntent:'seti_other'}));assert.equal(result.status,400);assert.equal(calls.filter(c=>c.fields).length,0);tests++;
 setupOwner='cus_own';calls=[];result=await manage.POST(request({action:'save_card',setupIntent:'seti_owned'}));assert.equal(result.status,200);assert.equal(calls[1].path,'customers/cus_own');assert.equal(calls[2].path,'subscriptions/sub_own');tests++;
 result=await invoice.GET(new Request('https://aiwebdesignfirm.com/api/billing/invoice?id=in_foreign'));assert.equal(result.status,404);tests++;
 calls=[];result=await invoice.GET(new Request('https://aiwebdesignfirm.com/api/billing/invoice?id=../../customers'));assert.equal(result.status,400);assert.equal(calls.length,0);tests++;
 ownCustomer=undefined;calls=[];result=await manage.POST(request({action:'cancel'}));assert.equal(result.status,400);assert.equal(calls.length,0);tests++;
 console.log(`${tests} billing ownership, authorization, and charge-safety checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
