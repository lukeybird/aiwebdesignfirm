import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { initDatabase, sql } from '@/lib/db';

type Params = { custom: string[] };

function normalizeCustom(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join('/')
    .replace(/^\/+|\/+$/g, '');
}

async function resolveProjectByCustom(custom: string) {
  try {
    const projects = await sql`
      SELECT id, slug, name
      FROM idea_projects
      WHERE live_link = ${custom}
      LIMIT 1
    `;
    if (projects.length === 0) return null;

    const project = projects[0] as { id: number; slug: string; name: string };
    const files = await sql`
      SELECT file_path
      FROM idea_project_files
      WHERE project_id = ${project.id}
      ORDER BY file_path
    `;
    const paths = (files as unknown as { file_path: string }[]).map((f) => f.file_path);
    const indexPath = paths.find((p) => p.toLowerCase() === 'index.html') || paths.find((p) => p.endsWith('/index.html'));

    return { ...project, indexPath, paths };
  } catch (e: any) {
    if (e?.message?.includes('idea_projects') && e?.message?.includes('does not exist')) {
      await initDatabase();
      return null;
    }
    throw e;
  }
}

export default async function ProjectCustomPage({ params }: { params: Promise<Params> }) {
  const { custom: customParts } = await params;
  const custom = normalizeCustom(customParts || []);
  if (!custom) notFound();

  const project = await resolveProjectByCustom(custom);
  if (!project) notFound();

  if (project.indexPath) {
    const encodedPath = project.indexPath.split('/').map(encodeURIComponent).join('/');
    redirect(`/ideas/${encodeURIComponent(project.slug)}/${encodedPath}`);
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-gray-400">This project has no index.html file yet.</p>
        <Link href={`/ideas/${encodeURIComponent(project.slug)}`} className="text-cyan-400 hover:text-cyan-300">
          Open project files
        </Link>
      </div>
    </main>
  );
}
