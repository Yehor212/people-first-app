# Gitleaks Triage - 2026-08-09

This ledger records the owner-authorized offline triage of the twelve redacted
historical findings blocking the Android 2.1 release lane. It contains no
candidate values, matches, raw environment content, credentials, or user data.

## Scope and policy

- Repository revision: `13ca51a80d23220574deba762851fe5a32372e46`
  plus the uncommitted Android 2.1 lane.
- Scanner source: the local Gitleaks `generic-api-key` history findings.
- Policy basis: root `SECURITY.md`; application, authentication, Supabase, and
  personal-data paths are in scope. Test fixtures and removed documentation do
  not cross a shipped runtime boundary unless a real credential is present.
- Baseline command: `gitleaks git . --redact=100 --report-format json
  --report-path <temporary-report> --no-banner`.
- Baseline result: exit `1`, 1,788 commits scanned, exactly twelve findings.
- Allowlist rule: only the exact scanner fingerprints listed below are added.
  There is no rule-wide, path-wide, regex, commit-range, or current-tree
  exclusion.

## Finding-by-finding verdicts

| Item | Historical location | Static evidence | Boundary assessment | Verdict |
| ---: | --- | --- | --- | --- |
| 1 | `c902b6...:scripts/__tests__/supabase-auth-magic-link-template.test.ts:95` | Test-only `SUPABASE_ACCESS_TOKEN` fixture; the literal contains an explicit test marker and current code constructs the same non-production fixture from segments. | Isolated test input; no deployed credential or external authorization path. | `not_actionable` / high confidence |
| 2 | `c902b6...:supabase/functions/_shared/pushDeletionBarrier.test.ts:213` | A UUID-shaped `permit_token` mismatch fixture injected through a test `randomUUID` seam. | Isolated negative test; not a stored or accepted production permit. | `not_actionable` / high confidence |
| 3 | `0b557d...:scripts/__tests__/supabase-auth-magic-link-template.test.ts:95` | Same test-only fixture as item 1 at a second historical commit. | Isolated test input; no shipped credential. | `not_actionable` / high confidence |
| 4 | `0b557d...:supabase/functions/_shared/pushDeletionBarrier.test.ts:213` | Same negative UUID fixture as item 2 at a second historical commit. | Isolated negative test; no production permit. | `not_actionable` / high confidence |
| 5 | `6ba34a...:src/features/journal/useJournalSecurity.ts:600` | The matched line contains no string literal: it selects stored or legacy numeric PBKDF2 iteration metadata before key derivation. | Shipped journal path, but the scanner matched numeric/identifier text rather than secret material. | `not_actionable` / high confidence |
| 6 | `f04a4e...:scripts/__tests__/supabase-auth-smtp-apply.test.ts:107` | The exact historical literal matches the current value explicitly annotated as a synthetic sanitizer fixture. | Isolated redaction test; no credential reaches a live Supabase call. | `not_actionable` / high confidence |
| 7 | `f04a4e...:scripts/__tests__/supabase-auth-smtp-apply.test.ts:108` | The exact historical literal matches the current synthetic SMTP sanitizer fixture. | Isolated redaction test; no credential reaches an SMTP provider. | `not_actionable` / high confidence |
| 8 | `ecc426...:scripts/__tests__/supabase-auth-redirect-allow-list.test.ts:111` | Test-only access-token literal with an explicit test marker; current source labels it a synthetic test token. | Isolated CLI validation test; no live authorization. | `not_actionable` / high confidence |
| 9 | `fd380a...:scripts/__tests__/journal-magic-link-github-bootstrap.test.ts:15` | Current source retains the same shape only as an explicitly annotated synthetic publishable-key fixture. | Isolated GitHub bootstrap test; no hosted secret or user account. | `not_actionable` / high confidence |
| 10 | `fd380a...:scripts/__tests__/journal-magic-link-github-bootstrap.test.ts:16` | Current source explicitly labels the corresponding value a synthetic test token. | Isolated GitHub bootstrap test; no live authorization. | `not_actionable` / high confidence |
| 11 | `fd380a...:scripts/__tests__/supabase-auth-smtp-apply.test.ts:134` | Test-only access-token fixture with an explicit test marker; current source labels the equivalent a synthetic test token. | Isolated CLI test; no live Supabase or SMTP request. | `not_actionable` / high confidence |
| 12 | `d3546b...:.claude/agents/payments/agentic-payments.md:35` | Removed documentation example. Its quoted value is 19 characters, not the 64 hexadecimal characters required for a 32-byte Ed25519 private key. | Historical docs-only example absent from the current tree; cannot authenticate or sign. | `not_actionable` / high confidence |

## Decision

All twelve inputs are `not_actionable`. There are no `confirmed` or
`needs_review` findings in this set, so no credential rotation, revocation,
history rewrite, or `$fix-finding` handoff is warranted. A future finding with
a different fingerprint still fails the scan and requires a new value-free
triage entry.

## Fresh verification

- The identical redacted Git-history scan now exits `0` after scanning 1,788
  commits and reports zero findings.
- A separate current-worktree scan copied only tracked and non-ignored source
  files into a temporary directory. It scanned 3,274 files / 56.74 MB and
  reports zero findings. Ignored owner configuration, dependencies, build
  output, and prior reports were not laundered into release evidence.
- `/Users/yehor/.codex/bin/codex-security-suite.sh --profile secrets --strict`
  exits `0`; both Gitleaks and TruffleHog report status `0` in the private local
  report `20260809T072752Z-34185`.
- Fourteen additional current-tree matches were all synthetic UUID, revision,
  or vault-key fixtures in isolated tests. Each exact line now has an inline
  `gitleaks:allow` rationale; no production source, rule, path, or pattern was
  excluded.
