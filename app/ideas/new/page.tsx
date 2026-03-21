'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function clientSlugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

type ManualRow = { id: string; path: string; file: File | null };

export default function NewIdeaProjectPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [mode, setMode] = useState<'zip' | 'folder' | 'manual'>('zip');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manualRows, setManualRows] = useState<ManualRow[]>(() => [
    { id: 'row-1', path: '', file: null },
  ]);

  const effectiveSlug = clientSlugify(slug || displayName || 'project') || 'project';

  const onNameChange = (v: string) => {
    setDisplayName(v);
    if (!slugTouched) setSlug(clientSlugify(v));
  };

  const addManualRow = () => {
    setManualRows((r) => [
      ...r,
      { id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, path: '', file: null },
    ]);
  };

  const removeManualRow = (id: string) => {
    setManualRows((r) => (r.length <= 1 ? r : r.filter((x) => x.id !== id)));
  };

  const updateManualRow = (id: string, patch: Partial<ManualRow>) => {
    setManualRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const submitZip = async (file: File | null) => {
    if (!file) {
      setError('Choose a ZIP file.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.append('slug', effectiveSlug);
      fd.append('displayName', displayName.trim() || effectiveSlug);
      fd.append('zip', file);
      const res = await fetch('/api/ideas/project-upload-zip', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      setSuccess(`Uploaded ${data.project?.fileCount} files → /ideas/${data.project?.slug}`);
      setTimeout(() => router.push(`/ideas/${encodeURIComponent(data.project.slug)}`), 1200);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const submitFolder = async (fileList: FileList | null) => {
    if (!fileList?.length) {
      setError('Choose a folder.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.append('slug', effectiveSlug);
      fd.append('displayName', displayName.trim() || effectiveSlug);
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i] as File & { webkitRelativePath?: string };
        fd.append('file', f);
        fd.append('path', f.webkitRelativePath || f.name);
      }
      const res = await fetch('/api/ideas/project-upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      setSuccess(`Uploaded ${data.project?.fileCount} files → /ideas/${data.project?.slug}`);
      setTimeout(() => router.push(`/ideas/${encodeURIComponent(data.project.slug)}`), 1200);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const submitManual = async () => {
    const rows = manualRows.filter((r) => r.file && r.path.trim());
    if (!rows.length) {
      setError('Add at least one file with a path (e.g. app/page.tsx).');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.append('slug', effectiveSlug);
      fd.append('displayName', displayName.trim() || effectiveSlug);
      for (const r of rows) {
        if (!r.file) continue;
        fd.append('file', r.file);
        fd.append('path', r.path.trim().replace(/^\/+/, ''));
      }
      const res = await fetch('/api/ideas/project-upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      setSuccess(`Uploaded ${data.project?.fileCount} files → /ideas/${data.project?.slug}`);
      setTimeout(() => router.push(`/ideas/${encodeURIComponent(data.project.slug)}`), 1200);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/ideas" className="text-gray-400 hover:text-white">
            ← Ideas
          </Link>
          <h1 className="text-2xl font-bold">New project</h1>
        </div>

        <p className="text-gray-400 text-sm">
          Give your project a name and URL. Then upload a <strong className="text-gray-300">ZIP</strong> (easiest for
          nested folders), <strong className="text-gray-300">pick a folder</strong> (Chrome/Edge), or{' '}
          <strong className="text-gray-300">add files one by one</strong> with paths like{' '}
          <code className="text-cyan-400">public/logo.png</code> or <code className="text-cyan-400">app/index.html</code>.
        </p>
        <p className="text-amber-200/80 text-sm border border-amber-500/30 rounded-lg p-3 bg-amber-500/10">
          <strong>Do not zip <code>node_modules</code></strong> — it is huge and skipped automatically if present. For a
          Next.js/React repo, zip only the files you need to preview (e.g. <code>public</code>, static HTML, or a built{' '}
          <code>out</code> folder). This host serves static files only; it does not run Node on the server.
        </p>

        <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Project name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="My landing page"
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">URL slug (path on site)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="my-landing-page"
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-500 font-mono text-sm"
            />
            <p className="text-gray-500 text-xs mt-1">
              Live at <code className="text-cyan-400">/ideas/{effectiveSlug || '…'}</code>
            </p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {(['zip', 'folder', 'manual'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                mode === m ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {m === 'zip' && 'Upload ZIP'}
              {m === 'folder' && 'Choose folder'}
              {m === 'manual' && 'Add files manually'}
            </button>
          ))}
        </div>

        {mode === 'zip' && (
          <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 space-y-4">
            <h2 className="text-lg font-semibold">ZIP file</h2>
            <p className="text-gray-400 text-sm">
              On Mac: right-click your project folder → Compress. Exclude or delete <code>node_modules</code> first to
              keep the ZIP small.
            </p>
            <input
              type="file"
              accept=".zip,application/zip"
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-600 file:text-white"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) submitZip(f);
              }}
            />
          </section>
        )}

        {mode === 'folder' && (
          <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Choose folder</h2>
            <p className="text-gray-400 text-sm">Works in Chrome, Edge, and other Chromium browsers.</p>
            <input
              type="file"
              className="hidden"
              id="new-proj-folder"
              multiple
              // @ts-expect-error webkitdirectory
              webkitdirectory=""
              disabled={busy}
              onChange={(e) => {
                submitFolder(e.target.files);
                e.target.value = '';
              }}
            />
            <label
              htmlFor="new-proj-folder"
              className={`inline-block px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}
            >
              {busy ? 'Uploading…' : 'Select folder…'}
            </label>
          </section>
        )}

        {mode === 'manual' && (
          <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Files & paths</h2>
            <p className="text-gray-400 text-sm">
              For each file, set the path as it should appear in the project (e.g. <code>index.html</code>,{' '}
              <code>css/style.css</code>).
            </p>
            <ul className="space-y-3">
              {manualRows.map((row) => (
                <li key={row.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                  <div className="flex-1 w-full">
                    <label className="text-xs text-gray-500">Path in project</label>
                    <input
                      type="text"
                      value={row.path}
                      onChange={(e) => updateManualRow(row.id, { path: e.target.value })}
                      placeholder="app/page.tsx"
                      className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white font-mono text-sm"
                    />
                  </div>
                  <div className="w-full sm:w-auto">
                    <label className="text-xs text-gray-500">File</label>
                    <input
                      type="file"
                      onChange={(e) => updateManualRow(row.id, { file: e.target.files?.[0] || null })}
                      className="block w-full text-sm text-gray-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeManualRow(row.id)}
                    className="text-red-400 text-sm px-2 py-2 shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addManualRow}
              className="text-cyan-400 text-sm hover:text-cyan-300"
            >
              + Add another file
            </button>
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={submitManual}
                className="px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-50"
              >
                {busy ? 'Uploading…' : 'Upload project'}
              </button>
            </div>
          </section>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}
      </div>
    </main>
  );
}
