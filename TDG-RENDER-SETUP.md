# TDG Render Game Server — Quick Start

Full details: [`tdg-game-server/README.md`](tdg-game-server/README.md)

## You do this

1. Deploy `tdg-game-server` on Render (root dir `tdg-game-server`, start `npm start`).
2. Set `TDG_JOIN_SECRET` on **both** Render and Vercel (same value).
3. Set `NEXT_PUBLIC_TDG_GAME_WS_URL=wss://YOUR-SERVICE.onrender.com` on Vercel.
4. Set `VERCEL_MATCH_WEBHOOK_URL=https://YOUR-APP.vercel.app/api/tdg-pvp/match-complete` on Render.
5. Redeploy Vercel.

## Confirm

- https://YOUR-SERVICE.onrender.com/health returns OK
- /api/tdg-pvp/config includes `gameWsUrl`
- Two clients play Online PvP with server ticks (no player host)
