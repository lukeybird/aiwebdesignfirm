// Run against a disposable database: PIXA_TEST_DATABASE_URL=... node --test scripts/test-free-pixashop.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const postgres = require("postgres");
const ts = require("typescript");
const { AsyncLocalStorage } = require("node:async_hooks");
const config = process.env.PIXA_TEST_DATABASE_URL;
function load(path, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) => (name in mocks ? mocks[name] : require(name)),
    mod,
    mod.exports,
  );
  return mod.exports;
}
test(
  "confirmed free access, referral attribution, download, device access and opt-in campaign",
  { skip: !config },
  async () => {
    const admin = postgres(config, { max: 1, onnotice() {} });
    const schema = "pixa_test_" + randomUUID().replaceAll("-", "");
    await admin.unsafe("CREATE SCHEMA " + schema);
    const sql = postgres(config, {
      connection: { search_path: schema },
      onnotice() {},
    });
    try {
      const storage = new AsyncLocalStorage();
      const db = { "@/lib/db": { sql } };
      const free = load("lib/free-pixashop.ts", {
        ...db,
        "next/headers": {
          cookies: async () => ({ get: () => ({ value: storage.getStore() }) }),
        },
      });
      const pix = load("lib/pixashop.ts");
      const inbox = [];
      const shared = {
        ...db,
        "@/lib/free-pixashop": free,
        "@/lib/pixashop": pix,
        "@/lib/password-accounts": {
          allowAuthAttempt: async () => true,
          normalizeEmail: (s) => String(s).trim().toLowerCase(),
        },
        "@/lib/team-email": {
          deliverEmail: async (mail) => {
            inbox.push(mail);
            return { ok: true };
          },
        },
      };
      const api = load("app/api/free/route.ts", shared);
      const linker = load("app/api/free/link/route.ts", shared);
      const device = load("app/api/pixashop/device/route.ts", {
        ...shared,
        "@/lib/site-users": { ensureSiteUserTables: async () => {} },
        "@/auth": { auth: async () => null },
      });
      const downloads = load("app/api/pixashop/download/route.ts", {
        ...shared,
        "@/app/api/billing/route": {
          GET: async () => Response.json({ hasAccess: false }),
        },
      });
      process.env.PIXASHOP_ENABLED = "true";
      const origin = free.freeOrigin;
      const send = (fields, session) =>
        storage.run(session, () =>
          api.POST(
            new Request(origin + "/api/free", {
              method: "POST",
              headers: { origin },
              body: new URLSearchParams(fields),
            }),
          ),
        );
      const requestCode = async (email, fields = {}) => {
        const res = await send({ action: "request", email, ...fields });
        assert.equal(res.status, 303);
        return new URL(
          inbox.at(-1).text.match(/https?:\/\/\S+/)[0],
        ).searchParams.get("key");
      };
      const verify = async (email, fields = {}) => {
        const key = await requestCode(email, fields);
        const interstitial = linker.GET(
          new Request(origin + "/api/free/link?action=confirm&key=" + key),
        );
        assert.equal(interstitial.status, 200);
        assert.match(await interstitial.text(), /method="post"/);
        const attempts = await Promise.all([
          send({ action: "confirm", key }),
          send({ action: "confirm", key }),
        ]);
        const ok = attempts.find((r) => r.cookies.has("pixa_free"));
        assert.ok(ok);
        assert.equal(
          attempts.filter((r) => r.cookies.has("pixa_free")).length,
          1,
        );
        const session = ok.cookies.get("pixa_free").value;
        assert.notEqual(session, key);
        const download = new URL(
          inbox.at(-1).text.match(/https?:\/\/\S+/)[0],
        ).searchParams.get("key");
        return { session, download };
      };
      const owner = await verify("owner@example.test", {
        consent: "on",
        source: "instagram",
      });
      const [first] =
        await sql`SELECT referral,substage.stage FROM pixa_free_members substage WHERE email='owner@example.test'`;
      await requestCode("pending@example.test", { ref: first.referral });
      await verify("friend@example.test", { ref: first.referral });
      await verify("FRIEND@example.test", { ref: first.referral });
      await verify("owner@example.test", { ref: first.referral });
      const [{ count }] =
        await sql`SELECT count(*)::int AS count FROM pixa_free_members WHERE confirmed IS NOT NULL AND inviter=${first.referral}`;
      assert.equal(count, 1);
      const fresh = await send({ action: "download", key: owner.download });
      assert.equal(fresh.status, 303);
      const mac = fresh.cookies.get("pixa_free").value;
      assert.equal(
        (await storage.run(mac, () => free.freeMember())).email,
        "owner@example.test",
      );
      assert.match(fresh.headers.get("location"), /platform=mac/);
      assert.equal(
        (await send({ action: "download", key: owner.download })).cookies.has(
          "pixa_free",
        ),
        false,
      );
      const get = () =>
        downloads.GET(
          new Request(origin + "/api/pixashop/download?platform=mac"),
        );
      assert.equal((await get()).status, 403);
      const originalFetch = global.fetch;
      try {
        const name = "pixashop-0.20.4-macos-universal.dmg";
        const url =
          "https://github.com/lukeybird/pixashop/releases/download/v0.20.4/" +
          name;
        global.fetch = async () =>
          Response.json({ assets: [{ name, browser_download_url: url }] });
        assert.equal(
          (await storage.run(mac, get)).headers.get("location"),
          url,
        );
      } finally {
        global.fetch = originalFetch;
      }
      await sql`CREATE TABLE site_users(id uuid PRIMARY KEY)`;
      const postDevice = (body) =>
        device.POST(
          new Request(origin + "/api/pixashop/device", {
            method: "POST",
            body: JSON.stringify(body),
          }),
        );
      const pair = await (await postDevice({ action: "begin" })).json();
      assert.equal(
        (
          await (
            await postDevice({ action: "check", token: pair.token })
          ).json()
        ).access,
        false,
      );
      assert.match(
        (await send({ action: "activate", code: pair.code }, mac)).headers.get(
          "location",
        ),
        /activated/,
      );
      assert.equal(
        (
          await (
            await postDevice({ action: "check", token: pair.token })
          ).json()
        ).access,
        true,
      );
      assert.match(
        (await send({ action: "activate", code: pair.code }, mac)).headers.get(
          "location",
        ),
        /invalid/,
      );
      const pitches = [];
      class Resend {
        emails = {
          send: async (message, key) => {
            pitches.push({ message, key });
            return { error: null };
          },
        };
      }
      const cron = load("app/api/free/drip/route.ts", {
        ...shared,
        "@/lib/resend-key": { getResendApiKey: () => "qa" },
        resend: { Resend },
      });
      Object.assign(process.env, {
        CRON_SECRET: "qa",
        FROM_EMAIL: "demo@example.test",
        PIXA_MAILING_ADDRESS: "QA address",
      });
      const run = () =>
        cron.GET(
          new Request(origin + "/api/free/drip", {
            headers: { authorization: "Bearer qa" },
          }),
        );
      assert.equal(
        (await cron.GET(new Request(origin + "/api/free/drip"))).status,
        401,
      );
      await sql`UPDATE pixa_free_members SET due=now() WHERE opt_in`;
      await Promise.all([run(), run()]);
      assert.equal(pitches.length, 1);
      assert.equal(pitches[0].message.to, "owner@example.test");
      assert.match(pitches[0].message.text, /4.99 monthly or \$29.99 annually/);
      const [{ unsub }] =
        await sql`SELECT unsub FROM pixa_free_members WHERE email='owner@example.test'`;
      await send({ action: "unsubscribe", key: unsub });
      await run();
      assert.equal(pitches.length, 1);
      assert.ok(await storage.run(mac, () => free.freeMember()));
    } finally {
      await sql.end();
      await admin.unsafe("DROP SCHEMA " + schema + " CASCADE");
      await admin.end();
    }
  },
);
