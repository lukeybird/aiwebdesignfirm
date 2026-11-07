import { createHash } from 'node:crypto';
export const PIXASHOP_ORIGIN = 'https://aiwebdesignfirm.com';
export const PIXASHOP_RELEASES = 'https://api.github.com/repos/lukeybird/pixashop/releases/latest';
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const validDeviceToken = (token: unknown): token is string => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export function normalizeDeviceCode(code: unknown) {
  return typeof code === 'string' ? code.toUpperCase().replace(/[-\s]/g, '') : '';
}
export function accessDuration(records: Array<{status: string; trial_end?: number | null; items?: {data?: Array<{price?: {id?: string}; current_period_end?: number}>}; current_period_end?: number}>, prices: string[], now = Date.now() / 1000) {
  let seconds = 0;
  for (const s of records) {
    if (!['active', 'trialing'].includes(s.status)) continue;
    for (const item of s.items?.data ?? []) {
      if (!prices.filter(Boolean).includes(item.price?.id ?? '')) continue;
      const end = s.status === 'trialing' ? s.trial_end : item.current_period_end ?? s.current_period_end;
      // Unknown end times never grant access indefinitely.
      if (typeof end === 'number' && Number.isFinite(end)) seconds = Math.max(seconds, Math.floor(Math.min(300, end - now)));
    }
  }
  return Math.max(0, seconds);
}
export function releaseAsset(assets: Array<{name: string; browser_download_url: string}>, platform: string) {
  const patterns: Record<string, RegExp> = {
    mac: /^pixashop-[\d.]+-macos-universal\.dmg$/,
    windows: /^pixashop-[\d.]+-windows-x64-portable\.zip$/,
    linux: /^pixashop-[\d.]+-linux-x86_64\.tar\.gz$/,
  };
  const re = patterns[platform];
  return re ? assets.find(a => re.test(a.name) && a.browser_download_url.startsWith('https://github.com/lukeybird/pixashop/releases/download/') && !/[\r\n]/.test(a.browser_download_url)) : undefined;
}
