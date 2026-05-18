# ZenFlow Sync Contract

Purpose: preserve Telegram-style synchronization semantics across V1, V2, web,
PWA, Android, iOS, and desktop surfaces.

This is an operator contract for future agents. Read it before changing habits,
journal, mood, focus, gratitude, settings, backup, Dexie, Zustand hydration,
Supabase sync, offline queue, broadcast, or app lifecycle code.

For the exact "nothing remains" completion definition, read
`docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md` after this file. This
contract owns invariants; the closure document owns the required proof matrix.

## North Star

The latest user action must become the authoritative state on every surface and
platform after sync settles. Local UI may update optimistically, but remote and
cross-tab convergence must be driven by ordered sync events, not by whichever
snapshot happens to finish last.

## Telegram-Style Evidence Model

ZenFlow does not copy Telegram internals, but the operator model is the same:
ordered state beats arrival order. Telegram clients use sequence state such as
`seq` and `pts` to apply updates once, ignore duplicates, and recover gaps before
claiming convergence. In ZenFlow, the equivalent proof is:

- every synced user action writes or maps to an ordered event;
- every remote consumer applies events through `applyDelta()` or a tested wrapper;
- every client stores cursor state only after apply succeeds;
- gaps trigger recovery instead of falling back to stale snapshots;
- broadcast is a wake-up signal, not the durable source of truth.

Supabase Realtime Broadcast is useful for low-latency wakeups, but it is not a
replacement for the durable event log. If Broadcast arrives before a DB write is
visible, or is missed by an offline client, the next delta pull must still converge
to the latest event-log state.

For public/debug proof, ZenFlow exposes an opt-in privacy-safe diagnostic recorder
at `window.__zenflowSyncHealth` when `?syncHealth=1`, `?syncDebug=true`,
`?runtimeSync=on`, or local key `zenflow-sync-health-recorder` is
enabled. It may show route, auth state, online state, queue counts, last cursor,
and coarse sync receipts only. It must never expose payloads, entity ids, journal
text, habit names, or other user content, and it does not replace same-account
`smoke:sync-account` proof.

## Non-Negotiable Invariants

1. **Event log owns cross-device ordering.**
   - `sync_events.seq` is the server-authoritative ordering primitive.
   - Client lifecycle code must use `src/storage/eventSync.ts` cursor state for
     delta application.
   - Do not use `src/lib/syncCursor.ts` as a substitute for eventSync cursor
     state unless the two cursors are explicitly unified in the same change.

2. **Fetch is not sync unless apply succeeds.**
   - Any delta pull path must call `applyDelta()` or a wrapper that does.
   - Resume, visibility, online, native app-active, and broadcast paths must not
     stop at `fetchAllDeltas()`.

3. **One remote-change owner per feature flag state.**
   - When `deltaSync` is enabled, remote broadcast signals are owned by
     `useDeltaSyncEffects()` through the shared shell hook
     `useTelegramGradeSyncRuntime()`.
   - Legacy backup or granular pull code may still initialize broadcast, but it
     must not also consume the same remote signal and race delta application.

4. **Backup is recovery, not ordering.**
   - JSON backup/snapshot sync may bootstrap or repair a client.
   - It must not overwrite newer event-log state during normal cross-device
     convergence.

5. **Deletes are first-class actions.**
   - A delete must be durable before any merge can resurrect the entity.
   - New delete flows must write ordered delete events with stable operation ids.
   - Durable server tombstones in `sync_tombstones` are derived from delete events
     and back long-term anti-resurrection. The local `deletionTracker` remains an
     offline/immediate guard, not the only durable source.

6. **Every synced entity needs an apply path.**
   - If `sync_events.entity_type` accepts an entity, the client must either map
     it in `ENTITY_TABLE_MAP` or document and test a specific recovery path.
   - Do not add event writes for an entity type that remote clients cannot apply.

7. **Retries need idempotency.**
   - New critical user actions should use a stable operation/idempotency key.
   - `sync_events.idempotency_key` is a database UUID. Do not encode
     `device/entity/op` into that column; those semantics already live in
     separate columns and non-UUID keys fail against live Supabase.
   - Core data event writes must not be fire-and-forget. If the domain table
     mutation succeeds but `sync_events` cannot be written, the action must enter
     the critical `WRITE_SYNC_EVENT` outbox and broadcast only after a durable
     `sync_events.seq` exists.
   - Core sync functions must `await getPersistentDeviceId()` and
     `await writeEventAndBroadcast(...)` before returning. Returning while the
     event write is still in a `.then(...)` chain reopens the app-close data-loss
     window and is a sync regression.
   - Critical offline/outbox enqueue must wait for persistent storage. Updating
     queue state in memory is not enough for Android/iOS pause, browser tab close,
     or desktop process exit.
   - Fire-and-forget writes are acceptable only for legacy compatibility or
     low-risk telemetry-like updates that do not affect user state.

8. **V1 and V2 are one product state.**
   - V1 and V2 may have different UI, but they must read/write the same durable
     entities and converge through the same sync semantics.
   - Every app shell entry point must mount
     `src/hooks/useTelegramGradeSyncRuntime.ts`; never leave a V2 direct route
     with only local hydration or snapshot sync.
   - If a V2 action deletes, archives, edits, or completes a habit, V1 must not
     be able to rehydrate the old value from backup or stale local state.

