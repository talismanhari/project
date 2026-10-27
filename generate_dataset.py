import os
import urllib.request
import io
import numpy as np
import pandas as pd
from scipy import io as spio
from scipy import signal
from scipy.stats import kurtosis, skew

CWRU_DIR = "./cwru_data"
os.makedirs(CWRU_DIR, exist_ok=True)

URLS = {
    "Normal": "https://raw.githubusercontent.com/s-whynot/CWRU-dataset/main/Normal/97_Normal_0.mat",
    "Inner_Race": "https://raw.githubusercontent.com/s-whynot/CWRU-dataset/main/12k_Drive_End_Bearing_Fault_Data/IR/007/105_0.mat",
    "Ball_Fault": "https://raw.githubusercontent.com/s-whynot/CWRU-dataset/main/12k_Drive_End_Bearing_Fault_Data/B/007/118_0.mat",
    "Outer_Race": "https://raw.githubusercontent.com/s-whynot/CWRU-dataset/main/12k_Drive_End_Bearing_Fault_Data/OR/007/%406/130%406_0.mat"
}

raw_signals = {}
for name, url in URLS.items():
    filepath = os.path.join(CWRU_DIR, f"{name}.mat")
    if not os.path.exists(filepath):
        print(f"Downloading {name}...")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            with open(filepath, "wb") as f:
                f.write(resp.read())
    mat = spio.loadmat(filepath)
    de_keys = [k for k in mat.keys() if "DE_time" in k]
    key = de_keys[0] if de_keys else [k for k in mat.keys() if not k.startswith("__")][0]
    raw_signals[name] = mat[key].flatten()
    print(f"Loaded {name}: {len(raw_signals[name])} samples")

