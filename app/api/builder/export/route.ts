import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { ensureBuilder } from '@/lib/builder/store';
import { pageSchema,renderPage } from '@/lib/builder/document';
export async function GET(request:Request){
 const user=(await auth())?.user;if(!user?.id)return new Response('Sign in required.',{status:401});
 const id=new URL(request.url).searchParams.get('id');if(!id||!/^[a-f0-9-]{36}$/i.test(id))return new Response('Invalid project.',{status:400});
 await ensureBuilder();const rows=await sql`SELECT document FROM site_builder_projects WHERE id=${id} AND user_id=${user.id}`;if(!rows[0])return new Response('Not found.',{status:404});
 return new Response(renderPage(pageSchema.parse(rows[0].document)),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="homepage.html"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
