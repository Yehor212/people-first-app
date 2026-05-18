# Telegram-Grade Sync 100 Percent Closure Contract

Purpose: define exactly what "sync is 100 percent done" means for ZenFlow, so
future agents cannot leave hidden tails, overclaim partial evidence, or regress
V1/V2/account/cross-platform convergence.

This document is the closure map for:

- user account sync;
- V1 and V2 shared state;
- web, PWA, Android WebView, iOS/WKWebView, desktop, phone, sidebar, drawer;
- online, offline, resume, multi-tab, and public GitHub Pages behavior;
- Supabase event-log, tombstone, offline queue, and Broadcast wake-up paths.

Read this after:

1. `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`
2. `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`
3. `docs/ai/SYNC_CONTRACT.md`
4. `docs/ai/CANONICAL_ORB_INVARIANT.md` when visuals or orbs are adjacent

## What 100 Percent Means

100 percent is a proof state, not an intention.

ZenFlow sync is closed only when the latest user action converges to the same
durable state across every applicable shell and platform after sync settles, and
every required proof artifact is current.

If a proof path is unavailable because credentials, native hardware, or public
deploy access is missing, the result is `UNVERIFIED`, not `PASS`. The remaining
work must be named here or in the final report. Do not turn `UNVERIFIED` into
product confidence.

## Source-Backed Model

ZenFlow does not copy Telegram code. It adopts the same reliability shape:

- Telegram update handling uses local sequence state such as `seq`, `pts`, and
  `qts` to avoid missed, duplicate, or out-of-order updates.
- Telegram gap recovery uses `updates.getDifference` when sequence state shows
  missing data.
- TDLib is cross-platform, owns local data storage, and guarantees ordered
  update delivery to clients.
- Telegram Android stores update cursors such as `seq`, `pts`, and `qts` in a
  local SQLite `params` table and uses a dedicated storage queue plus WAL.
- Supabase Broadcast is a low-latency message channel. In ZenFlow it is only a
  wake-up signal; durable ordering comes from `sync_events.seq`.
- Chrome Long Animation Frames and Core Web Vitals are evidence tools for
  responsiveness; static review cannot prove "does not lag".

Primary references:

- https://core.telegram.org/api/updates
- https://core.telegram.org/method/updates.getDifference
- https://core.telegram.org/tdlib
- https://github.com/tdlib/td/blob/master/td/telegram/UpdatesManager.h
- https://github.com/tdlib/td/blob/master/td/telegram/UpdatesManager.cpp
- https://github.com/DrKLO/Telegram/blob/master/TMessagesProj/src/main/java/org/telegram/messenger/MessagesStorage.java
- https://supabase.com/docs/guides/realtime/broadcast
- https://developer.chrome.com/docs/web-platform/long-animation-frames
- https://web.dev/articles/vitals

## Non-Negotiable Closure Invariants

### 1. Ordered Event Log Owns Cross-Device Truth

`sync_events.seq` is the only cross-device ordering primitive.

Required:

- every user-state mutation writes, maps to, or queues a durable sync event;
- every remote consumer applies events through `applyDelta()` or a tested wrapper;
- local cursor state is saved only after apply succeeds;
- snapshots and backups can bootstrap or repair, but cannot beat newer events;
- BroadcastChannel and Supabase Broadcast wake clients only.

Forbidden:

- treating a snapshot fetch as convergence proof;
- advancing a cursor before IndexedDB apply succeeds;
- allowing a V1/V2 route to skip `useTelegramGradeSyncRuntime()`;
- resolving a critical domain action before its event or outbox intent is durable.

### 2. Latest User Action Wins

The user's latest durable action wins across:

- route changes;
- tab switches;
- browser reload;
- V1 to V2 to V1 navigation;
- desktop to phone layout changes;
- offline queue replay;
- public deploy reload after service worker update;
- Android/iOS pause and resume.

If two writes conflict, ordering is determined by durable event order and
domain-level timestamps only where the sync contract explicitly allows it.

### 3. Deletes Cannot Resurrect

Deletes must be durable actions, not local UI removals.

Required:

- delete event in `sync_events`;
- server tombstone in `sync_tombstones`;
- local tombstone in `deletionTracker` for immediate/offline protection;
- stale IndexedDB hydration, stale backup, stale snapshot, and delayed remote
  pull must not re-create the deleted entity;
- V1 and V2 both observe the deletion after sync settles.

### 4. One Sync Owner Applies Deltas

Multiple tabs are a supported platform.

Required:

- delta pull/apply work goes through `runWithSyncLeaderLock()`;
- Web Locks is preferred where available;
- local lease fallback covers WebView/WKWebView contexts;
- Broadcast, visibility, online, native resume, auth changes, and intervals may
  wake sync but must not bypass the owner lock.
