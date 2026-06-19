# Sentry Live Proof Runbook

This runbook closes the Sentry observability proof without exposing secrets in chat, logs, screenshots, Git history, or build artifacts.

## Goal

Live Sentry proof is complete only when all of these are true:

- Runtime config has a usable `VITE_SENTRY_DSN`.
- Local or CI-only Sentry API/upload config has usable `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT`.
- Optional custom Sentry host uses `SENTRY_BASE_URL`; the default is `https://sentry.io`.
- GitHub Actions has the required GitHub secret names and GitHub variable names.
- `ZENFLOW_SENTRY_STATUS_REQUIRED=true npm run check:sentry` exits 0.
- `npm run check:sentry-artifacts` reports no public source maps and no `sourceMappingURL` references.

## Secret Handling Rules

Never paste SENTRY_AUTH_TOKEN into chat, issue comments, docs, screenshots, terminal transcripts, or source files.

Treat `VITE_SENTRY_DSN` as public runtime config, but still avoid copying the full value into docs or chat because it creates noisy audit trails. Treat `SENTRY_AUTH_TOKEN` as a private CI/local secret. `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_BASE_URL` are non-secret configuration values, but they still belong in CI variables or local shell env, not hardcoded app code.

## Required GitHub Names

GitHub secret names:

- `VITE_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

GitHub variable names:

- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_BASE_URL` when a non-default Sentry base URL is required

## Local Readiness Check

Run:

```bash
npm run check:sentry
```

Expected incomplete state before credentials exist:

- `readiness=UNVERIFIED` when local API/upload env is missing or placeholder.
- `api=UNVERIFIED` when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, or `SENTRY_PROJECT` is missing.
- `github=PARTIAL` when GitHub names are missing.
- `artifacts=PASS` only when public artifacts contain no source maps or source map references.

Do not convert `UNVERIFIED` into `PASS` by weakening checks. Add the missing environment values instead.

## Apply GitHub Names Safely

First run the helper in dry-run mode:

```bash
npm run apply:sentry-github
```

The dry-run must list only names and status, never values.

After the real values are present in the local shell environment, explicitly confirm the write:

```bash
ZENFLOW_SENTRY_GITHUB_APPLY=true npm run apply:sentry-github
```

The helper writes GitHub secret and variable values through standard input to `gh`. It must not pass secret values as command arguments and must not print them.

## Final Proof Commands

Run the required local Sentry gate:

```bash
ZENFLOW_SENTRY_STATUS_REQUIRED=true npm run check:sentry
```

Run the artifact guard:

```bash
npm run check:sentry-artifacts
```

Run the focused Sentry tests after changing Sentry scripts or docs:

```bash
npm run test -- scripts/__tests__/apply-sentry-github.test.ts scripts/__tests__/sentry-live-proof-doc.test.ts scripts/__tests__/sentry-status.test.ts scripts/__tests__/sentry-artifacts.test.ts scripts/__tests__/sentry-api-smoke.test.ts scripts/__tests__/github-sentry-secrets.test.ts scripts/__tests__/sentry-source-map-build-contract.test.ts scripts/__tests__/sentry-readiness.test.ts src/lib/__tests__/sentryPrivacy.test.ts src/lib/__tests__/sentryEventFilters.test.ts src/lib/__tests__/sentryTransportContract.test.ts src/lib/__tests__/errorBuffer.test.ts src/components/__tests__/ErrorBoundary.test.tsx
```

## PASS Criteria

Mark live Sentry proof as PASS only when fresh output proves:

- `npm run check:sentry` summarizes readiness, API, GitHub names, and artifacts.
- `ZENFLOW_SENTRY_STATUS_REQUIRED=true npm run check:sentry` exits 0.
- `npm run check:sentry-artifacts` exits 0.
- Focused Sentry tests exit 0.
- No command output includes `SENTRY_AUTH_TOKEN` values, full DSN values, raw Sentry issue bodies, stack traces, user emails, IP addresses, journal content, habit data, or other unnecessary PII.

## If It Still Shows UNVERIFIED

Keep the goal active. The usual causes are:

- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, or `SENTRY_PROJECT` is missing locally.
- GitHub Actions has not been configured with the required GitHub secret or GitHub variable names.
- The Sentry token lacks read-only project/event/org access.
- A placeholder value such as a `your_*` or `set_*` sample is still being used.

Do not ask anyone to paste token values into chat. Ask them to set the values locally or in GitHub, then rerun the proof commands.
