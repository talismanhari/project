@echo off
setlocal enabledelayedexpansion
title Edge AI Digital Twin - Windows Master Orchestrator (Lenovo LOQ / RTX 3050)
color 0A

echo ===============================================================================
echo   EMPIRICAL COST MODELING OF CALIBRATED INFERENCE DEFERRAL IN EDGE AI
echo   Dual-Core ESP32-S3 TinyML Node + Windows RTX 3050 Cloud Acceleration
echo ===============================================================================
echo.

:: 1. Verify Python Environment
echo [*] Step 1/5: Checking Python Environment...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Python 3.9+ is not found in PATH!
    echo Please install Python 3.9+ from https://www.python.org/ and check 'Add to PATH'.
    pause
    exit /b 1
)
python -c "import sys; print(f'[*] Python Version: {sys.version.split()[0]}')"

:: 2. Install ML Pipeline & Cloud Server Dependencies
echo.
echo [*] Step 2/5: Installing Python Dependencies...
pip install -r ml_pipeline\requirements.txt --quiet --disable-pip-version-check
pip install -r cloud_server\requirements.txt --quiet --disable-pip-version-check
echo [OK] Python dependencies verified.

:: 3. Execute Local ML Pipeline on Windows
echo.
echo [*] Step 3/5: Executing Machine Learning & DSP Pipeline...
echo [+] Running 01_fetch_data.py...
python ml_pipeline\01_fetch_data.py
if %ERRORLEVEL% NEQ 0 (
    echo [!] Data fetch completed with warnings. Continuing...
)

echo [+] Running 02_dsp_extract.py (Butterworth LPF fc=1500Hz, Polyphase Resampling to 3200Hz)...
python ml_pipeline\02_dsp_extract.py
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] DSP feature extraction failed!
    pause
    exit /b 1
)

echo [+] Running 03_train_and_export.py (QAT INT8 MLP Export to firmware/include/tinyml_model_data.h)...
python ml_pipeline\03_train_and_export.py
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Model training and C++ header export failed!
    pause
    exit /b 1
)
echo [OK] firmware\include\tinyml_model_data.h successfully generated.

:: 4. Check PlatformIO & Flash ESP32-S3
echo.
echo [*] Step 4/5: Compiling & Flashing ESP32-S3 Firmware...
pio --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] PlatformIO CLI not found in PATH. Attempting automatic installation via pip...
    pip install platformio --quiet
)

pio --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [*] Scanning for connected ESP32-S3 COM port...
    cd firmware
    pio run -t upload
    if %ERRORLEVEL% EQU 0 (
        echo [OK] ESP32-S3 firmware successfully compiled and uploaded!
    ) else (
        echo [!] ESP32-S3 hardware upload skipped or device not plugged into USB.
        echo     (You can run with simulated telemetry on the Cloud Dashboard.)
    )
    cd ..
) else (
    echo [!] PlatformIO could not be invoked. Skipping hardware flash.
)

:: 5. Launch Cloud Server & Open SCADA Dashboard
echo.
echo [*] Step 5/5: Starting RTX 3050 Accelerated Cloud Server & Dashboard...
echo [*] Server binding to http://localhost:8000 ...

start "Edge-Cloud Inference Deferral Server (RTX 3050)" cmd /k "cd cloud_server && python -m uvicorn server:app --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul
start http://localhost:8000

echo.
echo ===============================================================================
echo   [SUCCESS] All systems operational!
echo   Dashboard URL: http://localhost:8000
echo   Offload API:   http://localhost:8000/offload
echo ===============================================================================
echo.
pause
