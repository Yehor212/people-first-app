# Tasks: Product Regression Recovery

**Input**: Design documents from `specs/002-product-regression-recovery/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `traceability.md`
**Method**: Red-first. Each behavior-changing test task must fail for the named contract reason before its implementation task starts. Isolated fixtures only; no production-derived journal data.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Safe to execute in parallel only when no listed dependency is incomplete and files do not overlap.
- **[US1]**: safe password removal; **[US2]**: partial journal reads; **[US3]**: feature availability; **[US4]**: save ceremony gate; **[US5]**: evidence and rollback.

## Phase 1: Setup and Evidence Boundary

**Purpose**: Establish a clean, reproducible lane before first-party product edits.

- [x] T001 Confirm branch, worktree lock, clean baseline, `HEAD == origin/main`, and no tracked snapshot restoration in `specs/002-product-regression-recovery/evidence/baseline.md` (FR-035, FR-050, FR-053)
- [x] T002 Install exact dependencies from `package-lock.json` with `npm ci` and record only command/status/tool versions in `specs/002-product-regression-recovery/evidence/baseline.md`
- [x] T003 Run the external-worktree RAG preflight and reread task-relevant policy sources; update ignored `.preflight-token` and `.skill-routing-token` without adding them to Git (FR-049, FR-052)
- [x] T004 [P] Capture existing focused journal, feature-flag, ceremony, sync-contract, type-freshness, and PDI-diff baseline commands in `specs/002-product-regression-recovery/evidence/baseline.md` without treating failures as product regressions until attributed (FR-049-FR-052)
- [x] T005 [P] Create a privacy-safe red/green receipt schema in `specs/002-product-regression-recovery/evidence/README.md` that forbids content, ciphertext, IDs, credentials, production records, and stale-commit proof (FR-016, FR-040, FR-050, FR-055)

---

## Phase 2: Foundational Compatibility and Privacy Contracts

**Purpose**: Add shared type and evidence foundations required by the P1 stories without changing user behavior.

- [x] T006 Add table-driven privacy negative controls for blocker/result serialization and durable error metadata in `src/features/journal/__tests__/journalPasswordRemoval.privacy.test.ts` and retain expected RED evidence (FR-016, FR-040, FR-056)
- [x] T007 Implement stable blocker, preflight, result, operation-phase, native-cleanup, and cloud-cleanup types in `src/features/journal/journalSecurityErrors.ts` and `src/features/journal/journalSecurityMigration.ts` without raw error persistence (FR-003, FR-040, FR-057)
- [x] T008 Rerun T006 green and record exact test count/output identity in `specs/002-product-regression-recovery/evidence/wave-1.md`

**Checkpoint**: Typed product outcomes and privacy-safe operation metadata exist; no real-account mutation has occurred.

---

## Phase 3: User Story 1 — Remove Journal Protection Without Losing Data (Priority: P1) 🎯 MVP

**Goal**: Healthy protected data converts atomically; every blocker leaves data unchanged; post-local native/cloud failure is truthful and resumable.

**Independent Test**: An isolated protected journal passes healthy, locked, activation/removal-pending, revision, object-decrypt, row-race, owner-switch, offline, restart, native-failure, remote-CAS, and duplicate-replay cases with exact fingerprint assertions.

### Red tests

- [ ] T009 [P] [US1] Add preflight blocker and full before/after fingerprint tests for entry, media, draft, space, capture, locked, activation-pending, revision, and storage failures, consolidated in `src/features/journal/__tests__/journalSecurityMigration.test.ts`; retain expected RED evidence (FR-001-FR-004, FR-011)
- [ ] T010 [P] [US1] Add version-1 compatibility, malformed/future fail-closed, duplicate-tab, conflicting intent, and completed replay tests, consolidated in `src/features/journal/__tests__/journalSecurityMigration.test.ts`; retain expected RED evidence (FR-038, FR-057, FR-069-FR-070)
- [ ] T011 [P] [US1] Add direct Dexie insert/update/delete snapshot races and account/vault TOCTOU tests, consolidated in `src/features/journal/__tests__/journalSecurityMigration.test.ts`; retain expected RED evidence (FR-006, FR-037, FR-058, FR-071)
- [ ] T012 [P] [US1] Add native ordering, native failure after local commit, installation-wide A-to-B owner switch, crash, and retry tests in `src/features/journal/__tests__/useJournalSecurity.vaultKey.test.tsx`; retain expected RED evidence (FR-004, FR-008-FR-010, FR-066)
- [ ] T013 [P] [US1] Add queue-empty removal-intent sign-out/account-switch blocking tests in `src/lib/__tests__/accountSignOutCleanup.test.ts`; retain expected RED evidence (FR-010, FR-067)
- [ ] T014 [P] [US1] Add app-start and resume cleanup tests that do not mount `JournalModule` in `src/features/journal/__tests__/journalPasswordRemoval.lifecycle.test.ts`; retain expected RED evidence (FR-008, FR-045, FR-068)
- [ ] T015 [P] [US1] Add global-merge negative control, encrypted-backup, entry acknowledgement, backup CAS, extra-protected-row, vault CAS abort/zero-row/stale-revision, offline, and replay tests in `src/features/journal/__tests__/journalPasswordRemoval.cloudCleanup.test.ts`; retain expected RED evidence (FR-039, FR-044, FR-061-FR-065)
- [x] T015a [P] [US1] Add the server-fence expand/contract migration test in `src/storage/sync/__tests__/journalPasswordRemovalServerFenceMigration.test.ts` and retain the expected `2/11` RED for immediate strict activation and missing removal pause (FR-037, FR-058, FR-062-FR-065)
- [ ] T016 [P] [US1] Add metadata-only media download/decrypt plus upload, metadata-commit, and old-blob-delete failure-boundary tests, consolidated in `journalSecurityMigration.test.ts`, `journalPasswordRemoval.cloudCleanup.test.ts`, and sync tests; retain expected RED evidence (FR-002, FR-011, FR-062, FR-064)
- [x] T017 [P] [US1] Add blocker, partial-success, focus, Escape, Android Back, announcement, double-submit, and 48 px contract tests in `src/features/journal/__tests__/RemovePasswordConfirmDialog.test.tsx`; retain expected RED evidence (FR-009, FR-017-FR-019, FR-047)

### Implementation

- [x] T018 [US1] Implement tri-state supported/absent/unsupported removal-intent parsing, reader-first v1 normalization, compare-and-set persistence, duplicate resume, and replay acknowledgement in `src/features/journal/journalSecurityMigration.ts` (depends on T010; FR-038, FR-057, FR-069-FR-070)
- [x] T019 [US1] Implement the read-only owner/revision-bound preflight across entries, media, drafts, spaces, and captures with ephemeral preparation in `src/features/journal/journalSecurityMigration.ts` (depends on T009, T016; FR-001-FR-005)
- [x] T020 [US1] Revalidate owner, vault revision, operation revision, and exact raw row snapshots, then commit prepared plaintext plus local metadata removal atomically in `src/features/journal/journalSecurityMigration.ts` (depends on T011, T018-T019; FR-006-FR-007, FR-037, FR-058, FR-071)
- [x] T021 [US1] Move installation-wide native biometric cleanup after local commit, revalidate the account boundary immediately before it, and persist partial status in `src/features/journal/useJournalSecurity.ts` and `journalSecurityRemovalLifecycle.ts` while reusing the existing native credential helper (depends on T012, T020; FR-008-FR-010, FR-066)
- [x] T022 [US1] Count supported and unknown pending removal intent as durable owner work in `src/lib/accountSignOutCleanup.ts` and the existing account-switch discard snapshot types (depends on T013, T018; FR-067)
- [x] T023 [US1] Move removal enqueue/recovery ownership to the app-level startup/resume coordinator in `src/main.tsx` and `journalSecurityRemovalLifecycle.ts`, leaving `useJournalSecurity.ts` as the initiating state consumer (depends on T014, T018; FR-045, FR-068)
- [x] T024 [US1] Add required-remote-commit outcomes for journal entry/photo/audio upserts so queued, stale, aborted, or no-op delivery cannot acknowledge cleanup in `src/storage/realtimeSync.ts` and `src/storage/sync/` journal helpers (depends on T015; FR-039, FR-062)
- [x] T025 [US1] Implement a journal-only compare-and-set backup patch that preserves every non-journal remote domain in `src/storage/sync/journalRemovalRemote.ts` using the existing backup exporter (depends on T015, T024; FR-044, FR-061-FR-062)
- [x] T026 [US1] Implement plaintext media replacement upload, required metadata commit, durable per-item progress, and old encrypted-blob deletion last in `journalSecurityMigration.ts` using existing storage helpers and strict sync acknowledgements (depends on T016, T024; FR-062, FR-064)
- [x] T027 [US1] Implement remote protected-object verification and expected-vault-revision compare-and-set deletion with abort/zero-row failure in `src/storage/sync/syncSettings.ts`, `journalRemovalRemote.ts`, and `journalSecurityMigration.ts` (depends on T015, T025-T026; FR-063, FR-065)
- [x] T027a [US1] Author the forward-only Supabase `legacy → paused → strict` fence migration, generated RPC type, protected-write rejection, plaintext removal-conversion path, and owner-scoped strict inventory; keep live application explicitly unauthorized/unverified (depends on T015a, T027; FR-037, FR-058, FR-062-FR-065)
- [x] T027b [US1] Reject and remove the experimental permanent remote-ID cutover because retained rows/tombstones cannot classify every pre-cutover deletion; preserve durable client tombstones, owner-scoped idempotent deletes, and paused-fence deferred retry with capped backoff without claiming global deletion permanence (FR-037, FR-052, FR-058)
- [x] T028 [US1] Replace expected removal exceptions with `JournalPasswordRemovalResult` propagation while preserving programmer-error reporting in `src/features/journal/useJournalSecurity.ts` (depends on T020-T027; FR-003, FR-008-FR-010)
- [x] T029 [US1] Map every blocker and partial result to specific recovery UI while preserving focus/Back/Escape semantics in `RemovePasswordConfirmDialog.tsx` and its `JournalModule.tsx` callers (depends on T017, T028; FR-017-FR-018, FR-041, FR-056)
- [x] T030 [P] [US1] Add natural complete removal and partial-cleanup copy with placeholder parity to `src/i18n/types.ts` and `src/i18n/languages/{en,uk,es,de,fr,ja,ar,he}.ts` (depends on T017; FR-019, FR-047, FR-056)
- [x] T031 [US1] Rerun T009-T017 green plus existing journal-security, auth-boundary, sync, i18n, translation, RTL, and privacy-negative-control tests; record exact counts in `specs/002-product-regression-recovery/evidence/wave-1.md` (FR-049, FR-052)

**Checkpoint**: US1 is independently testable. No real account was mutated; the user-only confirmation requirement remains intact.

---

## Phase 4: User Story 2 — Read Every Recoverable Journal Entry (Priority: P1)

**Goal**: A damaged or incompatible entry cannot hide readable entries or masquerade as an empty journal.

**Independent Test**: Mixed, all-unreadable, missing-key, verified-empty, duplicate-timestamp, unavailable-cursor, pagination, refresh, and export-negative-control fixtures produce the exact page states without private leakage.

### Red tests

- [ ] T032 [P] [US2] Add mixed, all-unreadable, missing-key, empty, stable-order, raw-cursor, and pagination tests in `src/features/journal/__tests__/journalStorage.partialRead.test.ts`; retain expected RED evidence (FR-013-FR-016, FR-041)
- [ ] T033 [P] [US2] Add unavailable-count accumulation, refresh replacement, and non-global-error tests in `src/features/journal/__tests__/useJournal.test.ts`; retain expected RED evidence (FR-013-FR-015, FR-041)
- [ ] T034 [P] [US2] Add no-fake-card, privacy-safe count, empty/degraded distinction, screen-reader announcement, and RTL layout tests, consolidated in `src/features/journal/__tests__/JournalEntryList.spaceParity.test.tsx`; retain expected RED evidence (FR-015-FR-016, FR-019, FR-047)
- [ ] T035 [P] [US2] Add export and single-entry mutation negative controls that remain fail-closed in `src/features/journal/__tests__/journalStorage.partialRead.test.ts`; retain expected RED evidence (FR-011, FR-043)

### Implementation

- [x] T036 [US2] Replace blank-content fallback and page-wide rejection with settled display decryption and `JournalEntryPageResult` states/counts while keeping the raw cursor in `src/features/journal/journalStorage.ts` (depends on T032, T035; FR-013-FR-016)
- [x] T037 [US2] Propagate ready/empty/degraded/unavailable state and page-count accumulation through `src/features/journal/useJournal.ts` without weakening export/edit paths (depends on T033, T036; FR-041, FR-043)
- [x] T038 [US2] Render one localized privacy-safe degraded or unavailable status outside entry cards in `src/features/journal/JournalEntryList.tsx` and its journal module caller (depends on T034, T037; FR-015-FR-016, FR-041)
- [x] T039 [P] [US2] Add natural unavailable-entry count messages with plural and RTL-safe interpolation to `src/i18n/types.ts` and `src/i18n/languages/{en,uk,es,de,fr,ja,ar,he}.ts` (depends on T034; FR-019, FR-047, FR-056)
- [x] T040 [US2] Rerun T032-T035 green plus journal export/import, pagination, account-boundary, i18n, translation, and privacy scans; record exact counts in `specs/002-product-regression-recovery/evidence/wave-1.md` (FR-049, FR-052)

**Checkpoint**: US2 is independently testable and distinguishable from a verified-empty journal.

---

## Phase 5: User Story 3 — Understand Product Function Availability (Priority: P2)

**Goal**: Every known gate has an authoritative, fail-closed, explainable disposition; a hardcoded journal count no longer hides eligible features.

**Independent Test**: A manifest covers every known gate/consumer and real IndexedDB count transitions; unknown state is not zero, existing boolean consumers remain compatible, and blocked services remain off.

### Red tests and inventory

- [x] T041 [P] [US3] Build the source-backed route/gate/consumer/platform inventory in `specs/002-product-regression-recovery/gate-inventory.md`, including explicit `UNVERIFIED` evidence and no enablement decision (FR-020, FR-027, FR-052)
- [ ] T042 [P] [US3] Add pure manifest uniqueness, unknown-key, missing-consumer, absent-value, source/disclosure, and no-enable negative-control tests in `src/lib/__tests__/featureAvailability.test.ts`; retain expected RED evidence (FR-022-FR-026, FR-072-FR-074)
- [ ] T043 [P] [US3] Add asynchronous journal-count loading/ready/error, settled refresh, account-boundary, calendar-independent unlock, and boolean parity tests in `src/contexts/__tests__/FeatureFlagsContext.test.tsx`; retain expected RED evidence (FR-021-FR-023)
- [ ] T044 [P] [US3] Add a static consumer inventory test covering auth/onboarding/recovery, orb/mood, habits/garden/tasks/focus, diary, social/insights, settings/data, PWA, and native/Desktop shells in `scripts/__tests__/feature-availability-inventory.test.ts`; retain expected RED evidence (FR-027, FR-072)

### Implementation

- [x] T045 [US3] Implement the versioned fail-closed gate manifest and pure `FeatureAvailability` evaluator in `src/lib/featureAvailability.ts` (depends on T041-T042; FR-020, FR-022-FR-026, FR-072-FR-074)
- [x] T046 [US3] Subscribe `FeatureFlagsProvider` to settled data refresh, read authoritative IndexedDB entry count, model loading/error explicitly, and expose the structured evaluator plus boolean adapter in `src/contexts/FeatureFlagsContext.tsx` (depends on T043, T045; FR-021-FR-023)
- [x] T047 [US3] Route known toggleable consumers and deep-link/navigation decisions through the adapter or structured result, and document every intentionally non-consumer in `src/hooks/useDeepLinkHandler.ts`, `src/components/navigation-v2/`, and `specs/002-product-regression-recovery/gate-inventory.md` (depends on T044-T046; FR-023-FR-027, FR-072)
- [x] T048 [US3] Encode fail-closed dispositions for AI Coach, V2 rewards, rewarded-ad acquisition, habit Lottie runtime, save ceremony, and design-rollout-only variants without enabling them in `src/lib/featureAvailability.ts` and existing gate owner modules (depends on T045; FR-026, FR-073-FR-074)
- [x] T049 [P] [US3] Add user-safe temporary-unavailability copy only for disclosed reasons in `src/i18n/types.ts` and `src/i18n/languages/{en,uk,es,de,fr,ja,ar,he}.ts`; keep hidden experiments silent (FR-024, FR-047, FR-056, FR-072)
- [x] T050 [US3] Rerun T042-T044 green, all current gate/route consumers, i18n/RTL/translation checks, and a no-enable source diff; update `specs/002-product-regression-recovery/gate-inventory.md` with exact evidence status (FR-049-FR-052)

**Checkpoint**: US3 is independently testable; every inventoried function has a disposition, not a promise of runtime proof.

---

## Phase 6: User Story 4 — Safe Journal Save Ceremony Admission (Priority: P3)

**Goal**: All target builds share one fail-closed capability receipt and truthful static fallback; production animation remains disabled until exact-candidate human gates close.

**Independent Test**: Four target receipts are deterministic and consistent, malformed or incomplete admission stays false, and host/lifecycle tests distinguish local save from pending/failed cloud status with a real anchor or use the static path.

### Red tests

- [ ] T051 [P] [US4] Add deterministic schema, forbidden-field, exact-commit, target-parity, malformed-input, admission, and kill-switch tests in `scripts/__tests__/feature-capability-receipt.test.ts`; retain expected RED evidence (FR-025, FR-028-FR-029, FR-033)
- [ ] T052 [P] [US4] Extend ceremony integration tests for an actual saved-entry anchor, local-saved/cloud-pending/cloud-failed states, repeated save, navigation, background/foreground, and circuit-breaker fallback in `src/features/journal/__tests__/JournalSaveCeremony.integrationContract.test.ts` and `JournalSaveCeremonyHost.test.tsx`; retain expected RED evidence (FR-030-FR-032, FR-075)
- [ ] T053 [P] [US4] Add workflow/build-entry contract tests that require the shared capability input and receipt for Pages, Android, iOS, and Tauri in `scripts/__tests__/feature-capability-release-contract.test.ts`; retain expected RED evidence (FR-028-FR-029, FR-050)

### Implementation

- [x] T054 [US4] Implement deterministic privacy-safe receipt generation/validation in `scripts/check-feature-capability-receipt.cjs` and guarded build consumption in `scripts/feature-capability-build.cjs`; schema v1 is non-enabling so unauthenticated `pass` strings cannot enable production motion (depends on T051; FR-025, FR-028-FR-029, FR-033)
- [x] T055 [US4] Wire one explicit fail-closed ceremony release input and kill switch into `vite.config.ts`, `scripts/run-shared-dist-build.mjs`, `.github/workflows/deploy.yml`, Android/iOS build paths, and `src-tauri/tauri.conf.json` without enabling it (depends on T053-T054; FR-028-FR-029, FR-050)
- [ ] T056 [US4] Bind ceremony presentation to the saved-entry anchor and truthful local/cloud outcome contract, with nonblocking veil/navigation and existing static degradation in `src/features/journal/JournalModule.tsx` and `src/features/journal/save-ceremony/JournalSaveCeremonyHost.tsx` (depends on T052; FR-030-FR-032, FR-075)
- [x] T057 [US4] Inventory every disabled animation flag and retain only source-backed production intent/evidence dispositions in `specs/002-product-regression-recovery/gate-inventory.md` without enabling unapproved runtimes (FR-026, FR-034)
- [x] T058 [US4] Run technical, accessibility, performance, and visual-runtime checks on the available disabled candidate; apply the visual-integrity protocol inline because the named skill is unavailable, record independent critic/Artistic/Craft/user approval as `UNVERIFIED`, and keep the flag false in `specs/002-product-regression-recovery/evidence/wave-3.md` (FR-033, FR-051, FR-060)
- [x] T059 [US4] Rerun available T051/T053 green plus bundle, cross-target receipt, and no-enable checks; explicitly retain T052/T056 host/lifecycle/anchor work as incomplete in `specs/002-product-regression-recovery/evidence/wave-3.md` (FR-032-FR-034, FR-049-FR-052)

**Checkpoint**: US4 safely prepares release parity. It does not claim artistic/user approval or enable production animation.

---

## Phase 7: User Story 5 — Verify and Roll Back Each Recovery Wave (Priority: P2)

**Goal**: Each wave has exact-commit proof and non-destructive rollback; unreproduced historical symptoms remain unchanged.

**Independent Test**: Traceability rows bind current reproduction, cause status, requirement, change, test, platform, artifact, and residual risk; no evidence is borrowed from another commit.

- [x] T060 [P] [US5] Compare current source/history and only exact relevant files from the saved snapshot for each reported symptom; record reproduced versus unreproduced disposition without restoring code in `specs/002-product-regression-recovery/regression-inventory.md` (FR-035-FR-036, FR-052-FR-053)
- [x] T061 [US5] Update `specs/002-product-regression-recovery/traceability.md` with exact changed files, red/green receipts, platform evidence, and residual risks after each implemented wave (FR-050-FR-052)
- [x] T062 [US5] Document non-destructive revert/kill-switch rollback and version-2 intent downgrade behavior in `specs/002-product-regression-recovery/evidence/rollback.md` (FR-029, FR-036, FR-053, FR-057)
- [x] T063 [US5] Reject any later-domain code edit lacking a current reproduction and focused red test; retain the decision in `specs/002-product-regression-recovery/regression-inventory.md` (FR-035, FR-052)

**Checkpoint**: US5 evidence remains commit- and platform-scoped; the 898-file snapshot was never restored wholesale.

---

## Phase 8: Cross-Cutting Verification and Delivery

**Purpose**: Run the complete fresh evidence packet without weakening gates or generalizing unavailable proof.

- [x] T064 Run TypeScript and Vitest as separate commands and record exact counts in `specs/002-product-regression-recovery/evidence/final-local.md` (SC-005, SC-010)
- [x] T065 Run focused journal/availability/ceremony tests, `check:all`, `ci:preflight`, i18n/deep/translation/RTL/accessibility, sync/auth, PWA/offline, canonical visual, and task-completion checks; record exact command statuses, including the inherited ratchet FAIL, in `specs/002-product-regression-recovery/evidence/final-local.md` (FR-047-FR-052)
- [x] T066 Run PDI diff/full, build once, then sequential PDI bundle/release-artifact/bundle-budget/Chrome-performance checks; stage and run PDI staged only after final diff review in `specs/002-product-regression-recovery/evidence/final-local.md` (FR-048-FR-050, FR-055)
- [x] T067 Run Snyk MCP if callable or the scoped local CLI fallback, the narrowest `/Users/yehor/.codex/bin/codex-security-suite.sh` profile, and `npm audit --audit-level=high`; record blockers as `UNVERIFIED` in `specs/002-product-regression-recovery/evidence/security.md` (FR-049)
- [x] T068 Run available Android, iOS, and Tauri builds/smokes without claiming physical-device, native-AT, or Windows proof; record exact results and gaps in `specs/002-product-regression-recovery/evidence/platforms.md` (FR-046-FR-051)
- [x] T069 Perform the production-equivalent local browser checks reachable without credentials or production data and record command/result evidence plus unavailable authenticated surfaces in `specs/002-product-regression-recovery/evidence/browser.md` (FR-016-FR-019, FR-041, FR-047-FR-051)
- [x] T070 Review `git diff`, `git diff --check`, status, generated artifacts, secrets, production-data substitution, test-only runtime reachability, and all ten role dispositions in `specs/002-product-regression-recovery/evidence/final-local.md` (FR-049, FR-052, FR-055)
- [ ] T071 Read the repository commit-pipeline knowledge, generate valid `.verification-done`, stage only Epic 002 files, and create reviewable batch commit(s) on `codex/002-product-regression-recovery` (FR-036, FR-050, FR-053)
- [ ] T072 Fetch and verify divergence, push the branch, create the Wave 1 review, and wait for exact-commit CI without force push or history rewrite; record links/status in `specs/002-product-regression-recovery/evidence/remote.md` (FR-036, FR-050, FR-053)
- [ ] T072a Before production rollout, apply and exercise the single Supabase password-removal migration on an explicitly authorized non-production project with old/new-client, Storage RLS, paused conversion, strict promotion, and forward-recovery receipts; regenerate canonical Supabase types from that exact target. Source/static tests and hand reconciliation alone cannot close this gate (FR-037, FR-050, FR-058, FR-062-FR-065)
- [ ] T073 After authorized merge/deploy, verify the exact SHA/capability receipt and cache-busted public runtime; the user alone performs just-in-time real-account removal confirmation, with all missing device/human proof kept `UNVERIFIED` in `specs/002-product-regression-recovery/evidence/remote.md` (FR-012, FR-050-FR-051)

---

## Dependencies and Execution Order

### Phase dependencies

- Phase 1 establishes the isolated baseline.
- Phase 2 depends on Phase 1 and blocks both P1 stories.
- US1 and US2 share journal types/UI/i18n files; execute US1 before US2 in this lane to avoid evidence and edit conflicts.
- US3 can begin after Phase 1 but its final consumer audit waits for US1/US2 journal states.
- US4 receipt work can proceed after Phase 1; host integration waits for US2 save/list semantics. Production enablement is explicitly outside completion while human gates are missing.
- US5 runs alongside each wave but cannot label a wave complete before its exact evidence exists.
- Phase 8 depends on every implementation phase selected for the branch.

### Within each behavior change

1. Complete and run the named red test.
2. Reject infrastructure or fixture failures as red evidence.
3. Implement only the scoped contract.
4. Rerun the same test green.
5. Run the blast-radius checks named by the story.
6. Update traceability with exact evidence or `UNVERIFIED`.

### Parallel opportunities

- T004 and T005 are independent evidence setup.
- T009-T017 are separate red-test files, but main implementation starts only after their valid failures are retained.
- T030 and T039 use the same locale files and therefore are not parallel with each other.
- T032-T035 are independently writable test surfaces except T032/T035 share one file; run those two serially.
- T041-T044 and T051-T053 use different docs/test files and may run in parallel after their prerequisites.
- Security, platform, and browser checks T067-T069 can be prepared independently, but artifact-sensitive build checks in T066 run sequentially.

## Implementation Strategy

### MVP

Phases 1-3 deliver safe password removal and truthful cleanup state. Do not deploy the MVP until US2 partial-read behavior and the cross-cutting security/data checks relevant to Wave 1 also pass, because the user symptom includes both removal and missing journal content.

### Incremental delivery

1. Wave 1: US1 + US2, exact tests/security/PDI/browser evidence, reviewable PR.
2. Wave 2: US3 gate inventory and authoritative count, based on updated accepted main.
3. Wave 3: US4 release receipt and safe disabled state; enablement only in a later separately approved exact-candidate change.
4. Wave 4+: only reproduced items from US5, split by domain.

## Done when

- Every completed task is checked only after its named evidence exists.
- All checklists remain complete.
- No required failing check is hidden or weakened.
- Every unavailable proof stays `UNVERIFIED` with a closure path.
- No production data or credentials are accessed, and no real-account password removal is automated.

## Retained RED-evidence gaps

Unchecked red-test tasks T009-T016, T032-T035, T042-T044, T051, and T053 have implemented GREEN coverage in consolidated current files, but an exact valid pre-implementation terminal receipt was not retained for every complete task statement. They remain unchecked rather than reconstructing failures from memory or treating a subagent summary as proof. This evidence gap does not weaken the implemented assertions; it prevents a full red-first-process PASS claim.
