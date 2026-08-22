# Convergence: Agent Governance Evidence

**Local implementation status**: `LOCAL_IMPLEMENTATION_VERIFIED`  
**M2 / release / routing-policy promotion**: `STOP`  
**Commit, push, merge, deploy**: not performed.

## What was implemented

1. Removed routine `.codex-audit.log` mutation from the skill-routing hook and
   made its repository-root lookup bounded and independent of the caller's
   nested working directory.
2. Added `npm run ai:agent-governance:observe-local`: an operator-invoked,
   stdout-first local observation command. Optional receipt output is constrained
   to a create-only, `0600`, symlink-rejecting path below
   `output/agent-orchestra/`.
3. Hardened the local A/B evaluator: it recomputes task identity, requires an
   exact actor set, preserves unavailable prerequisites, and cannot return a
   locally self-attested `PROMOTABLE` decision. A completed arm must also record
   at least one invocation; output hashes remain local file-byte, not actor,
   provenance.
   A cancelled comparison now has a non-promotable `PILOT_INTERRUPTED` terminal
   receipt, which does not treat partial output or review as completed evidence.
4. Replaced audit-log-derived enforcement metrics with explicit evidence
   boundaries: routine audit writes are disabled; host runtime loading and
   effective permissions remain `UNVERIFIED` without a separate trusted receipt.
5. Bounded PDI root discovery to 1.5 seconds and its one checker attempt to 10
   seconds inside the configured 20-second Stop hook budget. Timeout, process,
   malformed-result, and unexpected-status errors fail closed without exposing
   local paths or raw status text.

## Test-first and verification ledger

| Check | Result | Scope / note |
|---|---|---|
| Initial focused RED | expected failure | 14 failures before implementation: no-write/root, A/B binding/promotion, observation, and PDI controls |
| Incremental PDI RED | expected failure | 1 failure showed `/private/zenflow/node` from an unexpected checker status |
| Incremental A/B RED | expected failure | 1 failure showed that a zero-invocation completed arm had validated |
| Incremental cancellation RED | expected failure | 2 failures showed that an `INTERRUPTED` arm had no valid terminal receipt |
| Focused GREEN | PASS | 5 files, 66 tests passed |
| `npm run test:agent-orchestra` | PASS | 10 files, 468 tests passed; its chained workspace suite completed successfully |
| `npm run test:agent-workspace` | PASS | completed successfully |
| `npm run typecheck` | PASS | local TypeScript check |
| `npm run lint` | PASS | configured repository lint command |
| `eslint --no-ignore` on modified JS/CJS/MJS | PASS | syntax/style scope outside ignored TypeScript scripts |
| TypeScript-script no-ignore ESLint | UNVERIFIED | repository ESLint project configuration excludes the affected `scripts/*.ts` files; this is a parser-scope limitation, not treated as a pass |
| `node --check` modified JS/CJS/MJS | PASS | local syntax validation |
| `npm run check:agent-orchestra` | PASS | exactly ten structural roles; runtime loading/permissions remain `UNVERIFIED` |
| `npm run check:agent-orchestra:eval` | PASS | 40 scenarios; no semantic, runtime, human, or token proof implied |
| `npm run check:agent-context` | PASS | current context contract check |
| `npm run enforcement:check` | PASS | 50 PASS, 0 FAIL, 2 expected `UNVERIFIED` boundaries (52 total) |
| `npm run check:no-ai-templates` | PASS | governance/output drift check |
| `npm run check:best-practices` | PASS | 66 checks |
| `npm run check:production-data-integrity:diff` | PASS | errors=0, warnings=0, scanned=1865, reachable=783 |
| `npm run ai:agent-governance:observe-local` | PASS | one `LOCAL_PROCESS_OBSERVED` receipt to stdout; no output file requested |
| Narrow security suite | UNVERIFIED | suite completed, but Snyk code/agent scans lacked `SNYK_TOKEN`; no credential or network finding is fabricated |
| `npm audit --audit-level=high` | FAIL | inherited dependency advisories: high `brace-expansion` and `fast-uri`, plus moderate `undici`; no dependency update was authorized or made |

## Role-routing ledger

| Role | Disposition | Evidence boundary |
|---|---|---|
| 1 coordinator | SELECTED | performed scoped implementation and independently reran local checks |
| 2 human factors | EXCLUDED | no user-facing wellbeing, agency, interruption, or clinical change |
| 3 logic/state | SELECTED | exposed zero-invocation and unreachable-cancellation counterexamples; T025–T026 fixed those local invariants, while host actor provenance remains `UNVERIFIED` |
| 4 accessibility/i18n | EXCLUDED | no UI, copy, locale, or RTL surface changed |
| 5 architecture/cross-platform | SELECTED | governance-only boundary and product-platform N/A matrix reviewed |
| 6 security/privacy | SELECTED | path disclosure, receipt confinement, and no-promotion boundary reviewed |
| 7 reliability/operations | SELECTED | timeout budget, no implicit mutation, and one-shot behavior reviewed |
| 8 QA/evidence | SELECTED | test-first and evidence/claim boundaries reviewed |
| 9 product/visual | EXCLUDED | no product, visual, or motion surface changed |
| 10 independent sentinel Pass A | SELECTED, `STOP` | runtime isolation was not demonstrated; the pass inspected a different legacy root, so it cannot close M2 or authorize promotion |
| 10 independent sentinel Pass B | pending final packet | must be treated as `UNVERIFIED` unless its runtime isolation and packet integrity are independently demonstrated |

Specialist outputs informed the test matrix but were not accepted as proof by
themselves; current source and local command results above were independently
checked in the dedicated worktree.

## Product-platform matrix

| Target | Status | Reason |
|---|---|---|
| Web/Vite | N/A | no `src/`, route, browser runtime, or Vite code changed |
| Installed PWA | N/A | no service worker, manifest, cache, or browser asset changed |
| Android/Capacitor | N/A | no Android, Capacitor, safe-area, or native-bridge file changed |
| iOS/WKWebView | N/A | no iOS, WebView, or native-bridge file changed |
| Desktop/Tauri | N/A | no `src-tauri/` or desktop runtime code changed |
| Codex host macOS | UNVERIFIED | local subprocess proof is not host lifecycle/profile/permission proof |
| Codex host Windows/Linux | UNVERIFIED | code is cross-platform-shaped but no host lifecycle test was run |

## Remaining blockers and rollback

- The observed historical PDI timeout's precise root cause is still
  `UNVERIFIED`; the implemented bounded, fail-closed classifier avoids relaying
  its raw child-process text but does not retroactively attribute the incident.
- Role 10 runtime isolation, actual Codex profile loading, effective
  permissions, lifecycle scheduling, semantic role quality, qualified review,
  holdout, usage data, token cost, remote branch protection, and public/native
  release behavior remain `UNVERIFIED`.
- Historical ignored A/B receipt compatibility is `UNVERIFIED`: no safe fixture
  was supplied, so this feature does not rewrite, migrate, or validate private
  past receipts.
- `npm audit --audit-level=high` is a real `FAIL`; resolving it would require a
  separately authorized dependency remediation because this feature does not
  alter dependency versions.
- Roll back only the Feature 003 diff on `codex/agent-routing-ab-eval`. Preserve
  pre-existing ignored audit/output files and Feature 002 artifacts; do not use
  reset, clean, or history rewrite.
