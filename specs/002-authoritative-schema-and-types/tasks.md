# Tasks: Authoritative Schema and Types

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/local-schema-replay.md](./contracts/local-schema-replay.md), and [quickstart.md](./quickstart.md)
**Scope**: T167 documentation and ignored evidence only
**Prohibited**: Migration admission or edits, schema replay, type generation/editing, dependencies, remote Supabase, production data, runtime/package changes, dirty-umbrella writes, Git publication, deployment, external writes, T168/T169 execution, and subagents

## Phase 1: Evidence Boundary

**Purpose**: Prove that the task starts from the authorized clean lane and that all writes stay inside the declared T167 allowlist.

- [X] T001 Revalidate the R0 receipt JSON, result, bytes, SHA-256, explicit waiver limits, and pre-write lane identity recorded in `specs/002-authoritative-schema-and-types/research.md`
- [X] T002 Revalidate the clean-lane branch, commit/tree/base/remote/merge-base/divergence/upstream/lock/status, package lock, workspace descriptor, and edit-doctor evidence recorded in `specs/002-authoritative-schema-and-types/research.md`
- [X] T003 Confirm the only tracked write paths are `.specify/feature.json` and `specs/002-authoritative-schema-and-types/**`, and reserve only `.preflight-token` plus `output/android21/data/schema-source.json` as ignored T167 evidence
- [X] T004 Confirm task-specific Free RAG ran without lane writes or dependency installation and retain its evidence limitations in `specs/002-authoritative-schema-and-types/research.md`

**Checkpoint**: Any identity or scope mismatch stops T167 before receipt implementation.

---

## Phase 2: User Story 1 - Select one trustworthy schema source (Priority: P1)

**Goal**: Bind exactly one clean current source baseline and keep dirty candidates excluded.

**Independent Test**: Recompute the configuration binding and canonical inventory, then compare every admitted, excluded, provenance-only, and read-only target binding with `specs/002-authoritative-schema-and-types/research.md`.

- [X] T005 [US1] Recompute the exact tracked-clean `supabase/config.toml` bytes/SHA and 80-file `supabase/migrations/*.sql` count, Git tree, canonical inventory format, and aggregate SHA in the clean lane
- [X] T006 [US1] Recompute dirty-umbrella task, recovery manifest, config, automation migration, and journal privacy migration state/bytes/SHA without copying or modifying them, and record the bindings in `specs/002-authoritative-schema-and-types/research.md`
- [X] T007 [US1] Verify the automation and journal privacy migrations remain absent from clean `supabase/migrations/` and classified `NOT_ADMITTED`, with the automation migration owned by T168
- [X] T008 [US1] Reproduce/classify the dirty freshness RED and clean timestamp observation without claiming semantic parity, then encode the source-selection evidence in `output/android21/data/schema-source.json`

**Checkpoint**: Current source selection may be `PASS`; migration semantics and generated-type parity remain outside T167.

---

## Phase 3: User Story 2 - Preserve a local-only future execution contract (Priority: P2)

**Goal**: Make the future replay/generation path exact without executing it.

**Independent Test**: Inspect [contracts/local-schema-replay.md](./contracts/local-schema-replay.md) and the receipt; find exactly the required local reset and local generation command strings, with seed and remote execution prohibited and both states deferred.

- [X] T009 [US2] Validate the ordered future contract, source-set invalidation rules, local-only target, seed prohibition, tool prerequisites, and failure handling in `specs/002-authoritative-schema-and-types/contracts/local-schema-replay.md`
- [X] T010 [US2] Record the exact future replay and generation commands as `NOT_EXECUTED`, `DEFERRED`, and `UNVERIFIED` in `output/android21/data/schema-source.json`
- [X] T011 [US2] Record absent Supabase CLI/Docker as an `UNVERIFIED` future prerequisite without installation, and bind T168 migration admission separately from T169 replay/type generation in `output/android21/data/schema-source.json`