- public/debug diagnostics may expose `window.__zenflowSyncHealth.snapshot()`
  for queue, cursor, and receipt state, but diagnostics must never apply deltas
  or become another owner.

### 5. Offline Queue Is Durable Before Success

Offline or transient-failure actions must be persisted before the UI or caller
claims sync safety.

Required:

- critical `WRITE_SYNC_EVENT` outbox for domain write success plus event-write
  failure;
- IndexedDB persistence, with fallback storage only when IndexedDB is unavailable;
- idempotent retry using UUID-compatible `sync_events.idempotency_key`;
- validation before replay;
- priority processing for critical event-log repairs.

### 6. Account Boundary Is Never Mixed

All synced rows, events, tombstones, and storage records are scoped to the
authenticated user.

Required:

- Supabase RLS protects public tables exposed through the Data API;
- no `service_role` or secret key in client code;
- no authorization based on user-editable metadata;
- logout or account switch cannot replay the previous user's queue into the
  next account;
- local caches that contain user data are namespaced or cleared on account
  boundary changes.

### 7. Media And Large Payloads Do Not Block Sync

Journal media and future large payloads must not freeze the app or break
ordered metadata convergence.

Required:

- metadata has an ordered sync path;
- binary media storage has retry/status evidence;
- failed embeddings or enrichment jobs do not block the durable journal event;
- exports/imports are chunked or deferred and cannot overwrite newer event-log
  state.

### 8. Runtime Responsiveness Is Part Of Sync

Telegram-grade sync is not done if it makes the app lag.

Required:

- sync bootstraps after first useful paint unless the visible route requires it;
- long pulls, imports, exports, and local merges yield or chunk;
- Chrome route smoke covers cold boot and steady state;
- no sync path creates a route long task over the project fail budget;
- public-user lag claims need public URL proof.

### 9. Canonical Orbs Stay Frozen

Sync/performance work may touch route lifecycle near orb screens, but it must
not change the canonical visual system.

Required:

- full surfaces use `ValenceOrb`;
- mini/portal/sidebar/drawer/diary surfaces use `MiniValenceOrb`;
- `npm run check:canonical-orbs` remains green;
- any performance optimization must preserve WebGL-first canonical visuals.

## Entity Coverage Matrix

Every row below must have event write, event apply, offline behavior where
applicable, delete behavior where applicable, and V1/V2 convergence proof.

| Entity | Event type | Durable table/storage | Delete proof | V1/V2 proof | Account proof |
| --- | --- | --- | --- | --- | --- |
| Mood | `mood` | `mood_entries` + IndexedDB | Required | Required | Required |
| Habit | `habit` | `habits` + completions + IndexedDB | Required | Required | Required |
| Habit completion | `habit_completion` | completion rows + IndexedDB | Required when removable | Required | Required |
| Focus | `focus` | focus sessions + IndexedDB | Required when removable | Required | Required |
| Gratitude | `gratitude` | gratitude rows + IndexedDB | Required | Required | Required |
| Journal | `journal` | journal rows + IndexedDB | Required | Required | Required |
| Journal media metadata | domain table | photo/audio metadata + Storage pointer | Required when removable | Required if surfaced | Required |
| Settings | `setting` | settings table + IndexedDB | Not applicable unless clearing | Required | Required |
| Backup/import | recovery path | backup payload | Must not resurrect | Required when invoked | Required |

If a new synced entity is added, update this table, `src/storage/eventSync.ts`,
`src/storage/sync/*`, Supabase types/migrations, tests, and
`scripts/check-sync-contract.cjs` in the same change.

## Platform Closure Matrix

| Platform/surface | Required closure proof |
| --- | --- |
| V1 web shell | Runtime hook mounted, changed entity round-trip proof, no stale snapshot overwrite |
| V2 direct routes | Runtime hook mounted for `/orb`, `/habits`, `/diary`, `/settings`, round-trip proof |
| GitHub Pages/PWA | Cache-busted public URL, service worker stale-cache check, deployed commit evidence |
| Desktop wide | Sidebar parity, canonical mini-orbs, long-task budget, same sync state |
| Phone layout | Bottom nav/drawer parity, safe scroll, same sync state, canonical full/mini orbs |
| Multi-tab browser | One delta owner, broadcast wake-up, latest action converges in both tabs |
| Offline browser | Queue persists, replays, deduplicates, and does not resurrect deletes |
| Android WebView | Build/sync proof or explicit `UNVERIFIED`, pause/resume sync, back behavior |
| iOS/WKWebView | Simulator/device proof or explicit `UNVERIFIED`, foreground sync, no duplicate work |
| Account switch/logout | Previous account data cannot leak or replay into the next account |

## Required PASS Evidence

The word `PASS` is allowed only when the evidence below exists for the touched
scope.

### Static Contract Evidence

Run:

