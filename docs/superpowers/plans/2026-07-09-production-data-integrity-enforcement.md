# Production Data Integrity Enforcement Implementation Plan

> **Execution owner:** Codex in this checkout on `codex/production-data-integrity`.
> **Process:** execute in the current session with test-first evidence and fresh verification before any completion claim.

**Goal:** Prevent test doubles, plausible synthetic user history, deceptive fallbacks, and fake verification evidence from reaching ZenFlow production runtime, persistence, sync, analytics, exports, release artifacts, or required-check evidence while preserving isolated test and developer fixtures.

**Architecture:** Add a deterministic Node checker built on the installed TypeScript compiler API. It classifies paths, builds an explainable production dependency graph from the real Vite/PWA/Capacitor/Tauri/Supabase entrypoints, applies high-confidence AST and source/sink rules, validates exact baselines and expiring waivers, and scans built artifacts for a fixture canary. A separate Codex hook provides early feedback; a no-secrets GitHub Actions job named `production-data-integrity` is the repository gate. The no-AI-template gate stays separate.

**Stack:** Node 22+, TypeScript 5.8 compiler API, Vitest, Git, Vite, GitHub Actions, Codex project hooks.

## Grounded scope

### Explicit requirements

- Canonical policy, ADR-0010, configuration, exact baseline, waiver ledger, checker, Codex hook, package scripts, CI job, contract tests, PR/CODEOWNERS/routing integration, and bundle canary.
- Stable rules PDI001–PDI012, high-confidence blocking, stable JSON, exit codes 0/1/2, and `all`, `diff`, and `staged` modes.
- Production reachability through static imports, re-exports, resolvable dynamic imports, aliases, and JSON.
- No execution of scanned code, no `eval`, bounded reads, root/symlink protection, argument-array subprocesses, and no PII/source upload.
- Fresh local evidence and an honest `UNVERIFIED` ledger for remote settings and unavailable scanners.

### Safe implied requirements

- Remove the incomplete hidden production demo toggle and orphaned plausible demo history instead of baselining them. They have no visible demo banner, separate namespace, sync isolation, or live product consumer.
- Ratchet package scripts, hook registration, workflow semantics, tests, baseline/waivers, and rule severity—not only application files.
- Treat Web/PWA, Android, iOS, and Desktop as consumers of the same Vite artifact, while scanning Supabase Functions and migrations as independent production entry surfaces.
- Scan generated release evidence/readiness JSON narrowly; ordinary documentation prose is not runtime data.

### Platform matrix

| Surface | In-scope control | Required evidence | Remaining boundary |
| --- | --- | --- | --- |
| Web / PWA | `src/main.tsx`, `src/sw.ts`, Vite graph, `dist/` | checker + production build + canary | deployed URL unchanged |
| Android / iOS | shared `dist/`, Capacitor/native source paths | bundle scan + config classification | device/store proof `UNVERIFIED` |
| Desktop | shared `dist/`, Tauri Rust/config paths | bundle scan + native classification | signed installer `UNVERIFIED` |
| Supabase | function `index.ts` entries and migrations | AST/SQL source/sink rules | live database unchanged |
| Accessibility / RTL | no visible replacement or new copy | focused component/type checks | no new layout |
| Performance | tooling-only checker | measured all/diff/staged times | unresolved imports warn |
| Security / privacy | deterministic local analysis | security suite/Snyk fallback | in-repo separation limit |
| Release / operations | unique required-check candidate | workflow contract | branch protection `UNVERIFIED` |

## Local evidence

- `index.html` loads `src/runtime-perf-bootstrap.js` and `src/main.tsx`; Vite injects `src/sw.ts`; `@` resolves to `src`.
- Capacitor and Tauri ship `dist`, so fixture leakage affects every client platform.
- Supabase functions use per-function `index.ts` entrypoints; current migrations contain legitimate configuration seeds that must not be mistaken for user-history seeds.
- `src/lib/demoData.ts` contains dated moods, habits, focus sessions, gratitude, profile statistics, and current-time identifiers. Only its test imports it today.
- `src/hooks/useDemoMode.ts` is reachable from both settings implementations and persists `zenflow-demo-mode` after five version taps without the required product contract.
- Existing Codex hooks cover skill routing and no-AI-template output, but no production-data integrity boundary.
- Workflow convention pins checkout/setup-node to full SHAs and uses `contents: read` by default.
- `constitution:check` has pre-existing source/test/CSS/component drift; this work must not relabel that baseline.

