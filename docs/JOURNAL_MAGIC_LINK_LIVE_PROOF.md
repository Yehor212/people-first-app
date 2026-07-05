# Journal Magic Link Live Proof Runbook

This runbook closes the diary lock-removal proof without exposing Supabase tokens, one-time Magic Links, user email addresses, or diary content.

## Goal

Journal Magic Link live proof is complete only when all of these are true:

- Hosted Supabase Auth has email auth enabled.
- Hosted Supabase Auth allow-list includes every canonical ZenFlow journal reset callback for GitHub Pages, `https://zenflow.app`, and the native callback.
- Production live mode has custom SMTP configured. A no-paid path can use a reputable free SMTP tier, but it must still be configured as custom SMTP in Supabase.
- A dedicated smoke inbox receives a real Supabase Magic Link email.
- The captured proof URL is the Supabase `/auth/v1/verify` URL from that delivered email, not a manually built app callback.
- The captured URL is consumed only when the operator explicitly enables one-time consumption.
- `ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED=true npm run check:journal-magic-link-live` exits 0.

## Secret Handling Rules

Never paste these values into chat, issues, docs, screenshots, terminal transcripts, or source files:

- `SUPABASE_ACCESS_TOKEN`
- `ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL`
- the full smoke inbox address when it identifies a private person
- any callback URL after Supabase has appended `code`, `access_token`, or `refresh_token`

Use GitHub Secrets for secrets and GitHub Variables for booleans or public identifiers. Keep the real captured URL only long enough to run the proof, then rotate or clear it because it contains a one-time auth token.

Supabase's built-in email sender is not enough for production PASS: the official Auth docs describe it as low-limit, best-effort, and intended for non-production use. For this diary recovery path, built-in email may support local/manual exploration only; it must stay `UNVERIFIED` for live readiness.

## Required GitHub Names

GitHub secret names:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or legacy `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL`
- `ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL`
- `ZENFLOW_GITHUB_SECRET_CLEANUP_TOKEN`
- `ZENFLOW_AUTH_SMTP_ADMIN_EMAIL`
- `ZENFLOW_AUTH_SMTP_HOST`
- `ZENFLOW_AUTH_SMTP_PORT`
- `ZENFLOW_AUTH_SMTP_USER`
- `ZENFLOW_AUTH_SMTP_PASS`
- `ZENFLOW_AUTH_SMTP_SENDER_NAME`

GitHub variable names:

- `SUPABASE_PROJECT_REF`
- `VITE_JOURNAL_MAGIC_LINK_LIVE_READY`
- `ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL`

Check the names without printing values:

```bash
npm run check:github-journal-magic-link-secrets
npm run check:github-journal-magic-link-secrets:pass
```

This only proves the names exist in GitHub. It does not prove the secret values
are current, deliverable, or safe to keep after a one-time proof.

Normal deploy workflows intentionally do not receive `ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL`, do not consume one-time links, do not apply SMTP, and do not send smoke emails. Full one-time proof belongs only in the manual `Journal Magic Link Live Proof` GitHub Actions workflow.

`https://zenflow.app` is kept in the Supabase allow-list as the future/custom-domain callback, but it must not be used as live callback proof while DNS still resolves to the marketplace/parking host. Use the GitHub Pages callback for current proof until `zenflow.app/diary?...journalReset=...` returns the ZenFlow app route publicly.

## Manual GitHub Live Proof Workflow

Use the `Journal Magic Link Live Proof` workflow only after SMTP provider credentials, the smoke inbox, and a fresh captured Supabase `/auth/v1/verify` URL are ready in GitHub Secrets. The workflow is `workflow_dispatch` only, restricted to `main`, uses the `production` environment, and has read-only repository permissions.

Manual inputs:

- `confirm_live_smtp_apply`: must equal `APPLY_JOURNAL_MAGIC_LINK_LIVE_PROOF`.
- `consume_captured_url`: set to `true` only when the captured URL is fresh and ready to be consumed once.

