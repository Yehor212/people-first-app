# Tasks: PWA Motion, Navigation, and Icon Quality

**Authorization boundary**: The user authorized these dependency-ordered local source/test tasks on 2026-08-09. Issue creation, commit, push, PR, publication, deployment, native work, and feature-002 activation remain prohibited.

## Traceability key

`FR` and `SC` references point to [spec.md](spec.md). Each source task requires its preceding red/characterization task to be retained in evidence before modification.

## Phase 0 — Baseline and test-first evidence

- [ ] **T001** Capture baseline for optional reduced-motion work in `src/components/habit-hub/HabitDetailSheet.tsx` and `src/components/habit-pictogram/HabitMotionPlayer.tsx`; add failing/characterization coverage at `src/components/habit-hub/__tests__/HabitDetailSheet.motionNavigation.test.tsx` and `src/components/habit-pictogram/__tests__/HabitMotionPlayer.reducedMotion.test.tsx`. **Maps**: FR-001, FR-002, SC-001. **Evidence**: executed red/baseline command and network/load assertion. **Rollback**: delete only new isolated tests if abandoned before source change.
- [ ] **T002** Add an expected-red semantic test at `src/components/habit-hub/__tests__/HabitDetailSheet.motionNavigation.test.tsx` proving current tabs lack the final association/keyboard contract. **Maps**: FR-003, SC-002. **Evidence**: one failing assertion tied to current `HabitDetailSheet.tsx`. **Rollback**: isolated test deletion before source change.
- [ ] **T003** Add an expected-red test at `src/components/habit-hub/__tests__/HabitHeatmapGrid.summary.test.tsx` counting actionable/focusable cells and requiring one History control. **Maps**: FR-004, SC-003. **Evidence**: current 182-cell failure count. **Rollback**: isolated test deletion before source change.
- [ ] **T004** Add expected-red tests at `src/features/journal/__tests__/JournalCalendar.accessibleStatus.test.tsx` for localized date/entry/mood, emotion decoration/label, and private-mode negative control. **Maps**: FR-005, FR-008, SC-004. **Evidence**: baseline markup/accessible-name failure. **Rollback**: isolated test deletion before source change.
- [ ] **T005** Add expected-red render-bound tests at `src/features/journal/__tests__/JournalEntryList.renderWindow.test.tsx` using isolated test fixtures with 97+ entries. **Maps**: FR-006, SC-005. **Evidence**: current mounted-card count >96; fixture path proven test-only. **Rollback**: isolated test deletion before source change.
- [ ] **T006** Run `npm run assets:logos:check` and `npm run assets:logos:proof` as a characterization baseline; record source hashes for `scripts/generate-icons.cjs`, `scripts/check-brand-logo-assets.cjs`, and `config/brand-logo-assets.json`. **Maps**: FR-007, SC-006. **Evidence**: command exit/result and proof artifact path. **Rollback**: none; read-only baseline.
- [ ] **T007** Add expected-red inventory tests for exactly 79 indefinite emotion-SMIL nodes and 34 JavaScript-loop waiver files, requiring one checked classification/stop-contract registry and six-second reduced-motion stability. **Maps**: FR-001, FR-010, FR-011, SC-001, SC-007, SC-008. **Evidence**: failing count/registry/gate assertions. **Rollback**: isolated test deletion before source change.
- [ ] **T008** Add expected-red inventory and interaction tests for every production custom tablist, including Habit Detail, Habit Creation, Legal, and Leaderboard, under LTR and RTL. **Maps**: FR-003, FR-012, SC-002, SC-009. **Evidence**: current partial-ARIA failures. **Rollback**: isolated test deletion before source change.
- [ ] **T009** Add expected-red `AnimatedCalendar` tests requiring localized civil date plus visible mood/status/metric facts and rejecting raw persistence tokens. **Maps**: FR-005, FR-013, SC-004. **Evidence**: current `aria-label={dateKey}` failure. **Rollback**: isolated test deletion before source change.

## Phase 1 — Motion and tab owner

- [ ] **T010** Implement the verified effective-motion boundary and central `src/lib/motionSurfaceRegistry.ts`; bind all 79 emotion-SMIL nodes and all 34 JavaScript-loop waiver files to classification and stop contracts. **Depends on**: T001, T007. **Maps**: FR-001, FR-002, FR-010, FR-011, SC-001, SC-007, SC-008. **Evidence**: focused green count/gate/stability tests. **Platform**: Web/PWA shared; native receipt required later. **Rollback**: revert registry/gate/test hunks.
- [ ] **T011** Implement declared optional-motion behavior in `src/components/habit-hub/HabitDetailSheet.tsx` and `src/components/habit-pictogram/HabitMotionPlayer.tsx`; preserve static semantic state and canonical orb isolation. **Depends on**: T010. **Maps**: FR-001, FR-002, SC-001. **Evidence**: green test plus six-second browser/network capture. **Rollback**: revert scoped hunks; no data migration.
- [ ] **T012** Implement one shared tab keyboard/focus owner and apply it to every inventoried custom production tablist; add stable IDs/panels, roving focus, activation, RTL visual direction, visible focus, and 44px targets. **Depends on**: T002, T008, T011. **Maps**: FR-003, FR-008, FR-012, SC-002, SC-009. **Evidence**: green LTR/RTL inventory and interaction tests. **Rollback**: revert hook/owner/test hunks while retaining existing local state owners.

