'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AI_MARKETING_USE_CASES } from '@/lib/ai-marketing-use-cases';

const SITE_URL = 'https://aiwebdesignfirm.com';
/** Standard US business card ratio 3.5" × 2" */
const CARD_W = 1050;
const CARD_H = 600;
const QR_SIZE = 200;

const BG_LINES = AI_MARKETING_USE_CASES.slice(0, 10).map((c) => c.title.toUpperCase());

function drawCardCanvas(qrBitmap: CanvasImageSource): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, '#0c1428');
  g.addColorStop(0.45, '#0a0f1c');
  g.addColorStop(1, '#060a12');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.save();
  ctx.font = '600 19px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) {
    const text = BG_LINES[i % BG_LINES.length];
    ctx.fillText(text, 36, 42 + i * 72);
  }
  ctx.restore();

  const leftPad = 44;
  let ty = 175;
  ctx.textBaseline = 'top';
  ctx.font = '900 42px system-ui, -apple-system, sans-serif';

  const drawWhite = (t: string, x: number, y: number) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t, x, y);
    return x + ctx.measureText(t).width;
  };

  let x = leftPad;
  x = drawWhite('Book a ', x, ty);
  const gradPhrase = 'free consultation';
  const gw = ctx.measureText(gradPhrase).width;
  const og = ctx.createLinearGradient(x, ty, x + gw, ty + 42);
  og.addColorStop(0, '#fdba74');
  og.addColorStop(0.5, '#fb923c');
  og.addColorStop(1, '#ef4444');
  ctx.fillStyle = og;
  ctx.fillText(gradPhrase, x, ty);
  x += gw;
  drawWhite(' today.', x, ty);

  ty += 58;
  ctx.font = '800 28px system-ui, -apple-system, sans-serif';
  const urlText = 'aiwebdesignfirm.com';
  const uw = ctx.measureText(urlText).width;
  const ug = ctx.createLinearGradient(leftPad, ty, leftPad + uw, ty + 28);
  ug.addColorStop(0, '#22d3ee');
  ug.addColorStop(1, '#2563eb');
  ctx.fillStyle = ug;
  ctx.fillText(urlText, leftPad, ty);

  const qrX = CARD_W - QR_SIZE - 40;
  const qrY = (CARD_H - QR_SIZE) / 2;
  ctx.fillStyle = '#ffffff';
  const pad = 10;
  ctx.fillRect(qrX - pad, qrY - pad, QR_SIZE + pad * 2, QR_SIZE + pad * 2);
  ctx.drawImage(qrBitmap, qrX, qrY, QR_SIZE, QR_SIZE);

  return canvas;
}

export function BusinessCardGenerator() {
  const [qrObjectUrl, setQrObjectUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadQr = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch('/api/booking/admin/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: SITE_URL }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr((j as { error?: string }).error || 'Could not load QR code');
        return;
      }
      const blob = await r.blob();
      setQrObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch {
      setErr('Network error loading QR');
    }
  }, []);

  useEffect(() => {
    loadQr();
    return () => {
      setQrObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [loadQr]);

  async function downloadPng() {
    if (!qrObjectUrl) return;
    setBusy(true);
    setErr(null);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('QR image failed'));
        img.src = qrObjectUrl;
      });
      const canvas = drawCardCanvas(img);
      canvas.toBlob((blob) => {
        if (!blob) {
          setErr('Could not build image');
          setBusy(false);
          return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'aiwebdf-business-card.png';
        a.click();
        URL.revokeObjectURL(a.href);
        setBusy(false);
      }, 'image/png');
    } catch {
      setErr('Download failed — try again');
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-gray-400">
        Preview matches the public site look: dark gradient, faint AI service lines, headline,{' '}
        <span className="text-white/80">aiwebdesignfirm.com</span>, and a QR to the site on the right. Download a
        high-resolution PNG (3.5×2&quot; at 300dpi).
      </p>

      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      <div className="relative w-full max-w-[560px] overflow-hidden rounded-xl border border-white/15 shadow-[0_20px_60px_-20px_rgba(0,102,255,0.35)] aspect-[3.5/2]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c1428] via-[#0a0f1c] to-[#060a12]" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          {BG_LINES.slice(0, 8).map((line, i) => (
            <div
              key={i}
              className="absolute left-4 whitespace-nowrap font-heading text-[10px] font-semibold uppercase tracking-[0.14em] text-white/[0.09] sm:text-[11px]"
              style={{ top: `${6 + i * 11}%` }}
            >
              {line}
            </div>
          ))}
        </div>

        <div className="relative z-[1] flex h-full items-center justify-between gap-3 px-5 py-4 pl-6 sm:gap-5 sm:px-7 sm:pl-8">
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-balance font-black font-heading leading-[1.15] text-white text-[clamp(1rem,3.5vw,1.65rem)] sm:text-2xl md:text-[1.75rem]">
              Book a{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-orange-400 to-red-500">
                free consultation
              </span>{' '}
              today.
            </p>
            <p className="mt-2 sm:mt-3 text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d4ff] to-[#0066ff] font-heading">
              aiwebdesignfirm.com
            </p>
          </div>
          <div className="shrink-0 w-[26%] max-w-[132px] rounded-md bg-white p-1.5 sm:p-2 shadow-md">
            {qrObjectUrl ? (
              <img
                src={qrObjectUrl}
                alt="QR code to aiwebdesignfirm.com"
                className="w-full h-auto aspect-square object-contain"
                width={512}
                height={512}
              />
            ) : (
              <div className="aspect-square w-full bg-gray-100 animate-pulse rounded-sm" />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={downloadPng}
          disabled={busy || !qrObjectUrl}
          className="rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d4ff] text-black font-bold hover:opacity-95"
        >
          {busy ? 'Preparing…' : 'Download PNG'}
        </Button>
        <Button type="button" variant="outline" onClick={loadQr} className="rounded-full border-white/20">
          Reload QR
        </Button>
      </div>
    </div>
  );
}
