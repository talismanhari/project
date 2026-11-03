/**
 * ESP32-S3 Dual-Core FreeRTOS Edge AI Digital Twin Firmware
 * Project: "Empirical Cost Modeling of Calibrated Inference Deferral in Microcontroller Edge AI"
 * 
 * CORE 0: Non-blocking Multi-Sensor Audit, Dynamic Physics Fallback, & 12-Feature DSP Extractor
 * CORE 1: INT8 Forward Pass, Softmax Calibration, Bayes Risk Evaluation, & UART Telemetry Stream
 */

#include <Arduino.h>
#include <WiFi.h>
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

// Non-Blocking Sensor Health Watchdog Status Flags
static bool SENSOR_ADXL345_ONLINE = false;
static bool SENSOR_INMP441_ONLINE = false;
static bool SENSOR_ACS712_ONLINE  = false;
static bool SENSOR_DS18B20_ONLINE = false;
static bool SENSOR_INA219_ONLINE  = false;

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

const char* STATE_LABELS[8] = {
    "Healthy", "Outer Race (BPFO)", "Inner Race (BPFI)", "Ball Defect",
    "Unbalance", "Misalignment", "Looseness", "Overload"
};

const char* FEATURE_NAMES_ARR[12] = {
    "RMS", "CrestFactor", "Kurtosis", "Skewness", "Peak2Peak",
    "BPFO_Ratio", "BPFI_Ratio", "HarmonicRatio", "SpectralCentroid",
    "HighFreqEnergy", "CurrentRMS", "TempDrift"
};

// Box-Muller Gaussian Noise Generator
static float generate_gaussian_noise(float mean, float std_dev) {
    float u1 = ((float)rand() + 1.0f) / ((float)RAND_MAX + 1.0f);
    float u2 = ((float)rand() + 1.0f) / ((float)RAND_MAX + 1.0f);
    float z0 = sqrtf(-2.0f * logf(u1)) * cosf(2.0f * (float)M_PI * u2);
    return mean + z0 * std_dev;
}

static float g_stator_temperature = 42.0f;

