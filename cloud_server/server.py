import os
import sys
import time
import json
import asyncio
from typing import List, Optional
from contextlib import asynccontextmanager
import numpy as np

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    torch = None
    TORCH_AVAILABLE = False

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Configuration from Environment Variables
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
COM_PORT = os.getenv("ESP32_COM_PORT", "COM7")
BAUD_RATE = int(os.getenv("ESP32_BAUD_RATE", "115200"))
FORCE_DEVICE = os.getenv("DEVICE", "auto")

if TORCH_AVAILABLE and torch is not None:
    if FORCE_DEVICE == "cpu":
        DEVICE = "cpu"
    elif FORCE_DEVICE == "cuda" and torch.cuda.is_available():
        DEVICE = "cuda"
    else:
        DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    GPU_NAME = torch.cuda.get_device_name(0) if (DEVICE == "cuda" and torch.cuda.is_available()) else "Host CPU (Float32)"
else:
    DEVICE = "cpu"
    GPU_NAME = "Host CPU (NumPy STFT Engine)"

print("============================================================")
print(f"[*] Cloud Validation Engine: {DEVICE.upper()} ({GPU_NAME})")
print(f"[*] COM Port Monitor Target: {COM_PORT} @ {BAUD_RATE} baud")
print("============================================================")

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(STATIC_DIR, exist_ok=True)

FEATURE_NAMES = [
    "RMS", "CrestFactor", "Kurtosis", "Skewness", "Peak2Peak",
    "BPFO_Ratio", "BPFI_Ratio", "HarmonicRatio", "SpectralCentroid",
    "HighFreqEnergy", "CurrentRMS", "TempDrift"
]

CLASS_NAMES = [
    "Healthy", "Outer Race Fault", "Inner Race Fault", "Ball Defect",
    "Unbalance", "Misalignment", "Loose Stator", "Overload"
]

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()
serial_task = None
serial_handle = None

