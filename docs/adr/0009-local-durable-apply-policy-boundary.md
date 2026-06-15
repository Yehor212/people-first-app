# ADR-0009: Local durable apply policy boundary

- **Status:** Accepted (planning guardrail; no runtime change)
- **Date:** 2026-06-14
- **Deciders:** Codex council review
- **Tags:** sync, indexeddb, dexie, offline-first, architecture

## Context

ZenFlow is local-first: Dexie/IndexedDB is the durable local source of truth and
Zustand is the synchronous in-memory mirror. ADR-0002 documents that bridge.
The app now also has Telegram-grade ordered sync, legacy backup/snapshot sync,
offline queues, tombstones, Broadcast wake-ups, and V1/V2 shell parity.

The question is whether to move IndexedDB sync logic into a separate module now.
The answer is no for a broad extraction. The current behavior has several
load-bearing owners:

- `src/hooks/useIndexedDB.ts` owns generic IndexedDB load/write helpers,
  local fallback handling, validation, refresh listeners, and stale-refresh
  protection while a local write is pending.
- `src/stores/useHydrateUserData.ts` owns IndexedDB-to-Zustand hydration and
  registration of persistence setters.
- `src/stores/userDataStore.ts` owns synchronous store reads/actions and the
  current Zustand-to-IndexedDB setter bridge.
- `src/storage/eventSync.ts` owns ordered event-log writes, durable event
  broadcast, delta fetch/apply, local cursor persistence, tombstone handling
  during delta apply, and refresh after successful local apply.
- `src/hooks/useDeltaSyncEffects.ts` and `src/hooks/useTelegramGradeSyncRuntime.ts`
  own runtime pull/apply scheduling, leader locking, retry, resume, online,
  broadcast, and V1/V2 shared mounting.
- `src/storage/cloudSync.ts`, `src/storage/backup.ts`, and
  `src/storage/realtimeSync.ts` own legacy snapshot/backup and granular
  bootstrap/recovery paths.
- `src/storage/deletionTracker.ts` and `src/storage/sync/serverTombstones.ts`
  own local and server tombstone protection.
- `src/lib/offlineQueue.ts`, `src/lib/syncOrchestrator.ts`, and
  `src/lib/syncBroadcast.ts` own durable retry, legacy operation ordering, and
  wake-up signaling.

Moving these responsibilities now would risk creating a third sync owner instead
of clarifying the existing two eras: legacy snapshot recovery and ordered
event-log convergence.

## Decision

Do not move IndexedDB sync implementation now. Instead, reserve a future
boundary named **local durable apply policy** for the narrow behavior that must
be common to every ordered local apply path.

That future boundary may include:

- applying ordered remote events to Dexie, currently `applyDelta()`;
- saving the sync cursor only after the local IndexedDB apply transaction
  succeeds;
- tombstone filtering and anti-resurrection checks during local apply;
- calling `triggerDataRefresh()` only after durable local state changes commit.

The boundary is a policy boundary, not a new sync engine. Until a specific bug or
planned refactor justifies implementation, the current code remains the source
of behavior.

## Explicit Non-Goals

This ADR does not authorize:

- moving or rewriting `src/storage/sync/*` domain implementations;
- changing `useIndexedDB`, `useHydrateUserData`, or `userDataStore` behavior;
- changing backup, import/export, tombstone, offline queue, Broadcast, or
  Supabase event schema behavior;
- changing runtime mounting in V1/V2 shells;
- changing feature handlers, UI flows, auth/session sync startup, native resume,
  device sessions, or service worker behavior;
- replacing legacy backup recovery with the event log in the same change;
- broad folder reshuffles, barrel churn, or renames without behavior proof.

## Triggers For A Real Extraction

A real move into the local durable apply policy boundary is allowed only when at
least one concrete trigger exists:

- a verified stale-refresh or resurrection bug shows that local apply policy is
  duplicated or inconsistent;
- V1/V2 runtime proof shows different local apply or cursor behavior for the
  same ordered event;
- a multi-tab or native resume bug shows cursor advancement outside the sync
  leader/apply transaction contract;
- a new `sync_events.entity_type` requires a reusable local apply path and tests;
- backup/snapshot recovery can overwrite newer event-log state and the fix needs
  a shared anti-resurrection policy;
- two or more domain sync paths need the same durable local apply helper and the
  helper can be extracted without changing ownership of Supabase writes;
- a planned feature-module migration would otherwise duplicate Dexie apply,
  cursor, tombstone, or refresh logic.

If none of these triggers exists, prefer adding tests, documentation, or a tiny
pure helper over moving runtime code.

## Consequences

**Positive:**
- Future sync refactors have a named, narrow target.
- Reviewers can reject broad "IndexedDB sync cleanup" changes that do not prove
  a concrete trigger.
- The existing ordered sync contract stays authoritative while the legacy backup
  path remains recovery/bootstrap only.

**Negative:**
- Some duplication remains in the short term.
- The bridge pattern keeps its current sharp edges until a verified issue
  justifies changing it.

**Neutral:**
- This ADR is documentation only. It changes no runtime behavior and creates no
  new module today.

## Rollout / Migration Plan

No migration happens with this ADR.

When a future trigger exists:

1. Emit an `AGENT_CHANGE_NOTICE` because storage/sync/IndexedDB are protected
   surfaces.
2. Write or update regression tests that reproduce the trigger first.
3. Extract the smallest local durable apply helper or module around the proven
   behavior.
4. Keep Supabase writes, domain mapping, runtime scheduling, and hydration bridge
   ownership unchanged unless separately justified.
5. Verify V1/V2 and platform-sensitive behavior before claiming completion.

Rollback for this ADR is to delete this file. Rollback for any future code
extraction must be a normal revert of that implementation PR.

## Verification Required Before Any Future Extraction

Before moving code into the boundary, run and record fresh evidence:

- `npm run check:sync-contract`;
- targeted sync tests for `eventSync`, `useDeltaSyncEffects`, `useIndexedDB`,
  and the affected domain sync files;
- anti-resurrection/delete tests when tombstones are involved;
- offline queue/outbox tests when durable event writes or retries are involved;
- V1/V2 runtime proof for the affected entity or route;
- multi-tab or Broadcast wake-up proof when cursor ownership can be affected;
- live same-account Supabase proof or an explicit `UNVERIFIED` note when live
  credentials are unavailable.

## References

- ADR-0002: Zustand + Dexie bridge pattern for persistent client state
- ADR-0007: Telegram-Grade Runtime Reliability
- `ARCHITECTURE.md`
- `docs/ai/SYNC_CONTRACT.md`
- `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`
- `src/hooks/useIndexedDB.ts`
- `src/stores/useHydrateUserData.ts`
- `src/stores/userDataStore.ts`
- `src/storage/eventSync.ts`
- `src/hooks/useDeltaSyncEffects.ts`
