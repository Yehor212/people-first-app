# Account-Boundary Release Closure Implementation Plan

> **Governance update (2026-08-14):** Execute only an explicitly authorized task and do so SOLO. Any custom-role, council, subagent-driven, or automatic next-task instruction below is retired and must not be executed.

**Goal:** Close every locally actionable evidence gap around account-bound imports, offline writes, sign-in transitions, push ownership, generated Supabase types, and release verification without inventing user or owner evidence.

**Architecture:** Preserve IndexedDB as local truth and the existing owner-bound auth transition coordinator. Treat generated types, external AdMob evidence, browser runtime, native devices, and scanners as separate proof boundaries so a narrow local PASS cannot be promoted into a release claim.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Dexie/IndexedDB, Zustand, Supabase CLI/Postgres, Capacitor 8, Playwright/browser runtime, project evidence scripts.

## Global Constraints

- Do not reset, revert, overwrite, stage, commit, push, or deploy unrelated user changes.
- Do not add mock, demo, sample, seeded, fallback, or synthetic user/product data to production-reachable paths.
- Test-only values may describe protocol boundaries, but they must never be presented as real user, owner-console, readiness, or release evidence.
- Never weaken freshness limits, security checks, RLS ownership, or production-data gates to make a test green.
- First-party behavior changes require a reproduced RED failure before production code changes.
- Generated Supabase types must come from real migrations applied to a local Supabase instance; do not hand-edit them.
- Every final claim must be backed by a fresh command or runtime artifact from this execution.
- No commit is authorized by this plan; the final handoff remains an unstaged working-tree report.

## Execution Ledger — 2026-07-22

### Completed With Fresh Evidence

- Owner evidence cannot silently disappear between marker creation and local purge. The focused transition matrix distinguishes a genuinely local-first install, lost owner evidence, a resumed purge, a stale A marker under B, and a matching A owner.
- Offline-queue lifecycle launches contain rejected processing, emit only privacy-safe diagnostics, retry with a finite `1s / 5s / 15s` budget, and stop scheduling after destruction or account-boundary suspension.
- RAG traversal prunes the generated `output/` tree before directory descent. Three fresh runs completed in `1.96s`, `1.30s`, and `1.33s`; the root `tmp/` tree remains untouched because deletion was not authorized.
- AdMob evidence tests now evaluate historical evidence at a deterministic historical time. This does not refresh or upgrade the actual external readiness ledger.
- The final frozen Vitest run is fresh after the offline-queue repair: `691/691` files passed, `8286` tests passed, `14` todo, exit `0`, and no unhandled teardown error was reported.
- `check:all`, production build, sync contract, production-data-integrity diff/bundle, no-AI-template, best-practices, agent-context, historical agent-governance structure, RAG context, documentation counts, constitution, and migration-prefix checks completed successfully at the stated snapshot. Current governance uses the separate SOLO contract.
- A production-equivalent Chromium settings run passed `13/13` scenarios covering 320px, 150% text, RTL `ar/he`, focus restoration, history, immediate appearance persistence, 44px controls, and horizontal overflow. Clean first-run sessions correctly render onboarding rather than bypassing it.
- The settings reset popover is intentionally a disclosure, not an ARIA menu. The conflicting E2E assertion was aligned with the existing unit contract and W3C disclosure/menu-button requirements; production semantics were not weakened.
- Offline-queue fallback reconciliation no longer treats a legacy browser-storage snapshot as authority over newer IndexedDB truth. Version 3 stores owner-bound exact-operation tombstones, reconciles inside the queue lock and Dexie transaction, preserves newer durable operations, unions pending tombstones while cleanup is unavailable, and fails closed on unreadable or schema-incomplete fallback state. A Pass B counterexample proved that an incomplete tombstone was previously filtered out; the new regression failed `1/61` before the fix and passed `61/61` afterward. The focused account-boundary/handler/package regression run passed `102/102` tests.
- Repository-wide Vitest scripts now exclude generated `output/**` copies. This prevents coverage and CI preflight from discovering duplicate dependency trees inside the 44 GB artifact directory; the regression contract covers the repository-wide `test` and `test:coverage` entry points.
- Fresh coverage artifacts were produced at `2026-07-22T09:15:10-0500`: lines `63.52%`, statements `61.55%`, functions `58.62%`, branches `50.21%`. Coverage percentage is descriptive evidence, not a release-readiness claim.
- Fresh post-repair checks passed: TypeScript, `git diff --check`, and production-data-integrity diff (`errors=0`, `warnings=0`, `scanned=2315`, `reachable=757`).

