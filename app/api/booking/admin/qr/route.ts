import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

const MAX_URL_LENGTH = 2048;

function parseTargetUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.length > MAX_URL_LENGTH) return null;
  try {
    const withProto = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Server-side QR PNG for arbitrary links (booking admin tools). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const target = parseTargetUrl(body.url);
    if (!target) {
      return NextResponse.json(
        { error: 'Enter a valid http(s) URL (max 2048 characters).' },
        { status: 400 },
      );
    }

    const png = await QRCode.toBuffer(target, {
      type: 'png',
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000ff', light: '#ffffffff' },
    });

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('booking/admin/qr:', e);
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 });
  }
}
