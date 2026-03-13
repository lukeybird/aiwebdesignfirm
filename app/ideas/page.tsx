'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type IdeaFile = {
  filename: string;
  uploaded_at: string;
};

export default function IdeasPage() {
  const [files, setFiles] = useState<IdeaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fetchFiles = async () => {
    setListError(null);
    try {
      const res = await fetch('/api/ideas/files');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFiles(data.files || []);
      else setListError(data.error || `Failed to load (${res.status})`);
    } catch (e: any) {
      setFiles([]);
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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const hasIndex = files.some((f) => f.filename.toLowerCase() === 'index.html');

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Home
          </Link>
          <h1 className="text-2xl font-bold">Ideas</h1>
        </div>

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
            <label
              htmlFor="ideas-upload"
              className="cursor-pointer block text-gray-300 hover:text-white"
            >
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
          {error && (
            <p className="mt-3 text-red-400 text-sm">{error}</p>
          )}
          {success && (
            <p className="mt-3 text-green-400 text-sm">{success}</p>
          )}
        </section>

        {listError && (
          <p className="text-amber-400 text-sm">
            Could not load file list. Run <a href="/api/db/init" target="_blank" rel="noopener noreferrer" className="underline">/api/db/init</a> once to create tables, then refresh.
          </p>
        )}

        {files.length > 0 && (
          <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
            <h2 className="text-lg font-semibold mb-3">Uploaded files</h2>
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
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
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
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors"
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
