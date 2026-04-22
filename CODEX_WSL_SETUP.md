# Codex on Windows: Permanent WSL2 Setup

Native Windows shell execution in Codex can fail before the command starts with errors such as `0x8009001d`. When that happens, the durable fix is to stop using native Windows shell execution for Codex work and run Codex inside WSL2 instead.

This follows OpenAI's current Windows guidance:

- Codex CLI on Windows is still documented as experimental.
- The recommended Windows path is WSL2.

## One-time host setup

Run the bootstrap script from PowerShell:

```powershell
.\codex-wsl-host.ps1
```

The script now requests elevation through UAC automatically when needed.

If your machine requires a reboot, reboot once and rerun the script if needed.

## One-time WSL setup

Open Ubuntu or another WSL distro and run:

```bash
cd /mnt/c/project/people-first-app
cp /mnt/c/project/people-first-app/codex-wsl-guest.sh ~/
bash ~/codex-wsl-guest.sh
```

That installs `nvm`, Node.js 22, and the latest `@openai/codex` inside WSL.

## Move the repo into Linux space

Do not work from `/mnt/c/...` long term. Keep the repository in Linux storage for better compatibility and filesystem behavior.

Recommended flow:

```bash
mkdir -p ~/code
cd ~/code
git clone <repo-url> people-first-app
cd people-first-app
npm install
codex
```

If the repository already exists only on `C:\project\people-first-app`, push or mirror it to a remote first, then clone it fresh inside `~/code`.

## VS Code / Codex app workflow

- Open the repo from WSL, not from `C:\`.
- If you use VS Code, start it from WSL with `code .`.
- If you use the Codex app, point the project at the WSL-side checkout instead of the Windows checkout.

## Verify the fix

Inside WSL, these should work:

```bash
pwd
node --version
codex --version
git status
```

After that, Codex agents should be able to inspect files, run tests, and use the terminal normally from the WSL checkout.

## Why this exists

This repository-local guide exists because native Windows Codex shell execution can currently fail even for trivial commands. The fix is environmental, not application-code related.
