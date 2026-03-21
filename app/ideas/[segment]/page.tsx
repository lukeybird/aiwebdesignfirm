'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type ViewMode = 'preview' | 'code';

function SingleHtmlViewer({ filename }: { filename: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [codeContent, setCodeContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    fetch(`/api/ideas/files?filename=${encodeURIComponent(filename)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const file = data?.file;
        if (!file) {
          setNotFound(true);
          return;
        }
        if (file.content) {
          setContent(file.content);
          setCodeContent(file.content);
        } else if (file.blob_url) setBlobUrl(file.blob_url);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [filename]);

  const canEdit = content !== null;
  const displayContent = codeContent || content || '';

  const handleSaveCode = async () => {
    if (!canEdit) return;
    setSaveMessage(null);
    setSaving(true);
    try {
      const res = await fetch('/api/ideas/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: codeContent }),
      });
      if (res.ok) {
        setSaveMessage('success');
        setContent(codeContent);
      } else setSaveMessage('error');
    } catch {
      setSaveMessage('error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </main>
    );
  }

  if (notFound || (!content && !blobUrl)) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-gray-400">File not found.</p>
        <Link href="/ideas" className="text-cyan-400 hover:text-cyan-300">
          ← Back to Ideas
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-gray-900">
      <div className="flex-shrink-0 py-2 px-4 border-b border-gray-700 flex flex-wrap items-center gap-3">
        <Link href="/ideas" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Back to Ideas
        </Link>
        <span className="text-gray-500 text-sm font-mono">{filename}</span>
        {canEdit && (
          <>
            <div className="flex gap-1 ml-2">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'preview' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  viewMode === 'code' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Preview code
              </button>
            </div>
            <button
              type="button"
              onClick={handleSaveCode}
              disabled={saving}
              className="px-3 py-1.5 rounded text-sm font-medium bg-green-600 hover:bg-green-500 text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save code'}
            </button>
            {saveMessage === 'success' && <span className="text-green-400 text-sm">Saved.</span>}
            {saveMessage === 'error' && <span className="text-red-400 text-sm">Save failed.</span>}
          </>
        )}
      </div>
      {viewMode === 'preview' ? (
        content !== null ? (
          <iframe
            srcDoc={displayContent}
            title={filename}
            className="flex-1 w-full min-h-0 border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <iframe src={blobUrl!} title={filename} className="flex-1 w-full min-h-0 border-0" sandbox="allow-scripts allow-same-origin" />
        )
      ) : (
        <textarea
          value={codeContent}
          onChange={(e) => setCodeContent(e.target.value)}
          className="flex-1 w-full min-h-0 p-4 bg-gray-800 text-gray-100 font-mono text-sm border-0 resize-none focus:outline-none"
          spellCheck={false}
        />
      )}
    </main>
  );
}

function ProjectHub({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState('');
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/ideas/project-files?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.files) {
          setNotFound(true);
          return;
        }
        setName(data.project?.name || slug);
        setFiles(data.files);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-gray-400">Project not found.</p>
        <Link href="/ideas" className="text-cyan-400 hover:text-cyan-300">
          ← Back to Ideas
        </Link>
      </main>
    );
  }

  const hasIndex = files.some((f) => f.toLowerCase() === 'index.html' || f.endsWith('/index.html'));
  const indexPath = files.find((f) => f.toLowerCase() === 'index.html') || files.find((f) => f.endsWith('/index.html'));

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/ideas" className="text-gray-400 hover:text-white">
            ← Ideas
          </Link>
          <h1 className="text-2xl font-bold">{name}</h1>
        </div>
        <p className="text-gray-400 text-sm font-mono">/ideas/{slug}</p>

        {indexPath && (
          <div>
            <Link
              href={`/ideas/${encodeURIComponent(slug)}/${indexPath.split('/').map(encodeURIComponent).join('/')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex px-4 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium"
            >
              Open site (index.html)
            </Link>
          </div>
        )}

        <section className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="text-lg font-semibold mb-3">Files in project</h2>
          <ul className="space-y-1 text-sm font-mono text-gray-300 max-h-96 overflow-y-auto">
            {files.map((f) => {
              const isHtml = f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm');
              return (
                <li key={f} className="flex items-center justify-between gap-2 py-1 border-b border-gray-700/50">
                  <span className="truncate">{f}</span>
                  {isHtml && (
                    <Link
                      href={`/ideas/${encodeURIComponent(slug)}/${f.split('/').map(encodeURIComponent).join('/')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 shrink-0"
                    >
                      Open
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {indexPath && (
          <div className="rounded-xl border border-gray-700 overflow-hidden h-[70vh]">
            <iframe
              title="Preview"
              src={`/ideas/${encodeURIComponent(slug)}/${indexPath.split('/').map(encodeURIComponent).join('/')}`}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </div>
    </main>
  );
}

export default function IdeaSegmentPage() {
  const params = useParams();
  const segment = typeof params.segment === 'string' ? params.segment : params.segment?.[0] ?? '';

  const isSingleHtml = segment.toLowerCase().endsWith('.html') || segment.toLowerCase().endsWith('.htm');

  if (!segment) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Invalid path</p>
      </main>
    );
  }

  if (isSingleHtml) {
    return <SingleHtmlViewer filename={segment} />;
  }

  return <ProjectHub slug={segment} />;
}
