# Tasks: Agent Governance Evidence

**Input**: Design documents in
`/Users/yehor/Projects/ZenFlow/worktrees/codex-agent-routing-ab-eval/specs/003-agent-governance-evidence/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`,
`contracts/local-observation-receipt.md`, `quickstart.md`, and both requirement
checklists.

**Tests**: Required. This protected behavior change follows the repository
test-first route: named regression controls must fail before source changes, then
pass after the scoped implementation.

## Phase 1: Specification And Safe Setup

**Purpose**: Freeze the bounded problem statement and ensure all implementation
work is traceable to an approved local scope.

- [x] T001 Record the protected write set, all-five-product-platform `N/A` reasons, Codex-host `UNVERIFIED` boundaries, rollback, and explicit no-commit/no-push limit in `specs/003-agent-governance-evidence/{spec.md,plan.md,research.md,data-model.md,contracts/local-observation-receipt.md,quickstart.md}`.
- [x] T002 Validate Feature 003 requirement quality with `specs/003-agent-governance-evidence/checklists/{requirements.md,governance.md}` and retain the `PROPOSED` constitution status as nonbinding context.

---

## Phase 2: Foundational RED Evidence (Blocking)

**Purpose**: Add the smallest focused regressions and capture their expected
pre-change failures before changing production governance tooling.

**⚠️ CRITICAL**: No source/hook implementation task begins until T003–T007 are
complete and fresh test-first / skill-routing evidence exists.

- [x] T003 [P] Add default-no-write and nested-Git-root negative controls to `scripts/__tests__/skill-routing-hook-payload.test.ts` for `.codex/hooks/skill-router-gate.cjs` (FR-001, FR-003, SC-001).
- [x] T004 [P] Add strict local-observation receipt, default-stdout, duplicate, path-escape, symlink, and forbidden-field negative controls in `scripts/__tests__/agent-governance-observation.test.mjs` before `scripts/persistent-agent-orchestra/governance-observation-core.mjs` exists (FR-002–005, SC-002–003).
- [x] T005 [P] Add task-slice mutation, output-actor mismatch, and self-attested `PROMOTABLE` rejection controls to `scripts/__tests__/agent-routing-ab-eval.test.mjs` (FR-006–009, SC-004–005).
- [x] T006 [P] Add one-shot timeout/process-error path-safety controls to `scripts/__tests__/production-data-integrity-hook.test.ts` (FR-012, SC-006).
- [x] T007 Run the four focused suites and record actual RED/baseline results plus full Spec Kit skill routing in an ignored fresh `.preflight-token` before editing `.codex/hooks/` or `scripts/` (FR-011).

**Checkpoint**: Exact pre-change behavior is captured. A test that unexpectedly
passes must be investigated and recorded as a baseline, never called RED.

---

## Phase 3: User Story 1 — Side-Effect-Free Routine Hooks And Explicit Local Observation (Priority: P1) 🎯 MVP

**Goal**: Ordinary hook processing leaves no hidden audit file, while an operator
can deliberately observe one bounded local subprocess without confusing it with
host evidence.

**Independent Test**: Read-only, unguarded, guarded, and blocked controlled
events do not create/modify `.codex-audit.log`; the explicit command emits only
an allowlisted local receipt to stdout and only safely creates a receipt when an
operator asks for a new in-root output path.

- [x] T008 [US1] Remove automatic audit-file mutation and add bounded Git-root resolution in `.codex/hooks/skill-router-gate.cjs`, preserving its current deterministic allow/block contract (FR-001, FR-003).
- [x] T009 [US1] Implement strict receipt validation and a `0600`, symlink-rejecting, create-only output writer in `scripts/persistent-agent-orchestra/governance-observation-core.mjs` according to `contracts/local-observation-receipt.md` (FR-002–005).
- [x] T010 [US1] Implement stdout-first controlled observation CLI in `scripts/run-agent-governance-observation.mjs` and expose only its explicit local command through `package.json` (FR-002–005).
- [x] T011 [US1] Run `scripts/__tests__/skill-routing-hook-payload.test.ts` and `scripts/__tests__/agent-governance-observation.test.mjs` after T008–T010; ensure output failure does not alter independently evaluated hook decisions (FR-001–005, SC-001–003).

**Checkpoint**: User Story 1 works independently without touching product,
native, generated-role, or remote surfaces.

---

## Phase 4: User Story 2 — Honest Local Versus Host Evidence (Priority: P1)

**Goal**: A local routing report detects identity/actor drift and cannot elevate
self-authored local facts into an installed-host/promotion claim.

**Independent Test**: Mutating retained task fields with an old digest, naming an
undeclared output actor, or setting local fields to `VERIFIED` fails validation or
stays explicitly non-promotable.

- [x] T012 [US2] Centralize canonical task-slice serialization/hash calculation and reject mismatched retained task content in `scripts/persistent-agent-orchestra/routing-ab-core.mjs` (FR-006, FR-007).
- [x] T013 [US2] Bind every completed output actor exactly to its arm execution identity and make the local validator reject `PROMOTABLE` / preserve each unavailable prerequisite in `scripts/persistent-agent-orchestra/routing-ab-core.mjs` (FR-008–010).
- [x] T014 [US2] Refactor `scripts/run-agent-routing-ab-eval.mjs` to use the core canonical task-slice identity path and keep raw-output hashing as an independent file-content check (FR-006, FR-011).
- [x] T015 [US2] Run `scripts/__tests__/agent-routing-ab-eval.test.mjs` and `npm run check:agent-orchestra:eval`; confirm current local validation does not recast structure as host proof and retain historical receipt compatibility as `UNVERIFIED` because no safe fixture is available (FR-006–010, SC-003–005).

