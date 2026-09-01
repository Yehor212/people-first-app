# Tasks: PWA Sync Continuity

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/sync-continuity-contract.md`, `quickstart.md`
**Method**: Test-first; every behavior phase begins with RED and ends with the same proof GREEN.
**Authorization boundary**: Tasks describe implementation work; they do not authorize release, production writes, native/schema changes, issues, commit, push, PR, or merge.

## Phase 1 - Preflight and Evidence Baseline

- [ ] T001 Record baseline HEAD, worktree status, normalized request hash, source hashes, and allowed/forbidden path sets in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` without claiming runtime PASS (Covers SC-010)
- [ ] T002 Record fresh structured test-first and skill-routing evidence in the repository-approved preflight token location, citing `specs/20260809-103601-pwa-sync-continuity/plan.md` and the exact focused command from `quickstart.md` (Covers SC-009)
- [ ] T003 Run the current focused characterization suite from `specs/20260809-103601-pwa-sync-continuity/quickstart.md` and append command, exit code, timestamp, test counts, and baseline HEAD to `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers SC-009)
- [ ] T004 [P] Reconfirm constitution proposal status and record the nonbinding result in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` without deriving CRITICAL or remediation from it
- [ ] T005 [P] Review current sync/localStorage/storage/diagnostic source hashes against `specs/20260809-103601-pwa-sync-continuity/evidence/preimplementation-analysis.md` and stop for attribution if baseline drift overlaps an owned implementation path

## Phase 2 - Foundational RED Contracts

**Goal**: Establish the failing evidence that constrains every user story before production edits.

- [ ] T006 [P] Add a RED state-table test proving local save, outbound pending, confirmed online, inbound applied, offline/paused, blocked, and storage-full precedence in `src/components/sync/__tests__/SyncHealthCard.test.tsx` (Covers FR-001, FR-002, SC-001)
- [ ] T007 [P] Add RED lifecycle-order tests for startup, sign-in, online, visible/resume, periodic, and broadcast triggers in `src/hooks/__tests__/useDeltaSyncEffects.test.ts` (Covers FR-004, FR-005, SC-002, SC-003)
- [ ] T008 [P] Add RED quota rollback tests that compare pre/post entity rows and cursor in `src/storage/__tests__/eventSync.test.ts` (Covers FR-007, SC-004)
- [ ] T009 [P] Add RED tests proving failed new queue writes/removals produce zero content-bearing `localStorage` writes in `src/lib/__tests__/offlineQueue.accountBoundary.test.ts` (Covers FR-010, FR-011, SC-004)
- [ ] T010 [P] Add RED migration failure-injection and re-entry cases for validate/transaction/confirmation/cleanup boundaries in `src/lib/__tests__/offlineQueue.accountBoundary.test.ts` (Covers FR-012, FR-013, FR-014, SC-005)
- [ ] T011 [P] Add RED storage-full deduplication, safe retry, ARIA, and 44px target tests in `src/components/__tests__/StorageErrorBanner.pushRevocation.test.tsx` (Covers FR-008, FR-009, FR-020, SC-007)
- [ ] T012 [P] Add RED route/content/ID/OAuth/error canary tests in `src/observability/__tests__/syncHealthRecorder.test.ts` (Covers FR-015, FR-016, FR-017, FR-018, SC-006)
- [ ] T013 Run T006–T012 together with `--maxWorkers=1` and retain the expected failure names/counts in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md`; production edits remain blocked if failures are setup-only

## Phase 3 - User Story 1: Know Whether a Change Is Safe (P1)

**Story goal**: Four evidence-backed meanings remain distinct and accessible.
**Independent test**: The state table produces exactly the expected localized meaning and never treats online plus empty in-memory state as confirmation.

- [ ] T014 [US1] Implement a pure derived truth-state function and precedence rules in `src/components/sync/SyncHealthCardParts.tsx` without adding persisted authority (Covers FR-001, FR-002, SC-001)
- [ ] T015 [US1] Wire durable queue, confirmed outbound receipt, committed inbound receipt, offline/paused, blocked, and storage-full evidence into `src/components/sync/SyncHealthCard.tsx` (Covers FR-001, FR-002, FR-003, SC-001)
- [ ] T016 [P] [US1] Add whole-thought truth and closed-client expectation keys to `src/i18n/types.ts` and `src/i18n/languages/en.ts` (Covers FR-002, FR-003, FR-019)
- [ ] T017 [P] [US1] Add semantically equivalent whole-thought keys with exact placeholders to `src/i18n/languages/uk.ts`, `src/i18n/languages/es.ts`, `src/i18n/languages/de.ts`, and `src/i18n/languages/fr.ts` (Covers FR-019, SC-008)
- [ ] T018 [P] [US1] Add semantically equivalent whole-thought keys with exact placeholders and bidi-safe wording to `src/i18n/languages/ja.ts`, `src/i18n/languages/ar.ts`, and `src/i18n/languages/he.ts` (Covers FR-019, SC-008)
- [ ] T019 [US1] Add parity, forbidden-implementation-term, placeholder, and ar/he bidi assertions in `src/i18n/__tests__/syncContinuityTruthAndBidi.test.ts` (Covers FR-019, SC-008)
- [ ] T020 [US1] Rerun the T006 state-table test and T019 translation test GREEN; append exact counts and result to `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers SC-001, SC-008)

