# Codex Shell Recovery Runbook

## Goal

Recover a usable command environment when Codex on Windows fails with:

- `Loading managed Windows PowerShell failed`
- error `8009001d`
- crypto/provider failure `0x8009001D`

## What this usually means

The failure happens before the actual command runs. In practice this points to:

- broken Windows PowerShell host startup
- broken crypto/provider initialization
- damaged system files
- third-party interference from security middleware, smart-card/VPN/DLP tools, or driver utilities

## Fastest usable path

For Codex itself on Windows, the best workaround is `WSL2`.

OpenAI currently documents Windows support as experimental and recommends WSL2 for the best Windows experience.

## Immediate execution order

1. Run [__codex_shell_repair.cmd](</C:/project/people-first-app/__codex_shell_repair.cmd>) as Administrator.
2. Reboot Windows.
3. Run [__codex_shell_diagnose.cmd](</C:/project/people-first-app/__codex_shell_diagnose.cmd>).
4. Read the files written to `%USERPROFILE%\Desktop\codex-shell-diagnose`.

## Decision tree

### Case A: `cmd` works, `powershell.exe -NoProfile` fails, `pwsh.exe` works

This narrows the issue to Windows PowerShell 5.1, not all shells.

Action:

1. Use [__codex_install_powershell7.cmd](</C:/project/people-first-app/__codex_install_powershell7.cmd>) if `pwsh` is missing.
2. Use `pwsh` for manual work.
3. Still keep `WSL2` as the preferred Codex environment.

### Case B: `Git Bash` works

Action:

1. Run [__codex_open_git_bash.cmd](</C:/project/people-first-app/__codex_open_git_bash.cmd>).
2. Optionally use [__codex_windows_terminal_git_bash_profile.json](</C:/project/people-first-app/__codex_windows_terminal_git_bash_profile.json>) as a Windows Terminal settings snippet.
3. Use Git Bash for manual repo work.
4. Prefer WSL for Codex itself.

### Case C: `WSL` exists or can be installed

Action:

1. Run [__codex_install_wsl.cmd](</C:/project/people-first-app/__codex_install_wsl.cmd>) as Administrator if WSL is not installed.
2. Reboot if prompted.
3. Open your Linux distro from Start Menu.
4. Initialize your Linux user.
5. Work from inside WSL.

### Case D: everything shell-like fails except `cmd`

Action:

1. Enable `CAPI2` logging in Event Viewer:
   - `Applications and Services Logs`
   - `Microsoft`
   - `Windows`
   - `CAPI2`
   - `Operational`
2. Reproduce the PowerShell launch failure.
3. Inspect fresh `CAPI2` errors for provider/certificate/DLL details.
4. If the issue started recently, use System Restore.
5. If it persists, use Windows in-place repair reinstall.

## Official references

- OpenAI Codex CLI: https://developers.openai.com/codex/cli
- Microsoft WSL install: https://learn.microsoft.com/en-us/windows/wsl/install
- Install PowerShell on Windows: https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows?view=powershell-7.5
- PowerShell profiles / `-NoProfile`: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_profiles?view=powershell-7.5
- Windows Terminal Git Bash profile: https://learn.microsoft.com/en-us/windows/terminal/dynamic-profiles
- DISM and SFC repair: https://support.microsoft.com/help/929833
- Clean boot: https://support.microsoft.com/en-us/topic/how-to-perform-a-clean-boot-in-windows-da2f9573-6eec-00ad-2f8a-a97a1807f3dd
- System Restore: https://support.microsoft.com/en-us/windows/system-restore-a5ae3ed9-07c4-fd56-45ee-096777ecd14e
- Reinstall Windows with installation media: https://support.microsoft.com/en-us/windows/reinstall-windows-with-the-installation-media-d8369486-3e33-7d9c-dccc-859e2b022fc7

## What to send back after running the diagnostics

Send these files:

- `%USERPROFILE%\Desktop\codex-shell-diagnose\summary.txt`
- `%USERPROFILE%\Desktop\codex-shell-diagnose\test-powershell-no-profile.stderr.txt`
- `%USERPROFILE%\Desktop\codex-shell-diagnose\test-pwsh-no-profile.stdout.txt`
- `%USERPROFILE%\Desktop\codex-shell-diagnose\test-git-bash.stdout.txt`
- `%USERPROFILE%\Desktop\codex-shell-diagnose\test-wsl-list.stdout.txt`
