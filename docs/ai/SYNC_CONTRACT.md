# ZenFlow Sync Contract

Purpose: preserve Telegram-style synchronization semantics across V1, V2, web,
PWA, Android, iOS, and desktop surfaces.

This is an operator contract for future agents. Read it before changing habits,
journal, mood, focus, gratitude, settings, backup, Dexie, Zustand hydration,
Supabase sync, offline queue, broadcast, or app lifecycle code.

## North Star

The latest user action must become the authoritative state on every surface and
platform after sync settles. Local UI may update optimistically, but remote and
cross-tab convergence must be driven by ordered sync events, not by whichever
snapshot happens to finish last.

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
     `useDeltaSyncEffects()`.
   - Legacy backup or granular pull code may still initialize broadcast, but it
     must not also consume the same remote signal and race delta application.

4. **Backup is recovery, not ordering.**
   - JSON backup/snapshot sync may bootstrap or repair a client.
   - It must not overwrite newer event-log state during normal cross-device
     convergence.

5. **Deletes are first-class actions.**
   - A delete must be durable before any merge can resurrect the entity.
   - New delete flows should prefer ordered delete events and stable operation
     ids over capped local-only tombstone arrays.
   - Existing `deletionTracker` protects legacy paths, but its 5000-id cap is a
     known limitation, not the target model.

6. **Every synced entity needs an apply path.**
   - If `sync_events.entity_type` accepts an entity, the client must either map
     it in `ENTITY_TABLE_MAP` or document and test a specific recovery path.
   - Do not add event writes for an entity type that remote clients cannot apply.

7. **Retries need idempotency.**
   - New critical user actions should use a stable operation/idempotency key.
   - Fire-and-forget event writes are acceptable only for legacy compatibility
     or low-risk telemetry-like updates; core data must have a retry story.

8. **V1 and V2 are one product state.**
   - V1 and V2 may have different UI, but they must read/write the same durable
     entities and converge through the same sync semantics.
   - If a V2 action deletes, archives, edits, or completes a habit, V1 must not
     be able to rehydrate the old value from backup or stale local state.

9. **Multi-tab is part of cross-platform.**
   - A browser with two tabs is a sync platform.
   - Add BroadcastChannel, Web Locks, or a single queue owner when a change can
     create concurrent writers or duplicate remote pulls.

10. **Evidence beats intent.**
    - Sync fixes need tests or browser proof for the original failure mode.
    - If live Supabase proof is unavailable, mark it as UNVERIFIED and provide
      local test evidence plus the exact remaining proof gap.

## Files To Inspect Before Sync Work

- `src/storage/eventSync.ts`
- `src/hooks/useDeltaSyncEffects.ts`
- `src/hooks/useCloudSyncEffects.ts`
- `src/lib/syncBroadcast.ts`
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
cmd /c npm run test -- src/storage/__tests__/eventSync.test.ts src/lib/__tests__/syncStateMachine.test.ts src/lib/__tests__/syncGapDetector.test.ts src/storage/__tests__/deletionTracker.test.ts src/lib/__tests__/offlineQueueHandlers.test.ts
cmd /c npm run check:supabase-migration-prefixes
```

When UI or route behavior is involved, also run a production-browser smoke for
the affected route. When the change is intended for public users, verify remote
deployment with:

```bash
cmd /c npm run ci:remote:wait
```

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

- `setting` is accepted by the server event schema, but the current client
  apply path still needs complete first-class coverage.
- `deletionTracker` is capped at 5000 ids and should be replaced or backed by
  durable ordered delete events for long-term permanence.
- Multi-tab sync coordination exists for auth refresh, but data sync ownership
  needs stronger leader/queue semantics for Telegram-grade behavior.
