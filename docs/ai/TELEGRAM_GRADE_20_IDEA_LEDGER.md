# Telegram-Grade 20 Idea Ledger

Purpose: turn the 20 Telegram-inspired sync and runtime ideas into a durable
project ledger. This file is not a brainstorm. It is the control map future
agents must use before claiming that sync, runtime, account continuity, or
cross-platform behavior is complete.

Read this after:

1. `docs/ai/TASK_COMPLETION_PROTOCOL.md`
2. `docs/ai/SYNC_CONTRACT.md`
3. `docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md`
4. `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`
5. `docs/ai/CANONICAL_ORB_INVARIANT.md` when visuals or orbs are nearby

## Completion Rule

The 20 ideas are complete only when each applicable row has current evidence in
the Done Packet. A row may be `PASS`, `PARTIAL`, `UNVERIFIED`, `FAIL`, or
`WAIVED` using the vocabulary from `TASK_COMPLETION_PROTOCOL.md`.

Do not describe the project as "100 percent Telegram-grade" when any release
critical row is `PARTIAL` or `UNVERIFIED`. In particular, same-account live sync
requires a dedicated Supabase test account and the GitHub secret names checked by
`npm run check:github-sync-secrets`.

## The 20 Ideas As Product Controls

| # | Idea | What it now does for ZenFlow | Evidence hook |
| --- | --- | --- | --- |
| 1 | Sync Inbox | Gives users and agents one privacy-safe place to see sync status, pending local actions, retries, and recent coarse receipts. It prevents silent "maybe synced" states. | `SyncHealthCard`, `window.__zenflowSyncHealth`, `smoke:sync-health` |
| 2 | Gap Recovery Dashboard | Makes missed or out-of-order sync visible as a recovery state instead of hiding it behind stale snapshots. | `SyncGapDetector`, delta receipts, `check:sync-contract` |
| 3 | Device Sessions | Shows which coarse device surfaces participate in account sync, with current-device and last-seen status. It is presence, not raw fingerprinting. | `device_sessions`, `useDeviceSessionRuntime`, RLS/migration proof |
| 4 | Action Receipts | Gives every important user action a coarse status: queued, processed, failed, delta-applied, gap-recovered, or leader-skipped. | `SYNC_HEALTH_RECEIPT_EVENT`, Sync Inbox UI |
| 5 | Offline Outbox UX | Keeps offline work instant while making queued work visible and retryable without exposing private content. | `offlineQueue`, `WRITE_SYNC_EVENT`, Sync Inbox retry |
| 6 | Snapshot Plus Delta Recovery | Lets a new or stale client bootstrap from snapshot, then apply ordered event deltas without letting old snapshots beat newer actions. | `initialDeltaSync`, `applyDelta`, `eventSync` tests |
| 7 | Per-Domain Sync Ownership | Keeps moods, habits, journal, focus, gratitude, and settings on shared ordered transport while preserving domain-specific apply contracts. | `src/storage/sync/*`, `ENTITY_TABLE_MAP`, targeted sync tests |
| 8 | Cross-Platform Resume Protocol | Wakes sync consistently on visibility, online, focus/resume, auth, and app-active events across web/PWA/WebView surfaces. | `useTelegramGradeSyncRuntime`, `main.tsx`, platform matrix |
| 9 | Performance Flight Recorder | Captures route/runtime evidence for lag without collecting journal text, habit names, payloads, or entity ids. | `runtimeFlightRecorder`, `smoke:chrome-performance` |
| 10 | Adaptive Runtime Without Visual Regression | Allows performance work around heavy layers while forbidding canonical orb substitution or visual downgrades. | `check:canonical-orbs`, visual screenshots/traces |
| 11 | Telegram-Style Local DB Discipline | Keeps durable IndexedDB/Dexie work out of input/render paths where possible, and saves cursors only after apply succeeds. | `applyDelta` transaction guard, queue persistence tests |
| 12 | Fast Shell, Deferred Heavy Modules | Shows the useful app shell first, then defers heavy or diagnostic work so startup does not freeze the user. | runtime contract, performance smoke, route evidence |
| 13 | Conflict UX For Diary | Requires future cross-device journal conflicts to be explicit instead of silently overwriting user text. | sync closure matrix; currently not a PASS unless conflict proof is attached |
| 14 | Anti-Resurrection Matrix | Makes delete proof mandatory across V1/V2, offline, backup, stale IndexedDB, delayed pull, and public deploy. | `sync_tombstones`, `deletionTracker`, targeted delete tests |
| 15 | Sync-Aware Notifications | Prevents reminders from acting on stale state when another surface already completed the action. | notification changes must cite sync contract and entity proof |
| 16 | Draft Everywhere | Treats drafts as account-aware user state when they cross devices or shells, not as disposable local-only state. | draft changes must cite account boundary proof |
| 17 | Command Queue For User Actions | Turns critical user mutations into operation/idempotency-key work that can be retried safely after failure. | `WRITE_SYNC_EVENT`, `idempotency_key`, offline queue handlers |
| 18 | Public Deploy Proof Mode | Makes public debugging prove commit/build/runtime/sync state instead of relying on local preview. | cache-busted GitHub Pages URL, sync-health route proof |
| 19 | Service Worker Safety Layer | Requires stale-cache and new-deploy behavior to be checked before public claims. | release checklist, public URL cache-buster, SW notes |
| 20 | Telegram Sync Drill Release Gate | Bundles local invariants, browser sync-health, canonical orb guard, migration prefixes, and same-account proof into one release artifact. | `smoke:telegram-sync-drill`, GitHub Actions artifact |