### Remaining Or Blocked

- **Push A→B delivery fence — decision required.** Remote token-row deletion cannot retract a notification that FCM already accepted under account A, and the current 15-minute TTL permits delayed delivery. A strict fix requires a per-installation generation/drain protocol and one explicit product choice:
  - delay account B admission until the prior installation delivery window closes; or
  - move display behind a generation-validated data/background path and accept platform delivery tradeoffs, plus clear already-delivered A notifications where native APIs permit it.
- **Bounded push RPCs — coupled to the same generation design.** Timing out claim/revoke alone can allow a late server commit or late native unregister to cross the next account generation, so it is unsafe to patch independently.
- **Supabase generated types — environment blocked.** The CLI is available, but local generation cannot run without Docker and linked generation requires Supabase platform authentication. `src/types/supabase.ts` remains unchanged and `check:types-fresh` remains `FAIL`; hand editing is prohibited.
- **Runtime tooling — partial.** The bundled Browser plugin is blocked by an invalid macOS code signature on its `classic-level.node` dependency. Playwright Chromium runtime evidence is fresh; Browser-plugin console/network inspection remains `UNVERIFIED` rather than being promoted from the E2E result.
- **Real multi-context offline serialization — not yet runtime-proven.** Unit tests cover conflicting snapshots, cleanup failure, exact tombstones, and account-boundary suspension. A fresh two-tab Chromium run against the real IndexedDB/Web Locks implementation remains `UNVERIFIED`; unit mocks are not promoted into browser proof.
- Real authenticated backup binding, live multi-device Supabase convergence, Android/iOS/Tauri device behavior, public post-deploy behavior, and human acceptance remain `UNVERIFIED`.

### Closure Sequence Still To Execute

1. Re-run final static, build, production-data, and policy gates against the frozen packet.
2. Hash every task-critical file and attach the exact fresh command ledger.
3. The active agent re-checks every source and claim against that hash-bound packet.
4. Publish a final `PASS / FAIL / UNVERIFIED` matrix and request the one remaining push-architecture decision without staging, committing, pushing, or deploying.

---

### Task 1: Freeze The Evidence Boundary

**Files:**
- Inspect: `AGENTS.md`
- Inspect: `ARCHITECTURE.md`
- Inspect: `docs/ai/AGENT_CHANGE_GOVERNANCE.md`
- Inspect: `docs/ai/DEFERRED_FINDINGS_LEDGER.md`
- Create: `.preflight-token` only if the existing token does not cover this exact task and current timestamp

**Interfaces:**
- Consumes: current dirty checkout and Free RAG `sync_auth` citations
- Produces: exact task-file list, status snapshot, routing ledger, and fresh edit authorization token

- [ ] Run `npm run rag:preflight -- "Продолжить незавершённое доказательное закрытие account-boundary, imported backup, offline queue, push, Supabase types, полный тестовый gate без mock demo sample production data"` and require exit 0.
- [ ] Run `git status --short`, `git diff --check`, and task-scoped `git diff --stat`; preserve every unrelated change.
- [ ] Record the SOLO task boundary, platform/domain impact, and file/risk evidence.
- [ ] Hash the final task packet before closure; do not use a prior report as proof.

### Task 2: Diagnose The Three Full-Suite Failures

**Files:**
- Inspect/Test: `scripts/__tests__/admob-external-readiness.test.ts`
- Inspect/Test: `scripts/__tests__/rag-preflight.test.ts`
- Inspect: the production scripts imported by those tests

