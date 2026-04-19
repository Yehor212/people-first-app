# ADR-0002: Zustand + Dexie bridge pattern for persistent client state

- **Status:** Accepted (retroactive — pattern adopted over multiple Phase 2 PRs in 2026-Q1)
- **Date:** 2026-04-18 (retroactively recorded)
- **Deciders:** Team Lead + frontend-builder
- **Tags:** state-management, persistence, offline-first

## Context

ZenFlow has three concurrent requirements that naively conflict:

1. **Synchronous reads** from components (`useUserDataStore((s) => s.moods)`) — tabs render in &lt;16 ms and cannot await an IndexedDB round-trip.
2. **Persistent storage** — journal entries, moods, habits must survive app restarts and device reboots; localStorage cannot hold the data volume.
3. **Cross-tab + cross-device sync** — Supabase Realtime pushes remote changes that must update all open instances without a full reload.

A single-store approach fails one of these. Redux + redux-persist synchronizes state → disk but does not handle IndexedDB's async API cleanly. Pure Dexie + hooks forces every component to go through `useLiveQuery` with Suspense boundaries and awaits on every read.

## Decision

We use a **bridge pattern**: Dexie is the source of persistence; Zustand is the in-memory mirror that components read synchronously. A dedicated "hydrate" hook (`useHydrateUserData.ts`, `useHydrateGamification.ts`) bridges the two directions:

- **IndexedDB → Zustand** on app boot: `_hydrateFromDB()` synchronously seeds the store from the last persisted state, with array-validation guards (Law 14: State Integrity).
- **Zustand → IndexedDB** on each store mutation: registered setters (`setMoods`, `setHabits`, etc.) fire async writes without blocking the component.
- **Supabase Realtime → Zustand**: `useCloudSyncEffects.ts` subscribes to remote events and patches the store using the Effect-Sync Dedup Pattern (`JSON.stringify` ref guard to prevent triple-fire from reference-only changes).

## Alternatives Considered

- **Redux Toolkit + redux-persist (IndexedDB adapter)** — rejected: persist adapters force full snapshots, poor fit for append-heavy data (journal entries, moods). Middleware boilerplate.
- **Pure Dexie + `useLiveQuery`** — rejected: forces Suspense and await in every read site; increases bundle size of loading states; complicates offline-first UX.
- **Valtio + IDB-Keyval** — rejected: proxy-based reactivity harder to reason about for long-lived data; IDB-Keyval lacks the indexing we need for moods/habits queries.
- **Jotai + atomWithStorage** — rejected: atom-per-slice granularity fights against the "one store per domain" mental model that our feature modules rely on.

## Consequences

**Positive:**
- O(1) synchronous reads from any component (Zustand selector pattern).
- Offline-first is native — writes complete locally immediately; Dexie persists; Supabase catch-up runs async.
- Realtime updates work without reloads.
- Bridge hooks are testable in isolation.

**Negative:**
- Dual-storage invariant ("Zustand and IndexedDB must agree") is the developer's job; drift means UI lies until refresh. Hydrate bridge + `Array.isArray` validation mitigate but don't eliminate.
- Migration complexity: every schema change must migrate both Zustand shape and Dexie version.
- Effect-Sync Dedup ref guard (JSON.stringify) is O(n) on each effect fire — acceptable for our data sizes, would not scale to 10k+ entries without further optimization.

**Neutral:**
- Store count has grown beyond initial "4 stores" plan — current 8 runtime + 2 bridges + barrel (see ARCHITECTURE.md Codebase Metrics, auto-generated). This is organic, not a smell.

## Rollout / Migration Plan

Already rolled out. Retroactive ADR documents the pattern for future onboarding.

## Verification

- `npm run test` passes `src/stores/__tests__/*` (Zustand shape contracts)
- `npm run test` passes `src/hooks/__tests__/useHydrate*.test.ts`
- Invariants enforced by ESLint rule `no-restricted-globals` (direct `localStorage` forbidden; use `SK` + `safeJson`).
- Effect-Sync Dedup Pattern documented in `ARCHITECTURE.md` State Management § rule 7.

## References

- Fowler, "Repository Pattern" (POEAA, 2002) — conceptual ancestor of the bridge.
- Zustand docs: https://zustand-demo.pmnd.rs/ — selector pattern.
- Dexie: https://dexie.org/docs/Tutorial/React.
- Internal: `ARCHITECTURE.md` State Management section; `docs/law14-state-integrity.md`.
