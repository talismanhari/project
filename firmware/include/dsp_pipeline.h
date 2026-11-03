#pragma once
#include <Arduino.h>
#include <stdint.h>
#include <math.h>

// ==========================================
// HARDWARE PIN CONSTRAINTS (DO NOT DEVIATE)
// ==========================================
// 1. ADXL345 (SPI Hardware Bus)
#define PIN_ADXL_CS    10
#define PIN_ADXL_MOSI  11
#define PIN_ADXL_SCK   12
#define PIN_ADXL_MISO  13
#define ADXL_ODR_HZ    3200

// 2. INMP441 (I2S DMA Audio Transducer)
#define PIN_I2S_SCK    5
#define PIN_I2S_WS     6
#define PIN_I2S_SD     7

// 3. ACS712 Current Sensor (ADC1 ONLY - NO ADC2)
#define PIN_ACS712_ADC 4

// 4. DS18B20 Temperature Transducer (1-Wire)
#define PIN_DS18B20    8

// 5. INA219 Hardware Current/Power Shunt (I2C)
#define PIN_I2C_SDA    1
#define PIN_I2C_SCL    2

// Sampling buffer dimensions (1.00s window @ 3200 Hz)
#define SAMPLES_PER_SEC 3200
#define FFT_POINTS      1024
#define DECIMATED_PTS   800
#define NUM_FEATURES    20

// Inter-Core FreeRTOS Message Payload (Core 0 DSP -> Core 1 TinyML)
struct DSPPayload {
    uint32_t window_idx;
    uint32_t timestamp_ms;
    float features[NUM_FEATURES];
    float raw_preview[DECIMATED_PTS]; // 800-sample decimation for live MQTT/Cloud uplink
    float rms_x;
    float peak_to_peak;
    float dominant_freq;
    float dominant_psd_db;
};

// Fast in-place Radix-2 Cooley-Tukey FFT (1024-pt)
inline void radix2_fft(float* real, float* imag, int n) {
    // Bit-reversal permutation
    int j = 0;
    for (int i = 0; i < n - 1; i++) {
        if (i < j) {
            float tr = real[i]; real[i] = real[j]; real[j] = tr;
            float ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
        }
        int k = n >> 1;
        while (k <= j) {
            j -= k;
            k >>= 1;
        }
        j += k;
    }

    // Butterfly computations
    for (int len = 2; len <= n; len <<= 1) {
        float angle = -2.0f * (float)M_PI / (float)len;
        float wlen_r = cosf(angle);
        float wlen_i = sinf(angle);
        int half = len >> 1;

        for (int i = 0; i < n; i += len) {
            float w_r = 1.0f;
            float w_i = 0.0f;
            for (int k = 0; k < half; k++) {
                int pos = i + k;
                int match = pos + half;
                float u_r = real[pos];
                float u_i = imag[pos];
                float v_r = real[match] * w_r - imag[match] * w_i;
                float v_i = real[match] * w_i + imag[match] * w_r;

                real[pos] = u_r + v_r;
                imag[pos] = u_i + v_i;
                real[match] = u_r - v_r;
                imag[match] = u_i - v_i;

                float next_wr = w_r * wlen_r - w_i * wlen_i;
                float next_wi = w_r * wlen_i + w_i * wlen_r;
                w_r = next_wr;
                w_i = next_wi;
            }
        }
    }
}

// Band power integration (dB)
inline float integrate_band_db(const float* psd, float f_res, float f_min, float f_max, int n_bins) {
    int i_min = (int)(f_min / f_res);
    int i_max = (int)(f_max / f_res);
    if (i_min < 0) i_min = 0;
    if (i_max >= n_bins) i_max = n_bins - 1;

    float sum_p = 0.0f;
    for (int i = i_min; i <= i_max; i++) {
        sum_p += psd[i];
    }
    if (sum_p < 1e-12f) sum_p = 1e-12f;
    return 10.0f * log10f(sum_p);
}
