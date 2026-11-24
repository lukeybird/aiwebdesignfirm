import { initFree, freeOrigin } from "@/lib/free-pixashop";
import { sql } from "@/lib/db";
import { getResendApiKey } from "@/lib/resend-key";
import { Resend } from "resend";
const messages = [
  [
    "Your next PixaShop project",
    "Try cropping a photo for a listing or storefront. PixaShop stays free. If you also need tools for video, documents or design, explore the full PixaWorld suite.",
  ],
  [
    "One membership for your Mac projects",
    "Working across photos, documents and presentations? Compare the released apps and choose the ones that fit your projects.",
  ],
  [
    "Monthly or annual PixaWorld membership",
    "Monthly access costs $4.99. A year costs $29.99 upfront, about $2.50 per month. Your free PixaShop access continues either way.",
  ],
];
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== "Bearer " + process.env.CRON_SECRET
  )
    return new Response(null, { status: 401 });
  const key = getResendApiKey(),
    from = process.env.FROM_EMAIL,
    address = process.env.PIXA_MAILING_ADDRESS;
  if (!key || !from || !address)
    return new Response("Sender configuration required", { status: 503 });
  await initFree();
  await sql`DELETE FROM pixa_free_tokens WHERE expires<now()`;
  const leads =
    await sql`UPDATE pixa_free_members SET leased_until=now()+interval '10 minutes' WHERE email IN
 (SELECT email FROM pixa_free_members WHERE confirmed IS NOT NULL AND opt_in AND stage<3 AND due<=now()
 AND (leased_until IS NULL OR leased_until<now()) ORDER BY due LIMIT 25 FOR UPDATE SKIP LOCKED) RETURNING *`;
  const sender = new Resend(key);
  for (const lead of leads) {
    const [eligible] =
      await sql`SELECT 1 FROM pixa_free_members WHERE email=${lead.email} AND stage=${lead.stage} AND opt_in AND due<=now()`;
    if (!eligible) continue;
    const [subject, copy] = messages[Number(lead.stage)];
    const unsub =
      freeOrigin + "/api/free/link?action=unsubscribe&key=" + lead.unsub;
    const text =
      copy +
      "\n\nSuite trial: " +
      "https://pixaworld.com/start?utm_source=email&utm_campaign=free_pixashop&utm_content=day" +
      [2, 5, 10][Number(lead.stage)] +
      "\n14 days with a payment method, then $4.99 monthly or $29.99 annually, billed automatically until canceled.\n\nUnsubscribe: " +
      unsub +
      "\n" +
      address;
    const result = await sender.emails.send(
      { from, to: String(lead.email), subject, text },
      { idempotencyKey: "pixa-free-" + lead.referral + "-" + lead.stage },
    );
    if (!result.error)
      await sql`UPDATE pixa_free_members SET stage=stage+1,leased_until=null,due=CASE stage WHEN 0 THEN now()+interval '3 days' WHEN 1 THEN now()+interval '5 days' ELSE null END WHERE email=${lead.email} AND stage=${lead.stage}`;
  }
  return Response.json({ processed: leads.length });
}
