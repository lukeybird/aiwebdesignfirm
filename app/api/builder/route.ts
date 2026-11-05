import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { auth } from '@/auth';
import { GET as getBilling } from '@/app/api/billing/route';
import { sql } from '@/lib/db';
import { importWebsite, type SiteSource } from '@/lib/builder/source';
import { pageSchema } from '@/lib/builder/document';
import { importedDraft, providerConfigured, redesign } from '@/lib/builder/ai';
import { ensureBuilder,consumeGeneration } from '@/lib/builder/store';
export const maxDuration=60;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
  const user=(await auth())?.user;if(!user?.id)return reply({error:'Sign in required.'},401);
  try{
    await ensureBuilder();const id=new URL(request.url).searchParams.get('id');
    if(id){if(!/^[a-f0-9-]{36}$/i.test(id))return reply({error:'Invalid project.'},400);
      const rows=await sql`SELECT id,source_url,goal,document,revision,slug,published_document IS NOT NULL AS published,mode,source->'images' AS images FROM site_builder_projects WHERE id=${id} AND user_id=${user.id}`;
      if(!rows[0])return reply({error:'Project not found.'},404);
      const versions=await sql`SELECT revision,created_at FROM site_builder_versions WHERE project_id=${id} ORDER BY revision DESC LIMIT 30`;
      return reply({project:rows[0],versions,aiAvailable:providerConfigured()});
    }
    const projects=await sql`SELECT id,source_url,document->>'businessName' AS name,revision,slug,published_document IS NOT NULL AS published,updated_at FROM site_builder_projects WHERE user_id=${user.id} ORDER BY updated_at DESC LIMIT 100`;
    return reply({projects,aiAvailable:providerConfigured()});
  }catch{return reply({error:'Could not load projects. Please try again.'},502);}
}
export async function POST(request:Request){
  const user=(await auth())?.user;if(!user?.id)return reply({error:'Sign in required.'},401);
  if(request.headers.get('origin')!=='https://aiwebdesignfirm.com')return reply({error:'Invalid request origin.'},403);
  try{
    const text=await request.text();if(text.length>60000)return reply({error:'Request too large.'},413);
    const input=JSON.parse(text);
    await ensureBuilder();
    const billing=await (await getBilling()).json();
    if(!billing.hasAccess)return reply({error:'An active subscription or trial is required to build and publish.',requiresPlan:true},403);
    if(input.action==='create'){
      const goal=typeof input.goal==='string'?input.goal.trim().slice(0,500):'Get more inquiries';
      if(!input.ownsSite)return reply({error:'Confirm that you own or have permission to use this website’s content.'},400);
      await consumeGeneration(user.id);
      let source:SiteSource;
      if(typeof input.pastedText==='string'&&input.pastedText.trim().length>=100){source={url:'',title:typeof input.businessName==='string'?input.businessName.slice(0,100):'Your business',description:'',headings:[],text:input.pastedText.trim().slice(0,14000),images:[],email:'',phone:''};}
      else{if(typeof input.url!=='string'||input.url.length>2000)return reply({error:'Enter a website URL or paste at least 100 characters of homepage text.'},400);source=await importWebsite(input.url);}
      let document=importedDraft(source),mode='imported',notice='';
      if(providerConfigured()){try{document=await redesign(source,goal);mode='ai';}catch{notice='The AI service is temporarily unavailable. We saved an imported layout you can edit manually.';}}
      else notice='Your content was placed into a modern layout. AI rewriting is not enabled yet; all fields can be edited manually.';
      const slug=randomBytes(12).toString('hex');
      const rows=await sql`INSERT INTO site_builder_projects(user_id,source_url,source,goal,document,slug,mode) VALUES(${user.id},${source.url},${sql.json(source)},${goal},${sql.json(document)},${slug},${mode}) RETURNING id`;
      await sql`INSERT INTO site_builder_versions(project_id,revision,document) VALUES(${rows[0].id},1,${sql.json(document)})`;
      return reply({id:rows[0].id,notice});
    }
    const id=input.id;if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))return reply({error:'Invalid project.'},400);
    const rows=await sql`SELECT id,source,document,revision FROM site_builder_projects WHERE id=${id} AND user_id=${user.id}`;
    const current=rows[0];if(!current)return reply({error:'Project not found.'},404);
    if(input.action==='publish'||input.action==='unpublish'){
      if(input.action==='publish'&&Number(input.revision)!==current.revision)return reply({error:'Your project changed. Reload before publishing.'},409);
      await sql`UPDATE site_builder_projects SET published_document=${input.action==='publish'?sql.json(current.document):null},updated_at=NOW() WHERE id=${id} AND user_id=${user.id}`;
      return reply({ok:true});
    }
    if(Number(input.revision)!==current.revision)return reply({error:'A newer version exists. Reload the project before saving.'},409);
    let document;
    if(input.action==='save')document=pageSchema.parse(input.document);
    else if(input.action==='edit_ai'){
      if(typeof input.instruction!=='string'||!input.instruction.trim()||input.instruction.length>1500)return reply({error:'Describe the change in 1–1500 characters.'},400);
      await consumeGeneration(user.id);document=await redesign(current.source,'Improve this homepage',current.document,input.instruction);
    }else if(input.action==='restore'){
      const versions=await sql`SELECT document FROM site_builder_versions WHERE project_id=${id} AND revision=${Number(input.version)}`;
      if(!versions[0])return reply({error:'Version not found.'},404);document=pageSchema.parse(versions[0].document);
    }else return reply({error:'Unknown action.'},400);
    if((document.image && !current.source.images.includes(document.image)) || (document.logo && !current.source.images.includes(document.logo)))return reply({error:'Choose an imported image or remove the image.'},400);
    const updated=await sql`WITH saved AS (UPDATE site_builder_projects SET document=${sql.json(document)},revision=revision+1,updated_at=NOW() WHERE id=${id} AND user_id=${user.id} AND revision=${current.revision} RETURNING id,revision,document) INSERT INTO site_builder_versions(project_id,revision,document) SELECT id,revision,document FROM saved RETURNING revision`;
    if(!updated.length)return reply({error:'A newer version exists. Reload before saving.'},409);
    return reply({ok:true});
  }catch(error){const message=error instanceof Error?error.message:'Could not build your page.';return reply({error:message.startsWith('[')?'Some page fields are invalid. Check their lengths and try again.':message},400);}
}
