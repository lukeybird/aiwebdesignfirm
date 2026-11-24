import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";

export const freeOrigin = new URL(
  process.env.PIXA_PUBLIC_ORIGIN || "https://pixaworld.com",
).origin;
export const secret = () => randomBytes(32).toString("hex");
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const validKey = (value: string) => /^[0-9a-f]{64}$/.test(value);

// postgres 3.4 omits the callable SQL tag from its TransactionSql type.
type QueryTag = (
  template: TemplateStringsArray,
  ...parameters: (string | boolean | null)[]
) => Promise<import("postgres").Row[]>;
export function freeTransaction<T>(work: (query: QueryTag) => Promise<T>) {
  return sql.begin((tx) => work(tx as unknown as QueryTag));
}
export async function initFree() {
  await freeTransaction(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(1840526102)`;
    await tx`CREATE TABLE IF NOT EXISTS pixa_free_members (
      email text PRIMARY KEY, referral text UNIQUE NOT NULL, inviter text, confirmed timestamptz,
      opt_in boolean DEFAULT false, unsub text UNIQUE NOT NULL, stage int DEFAULT 0,
      due timestamptz, leased_until timestamptz)`;
    await tx`CREATE TABLE IF NOT EXISTS pixa_free_tokens (
      hash text PRIMARY KEY, email text REFERENCES pixa_free_members(email), expires timestamptz NOT NULL,
      consent boolean NOT NULL, redeemed boolean NOT NULL DEFAULT false)`;
    await tx`ALTER TABLE pixa_free_tokens ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'confirm',
      ADD COLUMN IF NOT EXISTS inviter text, ADD COLUMN IF NOT EXISTS source text`;
    await tx`ALTER TABLE pixa_free_members ADD COLUMN IF NOT EXISTS source text`;
    await tx`CREATE INDEX IF NOT EXISTS pixa_free_referrals ON pixa_free_members(inviter) WHERE confirmed IS NOT NULL`;
    await tx`CREATE INDEX IF NOT EXISTS pixa_free_due ON pixa_free_members(due) WHERE opt_in`;
  });
}

export async function freeMember() {
  const token = (await cookies()).get("pixa_free")?.value;
  if (!token || !validKey(token)) return null;
  const [member] =
    await sql`SELECT m.email,m.referral FROM pixa_free_members m JOIN pixa_free_tokens t USING(email)
    WHERE t.hash=${digest(token)} AND t.purpose='session' AND t.expires>now() AND m.confirmed IS NOT NULL`;
  return member || null;
}

// A scanner's GET never redeems a token. The emailed secret never becomes a session cookie.
export async function redeemFreeLink(
  token: string,
  purpose: "confirm" | "download",
) {
  if (!validKey(token)) return null;
  return freeTransaction(async (tx) => {
    const [link] =
      await tx`DELETE FROM pixa_free_tokens WHERE hash=${digest(token)}
      AND purpose=${purpose} AND NOT redeemed AND expires>now() RETURNING email,consent,inviter,source`;
    if (!link) return null;
    const [member] =
      await tx`SELECT confirmed FROM pixa_free_members WHERE email=${link.email} FOR UPDATE`;
    if (!member || (!member.confirmed && purpose === "download")) return null;
    if (purpose === "confirm") {
      await tx`UPDATE pixa_free_members SET
        inviter=CASE WHEN confirmed IS NULL THEN ${link.inviter} ELSE inviter END,
        source=CASE WHEN confirmed IS NULL THEN ${link.source} ELSE source END,
        confirmed=coalesce(confirmed,now()), opt_in=opt_in OR ${link.consent},
        due=CASE WHEN ${link.consent} AND stage<3 THEN coalesce(due,now()+interval '2 days') ELSE due END
        WHERE email=${link.email}`;
    }
    const session = secret();
    await tx`INSERT INTO pixa_free_tokens(hash,email,expires,consent,purpose)
      VALUES(${digest(session)},${link.email},now()+interval '90 days',false,'session')`;
    let download = "";
    if (purpose === "confirm") {
      download = secret();
      await tx`INSERT INTO pixa_free_tokens(hash,email,expires,consent,purpose)
        VALUES(${digest(download)},${link.email},now()+interval '24 hours',false,'download')`;
    }
    return { session, email: String(link.email), download };
  });
}
