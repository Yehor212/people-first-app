# ZenFlow Telegram Control Plane

This Worker is the Telegram-first control plane for `people-first-app`. It receives Telegram bot webhooks, verifies an admin allowlist, creates durable control jobs in Cloudflare KV, starts a Cloudflare Workflow, and dispatches `.github/workflows/telegram-control.yml` through a GitHub App.

It stores only automation metadata: job id, Telegram requester id, command kind, GitHub run id, branch, PR URL, approval records, status, timestamps, and evidence. It must not store ZenFlow journal, habit, mood, or account content.

It also serves a minimal Telegram Mini App dashboard at `/miniapp`. Mini App API calls must include `Authorization: tma <Telegram.WebApp.initData>` and are verified server-side before any state or command is returned.

## Bot Identity Split

Use two Telegram bots in production:

- Public auth bot: `@ZenFlowAuthBot`, configured in BotFather Web Login and Supabase `custom:telegram`. Its token is used only for auth-bot profile/photo verification as GitHub secret `TELEGRAM_AUTH_BOT_TOKEN`.
- Private report/control bot: a separate admin-only bot, for example `@ZenFlowReportsBot`, configured as Cloudflare Worker secret `TELEGRAM_BOT_TOKEN` plus the `/telegram/webhook` webhook. This token must not be reused for public login.

Keeping these identities separate avoids exposing admin command menus on the public login bot, reduces blast radius, and lets control/report credentials rotate without touching Telegram sign-in.

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

## Report Delivery

When GitHub Actions or GitHub workflow webhooks call back into `/github/webhook`, the Worker sends the original Telegram chat an actionable report instead of a bare status line. The report includes the control job id, final status, branch when available, PR or run URL, and the latest evidence lines.

This callback path is what makes Telegram useful for receiving reports: `TELEGRAM_CONTROL_CALLBACK_URL` must point to `https://<worker-host>/github/webhook`, and `TELEGRAM_CONTROL_CALLBACK_SECRET` must match in both GitHub Actions and Cloudflare Worker secrets.

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

The write mode creates `.env.telegram-control.local`, which is ignored by git. It only contains `TELEGRAM_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`, and `TELEGRAM_CONTROL_CALLBACK_SECRET`. Account-owned credentials such as private `TELEGRAM_BOT_TOKEN`, public `TELEGRAM_AUTH_BOT_TOKEN`, GitHub App ids/private key, and `OPENAI_API_KEY` must still come from their official account flows.

Account-owned secrets can be installed through local prompts without printing values:

```bash
npm --prefix tools/telegram-control run secrets:prompt-account -- --dry-run
npm --prefix tools/telegram-control run secrets:prompt-account -- --cloudflare --github-telegram
```

The prompt helper asks for the private report/control BotFather token, numeric Telegram admin allowlist, GitHub App id, installation id, and a local path to the downloaded GitHub App `.pem` private key. It validates the values, writes them to Cloudflare Worker secrets, optionally asks for the public auth bot token and writes it to GitHub Actions as `TELEGRAM_AUTH_BOT_TOKEN`, and never prints secret values.

Account-owned secrets can also be installed from a prepared local shell without printing values:

```bash
npm --prefix tools/telegram-control run secrets:install-account -- --dry-run
npm --prefix tools/telegram-control run secrets:install-account -- --cloudflare
npm --prefix tools/telegram-control run secrets:install-account -- --github --github-telegram --github-snyk
```

