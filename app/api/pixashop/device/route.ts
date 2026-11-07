import { randomBytes } from 'node:crypto';
import { auth } from '@/auth';
import { sql } from '@/lib/db';
import { ensureSiteUserTables } from '@/lib/site-users';
import { allowAuthAttempt } from '@/lib/password-accounts';
import { accessDuration, normalizeDeviceCode, PIXASHOP_ORIGIN, tokenHash, validDeviceToken } from '@/lib/pixashop';
export const runtime = 'nodejs';
const reply = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store', 'Pragma': 'no-cache'}});
async function ensure() {
  await ensureSiteUserTables();
  await sql`CREATE TABLE IF NOT EXISTS pixashop_devices (
    token_hash TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES site_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked BOOLEAN NOT NULL DEFAULT FALSE
  )`;
}
async function secondsForUser(id: string) {
  const key = process.env.STRIPE_SECRET_KEY;
  const prices = [process.env.STRIPE_DIY_PRICE_ID ?? '', process.env.STRIPE_EXPERT_PRICE_ID ?? ''];
  if (!key || !prices.some(Boolean)) throw new Error('Billing is not configured.');
  const users = await sql`SELECT stripe_customer_id FROM site_users WHERE id=${id}`;
  if (!users[0]?.stripe_customer_id) return 0;
  const response = await fetch('https://api.stripe.com/v1/subscriptions?' + new URLSearchParams({customer: users[0].stripe_customer_id, status: 'all', limit: '100'}), {
    headers: {Authorization: `Bearer ${key}`}, cache: 'no-store', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Could not verify billing.');
  const body = await response.json();
  return accessDuration(body.data ?? [], prices);
}
export async function POST(request: Request) {
  if (process.env.PIXASHOP_ENABLED !== 'true') return reply({message: 'PixaShop activation is not available yet.'}, 503);
  try {
    if (Number(request.headers.get('content-length')) > 4096) return reply({message: 'Request too large.'}, 413);
    const text = await request.text();
    if (text.length > 4096) return reply({message: 'Request too large.'}, 413);
    const input = JSON.parse(text);
    await ensure();
    if (input.action === 'begin') {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
      if (!await allowAuthAttempt('pixashop:begin:' + ip, 20)) return reply({message: 'Please wait before trying again.'}, 429);
      const token = randomBytes(32).toString('hex');
      const code = randomBytes(5).toString('hex').toUpperCase();
      await sql`DELETE FROM pixashop_devices WHERE expires_at<NOW()`;
      await sql`INSERT INTO pixashop_devices(token_hash,code,expires_at) VALUES(${tokenHash(token)},${code},NOW()+INTERVAL '10 minutes')`;
      return reply({token, code, access: false, accessSeconds: 0, message: 'Enter this code on your account page to activate this device.'});
    }
    if (input.action === 'check') {
      if (!validDeviceToken(input.token)) return reply({access:false, accessSeconds:0, message:'Invalid activation. Choose Use another account.'});
      const rows = await sql`SELECT user_id FROM pixashop_devices WHERE token_hash=${tokenHash(input.token)} AND NOT revoked AND expires_at>NOW()`;
      const device = rows[0];
      if (!device) return reply({access:false, accessSeconds:0, message:'Activation expired or was revoked. Choose Use another account.'});
      if (!device.user_id) return reply({access:false, accessSeconds:0, message:'Waiting for you to approve this device on the website.'});
      if (!await allowAuthAttempt('pixashop:check:' + tokenHash(input.token), 120)) return reply({message:'Please wait before checking again.'}, 429);
      const seconds = await secondsForUser(device.user_id);
      return reply({access:seconds>0, accessSeconds:seconds, message:seconds>0?'Access active.':'An active trial or subscription is required.'});
    }
    // Browser actions require both an account session and an exact trusted origin.
    if (request.headers.get('origin') !== PIXASHOP_ORIGIN) return reply({message:'Invalid request origin.'},403);
    const user = (await auth())?.user;
    if (!user?.id) return reply({message:'Sign in required.'},401);
    if (!await allowAuthAttempt('pixashop:account:' + user.id, 15)) return reply({message:'Please wait before trying again.'},429);
    if (input.action === 'activate') {
      const code = normalizeDeviceCode(input.code);
      if (!/^[A-F0-9]{10}$/.test(code)) return reply({message:'Enter the ten-character code shown in PixaShop.'},400);
      if (!await secondsForUser(user.id)) return reply({message:'Start your trial or renew your subscription first.'},403);
      const rows = await sql`UPDATE pixashop_devices SET user_id=${user.id},expires_at=NOW()+INTERVAL '90 days' WHERE code=${code} AND user_id IS NULL AND NOT revoked AND expires_at>NOW() RETURNING code`;
      return rows.length ? reply({message:'Device activated. Return to PixaShop.'}) : reply({message:'Code expired, already used or not found. Create a new code in PixaShop.'},400);
    }
    if (input.action === 'revoke-all') {
      await sql`UPDATE pixashop_devices SET revoked=TRUE WHERE user_id=${user.id}`;
      return reply({message:'All your PixaShop devices have been signed out. Existing access checks expire within five minutes.'});
    }
    return reply({message:'Unknown action.'},400);
  } catch { return reply({message:'Could not verify access. Please retry.'},502); }
}
