# Tasks: Main Integration Compatibility

Input: spec.md, plan.md, research.md, data-model.md and contracts/internal-seams.md. Execute sequentially in the existing lane. Tests are mandatory under repository policy.

## Setup And Baseline

- [x] T001 Record approval, fresh workspace/RAG state, source preservation and PROPOSED constitution status.
- [x] T002 Capture full React 19 RED, type failures and twelve configured cycles before first-party adaptation; inspect affected source and policies.
- [x] T003 Complete this specification, design/contracts, quality checklists and requirement/task analysis.

## US1: Existing Interaction Boundaries

- [x] T004 [US1] Extend actual inert coverage in src/features/journal/__tests__/JournalModule.handoffBehavior.test.tsx and src/pages/nav-v2/__tests__/OrbPage.test.tsx where missing; run with the four known failed tests before production edits.
- [x] T005 [US1] Adapt refs, nullable contracts, unknown panel props and scoped JSX in exact typecheck-reported components/hooks/tests; remove newly redundant assertions in e2e/orb-resize-readiness.spec.ts, SlashCommandMenu.tsx and recordingSave.test.tsx only.
- [x] T006 [US1] Use boolean inert in affected drawer, progress sharing, journal, habits, orb and settings surfaces; remove obsolete motion casts while preserving imperative DOM attributes.
- [x] T007 [US1] Rerun original failing assertions and focused tests, typecheck/lint; inspect rendered focus/interaction in desktop/mobile, RTL/reduced motion and run inline visual critic.

## US2: Data Contracts Survive Separation

- [x] T008 [US2] Add shared writer/facade function and device-cache identity regression under src/storage/__tests__ and run RED; capture existing event/deletion/settings/journal owner baseline.
- [x] T009 [US2] Extract unchanged producer/types/cache/owner helper to src/storage/eventSyncWriter.ts, keep eventSync.ts exports and repoint src/storage/sync producers plus automationPreferences.ts; adjust physical test mocks without weakening assertions.
- [x] T010 [US2] Extract unchanged deletion constants/types to src/storage/deletionTrackerKeys.ts, retain tracker re-exports, repoint settingSyncPolicy.ts and replace the two stats self-barrel imports.
- [x] T011 [US2] Relocate existing producer checks in scripts/check-sync-contract.cjs, add facade-wiring enforcement and rerun identity/owner/retry/idempotency/deletion/local-only/journal regressions.
- [x] T012 [US2] Require zero cycles and green full tests, typecheck/lint, build/bundle and applicable architecture/governance/security/sync checks; record unavailable proof in verification.md.

## US3: Preserve And Publish All Work

- [x] T013 [US3] Inspect final diff/status and original inputs; update this ledger and docs/superpowers/plans/2026-09-09-all-branch-main-integration.md with actual results; populate fresh hook evidence with test counts.
- [ ] T014 [US3] Commit normally, push the existing branch and update PR #112 with current exact-head evidence and five-platform boundaries; wait for required CI without bypass.
- [ ] T015 [US3] Merge normally, fetch main, verify all fifteen original heads plus 538ff957 as ancestors, retain refs/source copies and report exact main tip and platform/public/device status.

## Dependencies

T001–T003 precede code. T004 precedes T005–T007; T008 precedes T009–T011. US1 and US2 are independently testable but both block publication. T012 blocks T013–T015, which execute in order. Required failures remain open until repaired or explicitly reported. No parallel-agent task or MVP omission is planned.

## Execution Notes

T005 preserved the original SlashCommandMenu non-null assertion: after its ref contract correctly became nullable, that assertion remained necessary. The recording-save and Playwright assertions identified as redundant were removed without changing behavior. See [verification.md](verification.md) for the observed RED/GREEN sequence and remaining publication gates.

## Current-Head CI Compatibility Follow-up

- [ ] T016 [US3] Restore the Telegram workflow contract's exact approved deploy-pages v5.0.1 SHA after local and remote RED; retain prior forbidden-tag checks, reject the new unpinned tag, rerun local Telegram checks and fresh exact-head CI before T014–T015 complete.
- [ ] T017 [US3] Align offline Diary evidence with its previously approved Orb background without dropping cache/durability assertions; add explicit reduced-motion evidence, refresh only the two directly inspected stale desktop/mobile Diary-draft screenshots from current browser output, keep comparison thresholds unchanged and rerun exact-head CI.
- [ ] T018 [US3] Fix the reproduced offline optional-prewarm import at its idle callback without altering the canonical renderer or global chunk-error dialog; require new fast RED/GREEN and the unchanged offline entry/save/reload journey before publication.
- [x] T019 [US3] Record direct owner authorization at 15:23 UTC for the separately exposed PWA editor packaging/cache contract; update spec.md, plan.md, research.md and delivery contract without changing the prior compatibility history.
- [x] T020 [US3] Add isolated emitted-graph, CSS/asset, cycle, missing dependency, revision, deduplication and size regressions in scripts/__tests__/diary-offline-precache.test.mjs and run RED before implementation.
- [x] T021 [US3] Implement scripts/diary-offline-precache.mjs and wire its collector/manifest transform in vite.config.ts only under pwaEnabled; rerun the same focused tests, actual production build and e2e/diary-pwa-offline.spec.ts without online editor warming or dropped assertions.
- [x] T022 [US3] Verify final injected entries/bytes, native-disabled build, source integrity/security, unchanged visual thresholds and broad preflight; update verification.md and the integration plan before normal commit/push and exact-head CI in T014–T015.

T020 precedes T021; T022 blocks T014–T015. All work remains inline in the existing locked lane. No partial offline claim substitutes for the complete save/reload/reconnect journey.

- [x] T023 [US3] Owner approved at 16:08 UTC on 2026-09-09: use 655360 bytes for the measured 566129-byte editor/list dependency payload, retaining the existing image and 3 MiB per-file guard. Boundary tests cover exact-limit acceptance and one-byte-over rejection; T021–T022 still require fresh build and runtime acceptance before publication.

Local acceptance snapshot at 16:45 UTC: T021–T022 passed the final build, full preflight and repeated browser checks documented in verification.md. T014–T018 remain open only for their normal publication/exact-head CI clauses; they are not missing implementation. Record the eventual merge and ancestry in PR #112 and the ignored final receipt rather than marking future actions complete in this pre-publication commit.
