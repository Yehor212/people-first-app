# Tasks: Agent and PWA Visibility Audit

**Input**: Design documents in `specs/20260804-000837-agent-pwa-visibility-audit/`

**Scope boundary**: These are evidence-gathering/documentation tasks only. None authorizes product code changes, Git writes, GitHub Actions dispatch, deployment, cache deletion, or installed-app storage access.

## Phase 1: Setup and Scope Lock

**Purpose**: Establish the isolated audit lane and make the no-side-effect boundary inspectable.

- [ ] T001 Record the clean-control and audit-lane `agent:workspace doctor` evidence in `specs/20260804-000837-agent-pwa-visibility-audit/research.md` [FR-001, FR-007]
- [ ] T002 Record constitution status as proposed/nonbinding and the selected analysis-only Spec Kit route in `specs/20260804-000837-agent-pwa-visibility-audit/plan.md` [FR-007]
- [ ] T003 Validate generated feature paths and the current feature pointer in `.specify/feature.json` and `specs/20260804-000837-agent-pwa-visibility-audit/spec.md` [SC-005]

---

## Phase 2: Foundational Evidence Model

**Purpose**: Define the vocabulary and proof requirements that every user story shares.

- [ ] T004 Define workspace-lane, change-lineage, deployment-receipt, and client-freshness entities in `specs/20260804-000837-agent-pwa-visibility-audit/data-model.md` [FR-001, FR-002, FR-005]
- [ ] T005 Define evidence status vocabulary, required proof legs, and prohibited shortcuts in `specs/20260804-000837-agent-pwa-visibility-audit/contracts/visibility-evidence-contract.md` [FR-002, FR-004, FR-007]
- [ ] T006 Define the full five-platform/domain matrix and explicit `UNVERIFIED` boundaries in `specs/20260804-000837-agent-pwa-visibility-audit/spec.md` [FR-006, SC-004]

**Checkpoint**: No claim can be made from a single graph badge, local file, or web page alone.

---

## Phase 3: User Story 1 — Locate an Agent Change (Priority: P1) 🎯 MVP

**Goal**: Explain why a local agent change does or does not appear in the current VS Code window.

**Independent Test**: A report reader can compare the two exact roots and see which one contains the change without using a copy, reset, or merge.

- [ ] T007 [US1] Map current linked worktrees, branches, locks, heads, and dirty paths using the evidence described in `specs/20260804-000837-agent-pwa-visibility-audit/data-model.md` [FR-001]
- [ ] T008 [US1] Map the doctor worktree's generated single-root VS Code workspace in `specs/20260804-000837-agent-pwa-visibility-audit/research.md` [FR-001, FR-002]
- [ ] T009 [US1] Document the safe VS Code opening procedure and wrong-root stop condition in `specs/20260804-000837-agent-pwa-visibility-audit/quickstart.md` [SC-001, SC-003]

**Checkpoint**: A local uncommitted file is classified as local-only, not missing or deployed.

---

## Phase 4: User Story 2 — Trace the 898-File Batch (Priority: P1)

**Goal**: Explain the relation between the initial batch snapshot, the final PR diff, and current `main`.

**Independent Test**: A reader can reproduce ancestry, merge-state, and final-file-count calculations from the listed Git evidence.

- [ ] T010 [US2] Record PR #64/#65 merge state and the `codex/pending-898-speckit-batch` relation to `origin/main` in `specs/20260804-000837-agent-pwa-visibility-audit/research.md` [FR-003]
- [ ] T011 [US2] Record the snapshot-versus-final-diff count and top-level path distribution in `specs/20260804-000837-agent-pwa-visibility-audit/research.md` [FR-003, SC-002]
- [ ] T012 [US2] Ensure the report contract forbids equating a large source-path count with a visible-screen count in `specs/20260804-000837-agent-pwa-visibility-audit/contracts/visibility-evidence-contract.md` [FR-002, SC-002]

**Checkpoint**: The batch is classified as merged/reachable or not from fresh Git evidence, never from a branch label alone.