**Interfaces:**
- Consumes: prior full-suite result with two stale AdMob assertions and one RAG timeout
- Produces: one root-cause statement per failure and an isolated reproducible command

- [ ] Run `npx vitest run scripts/__tests__/admob-external-readiness.test.ts scripts/__tests__/rag-preflight.test.ts --exclude 'output/**' --reporter=verbose --testTimeout=30000`.
- [ ] Read the complete failure stacks and trace each failing value to its source file.
- [ ] Compare isolated and full-suite timing; do not assume the timeout is a product defect if the isolated test remains below its declared budget.
- [ ] For AdMob, separate evaluator semantics from mutable external evidence. A real owner-console row that is older than 14 days must remain stale.

### Task 3: Repair Only Confirmed Test Or Implementation Defects

**Files:**
- Modify/Test: exact files identified by Task 2 only

**Interfaces:**
- Consumes: confirmed root cause from Task 2
- Produces: deterministic evidence semantics and/or bounded RAG runtime with no weakened gate

- [ ] Write or adjust the smallest regression test and run it to observe the expected RED failure.
- [ ] Apply one minimal change with `apply_patch`; do not bundle unrelated cleanup.
- [ ] Rerun the exact RED command and require GREEN.
- [ ] Rerun the sibling evidence-script tests to detect contract regressions.
- [ ] If the correct outcome is that external AdMob evidence is stale, keep the external readiness status `UNVERIFIED` and change only an invalid test assumption, never the evidence record.

### Task 4: Regenerate Supabase Types From Real Migrations

**Files:**
- Generated: `src/types/supabase.ts`
- Inspect: `supabase/config.toml`
- Inspect: `supabase/migrations/20260718150000_owner_bound_push_revoke.sql`

**Interfaces:**
- Consumes: repository migrations and a real local Supabase/Postgres runtime
- Produces: schema-derived TypeScript definitions whose timestamp/content follows the newest migration

- [ ] Run `npx supabase --version`, `npx supabase gen types --help`, and check Docker daemon availability.
- [ ] If Docker is installed but stopped, start Docker Desktop and poll `docker info` with a bounded wait.
- [ ] Run `npx supabase start` and require migrations to apply successfully.
- [ ] Generate `src/types/supabase.ts` with the CLI's documented local mode; review the diff for schema changes and secret leakage.
- [ ] Run `npm run check:types-fresh`, `npm run check:supabase-migration-prefixes`, and TypeScript compilation.
- [ ] If local Supabase cannot run, leave the generated file unchanged and report the exact blocker as `UNVERIFIED`.

### Task 5: Triage Security Findings By Reachable Data Flow

**Files:**
- Inspect/Test: `src/lib/authTransitionCoordinator.ts`
- Inspect/Test: `src/lib/__tests__/authTransitionCoordinator.test.ts`
- Inspect/Test: `scripts/run-shared-dist-build.mjs`
- Inspect/Test: its existing script tests or a new focused contract test

**Interfaces:**
- Consumes: Snyk findings for BroadcastChannel origin handling and three path inputs
- Produces: confirmed defect with RED/GREEN fix, or a bounded false-positive/mitigated finding ledger

- [ ] Verify BroadcastChannel same-origin platform semantics against current authoritative documentation and the local origin rejection test.
- [ ] Trace every path accepted by `run-shared-dist-build.mjs` from source to filesystem sink, including symlink and traversal behavior.
- [ ] If a reachable traversal exists, first add a failing test for escaping the allowed root, then canonicalize and enforce the allowed root before filesystem access.
- [ ] Run the focused security tests and a scoped security scan. Keep Checkov/Trivy/Snyk gaps `UNVERIFIED` when tooling or network prevents a clean run.

### Task 6: Re-run Local Product And Data Gates

**Files:**
- Verify only; modify nothing unless a new reproducible defect is found

**Interfaces:**
- Consumes: Tasks 2–5 outputs
- Produces: fresh local PASS/FAIL counts

