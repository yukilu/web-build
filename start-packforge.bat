@echo off
setlocal
chcp 65001 >nul
set "PYTHONUTF8=1"
set "NO_COLOR=1"
cd /d "%~dp0"
title Build

if not exist "dist\index.html" (
  echo [packforge] Frontend build not found. Building...
  where npm >nul 2>nul
  if errorlevel 1 (
    if exist "%LOCALAPPDATA%\Author Software\nvm\.nodejs\npm.cmd" (
      set "PATH=%LOCALAPPDATA%\Author Software\nvm\.nodejs;%PATH%"
    )
  )
  call npm run build
  if errorlevel 1 (
    echo [packforge] Frontend build failed. Please check Node.js and npm.
    pause
    exit /b 1
  )
)

if not exist ".venv\Scripts\python.exe" (
  echo [packforge] Missing Python virtual environment: .venv
  echo Create it in the project directory first:
  echo   python -m venv .venv
  echo   .venv\Scripts\python.exe -m pip install -r requirements.txt
  pause
  exit /b 1
)

".venv\Scripts\python.exe" "scripts\desktop_launcher.py"
if errorlevel 1 (
  echo.
  echo [packforge] Backend stopped.
  pause
)
endlocal
