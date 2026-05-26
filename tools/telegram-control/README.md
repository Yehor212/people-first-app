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

Approval-gated commands start a Cloudflare Workflow before Telegram confirmation. The approval, denial, or cancellation is sent back into that Workflow as an event, so the durable runtime owns the pause/resume boundary instead of relying only on a chat callback.

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

Create or bind the free-tier `CONTROL_STATE` KV namespace without editing the config by hand:

```bash
npm --prefix tools/telegram-control run setup:kv -- --dry-run
npm --prefix tools/telegram-control run setup:kv -- --create --write
```

If the KV namespace already exists, provide its Cloudflare namespace id explicitly:

```bash
npm --prefix tools/telegram-control run setup:kv -- --namespace-id <cloudflare-kv-id> --write
```

The helper validates the namespace id shape, updates only the `CONTROL_STATE` placeholder in `wrangler.jsonc`, and does not print secret values. KV namespace ids are account-bound identifiers, not secret keys.

Project-owned random secrets can be generated locally without exposing values:

```bash
npm --prefix tools/telegram-control run secrets:bootstrap
npm --prefix tools/telegram-control run secrets:bootstrap -- --write-local
```

The write mode creates `.env.telegram-control.local`, which is ignored by git. It only contains `TELEGRAM_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`, and `TELEGRAM_CONTROL_CALLBACK_SECRET`. Account-owned credentials such as `TELEGRAM_BOT_TOKEN`, GitHub App ids/private key, and `OPENAI_API_KEY` must still come from their official account flows.

Account-owned secrets can be installed from a prepared local shell without printing values:

```bash
npm --prefix tools/telegram-control run secrets:install-account -- --dry-run
npm --prefix tools/telegram-control run secrets:install-account -- --cloudflare
npm --prefix tools/telegram-control run secrets:install-account -- --github --github-snyk
```

`OPENAI_API_KEY` can also be installed from an already prepared environment with `--github --github-openai`, but this must only be run after explicit operator approval for that key. This helper does not create OpenAI keys.

If GitHub CLI is authenticated, store the generated callback secret without printing it:

```bash
npm --prefix tools/telegram-control run secrets:install-generated -- --github
```

This installs only `TELEGRAM_CONTROL_CALLBACK_SECRET` into GitHub Actions secrets. `TELEGRAM_CONTROL_CALLBACK_URL` still depends on the deployed Worker URL, and Cloudflare secrets still require `wrangler login`.

After the Worker is deployed, store the callback URL without editing GitHub settings by hand:

```bash
set TELEGRAM_CONTROL_BASE_URL=https://<worker-host>
npm --prefix tools/telegram-control run set-github-callback-url -- --dry-run
npm --prefix tools/telegram-control run set-github-callback-url -- --github
```

After `wrangler login`, install the generated Worker-side shared secrets without printing them:

```bash
npm --prefix tools/telegram-control run secrets:install-generated -- --cloudflare
```

This writes only `TELEGRAM_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`, and `TELEGRAM_CONTROL_CALLBACK_SECRET` to Cloudflare. Account-owned Cloudflare secrets still need their official sources.

Use the GitHub-aware or Cloudflare-aware activation checks when those CLIs are authenticated:

```bash
npm --prefix tools/telegram-control run activation:run
npm --prefix tools/telegram-control run activation:run -- --apply --kv --cloudflare-account-secrets --cloudflare-secrets --github-snyk-secret --github-secrets --deploy --github-callback --telegram --live-smoke --external-checks
npm --prefix tools/telegram-control run activation:checklist -- --github
npm --prefix tools/telegram-control run activation:checklist -- --cloudflare
npm --prefix tools/telegram-control run activation:doctor
npm --prefix tools/telegram-control run activation:doctor -- --github --cloudflare
```

The activation runner composes KV setup, account-secret installation, generated-secret installation, Worker deploy, GitHub callback URL, Telegram webhook, bot UI, live smoke, and the doctor into one ordered flow. Its default mode is dry-run/report-only. Mutating steps run only with `--apply` plus explicit step flags such as `--kv`, `--cloudflare-account-secrets`, `--deploy`, or `--telegram`; `--all` is reserved for a fully prepared operator shell.

The GitHub-aware check reads secret names only. It verifies whether `TELEGRAM_CONTROL_CALLBACK_SECRET`, `TELEGRAM_CONTROL_CALLBACK_URL`, `OPENAI_API_KEY`, and optional `SNYK_TOKEN` exist without reading their values.
The activation doctor summarizes Cloudflare, GitHub, callback URL, OpenAI, Snyk, and Telegram readiness as PASS/UNVERIFIED/FAIL without printing secret values. Its default mode is local-only; `--github --cloudflare` adds name-only GitHub secret checks and Wrangler auth status.

## Required GitHub Secrets

- `OPENAI_API_KEY`: required only for Codex-backed `plan`, `fix`, `review`, and `security`. When missing, the workflow reports `UNVERIFIED` and does not fake AI success.
- `TELEGRAM_CONTROL_CALLBACK_URL`: `https://<worker-host>/github/webhook`.
- `TELEGRAM_CONTROL_CALLBACK_SECRET`: must match the Cloudflare secret.
- `SNYK_TOKEN`: optional for `snyk code test`.

## GitHub App Permissions

Minimum:

- Metadata: read
- Actions: read/write

`GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, and `GITHUB_APP_PRIVATE_KEY` are enough for `/status`, workflow dispatch, and GitHub run cancellation. `GITHUB_WEBHOOK_SECRET` is separate: it verifies inbound GitHub webhook events and is still required for live webhook proof.

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
npm --prefix tools/telegram-control run activation:run
npm --prefix tools/telegram-control run activation:doctor
npm --prefix tools/telegram-control run setup:kv -- --dry-run
npm --prefix tools/telegram-control run setup:plan
npm --prefix tools/telegram-control run check:secrets
npm --prefix tools/telegram-control run smoke:local
npm --prefix tools/telegram-control run smoke:live
npm --prefix tools/telegram-control run set-bot-ui -- --dry-run
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

## Bot UI Setup

After the Worker is deployed, configure the Telegram slash-command menu and the Mini App menu button:

```bash
set TELEGRAM_BOT_TOKEN=<redacted>
set TELEGRAM_MINI_APP_URL=https://<worker-host>/miniapp
npm --prefix tools/telegram-control run set-bot-ui -- --dry-run
npm --prefix tools/telegram-control run set-bot-ui
```

The helper calls Telegram `setMyCommands` and `setChatMenuButton`. The dry run prints command names and a redacted Mini App menu payload without exposing the bot token.

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

`npm --prefix tools/telegram-control run secrets:bootstrap` generates only project-owned random secrets and prints redacted evidence. It never prints plaintext secret values.

`npm --prefix tools/telegram-control run secrets:install-generated -- --github` reads `.env.telegram-control.local` and stores the generated callback secret in GitHub Actions without printing the value.

`npm --prefix tools/telegram-control run secrets:install-generated -- --cloudflare` reads `.env.telegram-control.local` and stores generated Worker-side shared secrets through Wrangler stdin without printing values.

`npm --prefix tools/telegram-control run set-github-callback-url -- --github` validates the deployed HTTPS Worker origin and stores `TELEGRAM_CONTROL_CALLBACK_URL=https://<worker-host>/github/webhook` in GitHub Actions secrets.