- [ ] Run the 12-file account-bound focused Vitest command and require 258/258.
- [ ] Run broader account/auth/storage blast-radius tests selected from the actual import/dependency closure.
- [ ] Run full Vitest with `--exclude 'output/**'`; report exact files and test counts.
- [ ] Run `npm run check:all` and `npm run build` separately.
- [ ] Run `npm run check:sync-contract`, `npm run check:production-data-integrity:diff`, `npm run check:production-data-integrity:bundle`, `npm run check:no-ai-templates`, `npm run check:best-practices`, `npm run check:agent-context`, `npm run check:solo-agent-governance`, `npm run doc-counts`, and `npm run constitution:check`.
- [ ] Run `git diff --check` after all edits.

### Task 7: Verify Runtime Without Synthetic User History

**Files:**
- Runtime route: local production-equivalent `/people-first-app/settings?nav=v2&navLayout=phone`
- Runtime route: public canonical route only if deployed-behavior proof is explicitly needed

**Interfaces:**
- Consumes: fresh production build and an empty/real browser state
- Produces: screenshots, console/network observations, and a bounded Web/PWA result

- [ ] Start the production-equivalent preview from the current checkout and verify the no-data unauthenticated flow, reload, and settings navigation.
- [ ] Check console errors, failed requests, overflow, keyboard focus, and responsive widths without injecting fake account history.
- [ ] Do not import a fabricated backup. Real import-to-auth and same-account cloud convergence remain `UNVERIFIED` until a real user-provided backup and interactive sign-in are available.
- [ ] Do not claim Android, iOS, or Tauri device PASS without fresh device/runtime evidence.

### Task 8: Independent Closure And Honest Handoff

**Files:**
- Inspect: final task packet only
- Modify: none unless a reviewer identifies a reproducible defect

**Interfaces:**
- Consumes: hash-bound final diff, fresh command outputs, and runtime artifacts
- Produces: final SOLO verification verdict and evidence ledger

- [ ] Map each explicit and implied requirement to direct local evidence or `UNVERIFIED`.
- [ ] Verify packet integrity, missing stakeholders/platforms, and proof-laundering risks.
- [ ] Re-check every prior claim against files or command output.
- [ ] Report `PASS`, `FAIL`, and `UNVERIFIED` separately for Web/PWA, Android, iOS, Desktop, accessibility/i18n, security/privacy, performance/reliability, production-data integrity, testing, and release readiness.
- [ ] List all task-critical untracked files. Do not stage, commit, push, or deploy without a separate user instruction.

## Risks And Mitigations

- **Dirty checkout contamination:** use task-scoped diffs and hashes; never reset or bulk-format unrelated files.
- **Freshness laundering:** external evidence remains stale until genuinely recollected; deterministic test evaluation cannot renew it.
- **Generated-file drift:** regenerate from real local migrations only; manual edits are prohibited.
- **Scanner false confidence:** a failed/unavailable scanner is `UNVERIFIED`, while a finding requires reachable-flow triage.
- **Runtime data fabrication:** verify empty/no-data behavior and wait for real user inputs for account-bound scenarios.
- **Cross-platform overclaim:** static contracts are not device proof; label each platform separately.

## Done Criteria

- [ ] Every locally reproducible test failure is fixed or has a documented non-code blocker.
- [ ] Generated Supabase types are fresh or unchanged with an exact environment blocker.
- [ ] No confirmed high-severity security finding remains open in the task scope.
- [ ] Production-data-integrity checks show no production-reachable synthetic data introduced by this work.
- [ ] Final full-suite and build outputs are fresh and include exact counts.
- [ ] The active agent verifies the final evidence packet against current sources and commands.
- [ ] Remaining external, authenticated, native, public-deploy, or human-acceptance proof is explicitly `UNVERIFIED`.

## UNVERIFIED Until Freshly Proven

- AdMob owner-console readiness and public evidence newer than the 14-day window.
- Real backup import followed by authenticated account binding.
- Live multi-device Supabase convergence and push ownership on real accounts.
- Android, iOS, and Tauri device runtime.
- Public GitHub Pages behavior after an authorized deployment.
- Human acceptance, visual preference, and production telemetry impact.
