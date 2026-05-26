# ZenFlow Telegram Control Plane

This Worker is the Telegram-first control plane for `people-first-app`. It receives Telegram bot webhooks, verifies an admin allowlist, creates durable control jobs in Cloudflare KV, starts a Cloudflare Workflow, and dispatches `.github/workflows/telegram-control.yml` through a GitHub App.

It stores only automation metadata: job id, Telegram requester id, command kind, GitHub run id, branch, PR URL, approval records, status, timestamps, and evidence. It must not store ZenFlow journal, habit, mood, or account content.

It also serves a minimal Telegram Mini App dashboard at `/miniapp`. Mini App API calls must include `Authorization: tma <Telegram.WebApp.initData>` and are verified server-side before any state or command is returned.

## Commands

- `/status` returns recent GitHub control workflow state.
- `/health` reports Worker, Telegram, GitHub, KV, and Workflow configuration.
- `/plan <prompt>` asks Codex to produce an implementation plan.
- `/fix <prompt>` asks Codex to make branch-scoped fixes and open a draft PR.
- `/review <prompt>` asks Codex for review/audit work.
- `/test <prompt>` runs repo gates through GitHub Actions.
- `/security <prompt>` runs security-focused work; `snyk code test` is attempted only when `SNYK_TOKEN` exists.
- `/deploy <prompt>` requires Telegram approval, runs release gates, and queues the existing GitHub Pages deploy workflow from `main`.
- `/rollback target=<commit-or-ref>` requires Telegram approval, creates a `codex/telegram-*` branch, reverts the target, runs gates, and opens a draft PR. It does not deploy directly.
- `/jobs` lists recent KV-backed control jobs.
- `/approve`, `/deny`, `/cancel` are normally driven by Telegram inline buttons with nonce-backed callback data.

Free text is parsed into the same schema. Low-confidence text becomes `ASK` and does not dispatch.

## Mini App

- `GET /miniapp` serves the Telegram dashboard shell.
- `POST /miniapp/state` returns redacted health and recent jobs after Telegram init data validation.
- `POST /miniapp/command` runs the same command contract as chat commands after Telegram init data validation.

Server-side validation follows Telegram Mini App init data rules: sort key-value pairs, exclude `hash`, derive the HMAC key from the bot token with `WebAppData`, compare the computed hash, and reject stale `auth_date`.

## Required Cloudflare Secrets

Set with `wrangler secret put`:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_ADMIN_IDS`
- `GITHUB_APP_ID`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `TELEGRAM_CONTROL_CALLBACK_SECRET`

Non-secret vars are in `wrangler.jsonc`: `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_WORKFLOW_FILE`, and `GITHUB_BASE_REF`.

## Required GitHub Secrets

- `OPENAI_API_KEY`: required only for Codex-backed `plan`, `fix`, `review`, and `security`. When missing, the workflow reports `UNVERIFIED` and does not fake AI success.
- `TELEGRAM_CONTROL_CALLBACK_URL`: `https://<worker-host>/github/webhook`.
- `TELEGRAM_CONTROL_CALLBACK_SECRET`: must match the Cloudflare secret.
- `SNYK_TOKEN`: optional for `snyk code test`.

## GitHub App Permissions

Minimum:

- Metadata: read
- Actions: read/write

For branch and PR publishing by `.github/workflows/telegram-control.yml`:

- Contents: write
- Pull requests: write
- Issues: write only if later audit-comment writeback is enabled

## Safety Contract

Non-destructive work can dispatch after Telegram admin authentication. Destructive operations require inline confirmation before dispatch:

- production deploy
- rollback
- merge to `main`
- Supabase SQL/RLS
- secret changes
- protected docs/hooks
- branch deletion

All code changes must land on `codex/telegram-*` branches and draft PRs. Direct writes to `main` are blocked by workflow design and should also be protected in GitHub branch protection.

Production deploys are different from code-write jobs: after Telegram approval, the control workflow dispatches `.github/workflows/deploy.yml` with `telegram_approval=telegram-approved`. That deploy workflow rejects Telegram-approved deploys unless the run ref is `main`.

## Local Verification

```bash
npm run check:telegram-control
npm --prefix tools/telegram-control run activation:checklist
npm --prefix tools/telegram-control run setup:plan
npm --prefix tools/telegram-control run check:secrets
npm --prefix tools/telegram-control run smoke:local
npm --prefix tools/telegram-control run smoke:live
npm --prefix tools/telegram-control run check:workflow
npm --prefix tools/telegram-control run deploy:dry-run
```

`deploy:dry-run` requires Wrangler access and a real Cloudflare account. If Wrangler auth or the placeholder KV id is missing, mark that evidence `UNVERIFIED`.

## Webhook Setup

After deploying the Worker and setting Cloudflare secrets, set the Telegram webhook from a local shell that has the bot token available:

```bash
set TELEGRAM_WEBHOOK_URL=https://<worker-host>/telegram/webhook
set TELEGRAM_BOT_TOKEN=<redacted>
set TELEGRAM_WEBHOOK_SECRET=<redacted>
npm --prefix tools/telegram-control run set-webhook -- --dry-run
npm --prefix tools/telegram-control run set-webhook
```

The helper sends Telegram `setWebhook` with `secret_token`, so Telegram includes `X-Telegram-Bot-Api-Secret-Token` on each webhook request. The dry run prints only redacted secret state.

## Live Smoke

After deploy, verify the public Worker without printing secrets:

```bash
set TELEGRAM_CONTROL_BASE_URL=https://<worker-host>
set TELEGRAM_BOT_TOKEN=<redacted>
set TELEGRAM_ADMIN_ID=<your-telegram-user-id>
npm --prefix tools/telegram-control run smoke:live
```

Without `TELEGRAM_BOT_TOKEN` and an admin id, the live smoke still checks `/health` and `/miniapp`, and marks authenticated Mini App state `UNVERIFIED`.

## Secret Safety

`npm --prefix tools/telegram-control run check:secrets` scans the control-plane source, docs, and workflow for token-shaped values. It is included in `npm run check:telegram-control`.

`npm --prefix tools/telegram-control run setup:plan` prints the activation commands without embedding secret values.
