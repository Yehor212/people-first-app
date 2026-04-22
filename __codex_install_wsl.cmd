@echo off
setlocal enableextensions

net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  echo This script must be run as Administrator.
  echo Right-click the file and choose "Run as administrator".
  pause
  exit /b 1
)

echo Installing or enabling WSL...
echo.
echo Microsoft official path: wsl --install
echo If WSL is already present, this may show help text or install a distro.
echo A reboot may be required.
echo.

wsl.exe --install
set "WSL_EXIT=%ERRORLEVEL%"

echo.
echo WSL command exit code: %WSL_EXIT%
echo.
echo After reboot:
echo 1. Launch Ubuntu or your installed distro from Start Menu
echo 2. Create your Linux username/password
echo 3. Open the project in WSL and run Codex there
echo.
pause
