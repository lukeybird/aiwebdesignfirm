import { freeMember } from "@/lib/free-pixashop";
import { rewards } from "@/lib/free-rewards";
import { sql } from "@/lib/db";
export async function GET(req: Request) {
  const member = await freeMember();
  if (!member)
    return new Response("Confirm your email to view rewards.", { status: 401 });
  const file = new URL(req.url).searchParams.get("file");
  const reward = rewards.find((item) => item.file === file);
  if (!reward) return new Response(null, { status: 404 });
  const [row] =
    await sql`SELECT count(*)::int AS total FROM pixa_free_members WHERE inviter=${member.referral} AND confirmed IS NOT NULL`;
  if (row.total < reward.threshold)
    return new Response("This milestone is still locked.", { status: 403 });
  return new Response(reward.content, {
    headers: {
      "Content-Disposition": `attachment; filename="${reward.file}"`,
      "Content-Type": reward.type + "; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