## Release-Critical Rows

For a normal sync or runtime release, these rows must be `PASS` or explicitly
`WAIVED` by the user:

- 1 Sync Inbox
- 2 Gap Recovery Dashboard
- 4 Action Receipts
- 5 Offline Outbox UX
- 6 Snapshot Plus Delta Recovery
- 8 Cross-Platform Resume Protocol for every applicable platform
- 10 Adaptive Runtime Without Visual Regression
- 14 Anti-Resurrection Matrix when deletes are touched
- 17 Command Queue For User Actions
- 18 Public Deploy Proof Mode for public-user claims
- 20 Telegram Sync Drill Release Gate

Rows 3, 13, 15, 16, and 19 are release-critical when the task touches account
devices, journal conflicts, notifications, drafts, or service workers.

## Known Non-PASS Conditions

These are not failures by themselves, but they block 100 percent claims until
fresh evidence exists:

- Missing `ZENFLOW_SYNC_TEST_EMAIL` or `ZENFLOW_SYNC_TEST_PASSWORD` GitHub
  secrets means same-account live sync remains `UNVERIFIED`. Use
  `npm run setup:sync-test-account` from a trusted admin shell with a
  server-only Supabase service-role key to provision the dedicated smoke account
  and GitHub secret names.
- Missing iOS project or WKWebView run evidence means iOS remains
  `UNVERIFIED`.
- Browser-only proof does not prove Android WebView, iOS/WKWebView, or store
  builds.
- `window.__zenflowSyncHealth` proves diagnostic health only. It does not prove
  same-account convergence without `smoke:sync-account`.
- Canonical orb visual proof must come from `ValenceOrb` and `MiniValenceOrb`,
  not substitute renderers.

## Done Packet Addendum

For sync/runtime tasks, include this section in the Done Packet:

```text
20-Idea Ledger:
| Idea rows touched | Status | Evidence |
| --- | --- | --- |
| #1 Sync Inbox | PASS/PARTIAL/UNVERIFIED/FAIL/WAIVED | command, URL, test, screenshot |
| #20 Telegram Sync Drill | PASS/PARTIAL/UNVERIFIED/FAIL/WAIVED | local command + GitHub artifact |

Rows not applicable:
- #:

Rows still blocked:
- #:
```

If any touched row is `PARTIAL` or `UNVERIFIED`, say exactly what is missing and
do not summarize the task as fully complete.
