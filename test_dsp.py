import numpy as np
from scipy import signal

FS_RAW = 12000
FS_TARGET = 3200

# 1-second synthetic or CWRU signal
t_raw = np.linspace(0, 1, FS_RAW, endpoint=False)
raw_sig = np.sin(2 * np.pi * 29.95 * t_raw) + 0.5 * np.sin(2 * np.pi * 107.4 * t_raw)

# 4th-order Butterworth low-pass filter at fc = 1500 Hz
b, a = signal.butter(4, 1500.0 / (FS_RAW / 2.0), btype='low')
filtered = signal.filtfilt(b, a, raw_sig)

# Resample to 3200 Hz: 12000 * 4 / 15 = 3200
downsampled = signal.resample_poly(filtered, up=4, down=15)
print("Downsampled shape:", downsampled.shape, "Expected: 3200")

# FFT up to Nyquist (1600 Hz)
fft_vals = np.abs(np.fft.rfft(downsampled * np.hanning(len(downsampled)))) / len(downsampled)
freqs = np.fft.rfftfreq(len(downsampled), 1.0 / FS_TARGET)
psd_db = 20 * np.log10(fft_vals + 1e-9)
print("FFT Nyquist:", freqs[-1], "Hz. Bins:", len(freqs))

# STFT 2D Spectrogram
f_stft, t_stft, Zxx = signal.stft(downsampled, fs=FS_TARGET, nperseg=128, noverlap=96)
mask = f_stft <= 1600
Zxx_db = 20 * np.log10(np.abs(Zxx[mask, :]) + 1e-9)
print("STFT shape:", Zxx_db.shape)
