'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function IdeaViewPage() {
  const params = useParams();
  const filename = typeof params.filename === 'string' ? params.filename : params.filename?.[0] ?? '';
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!filename) {
      setLoading(false);
      return;
    }
    fetch(`/api/ideas/files?filename=${encodeURIComponent(filename)}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.file?.blob_url) setBlobUrl(data.file.blob_url);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [filename]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </main>
    );
  }

  if (notFound || !blobUrl) {
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
      <div className="flex-shrink-0 py-2 px-4 border-b border-gray-700 flex items-center gap-4">
        <Link
          href="/ideas"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Back to Ideas
        </Link>
        <span className="text-gray-500 text-sm font-mono">{filename}</span>
      </div>
      <iframe
        src={blobUrl}
        title={filename}
        className="flex-1 w-full min-h-0 border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    </main>
  );
}
