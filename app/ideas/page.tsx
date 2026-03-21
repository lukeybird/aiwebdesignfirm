'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type IdeaFile = {
  filename: string;
  uploaded_at: string;
};

type IdeaProject = {
  slug: string;
  name: string;
  created_at: string;
};

export default function IdeasPage() {
  const [files, setFiles] = useState<IdeaFile[]>([]);
  const [projects, setProjects] = useState<IdeaProject[]>([]);
  const [uploading, setUploading] = useState(false);
  const [folderUploading, setFolderUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [projectSlug, setProjectSlug] = useState('');
  const [projectDisplayName, setProjectDisplayName] = useState('');

  const fetchFiles = async () => {
    setListError(null);
    try {
      const [fRes, pRes] = await Promise.all([
        fetch('/api/ideas/files'),
        fetch('/api/ideas/projects'),
      ]);
      const fData = await fRes.json().catch(() => ({}));
      const pData = await pRes.json().catch(() => ({}));
      if (fRes.ok) setFiles(fData.files || []);
      else setListError(fData.error || `Failed to load files (${fRes.status})`);
      if (pRes.ok) setProjects(pData.projects || []);
    } catch (e: any) {
      setFiles([]);
      setProjects([]);
      setListError(e.message || 'Failed to load list');
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setError(null);
    setSuccess(null);
    setUploading(true);
    let uploaded = 0;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.name.toLowerCase().endsWith('.html')) {
        setError('Only .html files are allowed.');
        continue;
      }
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/ideas/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
        uploaded++;
        await fetchFiles();
      } catch (e: any) {
        setError(e.message || 'Upload failed');
        break;
      }
    }
    if (uploaded > 0) setSuccess(`Uploaded ${uploaded} file(s).`);
    setUploading(false);
  };

  const handleFolderUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setError(null);
    setSuccess(null);
    setFolderUploading(true);
    try {
      const formData = new FormData();
      const slug =
        projectSlug.trim() ||
        (fileList[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] ||
        'project';
      formData.append('slug', slug);
      formData.append('displayName', projectDisplayName.trim() || slug);

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i] as File & { webkitRelativePath?: string };
        const rel = file.webkitRelativePath || file.name;
        formData.append('file', file);
        formData.append('path', rel);
      }

      const res = await fetch('/api/ideas/project-upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      setSuccess(`Project uploaded: /ideas/${data.project?.slug}`);
      setProjectSlug('');
      setProjectDisplayName('');
      await fetchFiles();
    } catch (e: any) {
      setError(e.message || 'Folder upload failed');
    } finally {
      setFolderUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const hasIndex = files.some((f) => f.filename.toLowerCase() === 'index.html');

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              ← Home
            </Link>
            <h1 className="text-2xl font-bold">Ideas</h1>
          </div>
          <Link
            href="/ideas/new"
            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm"
          >
            + New project
          </Link>
        </div>

        <p className="text-gray-400 text-sm -mt-4">
          <strong className="text-gray-300">New project</strong> — ZIP, folder, or add files one-by-one with paths (
          <code className="text-cyan-400">/ideas/new</code>). Single HTML upload below is for one file only.
        </p>

        <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="text-lg font-semibold mb-3">Upload HTML</h2>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <input
              type="file"
              accept=".html"
              multiple
              className="hidden"
              id="ideas-upload"
              onChange={(e) => {
                handleUpload(e.target.files);
                e.target.value = '';
              }}
            />
            <label htmlFor="ideas-upload" className="cursor-pointer block text-gray-300 hover:text-white">
              {uploading ? (
                <span>Uploading…</span>
              ) : (
                <>
                  <span className="font-medium">Drop HTML files here</span>
                  <span className="text-gray-500"> or click to choose</span>
                </>
              )}
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-gray-600 bg-gray-800/30 p-6">
          <h2 className="text-lg font-semibold mb-2">Quick folder upload (optional)</h2>
          <p className="text-gray-400 text-sm mb-4">
            Same as <Link href="/ideas/new" className="text-cyan-400 underline">New project → Choose folder</Link>, but
            with slug/name fields here. Prefer <strong className="text-gray-300">New project</strong> for ZIP or manual
            files.
          </p>
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">URL slug (optional)</label>
              <input
                type="text"
                value={projectSlug}
                onChange={(e) => setProjectSlug(e.target.value)}
                placeholder="my-site (defaults to top folder name)"
                className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Display name (optional)</label>
              <input
                type="text"
                value={projectDisplayName}
                onChange={(e) => setProjectDisplayName(e.target.value)}
                placeholder="My project"
                className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500"
              />
            </div>
          </div>
          <input
            type="file"
            className="hidden"
            id="ideas-folder-upload"
            multiple
            // @ts-expect-error webkitdirectory enables folder picker in Chromium
            webkitdirectory=""
            onChange={(e) => {
              handleFolderUpload(e.target.files);
              e.target.value = '';
            }}
          />
          <label
            htmlFor="ideas-folder-upload"
            className="inline-block cursor-pointer px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium text-sm"
          >
            {folderUploading ? 'Uploading folder…' : 'Choose folder…'}
          </label>
        </section>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        {listError && (
          <p className="text-amber-400 text-sm">
            Could not load list. Run{' '}
            <a href="/api/db/init" target="_blank" rel="noopener noreferrer" className="underline">
              /api/db/init
            </a>{' '}
            once, then refresh.
          </p>
        )}

        {projects.length > 0 && (
          <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="text-lg font-semibold mb-3">Projects (folders)</h2>
            <ul className="space-y-2">
              {projects.map((p) => (
                <li
                  key={p.slug}
                  className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                >
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-500 text-sm font-mono ml-2">/ideas/{p.slug}</span>
                  </div>
                  <Link
                    href={`/ideas/${encodeURIComponent(p.slug)}`}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
                  >
                    Open project
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {files.length > 0 && (
          <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="text-lg font-semibold mb-3">Single HTML files</h2>
            <ul className="space-y-2">
              {files.map((f) => (
                <li
                  key={f.filename}
                  className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                >
                  <span className="font-mono text-sm">{f.filename}</span>
                  <Link
                    href={`/ideas/${encodeURIComponent(f.filename)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
            {hasIndex && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <Link
                  href="/ideas/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium"
                >
                  Open index.html
                </Link>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
