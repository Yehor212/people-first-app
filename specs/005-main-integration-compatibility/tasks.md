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