9. **Multi-tab is part of cross-platform.**
   - A browser with two tabs is a sync platform.
   - Delta pull/apply work must pass through `runWithSyncLeaderLock()` so only
     one tab advances the local event cursor at a time.
   - Broadcast, online, visibility, interval, and native resume events may wake
     the runtime, but they must not bypass the leader lock.
   - `window.__zenflowSyncHealth` is diagnostic-only evidence for current queue,
     cursor, and receipt state. It must not become a second sync owner.

10. **Evidence beats intent.**
    - Sync fixes need tests or browser proof for the original failure mode.
    - If live Supabase proof is unavailable, mark it as UNVERIFIED and provide
      local test evidence plus the exact remaining proof gap.

## Files To Inspect Before Sync Work

- `src/storage/eventSync.ts`
- `src/hooks/useTelegramGradeSyncRuntime.ts`
- `src/hooks/useSyncHealthRuntime.ts`
- `src/hooks/useDeltaSyncEffects.ts`
- `src/hooks/useCloudSyncEffects.ts`
- `src/lib/syncBroadcast.ts`
- `src/lib/syncLeader.ts`
- `src/lib/syncGapDetector.ts`
- `src/lib/syncStateMachine.ts`
- `src/lib/syncOrchestrator.ts`
- `src/storage/sync/*`
- `src/storage/realtimeSync.ts`
- `src/storage/cloudSync.ts`
- `src/storage/backup.ts`
- `src/storage/deletionTracker.ts`
- `src/stores/useHydrateUserData.ts`
- `src/stores/userDataStore.ts`
- `supabase/migrations/*event_sync*.sql`

## Required Verification For Sync Changes

Minimum local gates:

```bash
cmd /c npm run typecheck
cmd /c npm run lint
cmd /c npm run check:sync-contract
cmd /c npm run test -- src/storage/__tests__/eventSync.test.ts src/lib/__tests__/syncStateMachine.test.ts src/lib/__tests__/syncGapDetector.test.ts src/storage/__tests__/deletionTracker.test.ts src/lib/__tests__/offlineQueueHandlers.test.ts
cmd /c npm run check:supabase-migration-prefixes
cmd /c npm run smoke:sync-account
```

`check:sync-contract` is the future-task hook for this contract. It verifies the
repo still has ordered event-log wiring, the critical event-write outbox,
snapshot-then-delta bootstrap, server-backed tombstones, anti-resurrection tests,
privacy-safe `window.__zenflowSyncHealth` diagnostics, and CI/doc references.

Behavioral gates for user-visible sync work:

- Perform a V1 -> V2 -> V1 round trip for the changed entity when both shells can
  touch it.
- Perform an offline/queued path check when the action can be made while offline.
- Perform a multi-tab or broadcast-trigger check when the action can be observed
  from another active browser context. The expected owner path is
  `runWithSyncLeaderLock()`; Broadcast is only the wake-up.
- For deletes, prove anti-resurrection: stale local state, backup recovery, or a
  delayed remote pull must not bring the deleted entity back.
- For settings and preferences, prove the active UI reads the same setting after
  hydration, reload, and route/shell switch.
- For same-account release claims, run `npm run smoke:sync-account` with
  `ZENFLOW_SYNC_TEST_EMAIL` and `ZENFLOW_SYNC_TEST_PASSWORD`; without those
  credentials the live account layer is `UNVERIFIED`, not passed.
- For public/debug investigations, open the affected URL with `?syncHealth=1`
  and inspect `window.__zenflowSyncHealth.snapshot()`. This is useful for queue,
  cursor, and receipt proof, but it is not account convergence proof by itself.

When UI or route behavior is involved, also run a production-browser smoke for
the affected route. When the change is intended for public users, verify remote
deployment with:

```bash
cmd /c npm run ci:remote:wait
```

After remote deployment, open the public URL with a cache-buster and, where the
tooling allows it, service workers disabled. Confirm the public asset hash or
rendered behavior belongs to the commit being verified.

## Stop Conditions

Stop and report before editing if:

- The change requires a new Supabase table, policy, trigger, or function and the
  migration path is unclear.
- A backup/snapshot path can still overwrite event-log state and there is no
  test proving the conflict order.
- A new entity writes sync events but has no remote apply path.
- A delete path cannot prove anti-resurrection behavior.
- A proposed fix relies on memory or previous CI output instead of fresh repo
  evidence.

## Current Known Gaps

- `deletionTracker` keeps local tombstones permanently for immediate/offline
  anti-resurrection. Long-term server permanence is backed by the
  `sync_tombstones` SQL path once migration
  `20260513224401_telegram_grade_sync_tombstones.sql` is applied.
- Live cross-device Supabase convergence still needs public account evidence for
  release claims. Local invariant coverage now includes the V1/V2 shared runtime,
  ordered deltas, server tombstones, and multi-tab delta ownership through
  `runWithSyncLeaderLock()`.

Do not describe the sync system as 100 percent complete unless every applicable
row in `docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md` has current evidence.
