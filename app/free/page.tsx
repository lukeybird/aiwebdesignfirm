import { freeMember, freeOrigin } from "@/lib/free-pixashop";
import { sql } from "@/lib/db";
import "./free.css";

export const metadata = {
  title: { absolute: "Free PixaShop for Mac | PixaWorld" },
  description:
    "Get PixaShop for Mac by confirming your email. No card required.",
};
type Query = Record<string, string | undefined>;
const ranks = [
  [1, "Scout"],
  [3, "Guide"],
  [10, "Ambassador"],
] as const;

export default async function FreePage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const q = await searchParams;
  const member = await freeMember();
  const status = q.sent
    ? "Check your inbox. Your confirmation link is valid for 30 minutes."
    : q.expired
      ? "That link expired or was already used. Request a fresh email below."
      : q.unsubscribed
        ? "You’re unsubscribed from suite offers. Your free access continues."
        : q.activated
          ? "Device activated. Return to PixaShop."
          : q.invalid
            ? "That code was unavailable. Generate a fresh code in the app."
            : q.mail === "delayed"
              ? "Your email is confirmed. Download below while email delivery is delayed."
              : "";
  const [stats] = member
    ? await sql`SELECT count(*)::int AS total FROM pixa_free_members WHERE inviter=${member.referral} AND confirmed IS NOT NULL`
    : [{ total: 0 }];
  const count = Number(stats.total);
  const rank = [...ranks].reverse().find(([n]) => count >= n)?.[1] || "Member";
  const next = ranks.find(([n]) => count < n);
  return (
    <main className="freePixa">
      <header>
        <a href="/">PixaWorld</a>
        <a href="/products">All apps ↗</a>
      </header>
      {status && (
        <p role="status" className="notice">
          {status}
        </p>
      )}
      {member ? (
        <>
          <h1>Your PixaShop workspace</h1>
          <p>Your free Mac download and device activation are ready.</p>
          <section>
            <h2>Install PixaShop</h2>
            <a className="primary" href="/api/pixashop/download?platform=mac">
              Download for Mac ↓
            </a>
            <form action="/api/free" method="post">
              <input type="hidden" name="action" value="activate" />
              <label htmlFor="free-device">
                Code shown in PixaShop on your Mac
              </label>
              <div className="row">
                <input
                  id="free-device"
                  name="code"
                  placeholder="Device code"
                  required
                  maxLength={14}
                  autoComplete="off"
                />
                <button>Activate device</button>
              </div>
            </form>
          </section>
          <section>
            <h2>Invite a friend</h2>
            <p>
              Share your link. Each friend who confirms their email earns you
              one referral.
            </p>
            <label htmlFor="invite">Your invitation link</label>
            <input
              id="invite"
              readOnly
              value={freeOrigin + "/free?ref=" + member.referral}
            />
            <p>
              <strong>{rank}</strong> · {count} confirmed{" "}
              {count === 1 ? "referral" : "referrals"}
            </p>
            <progress
              aria-label="Progress to Ambassador"
              max={10}
              value={Math.min(count, 10)}
            />
            <p>
              {next
                ? `${next[0] - count} more to earn ${next[1]}.`
                : "You earned Ambassador."}
            </p>
            <ul>
              {ranks.map(([n, name]) => (
                <li key={name}>
                  {count >= n ? "✓ " : ""}
                  {name} · {n}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>More Pixa apps</h2>
            <p>
              The complete suite is $4.99 monthly or $29.99 annually. PixaShop
              remains free.
            </p>
            <a href="https://pixaworld.com/start?utm_source=free_workspace&utm_medium=product">
              Explore membership →
            </a>
          </section>
        </>
      ) : (
        <>
          <h1>
            Get PixaShop for Mac. <em>Free.</em>
          </h1>
          <p>
            Edit photos, work with layers, and export your next project. Confirm
            your email and we’ll send you the download. No payment card
            required.
          </p>
          <section>
            <form action="/api/free" method="post">
              <input type="hidden" name="action" value="request" />
              <input type="hidden" name="ref" value={q.ref || ""} />
              <input type="hidden" name="source" value={q.utm_source || ""} />
              <label htmlFor="free-email">Email address</label>
              <input
                id="free-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
              <label className="consent">
                <input name="consent" type="checkbox" />
                Email me tips and offers for the complete PixaWorld suite.
              </label>
              <button className="primary">Send my confirmation link →</button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
