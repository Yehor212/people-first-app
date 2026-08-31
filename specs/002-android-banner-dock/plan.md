# Implementation Plan: Android Habits Banner Dock

## Technical context

React owns eligibility and page reservation. `@capacitor-community/admob` owns the Android native banner view. `AdContext` coordinates lifecycle and placement; `adController` serializes native commands. `HabitsPage` owns the approved surface. IndexedDB remains local truth; this feature must not introduce business data, migrations, analytics, or direct localStorage.

## Constitution and repository gates

The repository constitution is `PROPOSED` and non-binding. Binding project instructions require an M2 change notice, test-first edits, protected-surface review, production-data-integrity checks, Android installed-artifact evidence, and explicit cross-platform status. Animation worktree and animation files are excluded.

## Coherent change slices

1. Add fail-safe Android variant configuration and an explicit test-ad QA build contract.
2. Add pure eligibility primitives for local-day emotional protection, entitlement, today-visible habits, native lifecycle, and IME.
3. Add account-scoped entitlement integration that denies on unknown; do not trust user-editable metadata.
4. Bound native banner operations and invalidate stale generations.
5. Preflight anchored adaptive geometry natively, reserve it in React, then reveal the view; clear on failure/removal.
6. Verify all deny transitions, RTL/safe areas, accessibility reachability, and non-Android no-op behavior.
7. Build, hash, install, and visually exercise the exact QA APK on API 36 using only Google test ads.

## Platform impact

| Platform | Intended result |
|---|---|
| Web/Vite | Ad-free, no dock, static and runtime regression checks |
| Installed PWA | Ad-free, no dock; installed runtime remains separate evidence |
| Android/Capacitor | Banner implementation and emulator runtime target |
| iOS/WKWebView | Ad-free, no Android native initialization or dock |
| Desktop/Tauri | Ad-free, no dock |
| Store/Release | No publication in this branch; production artifact and live serving remain separately gated |

## Rollback

Revert this feature branch as one unit. The production-safe fallback is ads disabled with no dock and explicit unavailable state; no data migration or remote write requires rollback.
