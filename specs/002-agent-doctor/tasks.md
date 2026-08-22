# Tasks: Agent Doctor

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md),
[data-model.md](data-model.md), [CLI contract](contracts/cli.md), and
[quickstart.md](quickstart.md).

## Phase 1 — Specification and design

- [x] T001 Record the user outcome, local evidence, platform matrix, and
  fail-closed boundaries in `specs/002-agent-doctor/spec.md`.
- [x] T002 Create the requirements-quality checklist and complete the plan,
  research, data model, CLI contract, and quickstart documents under
  `specs/002-agent-doctor/`.

## Phase 2 — Test-first foundation

- [x] T003 [P] [US1] Add `scripts/__tests__/agent-doctor.test.mjs` using only
  `node:test` and `node:assert/strict`; cover healthy aggregation, retained
  later checks after a failure, invalid configuration, automatic workspace
  selection, and redacted bounded output.
- [x] T004 [US1] Run `node --test scripts/__tests__/agent-doctor.test.mjs` before
  creating `scripts/agent-doctor.mjs` and retain the expected RED result that
  the imported module does not exist.

## Phase 3 — User Story 1: one reliable diagnosis

- [x] T005 [US1] Implement `scripts/agent-doctor.mjs` with a fixed six-probe
  map, sequential `spawnSync` invocation, finite timeouts, output bounds,
  `GO`/`STOP` aggregation, and no repair or shell execution.
- [x] T006 [US1] Add `doctor:agent` and `test:agent-doctor` in `package.json`;
  include the focused suite in `test:agent-orchestra`.

## Phase 4 — User Story 2: preserve workspace boundaries

- [x] T007 [US2] Update `scripts/codex-governance/tool-targets.cjs` and
  `scripts/agent-workspace-command-guard.cjs` so a literal `doctor:agent`
  package script is recognized as diagnostic-only while dynamic package-script
  selection remains blocked.
- [x] T008 [US2] Add a literal `npm run doctor:agent` allow-path regression to
  `scripts/__tests__/agent-workspace-command-guard.test.ts` without weakening
  existing operator-only or dynamic-command denial cases.

## Phase 5 — User Story 3: safe operator contract

- [x] T009 [US3] Add `docs/ai/AGENT_DOCTOR.md` documenting invocation, output,
  current limits, underlying ignored-local-state behavior, and proof boundaries.

## Phase 6 — Verification and convergence

- [x] T010 Run `npm run test:agent-doctor` and `npm run test:agent-workspace`
  after implementation; retain test counts and failure output if any.
- [x] T011 Run the real `npm run doctor:agent -- --json` in this isolated lane;
  record the exact overall result and any inherited `STOP` without masking it.
- [x] T012 Run applicable agent-governance checks:
  `npm run check:agent-context`, `npm run check:agent-orchestra`,
  `npm run check:agent-orchestra:eval`, `npm run enforcement:check`,
  `npm run check:best-practices`, and `npm run check:no-ai-templates`.
- [x] T013 Run a narrow static/security check for the new first-party Node code;
  record unavailable Snyk tooling as `UNVERIFIED` instead of a pass.
- [x] T014 Review `git diff --check`, final diff, and `git status --short --branch`;
  update this task ledger and `convergence.md` with proof, platform status, and
  unresolved evidence boundaries.

## Dependencies and order

1. T003 and T004 are required before T005; no production/tooling behavior is
   written before a focused RED result exists.
2. T005 is required before package, guard, documentation, and real-command work.
3. T006–T009 may be completed after the implementation, but guard changes and
   their regression must land together.
4. T010–T014 happen only after all implementation tasks and use fresh results.

## Parallel opportunities

T003 and the documentation draft in T009 have no shared production file, but
this task remains single-owner to preserve the locked worktree and reduce
protected-surface coordination risk.

## Execution record

- T004 recorded the expected `ERR_MODULE_NOT_FOUND` RED state before the CLI
  existed. `npm run test:agent-doctor` is now `9/9 PASS`.
- T010 also invoked `npm run test:agent-workspace`; its Vitest executable is not
  installed in this clean locked worktree, so that suite remains `UNVERIFIED`.
  The literal `npm run doctor:agent` hook path was additionally exercised by
  the real guard adapter without a shell and exited 0; dynamic package-script
  selection remained blocked with exit 2.
- T011 retained the implementation lane's expected workspace `STOP` for
  uncommitted edits. The same new CLI ran against a clean control checkout in
  explicit review mode with all six probes `GO`.
- T012's `enforcement:check` reports `FAIL` solely because its production-data
  integrity child cannot load absent `typescript`; do not interpret that as
  proof of a production-data pass. See `convergence.md` for the complete
  evidence ledger and release boundary.