```bash
cmd /c npm run check:sync-contract
cmd /c npm run check:canonical-orbs
cmd /c npm run check:supabase-migration-prefixes
```

### Code Health Evidence

Run:

```bash
cmd /c npm run typecheck
cmd /c npm run lint
```

For release claims, add:

```bash
cmd /c npm run check:all
```

### Sync Behavior Evidence

Run or manually prove, depending on scope:

```bash
cmd /c npm run test -- src/storage/__tests__/eventSync.test.ts src/storage/__tests__/initialDeltaSync.test.ts src/lib/__tests__/syncGapDetector.test.ts src/lib/__tests__/syncLeader.test.ts src/lib/__tests__/offlineQueueHandlers.test.ts src/storage/sync/__tests__/serverTombstones.test.ts
cmd /c npm run smoke:sync-account
```

`smoke:sync-account` requires `ZENFLOW_SYNC_TEST_EMAIL` and
`ZENFLOW_SYNC_TEST_PASSWORD`. Without credentials, account-level live sync is
`UNVERIFIED`.

For public/debug investigations, enable `?syncHealth=1`, `?syncDebug=true`,
`?runtimeSync=on`, or local key `zenflow-sync-health-recorder`, then
inspect `window.__zenflowSyncHealth.snapshot()`. The snapshot may contain route,
online/auth state, queue counts, last applied cursor, and coarse receipts only.
It must not contain payloads, entity ids, journal text, habit names, or other
user content, and it cannot by itself upgrade live same-account sync from
`UNVERIFIED` to `PASS`.
Run `cmd /c npm run smoke:sync-health` for repeatable browser proof that the
debug recorder exists, tracks route changes, captures coarse receipts, and
stays privacy-safe. For deployed proof, set `ZENFLOW_SYNC_HEALTH_URL` to the
GitHub Pages URL with a cache-buster.

### Runtime Evidence

Run:

```bash
cmd /c npm run smoke:chrome-performance
```

For public-user claims:

```bash
cmd /c npm run ci:remote:wait
```

Then open the GitHub Pages URL with a cache-buster and confirm the public
artifact reflects the target commit.

### Manual Cross-Platform Evidence

For each touched entity:

1. Create/update/delete in source shell.
2. Navigate to the adjacent shell.
3. Reload.
4. Open another tab if browser sync is relevant.
5. Toggle offline/online if offline behavior is relevant.
6. Confirm the latest action wins and deletes do not resurrect.
7. Capture route, viewport, account, and result.

## Stop Conditions

Stop and report `UNVERIFIED` or `FAIL` instead of continuing if:

- Supabase credentials for live account proof are missing;
- native proof is required but no simulator/device/build path is available;
- service worker/public deploy state cannot be inspected for a public URL claim;
- `check:sync-contract` fails;
- a new event type has no apply path;
- an account boundary can replay another user's queued action;
- any delete path can resurrect from backup, IndexedDB, or delayed delta;
- an optimization changes canonical orb visuals;
- a route performance claim has no metric.

## Implementation Checklist For Future Sync Work

Use this checklist before editing sync, storage, auth, queue, or shell code.

- [ ] Runtime contract read.
- [ ] Sync contract read.
- [ ] This closure contract read.
- [ ] Canonical orb invariant read when the route is visually adjacent to orbs.
- [ ] Affected entities listed.
- [ ] V1/V2 surfaces listed.
- [ ] Account boundary impact listed.
- [ ] Offline/resume/multi-tab impact listed.
- [ ] Supabase migration/RLS impact listed.
- [ ] Tests or browser smoke selected before implementation.
- [ ] Rollback path named.

Use this checklist before claiming completion.

- [ ] `check:sync-contract` evidence captured.
- [ ] `check:canonical-orbs` evidence captured when visual primitives are adjacent.
- [ ] Typecheck/lint evidence captured.
- [ ] Targeted sync tests evidence captured.
- [ ] `window.__zenflowSyncHealth` public/debug snapshot captured when diagnosing
      deployed sync behavior.
- [ ] Live account proof captured or marked `UNVERIFIED`.
- [ ] Public deploy proof captured when the user reported a public URL.
- [ ] Platform matrix rows either proved or explicitly marked `UNVERIFIED`.
- [ ] No protected docs were edited.

## Documentation Ownership

This document is the closure source of truth. Related documents must point here
instead of redefining 100 percent completion:

- `docs/ai/SYNC_CONTRACT.md` owns detailed sync invariants.
- `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md` owns runtime/performance and
  cross-platform evidence rules.
- `docs/DEFINITION_OF_DONE.md` owns release gates.
- `docs/RELEASE_CHECKLIST.md` owns release-time manual checks.
- `scripts/check-sync-contract.cjs` owns mechanical drift detection.

If any future work changes sync semantics, update this document and the guard in
the same commit.