The workflow order is deliberate:

1. Validate branch and confirmation phrase.
2. Check GitHub secret and variable names without printing values.
3. Validate and apply Supabase Auth custom SMTP.
4. Consume the captured Supabase verify URL as part of `npm run check:journal-magic-link-live` before sending a new smoke Magic Link.
5. Require the proof status packet to pass.

After every proof attempt that consumes a captured URL, clear or rotate `ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL`; do not leave a consumed one-time link in GitHub Secrets. The manual workflow uses `ZENFLOW_GITHUB_SECRET_CLEANUP_TOKEN` only for this cleanup. Keep that token least-privileged, short-lived when possible, and limited to the canonical repository secret-management permission needed to delete this repository secret.

## Safe GitHub Bootstrap

Use the bootstrap only from a trusted local shell. It validates names and shapes first, refuses placeholders, refuses redirected app callbacks, and passes GitHub secret values through stdin so they do not appear as command arguments.

Dry-run without writing values:

```bash
ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_SMOKE_INBOX=true \
ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_FRESH_CAPTURED_URL=true \
npm run apply:journal-magic-link-github-secrets -- --dry-run
```

Apply only after `SUPABASE_ACCESS_TOKEN`, `ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL`, and the fresh `ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL` are present in the shell environment. Do not store the captured URL long term; run the live proof immediately and then rotate or clear it.

```bash
ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_SMOKE_INBOX=true \
ZENFLOW_JOURNAL_MAGIC_LINK_CONFIRM_FRESH_CAPTURED_URL=true \
npm run apply:journal-magic-link-github-secrets
```

The bootstrap cannot create a Supabase personal access token. Supabase documents PAT creation from the account token page, and the token is an owner-scoped credential that must be handled as a secret.
## Custom SMTP Bootstrap

Production PASS requires custom SMTP. Supabase documents the built-in sender as restricted and not production-ready, so a free tier is acceptable only when it provides real SMTP credentials and delivery proof. Do not invent SMTP values. Use an owner-controlled provider such as Resend, Brevo, Gmail App Password SMTP, SendGrid, Postmark, ZeptoMail, or AWS SES only after the owner has created the account, key, and sender/domain verification required by that provider.

Required shell-only values for the ZenFlow SMTP bootstrap:

```bash
export SUPABASE_ACCESS_TOKEN="set-in-shell-only"
export SUPABASE_PROJECT_REF="bwgfslmxmueyglpumkbf"
export ZENFLOW_AUTH_SMTP_CONFIRM_PRODUCTION=true
export ZENFLOW_AUTH_SMTP_ADMIN_EMAIL="no-reply@auth.example.com"
export ZENFLOW_AUTH_SMTP_HOST="smtp.provider.example"
export ZENFLOW_AUTH_SMTP_PORT=587
export ZENFLOW_AUTH_SMTP_USER="set-in-shell-only"
export ZENFLOW_AUTH_SMTP_PASS="set-in-shell-only"
export ZENFLOW_AUTH_SMTP_SENDER_NAME="ZenFlow"
```

Validate without network writes first:

```bash
npm run check:supabase-auth-smtp
```

Apply only from a trusted local shell after the provider credential is real and the sender/domain is verified:

```bash
npm run apply:supabase-auth-smtp
```

The bootstrap prints only field names and statuses. It must not print `ZENFLOW_AUTH_SMTP_PASS`, provider API keys, private email inboxes, or Magic Link URLs. After SMTP is applied, rerun the live proof with a fresh smoke email and a fresh delivered Supabase `/auth/v1/verify` URL.

## Local Proof Flow

1. Confirm the app-side guard still passes:

```bash
npm test -- --run scripts/__tests__/journal-magic-link-live.test.ts src/features/journal/__tests__/JournalModule.handoffBehavior.test.tsx src/hooks/__tests__/useAuthSession.test.ts
npm run check:journal-magic-link-proof-status
```