## Decision inputs

| Option | Decision | Reason |
| --- | --- | --- |
| Regex-only | Reject | No syntax context, graph, or rename-resistant evidence |
| ESLint rule | Reject as primary | File-centric; awkward SQL, artifacts, staged modes, and baselines |
| TypeScript AST only | Partial | Good precision but no shipped-entry context |
| AST + production graph | Select core | Cross-file reachability with installed compiler and no new dependency |
| Semgrep taint | Optional audit | Community engine is not a complete, always-available interfile TS gate |
| Bundle scan | Select defense-in-depth | Detects shipped canary but cannot replace source analysis |
| Combined system | Select | Best local precision/recall with CI as final repository-local boundary |

## Threat model

| Asset / boundary | Failure path | Impact | Control | Verification | Residual risk |
| --- | --- | --- | --- | --- | --- |
| User-history integrity | fixture through direct/barrel/alias/JSON/two-hop import | fabricated records shown or stored | PDI001/PDI002 graph + AST | adversarial imports | computed imports |
| Failure honesty | catch returns plausible records or success | hidden outage, false user trust | PDI003/PDI005 branch rules | catch/promise/ternary cases | complex wrappers |
| Local/cloud truth | synthetic record reaches Dexie/Zustand/queue/backup/Supabase | durable, cross-device contamination | PDI004 source/sinks | Dexie/Supabase/queue tests | reflection/encoding |
| Analytics/export/share | fake facts leave device/report | corrupt metrics/evidence | PDI007 sinks | analytics/export/share cases | external SDK behavior |
| Production DB | migration seeds user tables | fake rows at scale | table-aware PDI008 | allow config seeds/block user seeds | dynamic SQL |
| Shipped artifact | fixture bundled after source check | all client platforms leak it | sentinel PDI009 | positive/negative canary | unknown markers |
| Enforcement | app and verifier weakened together | false clean | PDI010 contracts + behavior tests | mutation cases | same-writer limit |
| Release evidence | readiness claims PASS without command/hash/time | unsafe release confidence | PDI011 structure | readiness cases | human intent |
| Waivers | wildcard/expired/agent approval | permanent bypass | exact schema + dates/issue/human | adversarial ledger tests | remote identity |
| Availability | parser/config/internal error becomes clean | silent loss | exit 2 and fail-closed hook/CI | internal-error tests | resource exhaustion |
| Repository input | symlink escape or huge file | exfiltration/DoS | realpath containment + byte caps | security fixtures | many-small-file DoS |

## Test-first execution

### 1. Checker and workflow RED tests

**Create:**
- `scripts/__tests__/production-data-integrity.test.ts`
- `scripts/__tests__/production-data-integrity-workflow.test.ts`

Add temporary-repository fixtures for allowed test mocks/timers/factories, isolated previews, product templates, honest empty fallbacks, visual randomness, test SQL/JSON; and blocking PDI001–PDI012, graph/barrel/alias/JSON, BOM/CRLF/path normalization, baselines, waivers, internal errors, stable ordering, and bundle leakage. Add workflow assertions for triggers, permissions, pinned actions, unique job name, real invocation, and absence of path/job skips, `continue-on-error`, and `|| true`. Run only these files and record RED because the artifacts do not exist.

### 2. Hook RED tests

**Create:** `scripts/__tests__/production-data-integrity-hook.test.ts`

Exercise UserPromptSubmit, PreToolUse, PostToolUse, Stop, SubagentStart, and SubagentStop through JSON stdin. Cover neutral prompts, malformed input, tampering, findings, internal error, recursion guard, JSON-only stdout, and evidence-incomplete PASS/GO. Record RED before the hook exists.

### 3. Checker core and canonical ledgers

