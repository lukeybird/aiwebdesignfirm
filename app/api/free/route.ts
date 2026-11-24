import { NextResponse } from "next/server";
import { deliverEmail } from "@/lib/team-email";
import { allowAuthAttempt, normalizeEmail } from "@/lib/password-accounts";
import { normalizeDeviceCode } from "@/lib/pixashop";
import { sql } from "@/lib/db";
import {
  initFree,
  freeTransaction,
  freeMember,
  freeOrigin,
  secret,
  digest,
  validKey,
  redeemFreeLink,
} from "@/lib/free-pixashop";

const back = (query = "") =>
  NextResponse.redirect(freeOrigin + "/free" + query, 303);
const mailLink = (action: string, key: string) =>
  freeOrigin + "/api/free/link?action=" + action + "&key=" + key;
export async function POST(req: Request) {
  if (req.headers.get("origin") !== freeOrigin)
    return new Response(null, { status: 403 });
  const form = await req.formData(),
    action = form.get("action"),
    key = String(form.get("key") || "");
  if (action === "unsubscribe") {
    if (!validKey(key)) return new Response(null, { status: 400 });
    await freeTransaction(async (tx) => {
      const [member] =
        await tx`UPDATE pixa_free_members SET opt_in=false,due=null WHERE unsub=${key} RETURNING email`;
      if (member)
        await tx`UPDATE pixa_free_tokens SET consent=false WHERE email=${member.email} AND consent`;
    });
    return back("?unsubscribed=1");
  }
  if (process.env.PIXASHOP_ENABLED !== "true")
    return new Response("PixaShop downloads are temporarily unavailable.", {
      status: 503,
    });
  if (action === "confirm" || action === "download") {
    const redeemed = await redeemFreeLink(key, action);
    if (!redeemed) return back("?expired=1");
    const response =
      action === "download"
        ? NextResponse.redirect(
            freeOrigin + "/api/pixashop/download?platform=mac",
            303,
          )
        : back();
    response.cookies.set("pixa_free", redeemed.session, {
      httpOnly: true,
      secure: freeOrigin.startsWith("https:"),
      sameSite: "lax",
      maxAge: 7776000,
      path: "/",
    });
    if (action === "confirm") {
      const url = mailLink("download", redeemed.download);
      const sent = await deliverEmail({
        to: redeemed.email,
        subject: "Download your free PixaShop for Mac",
        text:
          "Open this link on your Mac within 24 hours: " +
          url +
          "\nTo activate the app or request fresh access, visit " +
          freeOrigin +
          "/free",
        html:
          '<p>Your free Mac download is ready.</p><p><a href="' +
          url +
          '">Download PixaShop</a></p><p>This link works once, for 24 hours. For device activation or a fresh link, visit <a href="' +
          freeOrigin +
          '/free">your free workspace</a>.</p>',
      });
      if (!sent.ok)
        response.headers.set("Location", freeOrigin + "/free?mail=delayed");
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  if (action === "activate") {
    const member = await freeMember();
    if (!member) return back("?expired=1");
    const code = normalizeDeviceCode(form.get("code"));
    if (!/^[A-F0-9]{10}$/.test(code)) return back("?invalid=1");
    if (!(await allowAuthAttempt("free-device:" + member.email, 12)))
      return new Response(null, { status: 429 });
    const rows =
      await sql`UPDATE pixashop_devices SET free_email=${member.email},expires_at=now()+interval '90 days'
      WHERE code=${code} AND user_id IS NULL AND free_email IS NULL AND NOT revoked AND expires_at>now() RETURNING code`;
    return back(rows.length ? "?activated=1" : "?invalid=1");
  }
  if (action !== "request") return new Response(null, { status: 400 });
  const email = normalizeEmail(form.get("email"));
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email))
    return new Response("Enter a valid email.", { status: 400 });
  const ip =
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    "unknown";
  if (
    !(await allowAuthAttempt("free-ip:" + ip, 20)) ||
    !(await allowAuthAttempt("free-email:" + digest(email), 3))
  )
    return back("?sent=1");
  await initFree();
  const token = secret(),
    ref = String(form.get("ref") || ""),
    source = String(form.get("source") || "")
      .slice(0, 80)
      .replace(/[^a-z0-9_.-]/gi, "");
  await freeTransaction(async (tx) => {
    await tx`INSERT INTO pixa_free_members(email,referral,unsub) VALUES(${email},${secret().slice(0, 16)},${secret()}) ON CONFLICT(email) DO NOTHING`;
    await tx`INSERT INTO pixa_free_tokens(hash,email,expires,consent,inviter,source) VALUES
      (${digest(token)},${email},now()+interval '30 minutes',${form.get("consent") === "on"},
      (SELECT referral FROM pixa_free_members WHERE referral=${ref} AND confirmed IS NOT NULL AND email<>${email}),${source || null})`;
  });
  const url = mailLink("confirm", token);
  const sent = await deliverEmail({
    to: email,
    subject: "Confirm your email for free PixaShop access",
    text: "Confirm within 30 minutes: " + url,
    html:
      '<p><a href="' +
      url +
      '">Confirm your email for free PixaShop access</a></p><p>This link expires in 30 minutes.</p>',
  });
  return sent.ok
    ? back("?sent=1")
    : new Response("Email delivery unavailable. Please try again later.", {
        status: 503,
      });
}
