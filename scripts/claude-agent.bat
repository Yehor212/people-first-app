@echo off
REM Claude Autonomous Agent — Local Health Check
REM Schedule via: schtasks /create /tn "ClaudeAgent" /tr "C:\project\people-first-app\scripts\claude-agent.bat" /sc daily /st 09:00

cd /d C:\project\people-first-app

REM Create logs directory if not exists
if not exist logs mkdir logs

REM Get date for log filename
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set dt=%%I
set logdate=%dt:~0,8%

echo [%date% %time%] Starting Claude Agent... >> logs\agent-%logdate%.log

REM Generate ZenFlow auto-context before launching the scheduled agent.
node tools\zenflow-context\auto-context.mjs --topic "scheduled ci preflight verification" >> logs\agent-%logdate%.log 2>&1

REM Run Claude Code with preflight check
"C:\Users\egors\AppData\Roaming\npm\claude.cmd" -p --dangerously-skip-permissions "Run npm run ci:preflight in C:\project\people-first-app. Report results concisely. If anything fails, explain what and why." >> logs\agent-%logdate%.log 2>&1

echo [%date% %time%] Agent complete. >> logs\agent-%logdate%.log