**Create:**
- `scripts/production-data-integrity/core.cjs`
- `scripts/check-production-data-integrity.cjs`
- `config/production-data-integrity.json`
- `config/production-data-integrity-baseline.json`
- `config/production-data-integrity-waivers.json`

Validate schemas first; contain paths/symlinks; normalize BOM/newlines/case comparisons; build the TS graph; classify production/test/dev/generated/docs/enforcement; implement PDI001–PDI012 with only high-confidence blocks; implement exact structural fingerprints, all/diff/staged selection via argument-array Git calls, bounded bundle scanning, stable output, and exit 0/1/2. Run focused tests GREEN and measure performance.

### 4. Remove latent unsafe demo surfaces

**Delete:**
- `src/lib/demoData.ts`
- `src/lib/__tests__/demoData.test.ts`
- `src/hooks/useDemoMode.ts`
- `src/hooks/__tests__/useDemoMode.test.ts`

**Modify:**
- `src/components/settings/AboutSection.tsx`
- `src/pages/nav-v2/settings/V2SettingsAboutPanel.tsx`
- `src/lib/storageKeys.ts`
- demo translation contract entries only if proven dead

First extend settings tests to prove version activation cannot persist demo state. Then remove imports, flag, hidden tap handler, and orphan history while retaining accessible version/update behavior. Run focused settings/storage/i18n checks and the full PDI scan.

### 5. Separate Codex hook

**Create:** `.codex/hooks/production-data-integrity-gate.cjs`
**Modify:** `.codex/hooks.json`

Use official payload fields and JSON-only stdout where required. Inject only for relevant tasks; guard enforcement patches; run fast diff checks after relevant writes; run final diff/staged scan on Stop; block findings/internal errors; honor `stop_hook_active`; enforce the subagent evidence packet; configure bounded timeouts and no state. Run hook tests GREEN.

### 6. Package, CI, review, and enforcement wiring

**Modify/Create:**
- `package.json`
- `.github/workflows/production-data-integrity.yml`
- `.github/workflows/drift-checks.yml`
- `.github/workflows/deploy.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/CODEOWNERS`
- `scripts/check-enforcement-health.ts`
- `scripts/check-agent-context.mjs`

Add all/diff/staged/bundle scripts; source check before expensive preflight work and bundle check after build. The separate workflow runs on PR/push main, merge_group, and dispatch with `contents: read`, no secrets/path filter/job condition, pinned checkout/setup-node, install, scan, build, and canary. Its only exact job name is `production-data-integrity`. Add drift/context/reviewer contracts and use only the existing CODEOWNER.

### 7. Policy and ADR

**Create:**
- `docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md`
- `docs/adr/0010-production-data-integrity-enforcement.md`

**Modify:**
- `docs/adr/README.md`
- `AGENTS.md`
- completion/release docs only where a contract requires them

Keep full operational policy in one document and short routing in AGENTS. ADR-0010 records alternatives, official/local evidence, false-positive/negative strategy, rollback, separation-of-duties, and limitations. Policy covers allowed doubles, product-content distinction, demo contract, rules, baseline/waivers, incident response, and review. Consume the one-time AGENTS unlock only for the authorized edit.

### 8. Final verification and review reconciliation

Run focused suites, all/diff/staged, canary, no-AI-template, best-practices, enforcement, agent-context, task-completion, typecheck, lint, relevant Vitest, build, and `ci:preflight` when feasible. Run the mandated security suite and Snyk/fallback. Measure times, prove tooling is not imported into the app, rerun count/constitution checks, and separate new results from the recorded baseline. Verify every accepted specialist claim directly.

## Acceptance / stop conditions

- **Accept:** all required local artifacts exist; adversarial suites pass; checker/hook fail closed; exact ledgers validate; source and bundle scans pass; CI contract is deterministic; existing gates are not weakened.
- **Stop:** any new high-confidence production synthetic data remains; errors return clean; CI can skip/ignore the job; changed code has an unresolved scanner finding; counts/contracts made stale by this change.
- **UNVERIFIED by design:** remote branch protection/status requirement, human approval identity, Codex hook re-trust, external service behavior, signed/store/native artifacts, and public deployment.
