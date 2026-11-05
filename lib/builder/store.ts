import { sql } from '@/lib/db';
import { ensureSiteUserTables } from '@/lib/site-users';
export async function ensureBuilder(){
  await ensureSiteUserTables();
  await sql`CREATE TABLE IF NOT EXISTS site_builder_projects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,source_url TEXT NOT NULL,source JSONB NOT NULL,goal TEXT NOT NULL,document JSONB NOT NULL,revision INTEGER NOT NULL DEFAULT 1,slug TEXT NOT NULL UNIQUE,published_document JSONB,mode TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS site_builder_versions (project_id UUID NOT NULL REFERENCES site_builder_projects(id) ON DELETE CASCADE,revision INTEGER NOT NULL,document JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(project_id,revision))`;
  await sql`CREATE TABLE IF NOT EXISTS site_builder_usage (user_id UUID NOT NULL REFERENCES site_users(id) ON DELETE CASCADE,day DATE NOT NULL DEFAULT CURRENT_DATE,calls INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,day))`;
}
export async function consumeGeneration(userId:string){
  const rows=await sql`INSERT INTO site_builder_usage(user_id,day,calls) VALUES(${userId},CURRENT_DATE,1) ON CONFLICT(user_id,day) DO UPDATE SET calls=site_builder_usage.calls+1 WHERE site_builder_usage.calls<10 RETURNING calls`;
  if(!rows.length)throw new Error('You have reached today’s 10 import/AI-edit limit. Manual editing is still available.');
}
