# Requirements Quality Checklist: Agent Routing A/B/C Evaluation

**Feature**: [spec.md](../spec.md)

## Scope and safety

- [x] CHK001 A real but privacy-safe governance task is distinct from synthetic catalog fixtures.
- [x] CHK002 Product runtime, personal data, production data, remote writes, paid APIs, and deployment are excluded.
- [x] CHK003 Worktree isolation, rollback, and ignored operator-output boundaries are explicit.
- [x] CHK004 Web/PWA, Android, iOS, Desktop/Tauri, accessibility, release, privacy, testing, and operations impacts are declared.

## Comparison validity

- [x] CHK005 The three required arms are named exactly and must occur exactly once.
- [x] CHK006 Task, artifact, runtime, tool, budget, and rubric identities are frozen per arm.
- [x] CHK007 Execution order is retained as a permutation rather than hand-picked after outcomes.
- [x] CHK008 Targeted routing records all ten selected/excluded dispositions with evidence locators.
- [x] CHK009 Fixed-full-ten routing records all ten actual role executions.
- [x] CHK010 Duplicate or missing raw-output identities, missing measurements, and condition mismatch fail validation.

## Evidence boundaries

- [x] CHK011 `UNAVAILABLE` counters remain visible and block promotion instead of becoming zeros.
- [x] CHK012 Critical misses and conflicts cannot be hidden behind an aggregate score or majority vote.
- [x] CHK013 Runtime profile loading, effective permissions, qualified review, holdout, semantic quality, and user value remain separately statused.
- [x] CHK014 The report cannot assert a winner without the strict promotion prerequisites.

## Verification design

- [x] CHK015 Focused tests cover preparation, condition mismatch, targeted/full-ten completeness, duplicate outputs, and unavailable counters.
- [x] CHK016 The operator has a CLI prepare/validate round trip and explicit non-promotion procedure.
- [x] CHK017 Existing orchestra checks remain a separate structural check, not substituted evidence.
- [x] CHK018 Final verification requires diff/status inspection and appropriate security scan handling.
