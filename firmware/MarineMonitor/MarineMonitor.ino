/*
 * Marine Monitor — ESP32-S3 firmware
 * - On boot: BLE advertising, blue LED blinks ~1 Hz until config received
 * - Phone sends config via Web Bluetooth (device_id, token, server_url, wifi_ssid, wifi_password)
 * - After config: connect WiFi, green LED operational, POST float status every 2 s
 *
 * Pins (change for your board):
 *   BLUE_LED_PIN   = setup mode
 *   GREEN_LED_PIN  = operational
 *   FLOAT_SWITCH_PIN = GPIO reading float switch (LOW = open, HIGH = closed/activated)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLECharacteristic.h>
#include <BLEUtils.h>
#include <nvs_flash.h>
#include <nvs.h>
#include <ArduinoJson.h>

// ——— Pin definitions (adjust for your ESP32-S3 board) ———
#define BLUE_LED_PIN      2
#define GREEN_LED_PIN     3
#define FLOAT_SWITCH_PIN  4

// ——— BLE UUIDs (must match setup page) ———
#define CONFIG_SERVICE_UUID     "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CONFIG_CHAR_UUID        "4fafc202-1fb5-459e-8fcc-c5c9c331914b"

// ——— NVS keys ———
#define NVS_NAMESPACE     "marine"
#define NVS_DEVICE_ID     "device_id"
#define NVS_TOKEN         "token"
#define NVS_SERVER_URL    "server_url"
#define NVS_WIFI_SSID     "wifi_ssid"
#define NVS_WIFI_PASSWORD "wifi_pass"

// ——— Timing ———
#define SETUP_BLINK_MS    500   // blue LED: 500ms on, 500ms off = 1 Hz
#define POST_INTERVAL_MS  2000  // POST every 2 seconds
#define WIFI_TIMEOUT_MS   20000

// ——— Globals ———
BLEServer* pServer = nullptr;
BLECharacteristic* pConfigChar = nullptr;
nvs_handle_t nvs;
bool operational = false;
unsigned long lastBlueToggle = 0;
bool blueOn = false;
unsigned long lastPost = 0;
String deviceId;
String token;
String serverUrl;
String wifiSsid;
String wifiPassword;

// ——— NVS helpers ———
bool loadConfig() {
  if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &nvs) != ESP_OK) return false;
  char buf[256];
  size_t len = sizeof(buf);
  deviceId = "";
  token = "";
  serverUrl = "";
  wifiSsid = "";
  wifiPassword = "";
  if (nvs_get_str(nvs, NVS_DEVICE_ID, buf, &len) == ESP_OK) deviceId = buf;
  len = sizeof(buf); if (nvs_get_str(nvs, NVS_TOKEN, buf, &len) == ESP_OK) token = buf;
  len = sizeof(buf); if (nvs_get_str(nvs, NVS_SERVER_URL, buf, &len) == ESP_OK) serverUrl = buf;
  len = sizeof(buf); if (nvs_get_str(nvs, NVS_WIFI_SSID, buf, &len) == ESP_OK) wifiSsid = buf;
  len = sizeof(buf); if (nvs_get_str(nvs, NVS_WIFI_PASSWORD, buf, &len) == ESP_OK) wifiPassword = buf;
  nvs_close(nvs);
  return deviceId.length() > 0 && token.length() > 0 && serverUrl.length() > 0 && wifiSsid.length() > 0;
}

void saveConfig(const String& id, const String& tok, const String& url, const String& ssid, const String& pass) {
  nvs_open(NVS_NAMESPACE, NVS_READWRITE, &nvs);
  nvs_set_str(nvs, NVS_DEVICE_ID, id.c_str());
  nvs_set_str(nvs, NVS_TOKEN, tok.c_str());
  nvs_set_str(nvs, NVS_SERVER_URL, url.c_str());
  nvs_set_str(nvs, NVS_WIFI_SSID, ssid.c_str());
  nvs_set_str(nvs, NVS_WIFI_PASSWORD, pass.c_str());
  nvs_commit(nvs);
  nvs_close(nvs);
  deviceId = id;
  token = tok;
  serverUrl = url;
  wifiSsid = ssid;
  wifiPassword = pass;
}

// ——— BLE callback: config written by phone ———
class ConfigCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    std::string value = pChar->getValue();
    if (value.empty()) return;
    String json(value.c_str());
    StaticJsonDocument<512> doc;
    if (deserializeJson(doc, json) != DeserializationError::Ok) return;
    const char* id   = doc["device_id"];
    const char* tok  = doc["token"];
    const char* url  = doc["server_url"];
    const char* ssid = doc["wifi_ssid"];
    const char* pass = doc["wifi_password"];
    if (!id || !tok || !url || !ssid) return;
    saveConfig(String(id), String(tok), String(url), String(ssid), pass ? String(pass) : "");
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
    operational = true;
    if (pServer) pServer->getAdvertising()->stop();
  }
};

// ——— Setup BLE ———
void startBLE() {
  BLEDevice::init("MarineMonitor");
  pServer = BLEDevice::createServer();
  BLEService* pService = pServer->createService(CONFIG_SERVICE_UUID);
  pConfigChar = pService->createCharacteristic(
    CONFIG_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
  );
  pConfigChar->setCallbacks(new ConfigCallback());
  pService->start();
  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(CONFIG_SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->start();
}

// ——— Read float switch (debounced: LOW = open, HIGH = closed) ———
bool getFloatState() {
  return digitalRead(FLOAT_SWITCH_PIN) == HIGH;
}

// ——— POST status to server ———
bool postStatus(bool floatClosed) {
  if (serverUrl.length() == 0) return false;
  String url = serverUrl + "/api/marine/ingest";
  WiFiClientSecure client;
  client.setInsecure();  // for development; set CA cert in production
  HTTPClient http;
  if (!http.begin(client, url)) return false;
  http.addHeader("Content-Type", "application/json");
  String body = "{\"device_id\":\"" + deviceId + "\",\"token\":\"" + token + "\",\"float_switch\":\"" + (floatClosed ? "closed" : "open") + "\"}";
  int code = http.POST(body);
  http.end();
  return (code == 200);
}

void setup() {
  Serial.begin(115200);
  pinMode(BLUE_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(FLOAT_SWITCH_PIN, INPUT);
  digitalWrite(BLUE_LED_PIN, LOW);
  digitalWrite(GREEN_LED_PIN, LOW);

  if (nvs_flash_init() != ESP_OK) nvs_flash_erase();
  nvs_flash_init();

  if (loadConfig() && wifiSsid.length() > 0) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < WIFI_TIMEOUT_MS) {
      delay(200);
    }
    if (WiFi.status() == WL_CONNECTED) {
      operational = true;
    }
  }

  if (!operational) {
    startBLE();
  }
}

void loop() {
  if (operational) {
    // Connected: green LED on, POST every 2 s
    digitalWrite(BLUE_LED_PIN, LOW);
    unsigned long now = millis();
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
      delay(500);
      return;
    }
    if (now - lastPost >= POST_INTERVAL_MS) {
      lastPost = now;
      bool closed = getFloatState();
      if (postStatus(closed)) {
        digitalWrite(GREEN_LED_PIN, HIGH);
        delay(50);
        digitalWrite(GREEN_LED_PIN, LOW);
      }
    }
    return;
  }

  // Setup mode: blink blue ~1 Hz
  unsigned long now = millis();
  if (now - lastBlueToggle >= SETUP_BLINK_MS) {
    lastBlueToggle = now;
    blueOn = !blueOn;
    digitalWrite(BLUE_LED_PIN, blueOn ? HIGH : LOW);
  }
}
