# TDG Game Server (Render) Setup

Authoritative online PvP runs on a dedicated Node WebSocket service. Vercel keeps the website and matchmaking; Render runs combat truth.

## Architecture

1. Players queue via `/api/tdg-pvp/join` (Vercel + Postgres + Pusher `match_found`).
2. Matchmaking mints an HMAC **join ticket** (`TDG_JOIN_SECRET`).
3. Both clients open `wss://YOUR-SERVICE.onrender.com` and send `{ type: "join", ticket }`.
4. The game server ticks at 15 Hz, orders inputs, and broadcasts `{ type: "tick", inputs, snapshot }`.
5. Clients predict locally, then apply server-ordered ticks (no player is host-of-truth).

## 1. Create the Render Web Service

1. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign in with GitHub.
2. **New → Web Service** → select `lukeybird/aiwebdesignfirm`.
3. Settings:
   - **Root Directory:** `tdg-game-server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
4. Prefer a **paid/always-on** plan for playtests (free tier sleeps and causes long cold starts).
5. Deploy and copy the URL, e.g. `https://tdg-game-server.onrender.com`.

WebSocket URL becomes: `wss://tdg-game-server.onrender.com` (same host, `wss` scheme).

You can also use the repo [`render.yaml`](render.yaml) via Render Blueprint.

## 2. Environment variables on Render

| Variable | Required | Purpose |
|---|---|---|
| `TDG_JOIN_SECRET` | Yes | Shared HMAC secret with Vercel (long random string) |
| `VERCEL_MATCH_WEBHOOK_URL` | Recommended | `https://YOUR-VERCEL-APP.vercel.app/api/tdg-pvp/match-complete` |
| `TDG_WEBHOOK_SECRET` | Recommended | Same as `TDG_JOIN_SECRET` or a separate webhook secret |
| `DATABASE_URL` | Optional | Same Postgres as Vercel — fallback join auth if ticket missing |
| `CORS_ORIGIN` | Optional | Your site origin, e.g. `https://YOUR-VERCEL-APP.vercel.app` |
| `PORT` | Auto | Render sets this |

Generate a secret:

```bash
openssl rand -hex 32
```

## 3. Environment variables on Vercel

In the Vercel project → Settings → Environment Variables (Production + Preview):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_TDG_GAME_WS_URL` | `wss://tdg-game-server.onrender.com` |
| `TDG_JOIN_SECRET` | *(same secret as Render)* |
| `TDG_WEBHOOK_SECRET` | *(same as Render webhook secret)* |

Redeploy the Vercel app after saving env vars so `/api/tdg-pvp/config` returns `gameWsUrl`.

## 4. Local development

Terminal A — game server:

```bash
cd tdg-game-server
npm install
export TDG_JOIN_SECRET=dev-secret-change-me
npm run dev
# health: http://localhost:8080/health
```

Terminal B — Next app:

```bash
export TDG_JOIN_SECRET=dev-secret-change-me
export NEXT_PUBLIC_TDG_GAME_WS_URL=ws://localhost:8080
npm run dev
```

Open two browsers → Online PvP → match. Combat traffic should show on the game server logs (`tick` / joins), not Pusher room events.

## 5. Verify

1. `GET https://YOUR-SERVICE.onrender.com/health` → `{ ok: true, ... }`
2. Vercel `/api/tdg-pvp/config` → includes `gameWsUrl` and `serverAuth: true`
3. Two clients can finish a match; winner recorded via match-complete webhook
4. Disconnect: after ~12s grace the server forfeits the disconnected player

## 6. Fallback behavior

If `NEXT_PUBLIC_TDG_GAME_WS_URL` or `TDG_JOIN_SECRET` is missing, clients keep the legacy Pusher/HTTP host-authoritative path so the site does not hard-break.
