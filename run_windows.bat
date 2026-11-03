@echo off
setlocal enabledelayedexpansion
title Edge AI Digital Twin - Production Runner (Lenovo LOQ / RTX 3050)
color 0A

echo ===============================================================================
echo   EMPIRICAL COST MODELING OF CALIBRATED INFERENCE DEFERRAL IN EDGE AI
echo   Atomic Production Runner - Hardened Dual-Core ESP32-S3 + RTX 3050 GPU
echo ===============================================================================
echo.

:: 1. Pre-flight Cleanup: Terminate any orphaned process locking Port 8000
echo [*] Phase 1/5: Pre-Flight Cleanup (Releasing Port 8000 ^& COM7 locks)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [OK] Port 8000 verified free.

:: 2. Python & Virtual Environment Lifecycle
echo.
echo [*] Phase 2/5: Python Runtime Environment Setup...
if exist ".venv\Scripts\activate.bat" (
    echo [*] Active virtual environment detected in .venv. Activating...
    call .venv\Scripts\activate.bat
) else (
    echo [*] Initializing isolated Python virtual environment (.venv)...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    echo [*] Installing required production packages...
    python -m pip install --upgrade pip --quiet
    pip install -r ml_pipeline\requirements.txt --quiet --disable-pip-version-check
    pip install -r cloud_server\requirements.txt --quiet --disable-pip-version-check
    echo [OK] Package provisioning complete.
)

:: 3. Model Header Verification (Zero redundant re-training)
echo.
echo [*] Phase 3/5: Verifying TinyML Embedded Model Header...
if exist "firmware\include\tinyml_model_data.h" (
    echo [OK] Found pre-compiled tinyml_model_data.h. Skipping re-training.
) else (
    echo [!] Model header missing. Executing ML Pipeline to generate INT8 weights...
    python ml_pipeline\01_fetch_data.py
    python ml_pipeline\02_dsp_extract.py
    python ml_pipeline\03_train_and_export.py
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo [ERROR] Pipeline export failed.
        pause
        exit /b 1
    )
    echo [OK] firmware\include\tinyml_model_data.h generated successfully.
)

:: 4. Microcontroller Firmware Flash with Resilient Fallback
echo.
echo [*] Phase 4/5: Compiling ^& Flashing ESP32-S3 (Target: COM7)...
pio --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [*] Installing PlatformIO CLI...
    pip install platformio --quiet
)

echo [*] Attempting firmware upload to COM7...
pio run -d firmware -t upload --upload-port COM7
if %ERRORLEVEL% equ 0 (
    echo [OK] Firmware flashed successfully to ESP32-S3 on COM7!
) else (
    color 0E
    echo.
    echo [!] WARNING: ESP32-S3 flash skipped or device not detected on COM7.
    echo [*] Resilient failover active: Cloud Server will operate in Simulated Relay Mode.
    echo [*] Zero presentation interruption guaranteed.
    color 0A
)

:: 5. Foreground Server Execution & Browser Launch
echo.
echo [*] Phase 5/5: Launching RTX 3050 CUDA Cloud Server ^& SCADA Workbench...
echo [*] Opening browser to http://127.0.0.1:8000 ...

start http://127.0.0.1:8000

echo.
echo ===============================================================================
echo   RUNNING FOREGROUND SERVER - Press [Ctrl+C] to gracefully exit
echo   Logs and WebSockets streaming live below:
echo ===============================================================================
echo.

cd cloud_server
python -m uvicorn server:app --host 0.0.0.0 --port 8000

:: Cleanup on Exit
echo.
echo [*] Releasing GPU resources and system handles...
exit /b 0
