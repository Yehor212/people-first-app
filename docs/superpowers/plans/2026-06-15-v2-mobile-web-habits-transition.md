# V2 Mobile Web Mood To Habits Transition Fix

Date: 2026-06-15
Scope: V2 only.

## Goal

Fix the phone web freeze/hang when switching from the V2 Mood/Orb tab to Habits, then lock the behavior with evidence-first tests and browser proof.

## Success Criteria

- A mobile web user can switch from Mood/Orb to Habits even when the first-run mood hint is visible.
- Any route-load wait state is explicit enough that the UI does not feel frozen.
- The fix is scoped to V2 navigation/onboarding hint behavior.
- Future agents have a short test-first policy for bug fixes/features.
- PASS claims have fresh evidence; unknown platform coverage is marked UNVERIFIED.

## Plan

1. Reproduce the hang and add a failing test before production code.
2. Make the mood first-run hint non-blocking for navigation while preserving explicit dismiss.
3. Add a small V2 page-load fallback if the lazy route boundary would otherwise render blank.
4. Update targeted unit/component tests.
5. Add a concise test-first agent policy and link it from `AGENTS.md`.
6. Run targeted Vitest, Playwright mobile-web verification, screenshot/perf evidence, and security/static checks.

## Out Of Scope

- V1 navigation.
- Auth/sync/storage schema changes.
- Native Android code unless browser proof identifies a native-specific issue.
- Visual redesign unrelated to this transition bug.
