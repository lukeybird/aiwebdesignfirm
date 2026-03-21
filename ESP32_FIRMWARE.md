# ESP32-S3 firmware contract (Marine Monitor)

Use this when writing the C++ firmware for the ESP32-S3 so it works with the Marine Monitor server and setup page.

---

## Behavior summary

- **On boot:** No button. Device **automatically** starts BLE advertising.
- **Blue LED:** Blinks about **once per second** while waiting for a BLE connection (setup mode).
- **After config received:** Store config in NVS, connect to WiFi, then switch to **operational** (e.g. **green LED** solid or blink when sending).
- **Float switch:** Read GPIO; send status every **2 seconds** via HTTP POST to the server.
- **Power:** Plugged in for now (no battery reporting).

---

## BLE (Bluetooth Low Energy)

### Advertising

- Start BLE advertising on boot (no button).
- Advertise the **config service UUID** so the setup page can find the device.

### GATT service and characteristic

- **Service UUID:** `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **Characteristic UUID (writable):** `4fafc202-1fb5-459e-8fcc-c5c9c331914b`

The setup page (Web Bluetooth) will **write** a single JSON string to this characteristic.

### Config payload (written by phone)

UTF-8 JSON string, for example:

```json
{
  "device_id": "abc123def456",
  "token": "hex_token_from_server",
  "server_url": "https://aiwebdesignfirm.com",
  "wifi_ssid": "ORBI38",
  "wifi_password": "your_wifi_password"
}
```

- **device_id**, **token** — From the server when the user adds a device (used to authenticate POSTs).
- **server_url** — Base URL (no trailing slash); device will POST to `{server_url}/api/marine/ingest`.
- **wifi_ssid**, **wifi_password** — Stored in NVS; use to connect WiFi (default SSID on setup page is ORBI38).

After receiving and parsing, store in NVS and reboot or switch to operational (connect WiFi, start reporting).

---

## Ingest API (device → server)

- **URL:** `POST {server_url}/api/marine/ingest`
- **Headers:** `Content-Type: application/json`
- **Body (JSON):**

```json
{
  "device_id": "abc123def456",
  "token": "hex_token_from_server",
  "float_switch": "open"
}
```

or

```json
{
  "device_id": "abc123def456",
  "token": "hex_token_from_server",
  "float_switch": "closed"
}
```

- **float_switch:** Use `"open"` or `"closed"` (or `"activated"` for closed if you prefer; server treats `closed`/`activated` as “float: closed”).
- Send this **every 2 seconds** with the current float state (read from GPIO, debounced).

**Response:** `200 OK` with `{"ok":true}` on success. `401` if device/token invalid.

---

## LED summary

| State        | LED   | Behavior              |
|-------------|-------|------------------------|
| Setup mode  | Blue  | Blink ~1 Hz until BLE connected and config received |
| Operational | Green | Solid or blink when POST succeeds |

---

## WiFi

- Credentials come **only** from BLE config (no hardcoded password in firmware).
- Setup page pre-fills SSID **ORBI38**; user enters password and sends via BLE.
