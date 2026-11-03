import os
import shutil
import urllib.request
import sys

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cwru_data")
ALT_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

# CWRU Bearing Data Center standard 12kHz Drive End vibration files:
# 97.mat   - Normal baseline data (approx 1797 RPM, 0 HP)
# 105.mat  - 0.007" Inner Race fault
# 118.mat  - 0.007" Ball fault
# 130.mat  - 0.007" Outer Race fault (centered @ 6:00)
CWRU_FILES = {
    "Normal.mat": [
        "https://engineering.case.edu/sites/default/files/97.mat",
        "https://raw.githubusercontent.com/Biswas-A/CWRU-Bearing-Dataset/master/12k_Drive_End/Normal_0.mat",
    ],
    "Inner_Race.mat": [
        "https://engineering.case.edu/sites/default/files/105.mat",
        "https://raw.githubusercontent.com/Biswas-A/CWRU-Bearing-Dataset/master/12k_Drive_End/IR007_0.mat",
    ],
    "Ball_Fault.mat": [
        "https://engineering.case.edu/sites/default/files/118.mat",
        "https://raw.githubusercontent.com/Biswas-A/CWRU-Bearing-Dataset/master/12k_Drive_End/B007_0.mat",
    ],
    "Outer_Race.mat": [
        "https://engineering.case.edu/sites/default/files/130.mat",
        "https://raw.githubusercontent.com/Biswas-A/CWRU-Bearing-Dataset/master/12k_Drive_End/OR007@6_0.mat",
    ],
}

def fetch_datasets():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(ALT_DATA_DIR, exist_ok=True)

    print("==========================================================")
    print(" [01_fetch_data] Automating CWRU Bearing Dataset Ingestion")
    print("==========================================================")

    for target_name, urls in CWRU_FILES.items():
        dest_path = os.path.join(DATA_DIR, target_name)
        alt_dest = os.path.join(ALT_DATA_DIR, target_name)

        if os.path.exists(dest_path) and os.path.getsize(dest_path) > 10000:
            print(f"[*] Found existing dataset file: {dest_path} ({os.path.getsize(dest_path)} bytes)")
            if not os.path.exists(alt_dest):
                shutil.copyfile(dest_path, alt_dest)
            continue

        downloaded = False
        for url in urls:
            try:
                print(f"[+] Downloading {target_name} from: {url}")
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=30) as response, open(dest_path, 'wb') as out_file:
                    shutil.copyfileobj(response, out_file)
                if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000:
                    shutil.copyfile(dest_path, alt_dest)
                    print(f"[OK] Successfully fetched {target_name} ({os.path.getsize(dest_path)} bytes)")
                    downloaded = True
                    break
            except Exception as e:
                print(f"[-] Mirror failed ({url}): {e}")

        if not downloaded and not os.path.exists(dest_path):
            print(f"[!] Warning: Could not download {target_name} from remote mirrors.")
            print(f"    Please manually place {target_name} in '{DATA_DIR}'.")

    print("[01_fetch_data] Data ingestion phase complete.\n")

if __name__ == "__main__":
    fetch_datasets()
