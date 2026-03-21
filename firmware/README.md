# Marine Monitor — ESP32-S3 firmware

Firmware for the ESP32-S3 that talks to the Marine Monitor server: BLE setup, WiFi, and POST float switch status every 2 seconds.

---

## Requirements

- **Arduino IDE** (2.x) or **PlatformIO**
- **ESP32 board support** (Espressif 32)
- **ArduinoJson** library (by Benoit Blanchon), v6.x

---

## Arduino IDE setup

1. **Install ESP32 support**
   - File → Preferences → Additional Boards Manager URLs:
     - `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools → Board → Boards Manager → search **esp32** → Install **Espressif Systems** “esp32”.

2. **Install ArduinoJson**
   - Sketch → Include Library → Manage Libraries → search **ArduinoJson** → Install (Benoit Blanchon).

3. **Select board**
   - Tools → Board → **ESP32S3 Dev Module** (or your exact ESP32-S3 board).
   - Set **USB CDC On Boot** to **Enabled** if you use USB for Serial.
   - Set **Partition Scheme** if needed (e.g. Default 4MB with spiffs).

4. **Open sketch**
   - Open `firmware/MarineMonitor/MarineMonitor.ino`.

5. **Upload**
   - Connect the ESP32-S3 via USB.
   - Select the correct port (Tools → Port).
   - Click Upload.

---

## Pins (edit in `MarineMonitor.ino`)

| Define             | Default | Description |
|--------------------|---------|-------------|
| `BLUE_LED_PIN`     | 2       | Blue LED in setup mode (blink ~1 Hz). |
| `GREEN_LED_PIN`    | 3       | Green LED when operational (brief blink on successful POST). |
| `FLOAT_SWITCH_PIN` | 4       | Float switch GPIO. **LOW** = open, **HIGH** = closed/activated. |

Change the `#define` lines at the top of the sketch if your board uses different pins.

---

## Flow

1. **First boot (no config):** Blue LED blinks. BLE advertises as “MarineMonitor”. Open the Marine Monitor setup page on your phone, connect to the device via Web Bluetooth, and send config (WiFi SSID/password, device_id, token, server_url).
2. **After config:** Device saves to NVS, connects to WiFi, stops BLE. Green LED blinks briefly every 2 seconds when a POST succeeds. Float switch is read every 2 s and sent to `{server_url}/api/marine/ingest`.
3. **Later boots:** Config loaded from NVS; if WiFi connects, goes straight to operational (no BLE).

---

## Clearing config (factory reset)

Erase NVS so the device goes back to setup mode:

- In Arduino: run a small sketch that calls `nvs_flash_erase()` then `nvs_flash_init()`, or use **esptool.py** to erase the NVS partition.
- Or add a “factory reset” in your firmware (e.g. hold a button at boot to clear NVS and reboot).
