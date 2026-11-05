import { sql } from '@/lib/db';
import { ensureBuilder } from '@/lib/builder/store';
import { pageSchema,renderPage,previewPolicy } from '@/lib/builder/document';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;if(!/^[a-f0-9]{24}$/.test(slug))return new Response('Page not found.',{status:404});
 await ensureBuilder();const rows=await sql`SELECT published_document FROM site_builder_projects WHERE slug=${slug} AND published_document IS NOT NULL`;
 if(!rows[0])return new Response('Page not found.',{status:404});
 return new Response(renderPage(pageSchema.parse(rows[0].published_document)),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':previewPolicy.replace("frame-ancestors 'self'","frame-ancestors 'none'"),'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
