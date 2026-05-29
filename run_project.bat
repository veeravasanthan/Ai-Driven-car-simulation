@echo off
title Self-Driving Car Project Launcher
echo ===================================================
echo Starting Self-Driving Car Project...
echo ===================================================

:: Name of the conda environment (adjust this if needed, e.g., base, myenv, self-driving)
set CONDA_ENV_NAME=car

:: Try to activate conda environment
echo Activating conda environment: %CONDA_ENV_NAME%...
call conda activate %CONDA_ENV_NAME% 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARNING] 'conda activate %CONDA_ENV_NAME%' failed.
    echo Trying to find conda.bat...
    :: Common paths for conda
    if exist "%USERPROFILE%\anaconda3\Scripts\conda.exe" (
        call "%USERPROFILE%\anaconda3\Scripts\activate.bat" %CONDA_ENV_NAME%
    ) else if exist "%USERPROFILE%\miniconda3\Scripts\conda.exe" (
        call "%USERPROFILE%\miniconda3\Scripts\activate.bat" %CONDA_ENV_NAME%
    ) else if exist "%ProgramData%\anaconda3\Scripts\conda.exe" (
        call "%ProgramData%\anaconda3\Scripts\activate.bat" %CONDA_ENV_NAME%
    ) else (
        echo [ERROR] Conda environment %CONDA_ENV_NAME% could not be activated automatically. Falling back to global python.
        set CONDA_ENV_NAME=
    )
)

:: We are already inside the project directory


:: Start Python driver in a new CMD window
echo [1/2] Starting Python driver (drive.py)...
if not "%CONDA_ENV_NAME%"=="" (
    start "Python Driver (drive.py)" cmd /k "call conda activate %CONDA_ENV_NAME% 2>nul && python drive.py"
) else (
    start "Python Driver (drive.py)" cmd /k "python drive.py"
)

:: Give Python server a moment to spin up and load tensorflow model (approx 3 seconds)
ping 127.0.0.1 -n 4 > nul

:: Start Simulator
echo [2/2] Starting Car Simulator...
start "Car Simulator" "simulator-windows-32\Self-Driving Car Simulator Windows 32-bit.exe"

echo Both processes started! Enjoy the car simulation.