## Phase 4 - User Story 2: Reopen Without Losing Outbound Intent (P1)

**Story goal**: Current-owner durable outbound work always precedes inbound fetch/apply.
**Independent test**: Every trigger observes queue initialization/drain order; remaining work produces zero fetch/apply and an unchanged cursor.

- [ ] T021 [US2] Consolidate every existing trigger through the same leader-locked queue-before-delta operation in `src/hooks/useDeltaSyncEffects.ts` without creating a second lifecycle owner (Covers FR-004, FR-006, SC-002)
- [ ] T022 [US2] Re-read current-owner durable actions after processing and return before cursor read/fetch when any remain in `src/hooks/useDeltaSyncEffects.ts` (Covers FR-005, SC-003)
- [ ] T023 [US2] Preserve other-owner/ownerless quarantine, account-generation abort, duplicate operation identity, gap recovery, and broadcast-as-wake behavior in `src/hooks/useDeltaSyncEffects.ts` and `src/lib/offlineQueue.ts` (Covers FR-006)
- [ ] T024 [US2] Extend `src/hooks/__tests__/useDeltaSyncEffects.test.ts` with negative controls for other-owner rows, late account switch, leader-not-acquired, gap pull, and a blocked non-`WRITE_SYNC_EVENT` critical action (Covers FR-005, FR-006, SC-002, SC-003)
- [ ] T025 [US2] Rerun T007/T024 GREEN and append call-order, zero-fetch, unchanged-cursor, and test-count evidence to `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers SC-002, SC-003)

## Phase 5 - User Story 3: Recover Honestly from Storage Exhaustion (P1)

**Story goal**: Quota failure preserves durable truth, forbids new fallback content, and presents one safe incident.
**Independent test**: Inject IndexedDB/quota errors and prove no cursor/entity/fallback mutation plus one accessible recovery surface.

- [ ] T026 [US3] Remove new content-bearing fallback persistence and deletion-journal writes from failure paths in `src/lib/offlineQueue.ts`, returning a typed durable-storage failure instead (Covers FR-010, FR-011, SC-004)
- [ ] T027 [US3] Ensure failed enqueue/update/remove refreshes authoritative queue state without acknowledging or deleting the affected operation in `src/lib/offlineQueue.ts` (Covers FR-006, FR-009, SC-004)
- [ ] T028 [US3] Normalize quota/durable read/write incidents without raw error text or identifiers in `src/components/storageErrorIncidentState.ts` (Covers FR-008, FR-015)
- [ ] T029 [US3] Route `zenflow:storage-full` and typed queue storage failures through one deduplicated existing incident owner in `src/components/StorageErrorBanner.tsx` (Covers FR-008, FR-020, SC-007)
- [ ] T030 [US3] Add a bounded retry in `src/components/StorageErrorBanner.tsx` that rechecks exact durable work and dismisses only after success (Covers FR-009, FR-020, SC-007)
- [ ] T031 [US3] Preserve `applyDelta()` transaction/cursor rollback and emit the sanitized storage incident in `src/storage/eventSync.ts` only if T008 demonstrates a current gap (Covers FR-007, FR-008, SC-004)
- [ ] T032 [US3] Extend `src/components/__tests__/StorageErrorBanner.pushRevocation.test.tsx` and `src/lib/__tests__/offlineQueue.accountBoundary.test.ts` with repeated-incident, retry-failure, focus, raw-error canary, and no-fallback negative controls (Covers FR-008, FR-009, FR-010, FR-020, SC-004, SC-007)
- [ ] T033 [US3] Rerun T008/T009/T011/T032 GREEN and retain byte-level cursor/entity/fallback comparisons plus test counts in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers SC-004, SC-007)

## Phase 6 - User Story 4: Migrate Legacy Fallback Without Resurrection (P2)

**Story goal**: One-way migration is atomic, fail-closed, idempotent, and owner-safe.
**Independent test**: Valid legacy input reaches one durable copy before exact-key deletion; each failure boundary retains recoverable data and prevents processing/delta.

- [ ] T034 [US4] Refactor legacy journal parsing into a read-only bounded validator in `src/lib/offlineQueue.ts` that rejects incomplete ownership/tombstone/operation data (Covers FR-012, FR-013)
- [ ] T035 [US4] Apply accepted legacy upserts/removals in one existing-table Dexie transaction and confirm the committed result before cleanup in `src/lib/offlineQueue.ts` (Covers FR-012, SC-005)
- [ ] T036 [US4] Make exact-key cleanup post-commit, idempotent, and retryable while preserving newer durable operation identity in `src/lib/offlineQueue.ts` (Covers FR-013, FR-014, SC-005)
- [ ] T037 [US4] Update `src/lib/__tests__/offlineQueue.accountBoundary.test.ts` for valid migration, corrupt input, ownerless/other-owner input, equal-order ambiguity, newer durable conflict, transaction failure, cleanup failure, and second-start re-entry (Covers FR-012, FR-013, FR-014, SC-005)
- [ ] T038 [US4] Rerun T010/T037 GREEN and retain row identities/counts, exact-key state, transaction result, and test counts in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers SC-005)

## Phase 7 - User Story 5: Share Safe Support Details (P2)

**Story goal**: Diagnostics remain useful but contain only allowlisted symbolic state.
**Independent test**: Canary values in every forbidden source are absent from snapshots, receipts, custom events, DOM, and captured logs.

- [ ] T039 [US5] Add a bounded symbolic route resolver and replace raw path/search serialization in `src/observability/syncHealthRecorder.ts` and `src/hooks/useSyncHealthRuntime.ts` (Covers FR-015, FR-016, SC-006)
- [ ] T040 [US5] Replace arbitrary receipt strings with allowlisted domain/priority/error classes and preserve the 30-receipt immutable snapshot cap in `src/observability/syncHealthRecorder.ts` (Covers FR-015, FR-017, SC-006)
- [ ] T041 [US5] Ensure explicit production opt-in/disable precedence and no diagnostic receipt persistence in `src/observability/syncHealthRecorder.ts` (Covers FR-018)
- [ ] T042 [US5] Extend `src/observability/__tests__/syncHealthRecorder.test.ts` and `src/components/sync/__tests__/SyncHealthCard.test.tsx` with raw path/query/hash, OAuth, content, entity, queue, operation, device, payload, and error-message canaries (Covers FR-015, FR-016, FR-017, FR-018, SC-006)
- [ ] T043 [US5] Rerun T012/T042 GREEN and append zero-canary scan counts and test counts to `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers SC-006)

