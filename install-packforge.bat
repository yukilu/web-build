@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "PYTHONUTF8=1"
cd /d "%~dp0"
title Packforge Backend Setup

echo [packforge] Checking Python...

set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3"
if not defined PYTHON_CMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python"
)
if not defined PYTHON_CMD (
  echo [packforge] Python was not found. Install Python 3.13 and add it to PATH.
  goto :fail
)

%PYTHON_CMD% -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)"
if errorlevel 1 (
  echo [packforge] Python 3.10 or newer is required. Python 3.13 is recommended.
  goto :fail
)

echo [packforge] Python:
%PYTHON_CMD% --version

if not exist ".venv\Scripts\python.exe" (
  echo [packforge] Creating Python virtual environment...
  %PYTHON_CMD% -m venv .venv
  if errorlevel 1 (
    echo [packforge] Failed to create .venv.
    goto :fail
  )
)

echo [packforge] Installing Python dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo [packforge] Failed to install Python dependencies.
  goto :fail
)

echo.
echo [packforge] Backend setup complete.
echo [packforge] Frontend is not installed or built by this script.
echo [packforge] Install/build it yourself, then run start-packforge.bat.
if not "%PACKFORGE_SETUP_NO_PAUSE%"=="1" pause
exit /b 0

:fail
echo.
echo [packforge] Setup failed.
if not "%PACKFORGE_SETUP_NO_PAUSE%"=="1" pause
exit /b 1
