import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { initFree } from "@/lib/free-pixashop";
import "../free.css";
export const metadata = {
  title: "PixaShop signup activity",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Activity() {
  const user = (await auth())?.user;
  if (
    !process.env.PIXA_OWNER_USER_ID ||
    user?.id !== process.env.PIXA_OWNER_USER_ID ||
    user?.email?.toLowerCase() !== "luke@webstarts.com"
  )
    notFound();
  await initFree();
  const [daily, sources, recent] = await Promise.all([
    sql`SELECT (confirmed AT TIME ZONE 'America/New_York')::date::text AS day,count(*)::int AS total,count(inviter)::int AS referred FROM pixa_free_members WHERE confirmed>=now()-interval '30 days' GROUP BY day ORDER BY day DESC`,
    sql`SELECT coalesce(source,'Direct or unknown') AS channel,count(*)::int AS total FROM pixa_free_members WHERE confirmed IS NOT NULL GROUP BY channel ORDER BY total DESC LIMIT 20`,
    sql`SELECT email,confirmed,stage,opt_in FROM pixa_free_members WHERE confirmed IS NOT NULL ORDER BY confirmed DESC LIMIT 50`,
  ]);
  return (
    <main className="freePixa">
      <h1>Free signup activity</h1>
      <section>
        <h2>Last 30 days</h2>
        {daily.length ? (
          daily.map((r) => (
            <p key={r.day}>
              {r.day} · {r.total} confirmed · {r.referred} referred
            </p>
          ))
        ) : (
          <p>No confirmed signups yet.</p>
        )}
      </section>
      <section>
        <h2>Signup sources</h2>
        {sources.map((r) => (
          <p key={r.channel}>
            {r.channel} · {r.total}
          </p>
        ))}
      </section>
      <section>
        <h2>Latest confirmations</h2>
        {recent.map((r) => (
          <p key={r.email}>
            {r.email} ·{" "}
            {new Date(r.confirmed).toLocaleDateString("en-US", {
              timeZone: "America/New_York",
            })}{" "}
            · {r.opt_in ? `${r.stage} suite emails sent` : "Offers off"}
          </p>
        ))}
      </section>
    </main>
  );
}
