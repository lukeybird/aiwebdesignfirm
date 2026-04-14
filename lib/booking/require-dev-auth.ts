import { type NextRequest, NextResponse } from 'next/server';
import { DEV_PORTAL_COOKIE, verifyDevPortalCookieValue } from '@/lib/dev-portal-cookie';

export function bookingAdminUnauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/** Booking admin APIs require a valid dev_portal cookie (set on successful developer login). */
export function assertBookingAdmin(request: NextRequest): NextResponse | null {
  const token = request.cookies.get(DEV_PORTAL_COOKIE)?.value;
  if (!verifyDevPortalCookieValue(token)) return bookingAdminUnauthorized();
  return null;
}