## Phase 8 - Cross-Cutting Verification, Platform, and Rollback

- [ ] T044 [P] Run `npm run typecheck`, `npm run lint`, and `npm run check:sync-contract` sequentially and record command/exit/timestamp/HEAD in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers SC-009)
- [ ] T045 [P] Run `npm run check:translation-quality`, `npm run i18n:check`, and `npm run i18n:deep` sequentially and record exact results in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers FR-019, SC-008, SC-009)
- [ ] T046 Run `npm run check:production-data-integrity:diff` and inspect every warning/finding for changed paths; record results without laundering missing bundle/live proof in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers FR-022, SC-009)
- [ ] T047 Run the preferred Snyk code scan for changed first-party code or the narrow documented CLI fallback plus `/Users/yehor/.codex/bin/codex-security-suite.sh diff`; fix changed-code findings and rescan or mark tool/auth/network gaps `UNVERIFIED` in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers FR-015, FR-022, SC-009)
- [ ] T048 Run `npm run build`, then `npm run check:production-data-integrity:bundle`, then `npm run check:all` sequentially and bind results to the built artifact hash in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers SC-009)
- [ ] T049 Run the broader ordered-sync tests and `npm run smoke:telegram-sync-drill` from `specs/20260809-103601-pwa-sync-continuity/quickstart.md`; preserve live-account rows as `UNVERIFIED` when credentials/proof are absent (Covers FR-006, SC-009)
- [ ] T050 [P] Execute production-equivalent Web/Vite browser scenarios for offline, blocked, quota, duplicate, account-switch, multi-tab/gap, diagnostics, keyboard, 320px, desktop, ar, and he; retain privacy-safe receipts in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers FR-002, FR-003, FR-004, FR-008, FR-015, FR-019, FR-020, SC-001, SC-002, SC-006, SC-007, SC-008, SC-009)
- [ ] T051 Execute the installed Chrome/Edge PWA close/reopen and offline-to-online scenarios without claiming background convergence while closed; retain privacy-safe receipts in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers FR-003, FR-004, SC-002, SC-009)
- [ ] T052 Request Android, iOS, and Desktop shared-bundle compatibility receipts from platform owners and record each as verified evidence or `UNVERIFIED` in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers FR-021, SC-010)
- [ ] T053 Review `git diff --check`, full diff, status, name-only denylist, generated artifacts, secrets, production data, and unrelated edits; record exact changed-path manifest in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers FR-021, FR-022, SC-010)
- [ ] T054 Compute SHA-256 for every changed feature/source/test/build evidence artifact and add a non-self-authenticating hash manifest to `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` with its own external hash noted separately (Covers SC-009, SC-010)
- [ ] T055 Rehearse rollback by reviewing the exact revert set and legacy-reader compatibility, then record GO/STOP/ASK plus unresolved live/native/public/human risks in `specs/20260809-103601-pwa-sync-continuity/evidence/implementation-receipts.md` (Covers FR-021, SC-009, SC-010)