`TELEGRAM_AUTH_BOT_TOKEN` can be installed into GitHub Actions secrets from an already prepared environment with `--github --github-telegram`; this lets deploy prove the approved public Telegram OAuth bot profile photo without printing the token. Keep `TELEGRAM_BOT_TOKEN` for the private Cloudflare report/control bot only. `OPENAI_API_KEY` can also be installed from an already prepared environment with `--github --github-openai`, but this must only be run after explicit operator approval for that key. This helper does not create OpenAI keys.

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
npm --prefix tools/telegram-control run activation:run -- --apply --kv --cloudflare-account-secrets --cloudflare-secrets --github-telegram-secret --github-snyk-secret --github-secrets --deploy --github-callback --telegram --live-smoke --external-checks
npm --prefix tools/telegram-control run activation:checklist -- --github
npm --prefix tools/telegram-control run activation:checklist -- --cloudflare
npm --prefix tools/telegram-control run activation:doctor
npm --prefix tools/telegram-control run activation:doctor -- --github --cloudflare
npm --prefix tools/telegram-control run activation:doctor -- --github --cloudflare --external-checks
npm --prefix tools/telegram-control run telegram:doctor
npm --prefix tools/telegram-control run telegram:doctor -- --live
```

The activation runner composes KV setup, account-secret installation, generated-secret installation, Worker deploy, GitHub App manifest generation, GitHub callback URL, Telegram bot readiness, Telegram webhook, bot UI, live smoke, and the doctor into one ordered flow. Its default mode is dry-run/report-only. Mutating steps run only with `--apply` plus explicit step flags such as `--kv`, `--cloudflare-account-secrets`, `--deploy`, or `--telegram`; `--all` is reserved for a fully prepared operator shell.

The GitHub-aware check reads secret names only. It verifies whether `TELEGRAM_CONTROL_CALLBACK_SECRET`, `TELEGRAM_CONTROL_CALLBACK_URL`, `TELEGRAM_AUTH_BOT_TOKEN`, `OPENAI_API_KEY`, and optional `SNYK_TOKEN` exist without reading their values.
The activation doctor summarizes Cloudflare, GitHub, callback URL, OpenAI, Snyk, and Telegram readiness as PASS/UNVERIFIED/FAIL without printing secret values. Its default mode is local-only; `--github --cloudflare` adds name-only GitHub secret checks and Wrangler auth status.
With `--external-checks`, the activation doctor also checks public GitHub Status for Actions and Pages incidents, so workflow dispatch/deploy outages are reported as external dependency failures instead of vague CI drift.
The Telegram bot readiness doctor validates BotFather token shape, webhook secret-token rules, admin id allowlist, webhook URL, and Mini App URL without printing secret values. With `--live`, it additionally calls Telegram `getMe` and `getWebhookInfo` to prove the token and current webhook state.

## Required GitHub Secrets

- `TELEGRAM_AUTH_BOT_TOKEN`: required for deploy-time proof that the public Telegram OAuth bot uses the approved ZenFlow profile photo. This must be the public auth bot token, not the private report/control bot token.
- `OPENAI_API_KEY`: required only for Codex-backed `plan`, `fix`, `review`, and `security`. When missing, the workflow reports `UNVERIFIED`, writes a no-paid RAG/manual artifact, and does not fake AI success.
- `TELEGRAM_CONTROL_CALLBACK_URL`: `https://<worker-host>/github/webhook`.
- `TELEGRAM_CONTROL_CALLBACK_SECRET`: must match the Cloudflare secret.
- `SNYK_TOKEN`: optional for `snyk code test`.

## GitHub App Permissions

Minimum:

- Metadata: read
- Actions: read/write

`GITHUB_APP_ID`, `GITHUB_INSTALLATION_ID`, and `GITHUB_APP_PRIVATE_KEY` are enough for `/status`, workflow dispatch, and GitHub run cancellation. `GITHUB_WEBHOOK_SECRET` is separate: it verifies inbound GitHub webhook events and is still required for live webhook proof.

Generate the GitHub App manifest after the deployed Worker URL exists:

```bash
npm --prefix tools/telegram-control run github-app:manifest -- --base-url https://<worker-host>
npm --prefix tools/telegram-control run github-app:manifest -- --base-url https://<worker-host> --org <organization>
```

For less manual copying, use the local manifest-flow helper:

```bash
npm --prefix tools/telegram-control run github-app:local-flow -- --dry-run --base-url https://<worker-host>
npm --prefix tools/telegram-control run github-app:local-flow -- --apply --base-url https://<worker-host> --cloudflare
```

The local-flow helper starts a one-time loopback callback, opens a GitHub registration form, exchanges GitHub's temporary manifest `code`, and stores `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and GitHub's generated `GITHUB_WEBHOOK_SECRET` in Cloudflare when `--cloudflare` is present. It also saves the returned private key outside the repo under the local user config directory unless `--no-write-pem` is passed. It never prints private keys, webhook secrets, or tokens.

The manifest uses `workflow_run` webhooks, `metadata:read`, and `actions:write` by default. The helper uses GitHub's personal-account manifest target unless `--org <organization>` is provided. Add `--workflow-owned-prs` only if the GitHub App itself will create branches, issues, or PRs instead of the GitHub Actions workflow owning that work. The generated manifest does not include App ID, private key, webhook secret, or installation ID; GitHub returns those only through the owner-controlled manifest flow. If you use the manifest flow, prefer GitHub's returned `webhook_secret` for Cloudflare `GITHUB_WEBHOOK_SECRET` so webhook signature verification matches.

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
