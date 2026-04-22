@echo off
setlocal enableextensions

if exist "C:\Program Files\Git\bin\bash.exe" (
  start "" "C:\Program Files\Git\bin\bash.exe" -li
  exit /b 0
)

if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
  start "" "C:\Program Files (x86)\Git\bin\bash.exe" -li
  exit /b 0
)

echo Git Bash was not found.
echo Official Git for Windows site:
echo https://gitforwindows.org/
pause
exit /b 1
