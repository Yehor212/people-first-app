@echo off
setlocal enableextensions

net session >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  echo This script must be run as Administrator.
  echo Right-click the file and choose "Run as administrator".
  pause
  exit /b 1
)

set "OUT=%USERPROFILE%\Desktop\codex-shell-repair"
if not exist "%OUT%" mkdir "%OUT%"

echo Codex shell repair > "%OUT%\summary.txt"
echo Output folder: %OUT%>> "%OUT%\summary.txt"
echo.>> "%OUT%\summary.txt"

echo Running DISM. This can take a while...
DISM.exe /Online /Cleanup-Image /RestoreHealth > "%OUT%\dism.txt" 2>&1
set "DISM_EXIT=%ERRORLEVEL%"

echo Running SFC. This can take a while...
sfc /scannow > "%OUT%\sfc.txt" 2>&1
set "SFC_EXIT=%ERRORLEVEL%"

(
  echo DISM exit code: %DISM_EXIT%
  echo SFC exit code: %SFC_EXIT%
  echo.
  echo After both commands finish:
  echo 1. Reboot Windows.
  echo 2. Manually test powershell.exe -NoProfile -NoLogo
  echo 3. If PowerShell still fails, run __codex_shell_diagnose.cmd
  echo 4. Then check Event Viewer ^> Applications and Services Logs ^> Microsoft ^> Windows ^> CAPI2 ^> Operational
) >> "%OUT%\summary.txt"

echo.
echo Repair steps complete.
echo Logs saved to: %OUT%
echo Read summary.txt, then reboot and retest PowerShell.
pause
