# Tasks: Safe Delivery of the Preserved Pending Batch

**Input**: Design documents in `specs/001-pending-batch-delivery/`
**Status convention**: `[x]` is backed by current retained local evidence; `[ ]` remains required.
**Execution rule**: Tasks are sequential where they share Git state or build artifacts. `[P]` denotes independent checks that may run concurrently only when they do not mutate shared outputs such as `dist/`.

## Phase 1 - Safety foundation

- [x] T001 [US1] Capture owner HEAD, branch, 898-record porcelain-v2 state, status digest, remote, and ignored guard-file receipts outside the delivery branch.
- [x] T002 [US1] Create isolated worktree `.superpowers/worktrees/pending-898-speckit-batch` on `codex/pending-898-speckit-batch` without changing the owner checkout.
- [x] T003 [US1] Exclude the five exact `.dccache` artifacts and create snapshot commit `c902b612050dd891e5aa86958ebf8bb7f2e9f5ba` containing 893 legitimate paths.
- [x] T004 [US1] Recompute snapshot count and path-set SHA-256 and record them in `evidence/reconciliation.json`.
- [x] T005 [US3] Verify GitHub CLI authentication, repository target, remote URL, and workflow-capable permissions without printing credentials.

**Checkpoint**: User work has an immutable recovery point and the source checkout remains isolated.

## Phase 2 - Reconciliation with current main

- [x] T006 [US2] Fetch and merge `origin/main` commit `4aff30811d370981e1c8192cea753159e883c4d2` into the snapshot lineage.
- [x] T007 [US2] Resolve all 76 conflict records file-by-file using `AGENTS.md`, `ARCHITECTURE.md`, focused tests, and artifact provenance.
- [x] T008 [US2] Preserve pending journal atomicity/recovery, settings, accessibility, save-ceremony, and independent audio changes while retaining safer current-main Spec Kit, governance, token, animation-loop, and audio-manager updates.
- [x] T009 [US2] Downgrade stale `docs/JOURNAL_MAGIC_LINK_LIVE_PROOF_STATUS.json` claims to `UNVERIFIED` and bind them to the integrated source hash.
- [x] T010 [US2] Remove all tracked `.dccache` artifacts and add the narrow `**/.dccache` ignore rule.
- [x] T011 [US2] Commit the integration checkpoint as `d0fa0cc3acf267c4374d392c98642daa25ddc1ec`.
- [x] T012 [US2] Classify all 893 snapshot paths and record the disjoint 703/115/53/22 reconciliation totals in `evidence/reconciliation.json`.

**Checkpoint**: The integrated tree is conflict-free and every original legitimate path is accounted for.

## Phase 3 - Full Spec Kit lifecycle packet

- [x] T013 [US4] Verify Specify CLI 0.15.1, Darwin `sh` scripts, Codex installed/default integration, and nonbinding constitution status.
- [x] T014 [US4] Create and complete `spec.md`, including explicit/implied requirements, edge cases, platform matrix, success criteria, assumptions, and clarification decisions.
- [x] T015 [US4] Complete `plan.md`, `research.md`, `data-model.md`, `contracts/delivery-evidence.schema.json`, and `quickstart.md` from current repository evidence.
- [x] T016 [US4] Complete `checklists/requirements.md` and confirm every specification-quality item without claiming implementation success.
- [x] T017 [US4] Generate this dependency-ordered `tasks.md` with exact repository paths and evidence boundaries.
- [x] T018 [US4] Run cross-artifact consistency analysis and retain unresolved execution gates in `analysis.md`.
- [x] T019 [US4] Run a fresh isolated Codex runtime discovery probe and record every discoverable repository-local `speckit-*` skill in `evidence/verification.json`.

**Checkpoint**: The official Spec Kit lifecycle is internally traceable; actual runtime discovery is still required.

## Phase 4 - Focused remediation and regression proof

- [x] T020 [US2] Replace the scanner-shaped synthetic access-token literal in `scripts/__tests__/supabase-auth-magic-link-template.test.ts` without weakening its assertion.
- [x] T021 [US2] Replace the scanner-shaped synthetic permit-token mismatch in `supabase/functions/_shared/pushDeletionBarrier.test.ts` without changing test intent.
- [x] T022 [US2] Rerun focused tests for both remediated files and confirm scanner red/green evidence plus 15 preserved passing assertions.
- [x] T023 [US2] Rerun Gitleaks and TruffleHog against the final tracked diff and record zero verified secrets or exact blocking findings.
- [x] T024 [US2] Recompute generated architecture counts through `npm run doc-counts:update` only if `npm run doc-counts` reports drift; inspect the generated diff.
- [x] T025 [US2] Recompute the journal live-proof source hash after final source changes and keep readiness `UNVERIFIED` unless a matching authorized live receipt exists.

