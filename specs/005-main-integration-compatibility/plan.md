# Implementation Plan: Main Integration Compatibility

**Branch**: `codex/android-103ms-20260904`, existing locked lane | **Date**: 2026-09-09 | **Spec**: [spec.md](spec.md)

## Summary And Context

Complete the owner-approved React 19 adaptation and twelve-cycle repair before the normal merge of PR #112. Preserve fifteen original branch heads and local preservation commit `538ff957`, original source working copies and refs. This is not completion of the separate Android 103 ms gate.

Installed paired React/React DOM 19.2.8 and their scoped types run on the existing TypeScript/Vite/Capacitor stack. Existing full-suite RED: 10,364 cases, 10,330 passed, four failed, 23 pending and seven todo across 867 files. Four actual inert-attribute assertions fail; typecheck and configured circular analysis also fail. Existing dependency families only; no new paid service or production dependency.

## Constitution And Governance

Fresh constitution status is PROPOSED: proposal-only criteria remain nonbinding and noncritical. Repository test-first, owner-boundary, permanent deletion, visual and publication policies remain enforced. Direct owner approval on 2026-09-09 and the posted L3 notice authorize this repair, not storage redesign, personal-account mutation, branch deletion or guard relaxation. Pre-research and post-design review identify no conflict with these enforced contracts. Behavioral proof remains pending execution.

## Design And Write Set

1. In the exact typecheck-reported components/hooks/tests, initialize argumentless refs with undefined, express nullable element refs, use scoped React.JSX and narrow unknown panel props with actual property/type checks. Remove newly redundant assertions only. Do not mask errors with non-null casts.
2. In drawer, progress sharing, journal, habits, orb and settings surfaces, pass boolean inert under the same existing condition. Remove obsolete React 18 motion-prop casts. Keep imperative DOM setAttribute calls, animation timings, focus/back ownership, layout and copy unchanged.
3. Extract existing event producer/types/validators/cache into `src/storage/eventSyncWriter.ts`. Keep `eventSync.ts` public re-exports and delta/recovery logic. Move the shared network-owner helper unchanged; repoint seven sync producers and automation device-ID lookup to the writer. The writer must not depend on its delta consumer. Do not refactor journal recovery.
4. Extract unchanged deletion-key constants/types to `src/storage/deletionTrackerKeys.ts`; retain tracker re-exports and use the leaf from `settingSyncPolicy.ts`. Persistence and in-flight tombstones remain in the tracker.
5. Replace the two stats self-barrel imports with direct component imports. Relocate existing producer invariants in `scripts/check-sync-contract.cjs` to the writer and add facade-wiring enforcement; retain consumer and forbidden-pattern checks.
6. Update focused tests at their real seams, this feature directory, `.specify/feature.json`, the existing all-branch integration plan and current verification ledger. Existing package/lock pairing is already prepared. No hook implementation, AGENTS, schema, native source, asset or translation change is planned.

## Verification And Rollback

Use test-only RED additions and existing baseline before production edits. Rerun the four original failed assertions unchanged, affected-surface tests, writer/facade identity, owner/retry/idempotency/deletion/settings/journal recovery tests, zero-cycle analysis, separate typecheck and Vitest, lint, full build/bundle, architecture/context/governance checks, scoped Snyk and security evidence. Missing scanner proof is unverified, never PASS.

Inspect production-equivalent local browser focus/interaction at desktop/mobile, RTL and reduced motion. Run the inline visual critic without inferring device or artistic approval. Use only isolated test data, never personal app records.

Before publication inspect diff/status and ancestry, record fresh test counts for normal hooks, commit and push the existing branch, then require current exact-head CI for PR #112. Fetch merged main and recheck all original ancestors. No force, hook bypass, squash of required ancestry or branch deletion. Remote movement requires renewed validation.

Rollback is a normal inverse compatibility commit preserving history, reverting the paired code/dependency change together. No data migration exists to reverse.

## Platform And Domain Matrix

| Scope | Planned evidence | Unproven boundary |
|---|---|---|
| Web/Vite | Source/tests/build and rendered interaction | Public deployment needs fresh proof |
| Installed PWA | Shared source and browser lifecycle where available | Installed update lifecycle needs direct execution |
| Android/Capacitor | Exact-head Android CI, unchanged safe-area/back contracts | Device interaction and 103 ms remain separate |
| iOS/WKWebView | Exact-head iOS CI and shared source | Device keyboard/safe-area needs direct execution |
| Desktop/Tauri | Shared build and desktop-width review | Packaged Tauri needs direct execution |
| Accessibility | Actual inert, focus, RTL and reduced-motion coverage | jsdom alone is not browser proof |
| Performance | Existing smoke; unchanged canonical visuals | No universal native timing claim |
| Security/privacy/data | Owner, retry, tombstone, journal regressions and scans | No personal-account/live-sync inference |
| Store/release/operations | Required CI and preserved ancestry | No store submission or app termination |

## Execution

Follow [tasks.md](tasks.md) sequentially in this sole existing lane. US1 and US2 are independently testable but both block US3 publication. [analysis.md](analysis.md) maps all requirements. Record actual results and remaining gaps in verification.md. No new agent or worktree.
