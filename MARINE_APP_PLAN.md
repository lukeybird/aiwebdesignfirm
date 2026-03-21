# Marine Monitor — Build Plan

Plan for the subscription-based boat remote monitoring system, based on the core idea:  
**A device on the boat detects events → cellular → server → database → website the owner logs into.**

---

## One-line flow

**Sensor → Device → Cellular → Server → Database → Website → User** (paid subscription keeps it active.)

---

## 1. The device on the boat

- Sits on the boat and watches one or more sensors (e.g. float switch, battery).
- When something happens (e.g. float switch activated), it builds a small **JSON message** (device id, event type, battery level, etc.).
- Sends that message to the internet (via cellular, not WiFi).

**Build later:**  
- Device firmware (or reference spec) that: reads sensor, formats JSON, sends to your server (HTTPS POST to an ingest API).

---

## 2. Cellular connection

- Device uses a **cellular modem with eSIM** (no WiFi dependency).
- Connects to cell towers and sends the same JSON to your server over the internet.

**Build later:**  
- Choose modem/eSIM provider; device code uses that modem to POST to your server. No app changes needed beyond the ingest API.

---

## 3. The server (this app)

The server has three jobs when it receives a message:

1. **Authenticate device** — Verify the device id (and optionally a token/secret).
2. **Check subscription** — Ensure the device’s owner has an **active subscription**.
3. **Store the event** — Save the event (and any metadata) in the database.

**In place:**  
- Marine app: login/signup, dashboard (lists devices, shows last float status), **Add device** + **Setup** (Web Bluetooth, default SSID ORBI38).  
- **POST /api/marine/ingest** — Body: `device_id`, `token`, `float_switch` (or `event`); validates device, stores event, updates `last_float_status` / `last_activity_at`.  
- **GET/POST /api/marine/devices** — List devices for user; create device (returns device_id + auth_token for setup).  
- **Database:** `marine_users`, `marine_devices` (device_id, auth_token, name, last_float_status, last_activity_at), `marine_events`.

---

## 4. The database

Store:

- **Users** — `marine_users` (done).
- **Devices** — e.g. `marine_devices`: id, marine_user_id, device_id (unique), name (e.g. “Luke’s Boat”), created_at.
- **Events** — e.g. `marine_events`: id, device_id, event_type, payload (JSONB), created_at.
- **Subscriptions** — either columns on `marine_users` (subscription_status, subscription_expires_at) or a separate `marine_subscriptions` table.

**Already in place:**  
- `marine_users` with subscription_status and subscription_expires_at.

**To add:**  
- `marine_devices` (user, device_id, name).  
- `marine_events` (device, event_type, payload, timestamp).  
- Logic to “only accept ingest if user has active subscription”.

---

## 5. The website dashboard

- User **logs in** at `/marineApp` (or `/marineApp/login`) — **done**.
- After login, user sees **dashboard** — placeholder **done**; next steps:
  - List **devices** (boats) for this user.
  - Per device: **last activity**, **battery level**, **last event**.
  - **Event history** (list or timeline) for each device.
  - **Subscription status** and renewal (or link to pay).

**In place:**  
- Login/signup and protected dashboard.  
- Dashboard: devices list, last float status and last activity per device, Add device form (redirects to setup with token).  
- API: `GET /api/marine/devices` (with X-Marine-User-Id header), `POST /api/marine/devices` to create.  
- Optional later: event history list per device.

---

## 6. Device setup (Bluetooth)

- When the user gets the device, they **link it to their account** via **Bluetooth** from their phone.
- Phone sends: **device_id**, **token**, **server_url**, **wifi_ssid**, **wifi_password** to the device (via Web Bluetooth from `/marineApp/setup`).
- Device stores config in NVS and uses it to connect to WiFi and POST to the server.

**In place:**  
- **Add device** on dashboard → creates `marine_devices` row (device_id, auth_token, name).  
- **Setup page** `/marineApp/setup` — default WiFi SSID **ORBI38**; user enters password; Web Bluetooth sends config to ESP32 (see ESP32_FIRMWARE.md for UUIDs and JSON format).

**ESP32-S3 behavior (no button):**  
- On power-up, device **automatically** starts BLE advertising (no button press).  
- **Blue LED** blinks about **once per second** while waiting for a BLE connection.  
- After phone connects and sends config, device stores it (NVS), connects to WiFi, then switches to **operational** (e.g. different LED: green solid or blink when reporting).  
- Float switch status is sent every **2 seconds** via POST to the server.

---

## 7. Subscription system

- User pays a **monthly subscription** (e.g. $10/month).
- When paid: server marks account **active** (subscription_status, subscription_expires_at).
- If lapsed: server **rejects ingest** for that user’s devices (no new events stored); dashboard can show “Subscription expired”.

**Already in place:**  
- `marine_users.subscription_status` and `subscription_expires_at`.

**To add:**  
- Payment integration (Stripe, etc.): create subscription, webhooks to update subscription_status and subscription_expires_at.  
- In ingest API: before saving event, check subscription; if inactive, return 402 or 403 and do not store.

---

## 8. Business model

- Customer buys **hardware once** (e.g. $150).
- Customer pays **monthly** (e.g. $10/month) for cellular + server + maintenance + profit.

No code change needed; this is product/pricing. Optional: show “Subscribe — $10/mo” on dashboard when not subscribed.

---

## Suggested implementation order

1. **Database** — Add `marine_devices` and `marine_events`; run migrations.
2. **Ingest API** — `POST /api/marine/ingest`: validate device, check subscription, insert event.
3. **Dashboard data** — `GET /api/marine/devices`, `GET /api/marine/events`; wire dashboard to show devices and events.
4. **Device registration** — Endpoint or flow so a logged-in user can “add a device” (create `marine_devices` row; later, device gets token/keys via Bluetooth).
5. **Subscription** — Stripe (or other) subscription + webhooks to set subscription_status and subscription_expires_at; enforce in ingest.
6. **Device firmware / Bluetooth** — Out-of-app; device uses ingest API and (optionally) Bluetooth setup flow.

---

## Reference: core principle

> Move information from a physical sensor to a user’s screen through the internet.  
> Every piece of technology is a tool for that one goal.

So every feature should either:  
- **Get data from the device to the server** (ingest, auth, subscription check), or  
- **Get data from the server to the user’s screen** (dashboard, devices, events, subscription status).
