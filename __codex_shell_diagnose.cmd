@echo off
setlocal enableextensions

set "OUT=%USERPROFILE%\Desktop\codex-shell-diagnose"
if not exist "%OUT%" mkdir "%OUT%"

echo Codex shell diagnostics > "%OUT%\summary.txt"
echo Output folder: %OUT%>> "%OUT%\summary.txt"
echo.>> "%OUT%\summary.txt"

ver > "%OUT%\windows-version.txt" 2>&1
where cmd.exe > "%OUT%\where-cmd.txt" 2>&1
where powershell.exe > "%OUT%\where-powershell.txt" 2>&1
where pwsh.exe > "%OUT%\where-pwsh.txt" 2>&1
where wsl.exe > "%OUT%\where-wsl.txt" 2>&1
where bash.exe > "%OUT%\where-bash.txt" 2>&1

cmd.exe /c echo CMD_OK > "%OUT%\test-cmd.stdout.txt" 2> "%OUT%\test-cmd.stderr.txt"
set "CMD_EXIT=%ERRORLEVEL%"

powershell.exe -NoProfile -NoLogo -Command "$PSVersionTable.PSVersion.ToString(); Get-Date" > "%OUT%\test-powershell-no-profile.stdout.txt" 2> "%OUT%\test-powershell-no-profile.stderr.txt"
set "PS_EXIT=%ERRORLEVEL%"

pwsh.exe -NoProfile -NoLogo -Command "$PSVersionTable.PSVersion.ToString(); Get-Date" > "%OUT%\test-pwsh-no-profile.stdout.txt" 2> "%OUT%\test-pwsh-no-profile.stderr.txt"
set "PWSH_EXIT=%ERRORLEVEL%"

wsl.exe -l -v > "%OUT%\test-wsl-list.stdout.txt" 2> "%OUT%\test-wsl-list.stderr.txt"
set "WSL_EXIT=%ERRORLEVEL%"

if exist "C:\Program Files\Git\bin\bash.exe" (
  "C:\Program Files\Git\bin\bash.exe" -lc "echo GIT_BASH_OK; uname -a" > "%OUT%\test-git-bash.stdout.txt" 2> "%OUT%\test-git-bash.stderr.txt"
  set "GIT_BASH_EXIT=%ERRORLEVEL%"
) else (
  echo Git Bash not found at C:\Program Files\Git\bin\bash.exe > "%OUT%\test-git-bash.stderr.txt"
  set "GIT_BASH_EXIT=9009"
)

(
  echo CMD exit code: %CMD_EXIT%
  echo Windows PowerShell -NoProfile exit code: %PS_EXIT%
  echo PowerShell 7 -NoProfile exit code: %PWSH_EXIT%
  echo WSL list exit code: %WSL_EXIT%
  echo Git Bash exit code: %GIT_BASH_EXIT%
  echo.
  echo If PowerShell fails but CMD, WSL or Git Bash succeeds, the issue is narrowed to Windows PowerShell or its crypto/provider stack.
) >> "%OUT%\summary.txt"

echo.
echo Diagnostics complete.
echo Logs saved to: %OUT%
echo Open summary.txt first.
pause
