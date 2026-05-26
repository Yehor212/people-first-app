# Telegram Control Plane Completion Audit

Current status: `PARTIAL`.

The repository contains a verified Telegram control-plane implementation, but live operation is `UNVERIFIED` until real Telegram, Cloudflare, and GitHub secrets are configured outside git.

## Evidence

| Requirement | Verdict | Evidence |
| --- | --- | --- |
| Cloudflare Worker source exists | PASS | `tools/telegram-control/src/index.ts` and `tools/telegram-control/wrangler.jsonc` |
| Telegram webhook verifies secret token | PASS | `tools/telegram-control/src/security.ts`; test `missing Telegram webhook secret is rejected before message handling` |
| Telegram admin allowlist exists | PASS | `tools/telegram-control/src/security.ts`; test `unauthorized Telegram users are rejected before dispatch` |
| Command schema covers status/health/plan/fix/review/test/security/deploy/rollback/jobs/approval | PASS | `tools/telegram-control/src/commands.ts`; `npm run check:telegram-control` |
| Destructive commands require confirmation | PASS | `tools/telegram-control/src/control.ts`; test `deploy command stops at approval gate before GitHub dispatch` |
| Approval nonce flow exists | PASS | `tools/telegram-control/src/telegram.ts`; test `manual approve command validates nonce and starts approved job` |
| GitHub webhook/callback verification exists | PASS | `tools/telegram-control/src/security.ts`; tests `GitHub HMAC verification rejects modified bodies` and `workflow callback updates matching job and keeps evidence` |
| Mini App dashboard route exists | PASS | `tools/telegram-control/src/miniapp.ts`; test `miniapp HTML is served without exposing secrets` |
| Mini App init data is verified | PASS | `tools/telegram-control/src/miniapp.ts`; tests `miniapp state requires Telegram init data`, `miniapp state accepts signed init data for allowlisted admin`, and `miniapp command rejects non-admin signed user` |
| Mini App command surface reuses destructive approval gate | PASS | test `miniapp deploy command creates approval-gated job` |
| GitHub Actions workflow exists | PASS | `.github/workflows/telegram-control.yml` |
| Branch-only code work | PASS | `.github/workflows/telegram-control.yml` enforces `codex/telegram-*` branch naming |
| Telegram-approved deploy dispatch | PASS | `.github/workflows/telegram-control.yml` step `Dispatch production deploy workflow` queues `.github/workflows/deploy.yml` only after approval and only for `base_ref=main` |
| Deploy workflow main-ref guard | PASS | `.github/workflows/deploy.yml` step `Validate Telegram-approved deploy target` rejects Telegram-approved production deploys unless `GITHUB_REF=refs/heads/main` |
| Rollback creates branch-only draft PR | PASS | `.github/workflows/telegram-control.yml` step `Create rollback proposal PR` requires Telegram approval, validates `target=<commit-or-ref>`, runs gates, and opens a draft PR without deploying |
| Missing `OPENAI_API_KEY` does not fake success | PASS | `.github/workflows/telegram-control.yml` reports `UNVERIFIED` before Codex action |
| Local Worker/package verification | PASS | `npm run check:telegram-control`: unit tests, workflow invariants, local smoke, and setup verifier ran |
| Local end-to-end smoke without live secrets | PASS | `npm --prefix tools/telegram-control run smoke:local`: health, Mini App state, auth rejection, status, approval, and callback verified |
| Deployed Worker smoke helper exists | PASS | `npm --prefix tools/telegram-control run smoke:live` verifies `/health`, `/miniapp`, and signed Mini App state when env vars are present |
| Workflow safety contract | PASS | `npm --prefix tools/telegram-control run check:workflow`: Telegram control and deploy workflow invariants verified |
| CI drift guard | PASS | `.github/workflows/drift-checks.yml` includes `telegram-control` matrix entry running `npm run check:telegram-control` |
| Activation checklist | PASS | `npm --prefix tools/telegram-control run activation:checklist` reports remaining external setup without exposing secrets |
| Setup command plan | PASS | `npm --prefix tools/telegram-control run setup:plan` prints required Cloudflare/GitHub/Telegram commands without embedding secret values |
| Secret leak guard | PASS | `npm --prefix tools/telegram-control run check:secrets` scans control-plane files for token-shaped values |
| Full current-worktree static gates | PASS | `npm run check:all` passed on the current worktree |
| Task completion protocol | PASS | `npm run check:task-completion`: 72 invariants verified |
| Sync contract | PASS | `npm run check:sync-contract`: 343 sync invariants verified |
| Worker deploy dry-run | PASS | `npm --prefix tools/telegram-control run deploy:dry-run`: Wrangler 4.94.0 dry-run uploaded 31.73 KiB and detected Workflow/KV bindings |
| Snyk code scan | PASS | `snyk code test`: total issues 0 |
| Live Telegram bot webhook installed | UNVERIFIED | Requires real `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and deployed Worker URL |
| Live Cloudflare KV namespace configured | UNVERIFIED | `tools/telegram-control/wrangler.jsonc` still contains `REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID` |
| Live GitHub App dispatch configured | UNVERIFIED | Requires real GitHub App secrets in Cloudflare |
| Live production deploy completion | UNVERIFIED | Requires deployed Worker, configured callbacks, and a real GitHub Pages deploy run URL |
| Live Codex execution | UNVERIFIED | Requires GitHub `OPENAI_API_KEY` secret or a deliberate no-AI operating mode |
| Direct production rollback | UNVERIFIED | Rollback intentionally creates a draft PR only; production rollback/merge still requires external approval and repo protection |

## Required External Setup

1. Replace the placeholder KV namespace id in `tools/telegram-control/wrangler.jsonc`.
2. Set Cloudflare secrets listed in `tools/telegram-control/README.md`.
3. Deploy the Worker.
4. Run `npm --prefix tools/telegram-control run set-webhook` from a local shell with Telegram env vars set.
5. Configure `TELEGRAM_CONTROL_CALLBACK_URL` and `TELEGRAM_CONTROL_CALLBACK_SECRET` in GitHub.
6. Optionally add GitHub `OPENAI_API_KEY`; without it, AI modes correctly return `UNVERIFIED`.
7. Send `/health` and `/status` from the allowlisted Telegram account and save the responses as live evidence.
8. Run `npm --prefix tools/telegram-control run smoke:live` and save the PASS output as deployed Worker evidence.