---

## Phase 5: User Story 3 — Separate Public Deploy From Installed-PWA Freshness (Priority: P1)

**Goal**: Establish the public deployment state while preserving the installed profile's local data boundary.

**Independent Test**: The report has a matching current `main` SHA, successful deploy job, cache-busted public observation, and an explicit `UNVERIFIED` outcome for an uninspected personal PWA profile.

- [ ] T013 [US3] Match `origin/main` to the completed `deploy.yml` run and its deploy job in `specs/20260804-000837-agent-pwa-visibility-audit/research.md` [FR-004]
- [ ] T014 [US3] Record the cache-busted public route's title, translated settings surface, and module bundle identity in `specs/20260804-000837-agent-pwa-visibility-audit/research.md` [FR-004]
- [ ] T015 [US3] Document both version-check layers, the no-manual-data-clearing boundary, and the generated bootstrap's automatic mismatch cleanup in `specs/20260804-000837-agent-pwa-visibility-audit/quickstart.md` [FR-005, FR-007, SC-003]
- [ ] T016 [US3] Preserve the installed-profile worker/cache state as `UNVERIFIED` unless the owner observes it through the app's own update surface in `specs/20260804-000837-agent-pwa-visibility-audit/spec.md` [FR-005]

**Checkpoint**: Public deployment evidence is not presented as an inspection of the user's browser profile.

---

## Phase 6: User Story 4 — Release Parity (Priority: P2)

**Goal**: Prevent the Web/PWA result from being mistaken for Android, iOS, or Tauri publication.

**Independent Test**: Every platform row has a channel, evidence target, and a status that does not borrow the GitHub Pages result.

- [ ] T017 [US4] Map Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri channels in `specs/20260804-000837-agent-pwa-visibility-audit/spec.md` [FR-006]
- [ ] T018 [US4] Record the runtime-identification limitation and Tauri proof requirement in `specs/20260804-000837-agent-pwa-visibility-audit/quickstart.md` [FR-006]

**Checkpoint**: Native/Desktop release state remains `UNVERIFIED` without its own version/artifact receipt.

---

## Phase 7: Polish and Evidence Closure

**Purpose**: Validate the packet's internal traceability and report no unauthorised action as a completed product change.

- [ ] T019 Validate requirement quality using `specs/20260804-000837-agent-pwa-visibility-audit/checklists/visibility.md` [SC-005]
- [ ] T020 Run Spec Kit cross-artifact analysis against `specs/20260804-000837-agent-pwa-visibility-audit/spec.md`, `plan.md`, and this file; record gaps without silently changing product scope [SC-001–005]
- [ ] T021 Review `git diff --check` and `git status --short` in the audit worktree to ensure the write set contains only `.specify/feature.json` and `specs/20260804-000837-agent-pwa-visibility-audit/` [FR-007]
- [ ] T022 Mark personal installed-PWA freshness, Android, iOS, and Desktop/Tauri outcomes `UNVERIFIED` if their specific evidence was not intentionally obtained [FR-005, FR-006]

## Dependencies and Execution Order

1. T001–T003 establish scope and the current feature location.
2. T004–T006 establish the common evidence vocabulary.
3. T007–T009, T010–T012, and T013–T016 depend on the foundational vocabulary; their read-only evidence can be gathered independently.
4. T017–T018 add parity classification after the public channel is known.
5. T019–T022 close the documentation and evidence audit last.

## Parallel Opportunities

The Git evidence, public deploy evidence, and platform mapping use different read-only sources. They may be gathered in parallel only when they do not mutate a shared worktree or cause a live PWA profile to be changed. This audit deliberately uses one coherent evidence packet rather than parallel writers.

## Implementation Strategy

**MVP**: Complete User Story 1 first: it resolves the immediate question of why VS Code does not show another worktree's local edits.

**Incremental analysis**: Add the 898-batch lineage, then public deploy evidence, then release parity. Stop before any product implementation. `$speckit-implement` and `$speckit-converge` are intentionally not authorized for this diagnostic feature.