**Checkpoint**: User Story 2 prevents local structure from selecting a routing
policy but preserves the existing ten-role catalog and nonpromotion reporting.

---

## Phase 5: User Story 3 — Conservative A/B Promotion Boundaries (Priority: P2)

**Goal**: Metrics and health reporting keep host runtime/policy promotion unknown
unless separate authoritative evidence exists.

**Independent Test**: Metrics/health source and integration checks no longer rely
on a hidden audit log, and they still state runtime loading/effective permissions
as `UNVERIFIED`.

- [x] T016 [US3] Replace implicit `.codex-audit.log` parsing with static registration and explicit evidence-boundary output in `scripts/enforcement-metrics.ts` and align the audit boundary in `scripts/check-enforcement-health.ts` (FR-001, FR-004, FR-008–009).
- [x] T017 [US3] Update the expected enforcement contract in `scripts/__tests__/codex-agent-orchestra-integration.test.mjs` without weakening its structural role/registration assertions (FR-010–011).
- [x] T018 [US3] Run the enforcement-focused test(s), `npm run enforcement:check`, and `npm run check:agent-orchestra`; retain actual-host evidence as `UNVERIFIED` (FR-004, FR-008–011).

**Checkpoint**: No metric treats an ignored automatic log, registration count, or
local receipt as profile-load/effective-permission proof.

---

## Phase 6: User Story 4 — Bounded Integrity Failure Feedback (Priority: P2)

**Goal**: A delayed checker has a safe, one-shot, fail-closed lifecycle result
instead of exposing local executable paths or spending the full outer timeout.

**Independent Test**: Controlled child timeout/error returns a stable path-free
block with the manual checker command, runs one child attempt, and preserves the
existing recursion guard.

- [x] T019 [US4] Add a testable bounded checker-result classifier and timeout budget reserve in `.codex/hooks/production-data-integrity-gate.cjs`, retaining a single fail-closed run with no retry (FR-012).
- [x] T020 [US4] Run `scripts/__tests__/production-data-integrity-hook.test.ts` and the relevant hook syntax check; confirm findings remain distinct from internal timeout/error classifications (FR-012, SC-006).

**Checkpoint**: The original user-visible failure class is remediated only in
local source/test scope; its historical host cause remains `UNVERIFIED`.

---

## Phase 7: Cross-Cutting Verification And Convergence

**Purpose**: Verify the governed diff, record proof limits, and conclude Feature
003 without a release/promotion claim.

- [x] T021 Update `specs/003-agent-governance-evidence/{analysis.md,convergence.md}` with requirement-to-task-to-evidence traceability, role-routing dispositions, Role 10 isolation limitation, platform/domain matrix, rollback, and unresolved `UNVERIFIED` ledger (FR-013).
- [x] T022 Run `node --check` for modified CommonJS/ESM scripts; focused suites; `npm run test:agent-orchestra`; `npm run check:agent-orchestra`; `npm run check:agent-orchestra:eval`; `npm run check:agent-context`; `npm run enforcement:check`; `npm run check:no-ai-templates`; `npm run check:best-practices`; and `npm run check:production-data-integrity:diff` (FR-011–013).
- [x] T023 Run the narrow local security profile and `npm audit --audit-level=high`; distinguish unavailable credentials/network scanning from actual clean findings (FR-003–009, FR-012).
- [x] T024 Review `git diff --check`, final diff, and `git status --short`; verify the write set excludes `src/`, native folders, generated role files, remote/deploy surfaces, secrets, output receipts, and user-local `.codex-audit.log`; do not stage/commit/push/merge/deploy (FR-013, SC-007).
- [x] T025 [US2] Add a RED→GREEN regression that rejects `PILOT_COMPLETED` when any completed arm records zero invocations; retain actor provenance as `UNVERIFIED` without a trusted host receipt (FR-014).
- [x] T026 [US2] Add a RED→GREEN terminal cancellation receipt that permits `PILOT_INTERRUPTED` only with an `INTERRUPTED` arm and a non-promotable decision; reject missing interruption state (FR-015).

---

## Dependencies And Execution Order

1. T001–T002 establish the scoped contract.
2. T003–T007 are blocking test-first evidence.
3. T008–T011 deliver the P1 no-write/explicit-observation MVP.
4. T012–T015 harden report integrity and promotion boundaries.
5. T016–T018 remove misleading metrics/health dependency.
6. T019–T020 retain PDI fail-closed behavior with safe timeout classification.
7. T021–T026 converge, verify, and audit the resulting bounded diff.

## Parallel Opportunities

- T003–T006 target distinct test files and can be authored in parallel, but their
  RED execution must precede all source/hook changes.
- T012/T014 and T016/T017 should remain sequential within their file pairs to
  avoid conflicting contract expectations.
- The PDI phase is logically independent after T006 but is kept after P1/P2 so
  the final test-first token covers the complete protected write set.

## Implementation Strategy

1. Deliver User Story 1 first: it directly fixes the user-visible hidden-file
   surprise without relying on actual PWA, Tauri, or host-runtime claims.
2. Add the local-evidence and A/B validator constraints before altering metrics;
   no report can then falsely promote a policy.
3. Apply the bounded PDI fix after its focused regression establishes the intended
   fail-closed result.
4. Stop after final verification; this task has no authorization for publication,
   role-policy promotion, commit, push, merge, or release.