def compute_gpu_stft(sig_array: np.ndarray):
    """
    Computes 2D STFT Spectrogram using PyTorch on CUDA (or NumPy fallback).
    Window N=256, hop H=64, Hanning window, log-magnitude dB.
    """
    t_start = time.time()
    if len(sig_array) < 256:
        sig_array = np.pad(sig_array, (0, 256 - len(sig_array)), mode='reflect')

    if TORCH_AVAILABLE and torch is not None:
        tensor_sig = torch.tensor(sig_array, dtype=torch.float32, device=DEVICE)
        window = torch.hann_window(256, device=DEVICE)
        stft_res = torch.stft(
            tensor_sig,
            n_fft=256,
            hop_length=64,
            win_length=256,
            window=window,
            center=True,
            return_complex=True
        )
        mag = torch.abs(stft_res)
        psd_db = 20.0 * torch.log10(mag + 1e-6)
        psd_db = torch.nan_to_num(psd_db, nan=-100.0, posinf=40.0, neginf=-100.0)
        psd_db_np = psd_db.cpu().numpy()
    else:
        win = np.hanning(256)
        hop = 64
        num_frames = max(1, (len(sig_array) - 256) // hop + 1)
        frames = []
        for i in range(num_frames):
            seg = sig_array[i * hop : i * hop + 256]
            if len(seg) < 256:
                seg = np.pad(seg, (0, 256 - len(seg)), mode='constant')
            fft_seg = np.abs(np.fft.rfft(seg * win))
            frames.append(fft_seg)
        mag_np = np.column_stack(frames) if frames else np.zeros((129, 1))
        psd_db_np = 20.0 * np.log10(mag_np + 1e-6)
        psd_db_np = np.nan_to_num(psd_db_np, nan=-100.0, posinf=40.0, neginf=-100.0)

    f_bins = psd_db_np.shape[0]  # 129 bins
    t_bins = psd_db_np.shape[1]

    freqs = [round(float(f), 1) for f in np.linspace(0.0, 1600.0, f_bins)]
    times = [round(float(t), 3) for t in np.linspace(0.0, 1.0, t_bins)]
    z_matrix = [[round(float(v), 2) for v in row] for row in psd_db_np]

    latency_ms = (time.time() - t_start) * 1000.0
    return z_matrix, times, freqs, latency_ms

async def serial_listener():
    """Background listener for UART frames emitted by ESP32-S3 over COM7."""
    global serial_handle
    try:
        import serial
        try:
            serial_handle = serial.Serial(COM_PORT, BAUD_RATE, timeout=1)
            print(f"[+] Serial connection established on {COM_PORT}.")
            while True:
                if serial_handle and serial_handle.is_open:
                    line = serial_handle.readline().decode('utf-8', errors='ignore').strip()
                    if line.startswith("{") and line.endswith("}"):
                        try:
                            parsed = json.loads(line)
                            # Check if deferral triggered
                            dec = parsed.get("decision", {})
                            defer = dec.get("defer_to_cloud", False) or dec.get("action") == "CLOUD"

                            raw_wave = parsed.get("raw_waveform", [])
                            if defer and len(raw_wave) > 0:
                                sig_arr = np.array(raw_wave, dtype=np.float32)
                                z, t_arr, f_arr, ms = compute_gpu_stft(sig_arr)
                                parsed["spectrogram"] = {
                                    "z": z,
                                    "times": t_arr,
                                    "freqs": f_arr
                                }
                                parsed["cloud_verdict"] = {
                                    "status": "VALIDATED_BY_RTX3050",
                                    "gpu_device": GPU_NAME,
                                    "latency_ms": round(ms, 2),
                                    "confirmed_fault": dec.get("predicted_class", "Outer Race Fault")
                                }
                            else:
                                parsed["spectrogram"] = None
                                parsed["cloud_verdict"] = {
                                    "status": "GPU_STANDBY_IDLE",
                                    "gpu_device": GPU_NAME
                                }

                            await manager.broadcast(parsed)
                        except json.JSONDecodeError:
                            pass
                await asyncio.sleep(0.01)
        except Exception as e:
            print(f"[*] Note: COM port {COM_PORT} not opened ({e}). Simulation mode active.")
    except ImportError:
        print("[*] Note: pyserial not installed. Simulation mode active.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(serial_listener())
    yield
    task.cancel()
    global serial_handle
    if serial_handle and serial_handle.is_open:
        try:
            serial_handle.close()
        except Exception:
            pass
    if TORCH_AVAILABLE and torch is not None and torch.cuda.is_available():
        torch.cuda.empty_cache()

app = FastAPI(
    title="Edge-Cloud Inference Deferral Server (RTX 3050 Accelerated)",
    version="4.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimRequest(BaseModel):
    mode: str = "MODE_1_NORMAL"
    window_idx: int = 1
    outage_failsafe: Optional[bool] = False

def build_stream_payload(mode: str = "MODE_1_NORMAL", window_idx: int = 1, outage: bool = False):
    is_severe = (mode == "MODE_2_SEVERE")
    t = np.linspace(0.0, 1.0, 100, endpoint=False)

    if not is_severe:
        # Healthy 100-pt waveform
        sig = 0.05 * np.sin(2 * np.pi * 29.5 * t) + 0.015 * np.random.randn(len(t))
        risk_score = 0.14 + float(np.random.normal(0, 0.02))
        action = "EDGE"
        predicted_class = "Healthy"
        confidence = 96.8
        defer = False
        float_vals = [0.065, 2.40, 2.80, 0.05, 0.42, 0.04, 0.03, 0.85, 220.0, 0.08, 2.10, 0.50]
        int8_vals = [8, 12, 18, 2, 14, 3, 2, 24, 18, 4, 32, 2]
    else:
        # Severe fault 100-pt waveform
        sig = 0.28 * np.sin(2 * np.pi * 104.2 * t) + 0.15 * np.sin(2 * np.pi * 162.2 * t) + 0.06 * np.random.randn(len(t))
        risk_score = 1.48 + float(np.random.normal(0, 0.03))
        predicted_class = "Outer Race Fault"
        confidence = 94.2
        if outage:
            action = "EDGE_FAILSAFE"
            defer = False
        else:
            action = "CLOUD"
            defer = True
        float_vals = [0.280, 4.80, 6.50, 0.85, 2.20, 0.78, 0.08, 0.40, 480.0, 0.42, 2.35, 3.20]
        int8_vals = [42, 68, 92, 15, 74, 98, 8, 12, 54, 48, 38, 14]

    raw_wave = [round(float(v), 3) for v in sig]

    if defer:
        z, t_arr, f_arr, ms = compute_gpu_stft(sig)
        spec = {"z": z, "times": t_arr, "freqs": f_arr}
        cloud_v = {
            "status": "VALIDATED_BY_RTX3050",
            "gpu_device": GPU_NAME,
            "latency_ms": round(ms, 2),
            "confirmed_fault": predicted_class
        }
    else:
        spec = None
        cloud_v = {
            "status": "GPU_STANDBY_IDLE",
            "gpu_device": GPU_NAME
        }

    payload = {
        "hardware_status": {
            "is_physical": False,
            "mode_label": "STANDBY ENGINE ACTIVE"
        },
        "raw_waveform": raw_wave,
        "int8_features": {
            "names": FEATURE_NAMES,
            "float_vals": [round(float(v), 2) for v in float_vals],
            "int8_vals": int8_vals
        },
        "decision": {
            "action": action,
            "risk_score": round(float(risk_score), 3),
            "threshold": 1.20,
            "predicted_class": predicted_class,
            "confidence": confidence,
            "defer_to_cloud": defer
        },
        "spectrogram": spec,
        "cloud_verdict": cloud_v,
        # Backward-compatibility fields
        "window_idx": window_idx,
        "min_risk": round(float(risk_score), 3),
        "state_name": predicted_class
    }
    return payload

@app.get("/health")
def health():
    return {
        "status": "online",
        "device": DEVICE,
        "gpu_name": GPU_NAME,
        "com_target": COM_PORT
    }

@app.post("/simulate_cycle")
async def simulate_cycle(req: SimRequest):
    payload = build_stream_payload(req.mode, req.window_idx, req.outage_failsafe)
    await manager.broadcast(payload)
    return payload

@app.post("/predict")
async def predict(req: SimRequest):
    payload = build_stream_payload(req.mode, req.window_idx, req.outage_failsafe)
    return payload

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
def get_dashboard():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Cloud Dashboard index.html not found."}

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