2. Confirm incomplete local state stays honest:

```bash
npm run check:journal-magic-link-live
ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED=true npm run check:journal-magic-link-live
```

The first command may exit 0 with `UNVERIFIED`. The second command must exit non-zero until hosted config, smoke send, and captured click-through proof are present.

3. From a trusted shell, set the live proof environment without printing values:

```bash
export SUPABASE_PROJECT_REF="your-project-ref"
export SUPABASE_ACCESS_TOKEN="set-in-shell-only"
export VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
export ZENFLOW_JOURNAL_MAGIC_LINK_SMOKE_EMAIL="dedicated-smoke-inbox@example.com"
export ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE=true
export ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL=true
export ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED=true
```

4. Run the smoke send once:

```bash
npm run check:journal-magic-link-live
```

5. Open the delivered email in the dedicated smoke inbox and copy only the Supabase `/auth/v1/verify?...` link into a secret store. Do not copy an already redirected app URL.

6. Run the click-through proof only when you are ready to consume the one-time link:

```bash
export ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL="set-in-shell-only"
export ZENFLOW_JOURNAL_MAGIC_LINK_VERIFY_CAPTURED_URL=true
export ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL=true
ZENFLOW_JOURNAL_MAGIC_LINK_LIVE_REQUIRED=true npm run check:journal-magic-link-live
```

Expected result after a valid click-through: Supabase accepts the one-time link, redirects only to the trusted ZenFlow journal reset callback, and the app can continue the same-account diary lock-removal handoff. Wrong-account, forged, stale, already-used, or non-journal links must keep diary content and lock state protected.

7. Clear or rotate `ZENFLOW_JOURNAL_MAGIC_LINK_CAPTURED_URL` immediately after a PASS result. Use the dry-run first, then apply from a trusted shell:

```bash
npm run clear:journal-magic-link-captured-url
npm run clear:journal-magic-link-captured-url:apply
```

8. Update `docs/JOURNAL_MAGIC_LINK_LIVE_PROOF_STATUS.json`, then require the status packet to pass:

```bash
npm run check:journal-magic-link-proof-status:pass
```

## PASS Criteria

Mark journal Magic Link live proof as PASS only when fresh output proves:

- Hosted Supabase management config was checked through `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`.
- The required GitHub secret and variable names were checked without printing values.
- The smoke Magic Link was accepted for the dedicated smoke inbox.
- The captured proof was a Supabase verify URL with `token` or `token_hash`.
- Consuming the captured URL produced a trusted ZenFlow callback with auth proof.
- The one-time captured URL was consumed only by the manual live proof workflow or a trusted local proof shell, never by a normal deploy.
- No command output includes secret values, raw email content, user diary content, refresh tokens, access tokens, or full one-time links.
- `docs/JOURNAL_MAGIC_LINK_LIVE_PROOF_STATUS.json` has every required item marked `PASS`, and `npm run check:journal-magic-link-proof-status:pass` exits 0.

## If It Still Shows UNVERIFIED

Keep the goal active. The usual causes are:

- `SUPABASE_ACCESS_TOKEN` or `SUPABASE_PROJECT_REF` is missing.
- Supabase email auth or redirect allow-list is not configured on the hosted project.
- The smoke send was not enabled with both `ZENFLOW_JOURNAL_MAGIC_LINK_SEND_SMOKE=true` and `ZENFLOW_JOURNAL_MAGIC_LINK_ALLOW_REAL_EMAIL=true`.
- The captured URL is missing, already consumed, manually fabricated, or not the Supabase `/auth/v1/verify` link from the delivered email.
- `ZENFLOW_JOURNAL_MAGIC_LINK_CONSUME_CAPTURED_URL=true` was not set for the one-time click-through proof.

Do not weaken the checker to get a green result. Add the missing external proof instead.
