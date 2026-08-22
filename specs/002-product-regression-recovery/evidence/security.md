# Security Evidence: Wave 1 Candidate

> **CURRENT DISPOSITION (2026-08-04): `FAIL` / evidence invalidated.** The
> implementation changed after this capture. A fixed-point SQL reachability
> negative control currently exposes an unclosed PDI analyzer false negative.
> The privacy canary was also expanded after raw diary row identifiers were
> found in diagnostic paths; its focused rerun is green, but the complete
> frozen candidate has not been rescanned. Every `PASS` row below is a retained
> historical receipt only and MUST NOT be used as current completion, merge, or
> release evidence. Replace this file from fresh frozen-tree receipts before
> convergence.

**Captured**: 2026-08-04T06:10:45Z
**Scope**: Wave 1 journal password removal, storage/sync, unapplied Supabase
migration source, PDI parser, and dependency lock
**Authority**: local read/scan only; no DAST, production credential, live
account, database mutation, migration apply, or password-removal action

## Fresh results

| Check | Result | Assurance boundary |
| --- | --- | --- |
| `snyk code test src/features/journal` | exit `0`, issues `0` | Changed journal scope only |
| `snyk code test src/storage` | exit `0`, issues `0` | Changed storage/sync scope only |
| `snyk code test scripts/production-data-integrity` | exit `0`, issues `0` | Changed enforcement scope only |
| `npm audit --audit-level=high` | exit `0`, vulnerabilities `0` | Current installed dependency graph |
| Staged full-index Gitleaks stdin scan | exit `0`, leaks `0` | Candidate diff only; it does not clear inherited history |
| PDI source/diff/bundle | errors `0`, warnings `0`; scanned `2,360`, reachable `788` | Production-data substitution/reachability scanner only |
| Privacy and deletion-boundary negative controls | focused tests passed inside the `2,137/2,137` Wave 1 matrix; migration/delete/PDI subset `148/148` | Stable codes reject content, ciphertext, raw IDs, provider text, and raw errors; SQL contract rejects six authenticated journal mutation paths after the permanent account-deletion tombstone |
| Local security suite `quick` | mixed result; Gitleaks, TruffleHog, Trivy, Checkov, KICS exit `0`; Terrascan exit `4` | No blanket security PASS |

The lockfile-only security update moves `brace-expansion` to `5.0.9`,
`fast-uri` to `3.1.5`, and `undici` to `6.28.0`. No new production
service or dependency was added.

## Retained suite receipt

- Report directory:
  `/Users/yehor/.codex/security/reports/20260804T061045Z-91073`
- Summary SHA-256:
  `8a7b238b7de1cad6f9a440be3aadfb68269b4c6ad1dc5e0cb8452857dbe58bc5`
- Notes SHA-256:
  `094d65263414c8d0fbd3afc50e66c03a2efd52b15f0b1054ba7c0a4222ee2e03`
- Gitleaks warned about 12 inherited history findings. The separate staged-diff
  scan found zero candidate leaks; inherited history was not rewritten.
- TruffleHog reported zero verified secrets and 37 unverified matches from
  dependency/build-cache material. These are not presented as candidate
  findings or as cleared secrets.
- Checkov reported 733 passed, zero failed, and three skipped checks.
- Terrascan attempted unsupported parsing across Playwright YAML and dependency
  material while the repository has no applicable Terraform/Docker input for
  that run. Exit `4` remains `UNVERIFIED`, not PASS.
- The wrapper skipped its Snyk modes because `SNYK_TOKEN` was unavailable to
  the wrapper. The three direct authenticated local Snyk CLI runs above are
  separate scoped evidence.

## Threat-boundary status

| Boundary | Local disposition | Missing proof / rejection criterion |
| --- | --- | --- |
| Owner/account switching | Fail-closed checks before preparation, transaction, native cleanup, and remote phase | Real two-session switching/auth expiry `UNVERIFIED` |
| TOCTOU/revision | Expected vault epoch plus exact raw inventory snapshot/CAS and immediate pre-transaction owner/revision recheck | Reject if any mutation can commit after validation without retry; live schedule `UNVERIFIED` |
| Private diagnostics | Stable enums only; content/ciphertext/raw IDs/provider messages rejected | External telemetry sinks were not inspected end-to-end |
| Native biometric cleanup | Runs after local commit; failure cannot reverse truthful local success | Physical Android/iOS secure-storage behavior `UNVERIFIED` |
| Remote removal | Owner-bound durable operation, explicit acknowledgement, typed deferred state, replay | Live Supabase RLS, Storage policy, contention, and offline replay `UNVERIFIED` |
| Migration rollout | Forward-only source, bounded cutover lock, static ordering/isolation negative controls | Reject rollout until authorized non-production PostgreSQL/RLS exercise passes |
| Permanent account deletion | Owner advisory lock precedes a fresh `account_deletion_blocks` read for every authenticated journal-security mutation; helper is private and execute is revoked | Live `READ COMMITTED` two-session schedule and interaction with the deployed deletion transaction remain `UNVERIFIED`; reject if either can commit on the tombstoned owner |
| Real password removal | No automated execution | User-only just-in-time confirmation after an accepted deployment |

## Remaining risk

The exact cause of the user's real-data failure remains unknown. Static SQL
tests cannot establish live PostgreSQL syntax/application, locking, trigger
behavior, RLS, Storage, or old/new-client compatibility. Terrascan is not a
clean-complete run, the security-suite history scan retains inherited findings,
and DAST was neither necessary nor authorized for this local candidate. No
scanner result authorizes a migration or real journal operation.