## Dependencies

- Phase 1 precedes all other work.
- Phase 2 RED evidence blocks production edits in Phases 3–7.
- US2 and US3 may proceed after Phase 2 on separate owned files, but US3's queue changes must land before US4 refactors the same file.
- US1 may proceed in parallel with US2/US3 after RED evidence; US5 shares SyncHealth files with US1 and follows it.
- Phase 8 begins only after every story's same-test GREEN receipt exists.
- T048 follows T046 because bundle-sensitive integrity runs after the production build.
- T051 follows T050 and a successful production build.
- T054/T055 are final and follow full diff review.

## Parallel Examples

- After T013, one owner can implement US1 i18n/component derivation while another owns US2 delta tests/hook; they must not edit the same files.
- T016, T017, and T018 are parallel only with exclusive locale-file ownership; T019 follows all three.
- T044 and T045 may be prepared independently but should run sequentially when commands can mutate shared caches/artifacts.
- Security scan review and browser scenario preparation may proceed in parallel with distinct evidence destinations; final status remains coordinator-owned.

## Requirement-to-Task Coverage

| Requirement | Task IDs |
| --- | --- |
| FR-001 | T006, T014, T015, T050 |
| FR-002 | T006, T014–T18, T050 |
| FR-003 | T015–T18, T050, T051 |
| FR-004 | T007, T021, T050, T051 |
| FR-005 | T007, T022, T024 |
| FR-006 | T023, T024, T027, T049 |
| FR-007 | T008, T031 |
| FR-008 | T011, T028–T32, T050 |
| FR-009 | T011, T027, T030, T032 |
| FR-010 | T009, T026, T032 |
| FR-011 | T009, T026 |
| FR-012 | T010, T034, T035, T037 |
| FR-013 | T010, T034, T036, T037 |
| FR-014 | T010, T036, T037 |
| FR-015 | T012, T028, T039, T040, T042, T047, T050 |
| FR-016 | T012, T039, T042 |
| FR-017 | T012, T040, T042 |
| FR-018 | T012, T041, T042 |
| FR-019 | T016–T19, T045, T050 |
| FR-020 | T011, T029, T030, T032, T050 |
| FR-021 | T052, T053, T055 |
| FR-022 | T046, T047, T053 |
| SC-001 | T006, T014, T015, T020, T050 |
| SC-002 | T007, T021, T024, T025, T050, T051 |
| SC-003 | T007, T022, T024, T025 |
| SC-004 | T008, T009, T026, T027, T032, T033 |
| SC-005 | T010, T035–T038 |
| SC-006 | T012, T039, T040, T042, T043, T050 |
| SC-007 | T011, T029, T030, T032, T033, T050 |
| SC-008 | T017–T20, T045, T050 |
| SC-009 | T002, T003, T044–T51, T54, T55 |
| SC-010 | T001, T052–T55 |

## Implementation Strategy

The smallest viable safety increment is Phases 1–5: evidence-backed truth, outbound-before-delta, no new content fallback, and storage-full rollback/incident. US4 is required in the same final change before removing fallback writes because legacy pending work must remain recoverable. US5 is required before completion because the existing raw diagnostic route violates the feature's privacy boundary. No story is release-complete until Phase 8 evidence is reconciled.

## Format Validation

All 55 tasks use checkbox + sequential `T###`; story-phase tasks carry `[US#]`; `[P]` appears only where file ownership and dependencies permit parallel work; every task names an exact path and applicable FR/SC identifiers.
