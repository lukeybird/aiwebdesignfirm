import { validKey } from "@/lib/free-pixashop";

export function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const action = query.get("action"),
    key = query.get("key") || "";
  if (
    !action ||
    !["confirm", "download", "unsubscribe"].includes(action) ||
    !validKey(key)
  )
    return new Response("Invalid link. Request a new email at /free.", {
      status: 400,
    });
  const labels: Record<string, string> = {
    confirm: "Confirm email and unlock PixaShop",
    download: "Download PixaShop for Mac",
    unsubscribe: "Unsubscribe from suite offers",
  };
  const label = labels[action];
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${label}</title><style>body{font:18px system-ui;margin:12vh auto;padding:24px;max-width:480px;color:#162143}button{font:inherit;background:#233bbc;color:white;border:0;border-radius:10px;padding:14px 22px;cursor:pointer}</style><main><p>PixaWorld</p><h1>${label}</h1><form method="post" action="/api/free"><input type="hidden" name="action" value="${action}"><input type="hidden" name="key" value="${key}"><button>${label}</button></form></main></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      },
    },
  );
}