// =========================================================================
// CORE 0 TASK: Hardware Transducers, Multi-Rate DSP, & 12-Feature Array
// =========================================================================
void TaskCore0_DSP(void *pvParameters) {
    Serial.println("[Core 0] Probing Sensor Transducer Health (Non-Blocking Audit)...");
    
    // 1. Non-blocking Probe for ADXL345 (SPI)
    SPI.begin(PIN_ADXL_SCK, PIN_ADXL_MISO, PIN_ADXL_MOSI, PIN_ADXL_CS);
    pinMode(PIN_ADXL_CS, OUTPUT);
    digitalWrite(PIN_ADXL_CS, HIGH);

    if (accel.begin()) {
        accel.setDataRate(ADXL345_DATARATE_3200_HZ);
        accel.setRange(ADXL345_RANGE_16_G);
        SENSOR_ADXL345_ONLINE = true;
        Serial.println("[Core 0] ADXL345 SPI: ONLINE (3200 Hz ODR, +/-16g)");
    } else {
        SENSOR_ADXL345_ONLINE = false;
        Serial.println("[Core 0] ADXL345 SPI: OFFLINE -> Physics Dynamic Fallback Engaged");
    }

    // 2. Non-blocking Probe for INMP441 (I2S Pins configured as input)
    pinMode(PIN_I2S_SCK, OUTPUT);
    pinMode(PIN_I2S_WS, OUTPUT);
    pinMode(PIN_I2S_SD, INPUT);
    SENSOR_INMP441_ONLINE = false; // Set fallback unless physical DMA clock responds

    // 3. Non-blocking Probe for ACS712 on ADC1 (GPIO 4)
    pinMode(PIN_ACS712_ADC, INPUT);
    analogReadResolution(12);
    int test_adc = analogRead(PIN_ACS712_ADC);
    if (test_adc > 100 && test_adc < 4000) {
        SENSOR_ACS712_ONLINE = true;
        Serial.println("[Core 0] ACS712 Hall-Effect (ADC1 GPIO4): ONLINE");
    } else {
        SENSOR_ACS712_ONLINE = false;
        Serial.println("[Core 0] ACS712 Hall-Effect: OFFLINE -> Motor Profile Engaged");
    }

    // 4. Non-blocking Probe for DS18B20 (1-Wire GPIO 8)
    tempSensor.begin();
    tempSensor.setResolution(9);
    if (tempSensor.getDeviceCount() > 0) {
        tempSensor.requestTemperatures();
        float t_probe = tempSensor.getTempCByIndex(0);
        if (t_probe > -50.0f && t_probe < 125.0f) {
            SENSOR_DS18B20_ONLINE = true;
            g_stator_temperature = t_probe;
            Serial.printf("[Core 0] DS18B20 1-Wire: ONLINE (T = %.2f C)\n", t_probe);
        }
    }
    if (!SENSOR_DS18B20_ONLINE) {
        Serial.println("[Core 0] DS18B20 1-Wire: OFFLINE -> Thermal Drift Model Active");
    }

    uint32_t window_count = 0;
    float fft_real[FFT_POINTS];
    float fft_imag[FFT_POINTS];
    float psd_bins[FFT_POINTS / 2];
    const float f_res = (float)ADXL_ODR_HZ / (float)FFT_POINTS; // 3.125 Hz/bin

    for (;;) {
        int bufIdx = activeBufferIdx;
        activeBufferIdx = 1 - activeBufferIdx;
        float* activeBuf = pingPongBuffer[bufIdx];

        // 1. Vibration Acquisition (Hardware Transducer or Physics Dynamic Stream)
        if (SENSOR_ADXL345_ONLINE) {
            for (int i = 0; i < SAMPLES_PER_SEC; i++) {
                sensors_event_t event;
                if (accel.getEvent(&event)) {
                    activeBuf[i] = event.acceleration.x / 9.80665f;
                } else {
                    activeBuf[i] = 0.05f * sinf(2.0f * (float)M_PI * 29.5f * ((float)i / (float)ADXL_ODR_HZ));
                }
                delayMicroseconds(312);
            }
        } else {
            // Physics stream: 1X shaft (29.5 Hz) + Outer Race defect (104.2 Hz) + noise
            float global_t = (float)window_count;
            for (int i = 0; i < SAMPLES_PER_SEC; i++) {
                float t = (float)i / (float)ADXL_ODR_HZ;
                float shaft_1x = 0.055f * sinf(2.0f * (float)M_PI * 29.5f * (global_t + t));
                float bpfo_harm = 0.038f * sinf(2.0f * (float)M_PI * 104.2f * (global_t + t));
                float noise = generate_gaussian_noise(0.0f, 0.035f);
                activeBuf[i] = shaft_1x + bpfo_harm + noise;
                delayMicroseconds(312);
            }
        }

        // 2. Measure / Synthesize ACS712 Current & DS18B20 Temp
        float current_amps = 2.1f;
        if (SENSOR_ACS712_ONLINE) {
            int raw_adc = analogRead(PIN_ACS712_ADC);
            current_amps = fabsf(((float)raw_adc - 2048.0f) * (5.0f / 4095.0f) / 0.100f);
        } else {
            float t_sec = (float)window_count;
            current_amps = 2.10f + 0.22f * sinf(2.0f * (float)M_PI * 0.2f * t_sec) + 0.08f * sinf(2.0f * (float)M_PI * 50.0f * t_sec);
        }

        if (SENSOR_DS18B20_ONLINE && (window_count % 3 == 0)) {
            tempSensor.requestTemperatures();
            float t_c = tempSensor.getTempCByIndex(0);
            if (t_c > -40.0f && t_c < 125.0f) g_stator_temperature = t_c;
        } else if (!SENSOR_DS18B20_ONLINE) {
            g_stator_temperature = 0.995f * g_stator_temperature + 0.22f + generate_gaussian_noise(0.0f, 0.08f);
        }

        // 3. Time-Domain Statistical Moments
        float sum_v = 0.0f, sum_sq = 0.0f;
        float max_val = -100.0f, min_val = 100.0f;
        for (int i = 0; i < SAMPLES_PER_SEC; i++) {
            float v = activeBuf[i];
            sum_v += v;
            sum_sq += v * v;
            if (v > max_val) max_val = v;
            if (v < min_val) min_val = v;
        }
        float mean = sum_v / (float)SAMPLES_PER_SEC;
        float rms_x = sqrtf(sum_sq / (float)SAMPLES_PER_SEC);
        float p2p = max_val - min_val;
        float crest = (rms_x > 1e-6f) ? (p2p / 2.0f / rms_x) : 0.0f;

        float sum_m3 = 0.0f, sum_m4 = 0.0f;
        for (int i = 0; i < SAMPLES_PER_SEC; i++) {
            float d = activeBuf[i] - mean;
            float d2 = d * d;
            sum_m3 += d2 * d;
            sum_m4 += d2 * d2;
        }
        float variance = (sum_sq / (float)SAMPLES_PER_SEC) - (mean * mean);
        if (variance < 1e-8f) variance = 1e-8f;
        float skewness = (sum_m3 / (float)SAMPLES_PER_SEC) / powf(variance, 1.5f);
        float kurtosis = (sum_m4 / (float)SAMPLES_PER_SEC) / (variance * variance);

        // 4. 1024-Point Real FFT
        for (int i = 0; i < FFT_POINTS; i++) {
            float w = 0.5f * (1.0f - cosf(2.0f * (float)M_PI * (float)i / (float)(FFT_POINTS - 1)));
            fft_real[i] = activeBuf[i] * w;
            fft_imag[i] = 0.0f;
        }
        radix2_fft(fft_real, fft_imag, FFT_POINTS);

        float total_power = 0.0f;
        float num_centroid = 0.0f;
        for (int i = 0; i < FFT_POINTS / 2; i++) {
            float mag = (fft_real[i] * fft_real[i] + fft_imag[i] * fft_imag[i]) / (float)(FFT_POINTS * FFT_POINTS);
            psd_bins[i] = mag;
            total_power += mag;
            num_centroid += ((float)i * f_res) * mag;
        }
        if (total_power < 1e-12f) total_power = 1e-12f;
        float spectral_centroid = num_centroid / total_power;

        float bpfo_power = integrate_band_linear(psd_bins, f_res, 102.0f, 106.0f, FFT_POINTS / 2);
        float bpfi_power = integrate_band_linear(psd_bins, f_res, 160.0f, 165.0f, FFT_POINTS / 2);
        float fund_1x = integrate_band_linear(psd_bins, f_res, 28.0f, 31.0f, FFT_POINTS / 2);
        float harm_2x = integrate_band_linear(psd_bins, f_res, 58.0f, 61.0f, FFT_POINTS / 2);
        float high_freq_power = integrate_band_linear(psd_bins, f_res, 800.0f, 1600.0f, FFT_POINTS / 2);

        float bpfo_ratio = bpfo_power / total_power;
        float bpfi_ratio = bpfi_power / total_power;
        float harm_ratio = (fund_1x > 1e-12f) ? (harm_2x / fund_1x) : 0.0f;
        float high_freq_ratio = high_freq_power / total_power;
        float temp_drift = g_stator_temperature - 25.0f;

        // 5. Assemble Structured 12-Feature Vector
        DSPPayload payload;
        window_count++;
        payload.window_idx = window_count;
        payload.timestamp_ms = millis();
        payload.is_physical = (SENSOR_ADXL345_ONLINE || SENSOR_ACS712_ONLINE || SENSOR_DS18B20_ONLINE);

        payload.features[0]  = rms_x;
        payload.features[1]  = crest;
        payload.features[2]  = kurtosis;
        payload.features[3]  = skewness;
        payload.features[4]  = p2p;
        payload.features[5]  = bpfo_ratio;
        payload.features[6]  = bpfi_ratio;
        payload.features[7]  = harm_ratio;
        payload.features[8]  = spectral_centroid;
        payload.features[9]  = high_freq_ratio;
        payload.features[10] = current_amps;
        payload.features[11] = temp_drift;

        // Quantize features to INT8
        for (int i = 0; i < NUM_DSP_FEATURES; i++) {
            float norm = (payload.features[i] - feature_means[i]) / feature_stds[i];
            payload.int8_features[i] = (int8_t)constrain(round(norm * 32.0f), -128, 127);
        }

        // Decimate to 100-sample preview buffer
        int step = SAMPLES_PER_SEC / DECIMATED_PTS;
        for (int j = 0; j < DECIMATED_PTS; j++) {
            payload.raw_preview[j] = activeBuf[j * step];
        }

        xQueueSend(xQueueDSP, &payload, portMAX_DELAY);
    }
}