## Phase 5 - Local cross-domain verification

- [x] T026 [P] [US2] Run `npm run typecheck` and retain the two TypeScript project results.
- [x] T027 [P] [US2] Run `npx eslint . --max-warnings=0`, Oxlint, circular-dependency, formatting/diff, and repository static checks.
- [x] T028 [US2] Run the complete `npm test` suite in the isolated worktree and retain exact files/tests/pass/fail/todo counts.
- [x] T029 [P] [US2] Run localization, eight-locale parity, translation quality, RTL, accessibility/reflow, and affected UI regression checks.
- [x] T030 [P] [US2] Run agent-context, agent-orchestra, skill-routing, Spec Kit safety, no-AI-template, and best-practices validators.
- [x] T031 [P] [US2] Run dependency audit, the narrow local Codex security suite, and Snyk Code when authenticated; record unavailable scanner coverage as `UNVERIFIED`.
- [x] T032 [US2] Run `npm run check:production-data-integrity` before the production build.
- [x] T033 [US2] Run the production build with no competing `dist/` mutation, followed sequentially by bundle-integrity, release-artifact, size, audio, canonical-orb, sync, and ratchet checks.
- [x] T034 [US2] Run `npm run ci:preflight` as the broad local CI-equivalent gate and retain exact failure or success output.
- [x] T035 [US2] Inspect the retained desktop and phone recovery screenshots and, where feasible, targeted rendered runtime behavior; keep device and human artistic evidence separate.
- [x] T036 [US2] Review `git diff origin/main...HEAD`, `git diff --check`, Git status, prohibited paths, conflict markers, executable modes, and generated artifacts.

**Checkpoint**: Required local checks are green and all unavailable evidence is explicitly bounded.

## Phase 6 - Publish, monitor, and merge

- [x] T037 [US3] Update `evidence/verification.json`, `analysis.md`, `convergence.md`, and this task list from final local evidence; validate the evidence JSON against its schema.
- [ ] T038 [US3] Create a final single-quoted Git commit whose message includes `batch`, after normal staged production-data and commit guards pass.
- [ ] T039 [US3] Execute the repository pre-push guard without bypass and push `codex/pending-898-speckit-batch` to `origin`.
- [ ] T040 [US3] Open a ready pull request with exact scope, reconciliation, verification, rollback, and `UNVERIFIED` ledger.
- [ ] T041 [US3] Watch every required pull-request check; inspect and fix failures, reproducing suspected inherited failures on clean `origin/main` first.
- [ ] T042 [US3] Merge using a merge commit only after all required checks are green; do not squash or bypass protection.
- [ ] T043 [US3] Watch post-merge `main` workflows and verify the merged SHA plus snapshot-commit ancestry.
- [ ] T044 [US1] Restore owner ignored guard files byte-for-byte and mode-for-mode, then reconfirm owner HEAD, 898 records, and status digest.
- [ ] T045 [US3] Mark convergence `GO` and close the goal only when all independently binding completion gates are satisfied.

## Dependencies and execution order

- T001-T005 precede any integration work.
- T006-T012 precede the feature packet and all broad validation.
- T013-T018 precede remaining implementation; T019 may run after artifacts exist.
- T020-T025 precede the final broad checks so scanners and generated proofs inspect the final source.
- T032 must precede T033; build and bundle checks in T033 are sequential because they share `dist/`.
- T026-T036 must be complete before T037-T040.
- T041 gates T042; T042 gates T043; T043 and T044 gate T045.

## Independent story tests

- **US1**: Snapshot count/digest and final owner-checkout digest can be verified without running product code.
- **US2**: Tree reconciliation plus focused/broad repository checks can be run before any GitHub publication.
- **US3**: A pull request can remain open and independently demonstrate required checks without merging.
- **US4**: Specify CLI configuration and a disposable Codex runtime discovery probe can be verified without product mutation.
