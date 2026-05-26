# ZenFlow Telegram Control Plane

This Worker is the Telegram-first control plane for `people-first-app`. It receives Telegram bot webhooks, verifies an admin allowlist, creates durable control jobs in Cloudflare KV, starts a Cloudflare Workflow, and dispatches `.github/workflows/telegram-control.yml` through a GitHub App.

It stores only automation metadata: job id, Telegram requester id, command kind, GitHub run id, branch, PR URL, approval records, status, timestamps, and evidence. It must not store ZenFlow journal, habit, mood, or account content.

## Commands

- `/status` returns recent GitHub control workflow state.
- `/health` reports Worker, Telegram, GitHub, KV, and Workflow configuration.
- `/plan <prompt>` asks Codex to produce an implementation plan.
- `/fix <prompt>` asks Codex to make branch-scoped fixes and open a draft PR.
- `/review <prompt>` asks Codex for review/audit work.
- `/test <prompt>` runs repo gates through GitHub Actions.
- `/security <prompt>` runs security-focused work; `snyk code test` is attempted only when `SNYK_TOKEN` exists.
- `/deploy <prompt>` requires Telegram approval before GitHub dispatch.
- `/rollback <prompt>` requires Telegram approval and currently returns `UNVERIFIED` until a repository rollback adapter exists.
- `/jobs` lists recent KV-backed control jobs.
- `/approve`, `/deny`, `/cancel` are normally driven by Telegram inline buttons with nonce-backed callback data.

Free text is parsed into the same schema. Low-confidence text becomes `ASK` and does not dispatch.

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

## Local Verification

```bash
npm run check:telegram-control
npm --prefix tools/telegram-control run activation:checklist
npm --prefix tools/telegram-control run smoke:local
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