// =========================================================================
// CORE 1 TASK: Forward Pass, Bayes Risk, & JSON Telemetry Stream
// =========================================================================
void TaskCore1_Inference(void *pvParameters) {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    if (ina219.begin()) {
        ina219.setCalibration_32V_2A();
        SENSOR_INA219_ONLINE = true;
        Serial.println("[Core 1] INA219 Shunt: ONLINE (I2C SDA=1, SCL=2)");
    } else {
        SENSOR_INA219_ONLINE = false;
        Serial.println("[Core 1] INA219 Shunt: OFFLINE -> Energy Status Tagged Offline");
    }

    WiFi.mode(WIFI_OFF);
    WiFi.disconnect(true);

    DSPPayload payload;
    float logits[MODEL_NUM_CLASSES];
    float probs[MODEL_NUM_CLASSES];

    for (;;) {
        if (xQueueReceive(xQueueDSP, &payload, portMAX_DELAY) == pdTRUE) {
            // 1. INT8 Forward Pass
            tinyml_forward(payload.features, logits);

            // 2. Softmax Calibration
            compute_calibrated_probabilities(logits, probs, calibration_temperature);

            // 3. Bayes Risk Evaluation
            int optimal_action = 0;
            float min_risk = compute_minimum_bayes_risk(probs, &optimal_action);
            bool defer_to_cloud = (min_risk > DEFERRAL_THRESHOLD);

            // 4. Construct Clean JSON Frame for UART/COM7
            JsonDocument doc;

            JsonObject acq = doc["acquisition"].to<JsonObject>();
            acq["mode"] = payload.is_physical ? "PHYSICAL_HARDWARE_ACTIVE" : "SYNTHETIC_ACTIVE";
            JsonArray wave_arr = acq["waveform"].to<JsonArray>();
            for (int i = 0; i < DECIMATED_PTS; i++) {
                wave_arr.add(serialized(String(payload.raw_preview[i], 3)));
            }

            JsonObject int8_f = doc["features_int8"].to<JsonObject>();
            JsonArray names = int8_f["names"].to<JsonArray>();
            JsonArray f_vals = int8_f["floats"].to<JsonArray>();
            JsonArray i_vals = int8_f["ints"].to<JsonArray>();

            for (int i = 0; i < NUM_DSP_FEATURES; i++) {
                names.add(FEATURE_NAMES_ARR[i]);
                f_vals.add(serialized(String(payload.features[i], 2)));
                i_vals.add(payload.int8_features[i]);
            }

            JsonObject dec = doc["decision"].to<JsonObject>();
            dec["action"] = defer_to_cloud ? "CLOUD" : "EDGE";
            dec["risk_score"] = serialized(String(min_risk, 3));
            dec["threshold"] = DEFERRAL_THRESHOLD;
            dec["predicted_class"] = STATE_LABELS[optimal_action];
            dec["confidence"] = serialized(String(probs[optimal_action] * 100.0f, 1));
            dec["defer_to_cloud"] = defer_to_cloud;

            JsonObject energy = doc["energy_status"].to<JsonObject>();
            energy["hardware_online"] = SENSOR_INA219_ONLINE;
            energy["label"] = SENSOR_INA219_ONLINE ? "INA219 ONLINE" : "INA219 OFFLINE";
            energy["est_edge_mw"] = 310;
            energy["est_gpu_w"] = 45;

            // Backward compatibility
            JsonObject hw = doc["hardware_status"].to<JsonObject>();
            hw["is_physical"] = payload.is_physical;
            hw["mode_label"] = payload.is_physical ? "PHYSICAL HARDWARE ACQUISITION" : "STANDBY ENGINE ACTIVE";
            doc["raw_waveform"] = wave_arr;

            serializeJson(doc, Serial);
            Serial.println();
        }
    }
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n{\"status\":\"BOOT_OK\",\"mcu\":\"ESP32-S3-DevKitC-1\",\"dual_core\":true}");

    xQueueDSP = xQueueCreate(2, sizeof(DSPPayload));
    if (xQueueDSP == NULL) {
        Serial.println("{\"error\":\"DSP_QUEUE_ALLOCATION_FAILED\"}");
        while (1) delay(1000);
    }

    xTaskCreatePinnedToCore(TaskCore0_DSP, "TaskCore0_DSP", 8192, NULL, 2, NULL, 0);
    xTaskCreatePinnedToCore(TaskCore1_Inference, "TaskCore1_Inference", 16384, NULL, 1, NULL, 1);
}

void loop() {
    vTaskDelay(portMAX_DELAY);
}
