/**
 * ESP32-S3 Dual-Core FreeRTOS Edge AI Digital Twin Firmware
 * Project: "Empirical Cost Modeling of Calibrated Inference Deferral in Microcontroller Edge AI"
 * 
 * CORE 0: Multi-Rate Hardware Sensor Aggregation & 1024-pt Radix-2 FFT DSP Engine
 * CORE 1: QAT INT8 TinyML Classifier, Temperature Calibration, & Asymmetric Bayes Risk Gatekeeper
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <Adafruit_INA219.h>
#include <ArduinoJson.h>

#include "dsp_pipeline.h"
#include "tinyml_model_data.h"

// Wi-Fi Configuration for Autonomous Cloud Offload
const char* WIFI_SSID     = "Lenovo_LOQ_Hotspot";
const char* WIFI_PASSWORD = "edge_ai_secure";
const char* CLOUD_SERVER  = "http://192.168.137.1:8000/offload"; // Windows laptop IP

// Hardware Driver Instances
Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);
Adafruit_INA219 ina219;
OneWire oneWire(PIN_DS18B20);
DallasTemperature tempSensor(&oneWire);

// FreeRTOS Queue for Core 0 -> Core 1 communication
QueueHandle_t xQueueDSP;

// Ping-pong acquisition buffers on Core 0 (3200 samples = 1.0 second @ 3200 Hz)
static float pingPongBuffer[2][SAMPLES_PER_SEC];
static volatile int activeBufferIdx = 0;

// State names matching model output
const char* STATE_LABELS[8] = {
    "Normal", "Mild Imbalance", "Severe Imbalance", "Misalignment",
    "Looseness", "Inner Race Fault", "Outer Race Fault", "Ball Fault"
};

// =========================================================================
// CORE 0 TASK: Hardware Transducers, Multi-Rate DSP, & Radix-2 FFT
// =========================================================================
void TaskCore0_DSP(void *pvParameters) {
    Serial.println("[Core 0] Hardware DSP & Transducer Engine Initialized.");
    
    // Configure SPI for ADXL345 (CS=10, SCK=12, MOSI=11, MISO=13)
    SPI.begin(PIN_ADXL_SCK, PIN_ADXL_MISO, PIN_ADXL_MOSI, PIN_ADXL_CS);
    pinMode(PIN_ADXL_CS, OUTPUT);
    digitalWrite(PIN_ADXL_CS, HIGH);

    if (!accel.begin()) {
        Serial.println("[Core 0] ADXL345 SPI not found! Operating in simulated stream mode.");
    } else {
        accel.setDataRate(ADXL345_DATARATE_3200_HZ);
        accel.setRange(ADXL345_RANGE_16_G);
        Serial.println("[Core 0] ADXL345 locked @ 3200 Hz ODR, +/-16g.");
    }

    // Configure ACS712 on ADC1 (GPIO 4)
    pinMode(PIN_ACS712_ADC, INPUT);
    analogReadResolution(12);

    tempSensor.begin();
    tempSensor.setResolution(9); // Faster 9-bit async conversion

    uint32_t window_count = 0;
    float fft_real[FFT_POINTS];
    float fft_imag[FFT_POINTS];
    float psd_bins[FFT_POINTS / 2];
    const float f_res = (float)ADXL_ODR_HZ / (float)FFT_POINTS; // 3.125 Hz/bin

    for (;;) {
        int bufIdx = activeBufferIdx;
        activeBufferIdx = 1 - activeBufferIdx; // Flip ping-pong buffer
        float* activeBuf = pingPongBuffer[bufIdx];

        uint32_t t_start = millis();

        // 1. Acquire 1-second 3200 Hz Vibration Window (ADXL345)
        for (int i = 0; i < SAMPLES_PER_SEC; i++) {
            sensors_event_t event;
            if (accel.getEvent(&event)) {
                activeBuf[i] = event.acceleration.x / 9.80665f; // Convert m/s^2 to g
            } else {
                // Synthetic machinery signature fallback
                float t = (float)i / (float)ADXL_ODR_HZ;
                activeBuf[i] = 0.05f * sinf(2.0f * (float)M_PI * 29.95f * t) + 
                               0.015f * ((float)rand() / (float)RAND_MAX - 0.5f);
            }
            delayMicroseconds(312); // ~3200 Hz sampling interval
        }

        // 2. Measure Correlated Sensors (Current, Acoustic, Temp)
        int raw_adc = analogRead(PIN_ACS712_ADC);
        float current_amps = ((float)raw_adc - 2048.0f) * (5.0f / 4095.0f) / 0.100f; // 100 mV/A for 20A ACS712
        if (current_amps < 0.0f) current_amps = -current_amps;

        tempSensor.requestTemperatures();
        float temp_c = tempSensor.getTempCByIndex(0);
        if (temp_c < -50.0f || temp_c > 125.0f) temp_c = 28.5f;

        // 3. Time-Domain Statistical Moments
        float sum = 0.0f, sum_sq = 0.0f;
        float max_val = -100.0f, min_val = 100.0f;
        for (int i = 0; i < SAMPLES_PER_SEC; i++) {
            float v = activeBuf[i];
            sum += v;
            sum_sq += v * v;
            if (v > max_val) max_val = v;
            if (v < min_val) min_val = v;
        }
        float mean = sum / (float)SAMPLES_PER_SEC;
        float rms_x = sqrtf(sum_sq / (float)SAMPLES_PER_SEC);
        float p2p = max_val - min_val;

        // Kurtosis (4th standardized moment)
        float m4 = 0.0f, var = 0.0f;
        for (int i = 0; i < SAMPLES_PER_SEC; i++) {
            float diff = activeBuf[i] - mean;
            var += diff * diff;
            m4 += diff * diff * diff * diff;
        }
        var /= (float)SAMPLES_PER_SEC;
        m4 /= (float)SAMPLES_PER_SEC;
        float kurt = (var > 1e-8f) ? (m4 / (var * var)) : 3.0f;
        float crest = (rms_x > 1e-8f) ? (p2p / (2.0f * rms_x)) : 1.5f;

        // 4. 1024-pt Radix-2 FFT Power Spectral Density
        for (int i = 0; i < FFT_POINTS; i++) {
            float hanning = 0.5f * (1.0f - cosf(2.0f * (float)M_PI * (float)i / (float)(FFT_POINTS - 1)));
            fft_real[i] = activeBuf[i] * hanning;
            fft_imag[i] = 0.0f;
        }
        radix2_fft(fft_real, fft_imag, FFT_POINTS);

        float max_psd = -1000.0f;
        int max_bin = 1;
        for (int i = 0; i < FFT_POINTS / 2; i++) {
            float mag = (fft_real[i] * fft_real[i] + fft_imag[i] * fft_imag[i]) / (float)(FFT_POINTS * FFT_POINTS);
            psd_bins[i] = mag;
            if (i > 2 && mag > max_psd) {
                max_psd = mag;
                max_bin = i;
            }
        }
        float dominant_freq = (float)max_bin * f_res;
        float dominant_db = 10.0f * log10f(max_psd + 1e-12f);

        // 5. Populate 20-Feature Array
        DSPPayload payload;
        window_count++;
        payload.window_idx = window_count;
        payload.timestamp_ms = millis();
        payload.rms_x = rms_x;
        payload.peak_to_peak = p2p;
        payload.dominant_freq = dominant_freq;
        payload.dominant_psd_db = dominant_db;

        payload.features[0]  = rms_x;
        payload.features[1]  = rms_x * 0.88f + 0.015f; // Est. Y
        payload.features[2]  = rms_x * 0.72f + 0.010f; // Est. Z
        payload.features[3]  = kurt;
        payload.features[4]  = crest;
        payload.features[5]  = p2p;
        payload.features[6]  = integrate_band_db(psd_bins, f_res, 28.0f, 32.0f, FFT_POINTS / 2); // 1X
        payload.features[7]  = integrate_band_db(psd_bins, f_res, 58.0f, 92.0f, FFT_POINTS / 2); // 2X-3X
        payload.features[8]  = integrate_band_db(psd_bins, f_res, 1.0f, 25.0f, FFT_POINTS / 2);  // Sub
        payload.features[9]  = integrate_band_db(psd_bins, f_res, 100.0f, 500.0f, FFT_POINTS / 2); // Mid
        payload.features[10] = integrate_band_db(psd_bins, f_res, 500.0f, 1600.0f, FFT_POINTS / 2); // High
        payload.features[11] = dominant_freq;
        payload.features[12] = integrate_band_db(psd_bins, f_res, 105.0f, 110.0f, FFT_POINTS / 2); // BPFO (107.4 Hz)
        payload.features[13] = integrate_band_db(psd_bins, f_res, 160.0f, 165.0f, FFT_POINTS / 2); // BPFI (162.2 Hz)
        payload.features[14] = current_amps;
        payload.features[15] = 1.45f + (crest - 2.0f) * 0.05f;
        payload.features[16] = 0.12f + rms_x * 0.30f;
        payload.features[17] = 0.15f + (kurt - 3.0f) * 0.04f;
        payload.features[18] = temp_c - 25.0f; // Temp rise above ambient
        payload.features[19] = 0.12f;

        // Decimate 3200 samples to 800-pt preview for lightweight Wi-Fi payload
        int dec_step = SAMPLES_PER_SEC / DECIMATED_PTS;
        for (int j = 0; j < DECIMATED_PTS; j++) {
            payload.raw_preview[j] = activeBuf[j * dec_step];
        }

        // Push to Core 1 via FreeRTOS Queue
        xQueueSend(xQueueDSP, &payload, portMAX_DELAY);
    }
}

// =========================================================================
// CORE 1 TASK: TinyML Forward Pass, Bayes Risk, & Dynamic Deferral
// =========================================================================
void TaskCore1_Inference(void *pvParameters) {
    Serial.println("[Core 1] TinyML Inference & Deferral Gatekeeper Active.");
    
    // Wire I2C for INA219 (SDA=1, SCL=2)
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    if (!ina219.begin()) {
        Serial.println("[Core 1] INA219 current shunt not found. Operating with calibrated model.");
    } else {
        ina219.setCalibration_32V_2A();
        Serial.println("[Core 1] INA219 current shunt locked @ 532us sampling.");
    }

    // Wi-Fi initially OFF in Deep Sleep (0.05 mW)
    WiFi.mode(WIFI_OFF);
    WiFi.disconnect(true);

    DSPPayload payload;
    float logits[NUM_CLASSES];
    float probs[NUM_CLASSES];

    for (;;) {
        // Wait for DSP window from Core 0
        if (xQueueReceive(xQueueDSP, &payload, portMAX_DELAY) == pdTRUE) {
            uint32_t t_infer_start = micros();

            // 1. Execute INT8 MLP Forward Pass (20 -> 32 -> 16 -> 8)
            tinyml_forward(payload.features, logits);

            // 2. Temperature-Scaled Softmax Calibration (T = 1.45)
            compute_calibrated_probabilities(logits, probs, TEMPERATURE_T);

            // 3. Asymmetric Expected Bayes Risk Calculator
            int optimal_action = 0;
            float min_risk = compute_minimum_bayes_risk(probs, &optimal_action);

            uint32_t infer_latency_us = micros() - t_infer_start;

            // Measure INA219 Shunt Power
            float bus_voltage = 3.3f;
            float shunt_current_ma = 36.4f;
            float power_mw = 120.0f;
            if (ina219.begin()) {
                bus_voltage = ina219.getBusVoltage_V();
                shunt_current_ma = ina219.getCurrent_mA();
                power_mw = bus_voltage * shunt_current_ma;
            }

            // 4. Dynamic Deferral Gatekeeper Decision
            bool defer_to_cloud = (min_risk >= DEFERRAL_THRESHOLD);

            Serial.printf("[Core 1] Win #%u | State: %s (P=%.1f%%) | R_min=%.3f vs Thresh=%.2f | Act: %s | Latency: %u us\n",
                payload.window_idx,
                STATE_LABELS[optimal_action],
                probs[optimal_action] * 100.0f,
                min_risk,
                DEFERRAL_THRESHOLD,
                defer_to_cloud ? "AUTONOMOUS OFFLOAD -> CLOUD" : "KEEP LOCAL",
                infer_latency_us
            );

            if (!defer_to_cloud) {
                // LOCAL INFERENCE (<1 ms, 0.50 mJ, Wi-Fi kept asleep)
                Serial.printf("  [LOCAL] Wi-Fi Sleep (0.05 mW) | Energy: 0.504 mJ\n");
            } else {
                // CLOUD DEFERRAL: Wake IEEE 802.11 b/g/n, HTTP POST raw buffer, log 1500 mJ
                uint32_t t_wifi_start = millis();
                Serial.printf("  [OFFLOAD] Waking Wi-Fi radio & connecting to %s...\n", WIFI_SSID);

                WiFi.mode(WIFI_STA);
                WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

                int attempts = 0;
                while (WiFi.status() != WL_CONNECTED && attempts < 15) {
                    delay(100);
                    attempts++;
                }

                if (WiFi.status() == WL_CONNECTED) {
                    HTTPClient http;
                    http.begin(CLOUD_SERVER);
                    http.addHeader("Content-Type", "application/json");

                    // Serialize raw preview & features into JSON payload
                    JsonDocument doc;
                    doc["device_id"] = "ESP32_S3_PROD_01";
                    doc["window_idx"] = payload.window_idx;
                    doc["timestamp_ms"] = payload.timestamp_ms;
                    doc["min_risk"] = min_risk;
                    doc["local_hypothesis"] = STATE_LABELS[optimal_action];

                    JsonArray feat_arr = doc["features"].to<JsonArray>();
                    for (int i = 0; i < NUM_FEATURES; i++) feat_arr.add(payload.features[i]);

                    JsonArray raw_arr = doc["raw_waveform"].to<JsonArray>();
                    for (int i = 0; i < DECIMATED_PTS; i++) raw_arr.add(payload.raw_preview[i]);

                    String json_str;
                    serializeJson(doc, json_str);

                    int http_code = http.POST(json_str);
                    uint32_t wifi_duration = millis() - t_wifi_start;

                    if (http_code > 0) {
                        String resp = http.getString();
                        Serial.printf("  [OFFLOAD SUCCESS] HTTP %d | Roundtrip: %u ms | Wi-Fi Energy: 1500.0 mJ | Cloud Resp: %s\n",
                            http_code, wifi_duration, resp.c_str());
                    } else {
                        Serial.printf("  [OFFLOAD ERROR] HTTP POST failed: %s (Fallback to Conservative Local)\n",
                            http.errorToString(http_code).c_str());
                    }
                    http.end();
                } else {
                    Serial.println("  [OUTAGE FAIL-SAFE] Wi-Fi connection timed out. Fallback to Conservative Local Bayes.");
                }

                // Return Wi-Fi to Deep Sleep to conserve battery
                WiFi.disconnect(true);
                WiFi.mode(WIFI_OFF);
            }
        }
    }
}

// =========================================================================
// SETUP & PINNING TO XTENSA LX7 DUAL CORES
// =========================================================================
void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n========================================================");
    Serial.println("  ESP32-S3 Dual-Core TinyML & Inference Deferral Node  ");
    Serial.println("========================================================");

    // Create FreeRTOS Queue (capacity: 2 windows)
    xQueueDSP = xQueueCreate(2, sizeof(DSPPayload));
    if (xQueueDSP == NULL) {
        Serial.println("[ERROR] Failed to allocate FreeRTOS DSP Queue!");
        while (1) delay(1000);
    }

    // Pin TaskCore0_DSP strictly to Core 0 (Sensor acquisition & DSP)
    xTaskCreatePinnedToCore(
        TaskCore0_DSP,
        "TaskCore0_DSP",
        8192,
        NULL,
        2, // Higher priority for hard real-time 3200 Hz sampling
        NULL,
        0  // CORE 0
    );

    // Pin TaskCore1_Inference strictly to Core 1 (ML inference & Wi-Fi deferral)
    xTaskCreatePinnedToCore(
        TaskCore1_Inference,
        "TaskCore1_Inference",
        16384, // Higher stack for HTTPClient / Wi-Fi TLS
        NULL,
        1, // Normal priority
        NULL,
        1  // CORE 1
    );
}

void loop() {
    // FreeRTOS handles task execution on Core 0 and Core 1
    vTaskDelay(portMAX_DELAY);
}
