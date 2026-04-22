@echo off
setlocal enableextensions

where winget >nul 2>&1
if not "%ERRORLEVEL%"=="0" (
  echo winget was not found.
  echo Install PowerShell 7 manually from:
  echo https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows?view=powershell-7.5
  pause
  exit /b 1
)

echo Installing PowerShell 7 via winget...
echo.
winget install --id Microsoft.PowerShell --source winget --accept-source-agreements --accept-package-agreements
set "PWSH_EXIT=%ERRORLEVEL%"

echo.
echo winget exit code: %PWSH_EXIT%
echo Test after install:
echo   pwsh.exe -NoProfile -NoLogo
echo.
pause