## Phase 2 — Summary, semantics, and bounded rendering

- [ ] **T013** Convert `src/components/habit-hub/HabitHeatmapGrid.tsx` to a read-only, non-color summary with one 44px History action wired to the existing `HabitDetailSheet.tsx` state owner; update `src/components/habit-hub/__tests__/HabitHeatmapGrid.summary.test.tsx`. **Depends on**: T003, T012. **Maps**: FR-004, FR-008, SC-003. **Evidence**: green zero-cell-focus/one-action test and touch-target static check. **Rollback**: revert both component hunks and test.
- [ ] **T014** Implement the calendar/emotion accessible-name contract in `src/components/animated-stats/AnimatedCalendar.tsx`, `src/features/journal/JournalCalendar.tsx`, `src/features/journal/JournalCalendarFull.tsx`, and `AnimatedEmotionEmoji`; update focused tests. **Depends on**: T004, T009, T010. **Maps**: FR-005, FR-008, FR-010, FR-013, SC-004, SC-007. **Evidence**: green locale/private/raw-token negative-control tests. **Rollback**: revert scoped semantics/test hunks.
- [ ] **T015** Add required locale keys in the exact files identified by a parity audit and update relevant i18n tests. **Depends on**: T012, T013, T014. **Maps**: FR-008, FR-012, FR-013, SC-002 through SC-004, SC-009. **Evidence**: `npm run i18n:check`, `npm run i18n:deep`, and `npm run check:translation-quality`. **Rollback**: revert keys as one atomic change with usages.
- [ ] **T016** Implement a derived 96-card text-result render window and truthful continuation in `src/features/journal/JournalEntryList.tsx`; update `src/features/journal/__tests__/JournalEntryList.renderWindow.test.tsx`. **Depends on**: T005. **Maps**: FR-006, FR-009, SC-005. **Evidence**: green DOM count/order/no-duplicate/focus/scroll/private-mode tests. **Platform**: Web/PWA shared; native receipt required later. **Rollback**: revert list/test hunks; no user data mutation.

## Phase 3 — Icon boundary and validation

- [ ] **T017** Change generator/check/config paths only where the verified manifest defect requires it; use `scripts/generate-icons.cjs` and `scripts/check-brand-logo-assets.cjs`, generate outputs through the owned command, and never hand-edit raster/native outputs. **Depends on**: T006. **Maps**: FR-007, SC-006. **Evidence**: focused red/green guard, asset check, proof sheet, visual critic. **Rollback**: revert generator/check then regenerate public/docs manifests.
- [ ] **T018** Run focused green tests for T001-T009 and T010-T017; run production-data scans, typecheck, lint, translation checks, `check:canonical-orbs`, and icon checks. **Depends on**: T010-T017. **Maps**: FR-009, all SCs. **Evidence**: exact command outputs/counts. **Rollback**: diagnose/revert scoped change; do not weaken checks.
- [ ] **T019** Perform Web/Vite and installed-PWA browser verification: reduced motion, six-second stability, zero optional network assets, all custom tabs LTR/RTL, heatmap focus count, calendar names, 96-card bound, console, and performance capture. Request native owner receipts if shared modules changed. **Depends on**: T018. **Maps**: all FRs/SCs. **Evidence**: retained screenshots/trace/command paths; absent device/public/store/artistic evidence remains `UNVERIFIED`.
- [ ] **T020** Review `git diff --check`, scoped diff, `git status --short`, artifact hashes, platform matrix, visual-critic record, and rollback path in the implementation evidence successor. **Depends on**: T019. **Maps**: FR-009, all SCs. **Evidence**: final local receipt; no commit/push/PR.

## Requirement-to-task map

| Requirement | Tasks | Success criteria |
| --- | --- | --- |
| FR-001–FR-002 | T001, T007, T010-T011, T018-T019 | SC-001, SC-007, SC-008 |
| FR-003 | T002, T008, T012, T015, T018-T019 | SC-002, SC-009 |
| FR-004 | T003, T013, T015, T018-T019 | SC-003 |
| FR-005 | T004, T009, T014-T015, T018-T019 | SC-004 |
| FR-006 | T005, T016, T018-T019 | SC-005 |
| FR-007 | T006, T017-T019 | SC-006 |
| FR-008–FR-009 | T004, T008-T016, T018-T020 | SC-001 through SC-009 |
| FR-010–FR-011 | T007, T010, T014, T018-T019 | SC-007, SC-008 |
| FR-012 | T008, T012, T015, T018-T019 | SC-009 |
| FR-013 | T009, T014-T015, T018-T019 | SC-004 |