**Checkpoint**: No replay, generation, remote target selection, tool installation, or type-file edit has occurred.

---

## Phase 4: User Story 3 - Audit the bounded T167 result (Priority: P3)

**Goal**: Produce one machine-readable receipt that cannot be mistaken for runtime or release approval.

**Independent Test**: Parse the ignored receipt, validate status separation and exact row counts, recompute invariant bindings, and compare Git paths with the allowlist.

- [X] T012 [US3] Add all five static platform-impact rows plus Store/Release, Accessibility, Performance, Security/Privacy, Testing, and Operations dimensions to `output/android21/data/schema-source.json`
- [X] T013 [US3] Record runtime/live/production/native/public/release/human evidence as `UNVERIFIED`, prohibited actions as absent, and bounded rollback in `output/android21/data/schema-source.json`
- [X] T014 [US3] Validate `output/android21/data/schema-source.json` as an ignored JSON object and verify its internal counts, statuses, commands, hashes, and owner gates

**Checkpoint**: Receipt source selection is `PASS`; every unexecuted or unevidenced downstream claim remains deferred or unverified.

---

## Phase 5: Cross-Artifact Analysis and Convergence

**Purpose**: Close only T167 documentation/evidence gaps and prove the final path boundary.

- [X] T015 Run read-only Spec Kit analysis across `specs/002-authoritative-schema-and-types/spec.md`, `plan.md`, and `tasks.md`; resolve every critical inconsistency and verify all FR/SC coverage without writing during analysis
- [X] T016 Validate both files under `specs/002-authoritative-schema-and-types/checklists/` are complete and rerun the no-template, production-data-integrity, migration-prefix, freshness-observation, and applicable best-practices checks
- [X] T017 Recompute protected file/set and dirty-provenance bindings, run `git diff --check`, and prove status contains no path outside `.specify/feature.json`, `specs/002-authoritative-schema-and-types/**`, `.preflight-token`, and `output/android21/data/schema-source.json`
- [X] T018 Run Spec Kit convergence against `specs/002-authoritative-schema-and-types/tasks.md`, confirm that file remains byte-identical during read-only inspection, calculate `output/android21/data/schema-source.json` bytes/SHA externally, and prepare exactly one T168 handoff prompt only if every T167 criterion passes

## Dependencies and Execution Order

- Phase 1 blocks every later phase.
- User Story 1 establishes the source selection required by User Story 2.
- User Story 2 defines the deferred contract recorded by User Story 3.
- User Story 3 must finish before cross-artifact closure.
- T015 analysis is read-only and occurs before the implementation tasks are marked complete.
- T018 cannot issue a T168 handoff when any in-scope task, critical finding, invariant, or required check is unresolved.

## Requirement Traceability

| Requirement or outcome | Tasks |
| --- | --- |
| FR-001, FR-002, SC-001 | T001–T003, T017 |
| FR-003, FR-004, SC-002 | T005, T008, T014, T017 |
| FR-005, FR-006, FR-007, FR-008, SC-003 | T006–T008, T014, T017 |
| FR-009, FR-010, FR-011, FR-012, SC-004 | T009–T011, T014 |
| FR-013, FR-014, FR-015, SC-009 | T008–T011, T018 |
| FR-016, FR-017, SC-005 | T012–T014 |
| FR-018, FR-019, SC-006, SC-007 | T003, T013–T014, T017 |
| FR-020 | T013, T018 |
| FR-021 | T018 |
| FR-022 | T015–T017 |
| FR-023 | T004, T017 |
| SC-008 | T015–T018 |

## Completion Rule

Mark a task complete only after its current evidence is directly rechecked. Passing static checks does not upgrade runtime, schema semantics, generated declarations, native behavior, production/live state, public deployment, release, or human acceptance. A scoped T167 `GO` requires all 18 tasks complete and no unexplained failure or prohibited action.
