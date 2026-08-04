# Security Evidence: Epic 002 Candidate

**Captured**: 2026-08-04T04:26:03Z
**Scope**: journal password removal, storage/sync, Supabase migration source, availability/capability gates, PDI parser, and dependency lock
**Authority**: local read/scan only; no DAST, production credential, live account, database mutation, migration apply, or password-removal action

## Fresh results

| Check | Result | Assurance boundary |
| --- | --- | --- |
| `snyk code test src/features/journal` | exit `0`, issues `0` | Changed journal scope only |
| `snyk code test src/storage` | exit `0`, issues `0` | Changed storage/sync scope only |
| `snyk code test src/contexts` | exit `0`, issues `0` | Changed provider scope only |
| Broad `snyk code test src` | 21 open items plus API `403` | Mixed/unfinished; many matches are test strings/translations, but no whole-source PASS is claimed |
| `snyk code test scripts` | 3 LOW path-traversal findings plus API `403` | The same three findings reproduce from `origin/main`; inherited and still unresolved, not waived |
| `npm audit --audit-level=high` | exit `0`, vulnerabilities `0` | Current installed dependency graph |
| Base-lock audit comparison | 3 advisories: 2 high, 1 moderate | Establishes why `brace-expansion`, `fast-uri`, and `undici` lock updates are in scope |
| PDI source/diff/bundle | errors `0`, warnings `0` | Production-data substitution/reachability scanner only |
| Privacy negative controls | focused tests passed | Stable codes reject content, ciphertext, raw IDs, provider text, and raw errors from durable/UI metadata |
| Local security suite `quick` | Gitleaks, TruffleHog, Trivy, Checkov, KICS `0`; Terrascan exit `4` | Mixed result; no blanket security PASS |

## Retained suite receipt

- Report directory: `/Users/yehor/.codex/security/reports/20260804T040050Z-4644`
- Summary SHA-256: `9e5e86510e097bdbd833b7d2b658a8c9cc9bdec29e97aab9470ddbb8dffb4fe6`
- Notes SHA-256: `094d65263414c8d0fbd3afc50e66c03a2efd52b15f0b1054ba7c0a4222ee2e03`
- The wrapper skipped Snyk because `SNYK_TOKEN` was unavailable to that wrapper; direct authenticated CLI runs above are separate evidence.
- Terrascan attempted to parse Playwright YAML/node_modules as CloudFormation and reported absent Terraform/Docker inputs. Exit `4` is retained as mixed/`UNVERIFIED`, not converted to PASS.
- The three script findings were independently reproduced from a clean `origin/main` archive. Existing lock-lease ownership, symlink, and path negative controls remain; this Epic does not cosmetically rewrite inherited code.

## Threat-boundary status

| Boundary | Local disposition | Missing proof / rejection criterion |
| --- | --- | --- |
| Owner/account switching | Fail-closed checks before preparation, transaction, native cleanup, and remote phase | Real two-session switching/auth expiry `UNVERIFIED` |
| TOCTOU/revision | Expected vault epoch plus raw inventory snapshot/CAS and immediate pre-transaction owner/revision recheck | Reject if any mutation can commit after validation without a retry; live schedule `UNVERIFIED` |
| Private diagnostics | Stable enums only; content/ciphertext/raw IDs/provider messages rejected | External telemetry sinks were not inspected |
| Native biometric cleanup | Runs after local commit; failure cannot reverse truthful local success | Physical Android/iOS secure-storage behavior `UNVERIFIED` |
| Remote removal | Owner-bound durable operation, explicit acknowledgement, typed deferred state, replay | Live Supabase RLS, Storage policy, contention, and offline replay `UNVERIFIED` |
| Migration rollout | Forward-only source, bounded cutover lock, static ordering/isolation negative controls | Reject rollout until authorized non-production PostgreSQL/RLS exercise passes |
| Capability release | Exact-SHA/target policy, active kill switch, no user data in receipt, raw flag rejected | Exact release-CI receipt and enabled-artifact human review `UNVERIFIED` |
| Real password removal | No automated execution | User-only just-in-time confirmation after an accepted deployment |

## Remaining risk

The exact cause of the user's real-data failure remains unknown. Static SQL tests cannot establish live PostgreSQL locking, trigger behavior, RLS, Storage, or old/new-client compatibility. Broad Snyk and Terrascan are not clean-complete. These are explicit evidence gaps; no scanner result authorizes a migration or real journal operation.
